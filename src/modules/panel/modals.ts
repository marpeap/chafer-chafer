import { ModalSubmitInteraction } from 'discord.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed, successEmbed } from '../../views/base.js';
import { resolveMember } from '../../core/resolve-member.js';

// Reuse existing module logic
import * as dofusdude from '../../integrations/dofusdude/client.js';
import * as almanaxApi from '../../integrations/almanax/client.js';
import { buildItemEmbed, buildSearchResultsEmbed } from '../C-encyclopedia/views.js';
import { resolveRecipeNames } from '../C-encyclopedia/commands.js';
import { buildAlmanaxEmbed } from '../D-almanax/views.js';
import { buildCrafterAvailableEmbed, buildCrafterUnavailableEmbed } from '../E-professions/views.js';
import { db } from '../../core/database.js';

const log = childLogger('panel:modals');

export async function handlePanelModal(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  switch (customId) {
    case 'panel:modal_dofus_chercher':
      return handleDofusChercher(interaction);
    case 'panel:modal_metier_chercher':
      return handleMetierChercher(interaction);
    case 'panel:modal_almanax_bonus':
      return handleAlmanaxBonus(interaction);
    case 'panel:modal_donjon_fait':
      return handleDonjonFaitModal(interaction);
    case 'panel:modal_donjon_guilde':
      return handleDonjonGuildeModal(interaction);
    case 'panel:modal_xp_perso':
      return handleXpPersoModal(interaction);
    case 'panel:modal_xp_metier':
      return handleXpMetierModal(interaction);
    case 'panel:modal_chasse':
      return handleChasseModal(interaction);
    case 'panel:modal_almanax_date':
      return handleAlmanaxDateModal(interaction);
    case 'panel:modal_almanax_alerte':
      return handleAlmanaxAlerteModal(interaction);
    case 'panel:modal_admin_profil':
      return handleAdminProfilModal(interaction);
    case 'panel:modal_admin_note':
      return handleAdminNoteModal(interaction);
    case 'panel:modal_admin_warn':
      return handleAdminWarnModal(interaction);
    default:
      log.warn({ customId }, 'Unknown panel modal');
  }
}

async function handleDofusChercher(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const query = interaction.fields.getTextInputValue('query').trim();
  if (!query) {
    await interaction.editReply({ embeds: [errorEmbed('Requête vide.')] });
    return;
  }

  try {
    const { data: results, stale } = await dofusdude.searchGlobal(query, 8);

    if (!results || results.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed(`Aucun résultat pour « ${query} ».`)],
      });
      return;
    }

    // If single result, fetch full details
    if (results.length === 1) {
      try {
        const { data: item, stale: itemStale } = await dofusdude.getEquipment(results[0].ankama_id);
        const recipeNames = await resolveRecipeNames(item.recipe);
        const embed = buildItemEmbed(item, itemStale, recipeNames);
        await interaction.editReply({ embeds: [embed] });
        return;
      } catch {
        // Fall through to search results
      }
    }

    const embed = buildSearchResultsEmbed(results, query);
    if (stale) {
      embed.setFooter({ text: '⚠️ Données potentiellement anciennes (cache) | Chafer Chafer' });
    }
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err, query }, 'Dofus search error');
    await interaction.editReply({
      embeds: [errorEmbed('Erreur lors de la recherche. L\'API est peut-être indisponible.')],
    });
  }
}

async function handleMetierChercher(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply();

  const profession = interaction.fields.getTextInputValue('profession').trim();
  if (!profession) {
    await interaction.editReply({ embeds: [errorEmbed('Métier vide.')] });
    return;
  }

  const guildId = interaction.guildId!;

  // 1. Find ALL crafters with this profession (fuzzy match)
  const allCrafters = await db().professionProfile.findMany({
    where: {
      guildId,
      profession: { contains: profession, mode: 'insensitive' },
    },
    orderBy: { level: 'desc' },
  });

  // 2. Find "Glandeur Dispo" players who listed this profession
  const glandeurs = await db().playerProfile.findMany({
    where: {
      guildId,
      status: 'approved',
      globalAvailable: true,
      professions200: { contains: profession, mode: 'insensitive' },
    },
  });

  // 3. Build set of available user IDs
  const availableUserIds = new Set<string>();
  for (const c of allCrafters) {
    if (c.available) availableUserIds.add(c.userId);
  }
  for (const g of glandeurs) {
    availableUserIds.add(g.userId);
  }

  // 4. Split into available vs unavailable
  const availableProfiles = allCrafters.filter((c) => availableUserIds.has(c.userId));

  // Include glandeurs without a ProfessionProfile entry (level 200 assumed)
  const existingUserIds = new Set(allCrafters.map((c) => c.userId));
  for (const g of glandeurs) {
    if (!existingUserIds.has(g.userId)) {
      availableProfiles.push({
        userId: g.userId,
        level: 200,
        note: 'Glandeur Dispo',
      } as typeof allCrafters[number]);
    }
  }

  if (availableProfiles.length > 0) {
    // Case 1: Available crafters found — GREEN embed + ping in content
    const mentions = availableProfiles.map((p) => `<@${p.userId}>`).join(' ');
    const embed = buildCrafterAvailableEmbed(availableProfiles, profession);
    await interaction.editReply({
      content: `${mentions} — on cherche un **${profession}** !`,
      embeds: [embed],
    });
  } else {
    // Case 2: No available crafters — ORANGE embed, no ping
    const embed = buildCrafterUnavailableEmbed(allCrafters, profession);
    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleAlmanaxBonus(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const bonusType = interaction.fields.getTextInputValue('bonus_type').trim();
  if (!bonusType) {
    await interaction.editReply({ embeds: [errorEmbed('Type de bonus vide.')] });
    return;
  }

  try {
    const { data, stale } = await almanaxApi.getNextBonus(bonusType);

    if (!data) {
      await interaction.editReply({
        embeds: [errorEmbed(`Aucun bonus « ${bonusType} » trouvé dans les 60 prochains jours.`)],
      });
      return;
    }

    const embed = buildAlmanaxEmbed(data, stale);
    embed.setTitle(`📅 Prochain bonus : ${bonusType}`);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err, bonusType }, 'Almanax bonus search error');
    await interaction.editReply({
      embeds: [errorEmbed('Erreur lors de la recherche.')],
    });
  }
}

// ══════════════════════════════════
//  OUTILS MODAL HANDLERS
// ══════════════════════════════════

async function handleDonjonFaitModal(interaction: ModalSubmitInteraction): Promise<void> {
  const nom = interaction.fields.getTextInputValue('nom').trim();
  if (!nom) {
    await interaction.reply({ embeds: [errorEmbed('Nom du donjon vide.')], ephemeral: true });
    return;
  }

  try {
    const { DUNGEONS } = await import('../J-dungeons/data.js');
    const dungeon = DUNGEONS.find((d: { name: string }) => d.name.toLowerCase() === nom.toLowerCase());
    if (!dungeon) {
      await interaction.reply({
        embeds: [errorEmbed(`Donjon inconnu : \`${nom}\`. Vérifie l'orthographe ou utilise \`/donjon fait\` avec l'autocomplétion.`)],
        ephemeral: true,
      });
      return;
    }

    await db().dungeonProgress.upsert({
      where: { guildId_userId_dungeonName: { guildId: interaction.guildId!, userId: interaction.user.id, dungeonName: dungeon.name } },
      create: { guildId: interaction.guildId!, userId: interaction.user.id, dungeonName: dungeon.name },
      update: { completedAt: new Date() },
    });

    await interaction.reply({
      embeds: [successEmbed(`Donjon **${dungeon.name}** marqué comme complété !`)],
      ephemeral: true,
    });
  } catch (err) {
    log.error({ err }, 'handleDonjonFaitModal error');
    await interaction.reply({ embeds: [errorEmbed('Erreur lors de l\'enregistrement.')], ephemeral: true }).catch(() => {});
  }
}

async function handleDonjonGuildeModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const nom = interaction.fields.getTextInputValue('nom').trim();
  if (!nom) {
    await interaction.editReply({ embeds: [errorEmbed('Nom du donjon vide.')] });
    return;
  }

  try {
    const { DUNGEONS } = await import('../J-dungeons/data.js');
    const { buildDungeonGuildEmbed } = await import('../J-dungeons/views.js');
    const dungeon = DUNGEONS.find((d: { name: string }) => d.name.toLowerCase() === nom.toLowerCase());
    if (!dungeon) {
      await interaction.editReply({ embeds: [errorEmbed(`Donjon inconnu : \`${nom}\`.`)] });
      return;
    }

    const completions = await db().dungeonProgress.findMany({
      where: { guildId: interaction.guildId!, dungeonName: dungeon.name },
      select: { userId: true },
    });
    const embed = buildDungeonGuildEmbed(dungeon, completions.map((c: { userId: string }) => c.userId));
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'handleDonjonGuildeModal error');
    await interaction.editReply({ embeds: [errorEmbed('Erreur lors de la recherche.')] });
  }
}

async function handleXpPersoModal(interaction: ModalSubmitInteraction): Promise<void> {
  const actuel = parseInt(interaction.fields.getTextInputValue('actuel'), 10);
  const cible = parseInt(interaction.fields.getTextInputValue('cible'), 10);

  if (isNaN(actuel) || isNaN(cible) || actuel < 1 || actuel > 200 || cible < 1 || cible > 200) {
    await interaction.reply({ embeds: [errorEmbed('Les niveaux doivent être entre 1 et 200.')], ephemeral: true });
    return;
  }
  if (cible <= actuel) {
    await interaction.reply({ embeds: [errorEmbed('Le niveau cible doit être supérieur au niveau actuel.')], ephemeral: true });
    return;
  }

  let total = 0;
  for (let l = actuel + 1; l <= cible; l++) total += Math.floor(Math.pow(l, 2.4) * 10);

  const { buildXpEmbed } = await import('../K-tools/views.js');
  const embed = buildXpEmbed(actuel, cible, total);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleXpMetierModal(interaction: ModalSubmitInteraction): Promise<void> {
  const actuel = parseInt(interaction.fields.getTextInputValue('actuel'), 10);
  const cible = parseInt(interaction.fields.getTextInputValue('cible'), 10);

  if (isNaN(actuel) || isNaN(cible) || actuel < 1 || actuel > 200 || cible < 1 || cible > 200) {
    await interaction.reply({ embeds: [errorEmbed('Les niveaux doivent être entre 1 et 200.')], ephemeral: true });
    return;
  }
  if (cible <= actuel) {
    await interaction.reply({ embeds: [errorEmbed('Le niveau cible doit être supérieur au niveau actuel.')], ephemeral: true });
    return;
  }

  let total = 0;
  for (let l = actuel + 1; l <= cible; l++) total += 10 * l * (l - 1);

  const { buildXpMetierEmbed } = await import('../K-tools/views.js');
  const embed = buildXpMetierEmbed(actuel, cible, total);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleChasseModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const x = parseInt(interaction.fields.getTextInputValue('x'), 10);
  const y = parseInt(interaction.fields.getTextInputValue('y'), 10);
  const dirRaw = interaction.fields.getTextInputValue('direction').trim().toLowerCase();

  if (isNaN(x) || isNaN(y)) {
    await interaction.editReply({ embeds: [errorEmbed('Coordonnées X et Y invalides.')] });
    return;
  }

  const DIRECTION_MAP: Record<string, number> = { haut: 0, bas: 2, droite: 1, gauche: 3 };
  const VALID_DIRS = ['haut', 'bas', 'gauche', 'droite'];
  const dir = VALID_DIRS.find((d) => d.startsWith(dirRaw));
  if (!dir) {
    await interaction.editReply({ embeds: [errorEmbed(`Direction invalide : \`${dirRaw}\`. Valeurs : haut, bas, gauche, droite.`)] });
    return;
  }

  try {
    const response = await fetch(
      `https://dofus-map.com/huntTool/getData.php?x=${x}&y=${y}&direction=${DIRECTION_MAP[dir]}&world=0&language=fr`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (!response.ok) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur lors de la requête à dofus-map.com.')] });
      return;
    }

    const data = await response.json() as import('../K-tools/chasse.js').ChasseResponse;
    const { buildChasseEmbed } = await import('../K-tools/views-chasse.js');
    const embed = buildChasseEmbed(x, y, dir, data);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'handleChasseModal error');
    await interaction.editReply({ embeds: [errorEmbed('Impossible de contacter dofus-map.com.')] });
  }
}

async function handleAlmanaxDateModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const dateStr = interaction.fields.getTextInputValue('date').trim();
  const parsed = new Date(dateStr);

  if (isNaN(parsed.getTime())) {
    await interaction.editReply({ embeds: [errorEmbed('Date invalide. Utilise le format **AAAA-MM-JJ**.')]});
    return;
  }

  try {
    const { data, stale } = await almanaxApi.getDate(parsed);
    const embed = buildAlmanaxEmbed(data, stale);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err, dateStr }, 'handleAlmanaxDateModal error');
    await interaction.editReply({ embeds: [errorEmbed(`Impossible de récupérer l'almanax pour le **${dateStr}**.`)] });
  }
}

async function handleAlmanaxAlerteModal(interaction: ModalSubmitInteraction): Promise<void> {
  const bonusType = interaction.fields.getTextInputValue('bonus_type').trim();
  if (!bonusType) {
    await interaction.reply({ embeds: [errorEmbed('Type de bonus vide.')], ephemeral: true });
    return;
  }

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  try {
    const existing = await db().almanaxAlert.findUnique({
      where: { guildId_userId_bonusType: { guildId, userId, bonusType } },
    });

    if (existing) {
      await db().almanaxAlert.delete({ where: { id: existing.id } });
      await interaction.reply({
        embeds: [successEmbed(`Alerte supprimée pour le bonus **${bonusType}**.`)],
        ephemeral: true,
      });
      return;
    }

    const count = await db().almanaxAlert.count({ where: { guildId, userId } });
    if (count >= 10) {
      await interaction.reply({
        embeds: [errorEmbed('Limite de 10 alertes atteinte. Supprime-en une d\'abord.')],
        ephemeral: true,
      });
      return;
    }

    await db().almanaxAlert.create({ data: { guildId, userId, bonusType } });
    await interaction.reply({
      embeds: [successEmbed(`Alerte activée ! Tu seras mentionné quand le bonus **${bonusType}** sera actif.`)],
      ephemeral: true,
    });
  } catch (err) {
    log.error({ err }, 'handleAlmanaxAlerteModal error');
    await interaction.reply({ embeds: [errorEmbed('Erreur lors de la gestion de l\'alerte.')], ephemeral: true }).catch(() => {});
  }
}

// ══════════════════════════════════
//  ADMIN MODAL HANDLERS
// ══════════════════════════════════

async function handleAdminProfilModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const rawInput = interaction.fields.getTextInputValue('user_id').trim();
  try {
    const { buildProfileEmbed } = await import('../A-members/views.js');

    const member = interaction.guild
      ? await resolveMember(interaction.guild, rawInput)
      : null;
    if (!member) {
      await interaction.editReply({ embeds: [errorEmbed(`Membre introuvable : \`${rawInput}\`. Tape un pseudo exact ou un ID.`)] });
      return;
    }

    const profile = await db().playerProfile.findFirst({
      where: { guildId: interaction.guildId!, userId: member.id },
    });

    if (!profile) {
      await interaction.editReply({ embeds: [errorEmbed(`Aucun profil trouvé pour <@${member.id}>.`)] });
      return;
    }

    const embed = buildProfileEmbed(profile, member);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'handleAdminProfilModal error');
    await interaction.editReply({ embeds: [errorEmbed('Erreur lors de la récupération du profil.')] });
  }
}

async function handleAdminNoteModal(interaction: ModalSubmitInteraction): Promise<void> {
  const rawInput = interaction.fields.getTextInputValue('user_id').trim();
  const texte = interaction.fields.getTextInputValue('texte').trim();

  if (!texte) {
    await interaction.reply({ embeds: [errorEmbed('Texte de la note vide.')], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = interaction.guild
    ? await resolveMember(interaction.guild, rawInput)
    : null;
  if (!member) {
    await interaction.editReply({ embeds: [errorEmbed(`Membre introuvable : \`${rawInput}\`. Tape un pseudo exact ou un ID.`)] });
    return;
  }

  try {
    const { audit } = await import('../../core/audit.js');
    await audit({
      guildId: interaction.guildId!,
      actorId: interaction.user.id,
      action: 'admin.note',
      targetType: 'user',
      targetId: member.id,
      details: { note: texte },
    });

    await interaction.editReply({
      embeds: [successEmbed(`Note ajoutée pour <@${member.id}>.`)],
    });
  } catch (err) {
    log.error({ err }, 'handleAdminNoteModal error');
    await interaction.editReply({ embeds: [errorEmbed('Erreur lors de l\'ajout de la note.')] });
  }
}

async function handleAdminWarnModal(interaction: ModalSubmitInteraction): Promise<void> {
  const rawInput = interaction.fields.getTextInputValue('user_id').trim();
  const raison = interaction.fields.getTextInputValue('raison').trim();

  if (!raison) {
    await interaction.reply({ embeds: [errorEmbed('Raison de l\'avertissement vide.')], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = interaction.guild
    ? await resolveMember(interaction.guild, rawInput)
    : null;
  if (!member) {
    await interaction.editReply({ embeds: [errorEmbed(`Membre introuvable : \`${rawInput}\`. Tape un pseudo exact ou un ID.`)] });
    return;
  }

  try {
    const { audit } = await import('../../core/audit.js');
    await audit({
      guildId: interaction.guildId!,
      actorId: interaction.user.id,
      action: 'admin.warn',
      targetType: 'user',
      targetId: member.id,
      details: { reason: raison },
    });

    // Try to DM the user
    try {
      await member.send(`⚠️ Tu as reçu un avertissement sur le serveur : **${raison}**`);
    } catch {
      // DM failed (user has DMs disabled), that's OK
    }

    await interaction.editReply({
      embeds: [successEmbed(`Avertissement envoyé à <@${member.id}>.\nRaison : ${raison}`)],
    });
  } catch (err) {
    log.error({ err }, 'handleAdminWarnModal error');
    await interaction.editReply({ embeds: [errorEmbed('Erreur lors de l\'avertissement.')] });
  }
}
