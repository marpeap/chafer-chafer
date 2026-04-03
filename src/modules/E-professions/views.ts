import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { baseEmbed, Colors, Emoji, truncate } from '../../views/base.js';
import type { ProfessionProfile, CraftRequest } from '@prisma/client';

// ────────────────── Profession list (user's professions) ──────────────────

export function buildProfessionListEmbed(
  profiles: ProfessionProfile[],
  username: string,
): EmbedBuilder {
  if (profiles.length === 0) {
    return baseEmbed(`${Emoji.HAMMER} Mes métiers`, Colors.CRAFT)
      .setDescription('Tu n\'as aucun métier enregistré.\nUtilise `/metier inscrire` pour en ajouter.');
  }

  const lines = profiles.map((p) => {
    const status = p.available ? Emoji.CHECK : Emoji.UNAVAILABLE;
    const note = p.note ? ` — _${p.note}_` : '';
    return `${status} **${p.profession}** — Niv. ${p.level}${note}`;
  });

  return baseEmbed(`${Emoji.HAMMER} Métiers de ${username}`, Colors.CRAFT)
    .setDescription(truncate(lines.join('\n'), 4000));
}

// ────────────────── Crafter search results ──────────────────

/** @deprecated Use buildCrafterAvailableEmbed / buildCrafterUnavailableEmbed instead */
export function buildCrafterSearchEmbed(
  crafters: (ProfessionProfile & { userId: string })[],
  profession: string,
): EmbedBuilder {
  if (crafters.length === 0) {
    return baseEmbed(`${Emoji.SEARCH} ${profession}`, Colors.CRAFT)
      .setDescription(`Aucun artisan disponible pour **${profession}**.`);
  }

  const lines = crafters.map((c) => {
    const status = c.available ? Emoji.CHECK : Emoji.UNAVAILABLE;
    const note = c.note ? ` — _${c.note}_` : '';
    return `${status} <@${c.userId}> — Niv. ${c.level}${note}`;
  });

  return baseEmbed(`${Emoji.SEARCH} Artisans — ${profession}`, Colors.CRAFT)
    .setDescription(truncate(lines.join('\n'), 4000))
    .addFields({ name: 'Résultats', value: `${crafters.length} artisan(s) trouvé(s)`, inline: true });
}

// ────────────────── Smart search: available crafters (GREEN) ──────────────────

export function buildCrafterAvailableEmbed(
  crafters: { userId: string; level: number; note?: string | null }[],
  profession: string,
): EmbedBuilder {
  const lines = crafters.map((c) => {
    const note = c.note ? ` — _${c.note}_` : '';
    return `${Emoji.CHECK} <@${c.userId}> — Niv. ${c.level}${note}`;
  });

  return baseEmbed(`${Emoji.HAMMER} Artisans disponibles — ${profession}`, Colors.SUCCESS)
    .setDescription(truncate(lines.join('\n'), 4000))
    .addFields({ name: 'Résultats', value: `${crafters.length} artisan(s) disponible(s)`, inline: true });
}

// ────────────────── Smart search: no available crafters (ORANGE) ──────────────────

export function buildCrafterUnavailableEmbed(
  crafters: { userId: string; level: number; note?: string | null }[],
  profession: string,
): EmbedBuilder {
  if (crafters.length === 0) {
    return baseEmbed(`${Emoji.SEARCH} ${profession}`, Colors.WARNING)
      .setDescription(`Aucun artisan inscrit pour **${profession}**.`);
  }

  const lines = crafters.map((c) => {
    const note = c.note ? ` — _${c.note}_` : '';
    return `${Emoji.UNAVAILABLE} <@${c.userId}> — Niv. ${c.level}${note}`;
  });

  return baseEmbed(`${Emoji.HAMMER} Aucun artisan disponible — ${profession}`, Colors.WARNING)
    .setDescription(
      `Personne n'est disponible actuellement. Voici la liste des artisans :\n\n${truncate(lines.join('\n'), 3900)}`,
    )
    .addFields({ name: 'Résultats', value: `${crafters.length} artisan(s) inscrit(s)`, inline: true });
}

// ────────────────── Craft request card ──────────────────

const STATUS_LABELS: Record<string, string> = {
  open: `${Emoji.CLOCK} Ouverte`,
  taken: `${Emoji.HAMMER} En cours`,
  completed: `${Emoji.CHECK} Terminée`,
  cancelled: `${Emoji.CROSS} Annulée`,
};

export function buildCraftRequestEmbed(request: CraftRequest): EmbedBuilder {
  const statusLabel = STATUS_LABELS[request.status] ?? request.status;

  // Build item display: link to encyclopedia if ankama_id is available
  const itemDisplay = request.itemAnkamaId
    ? `${request.quantity}x [${request.itemName}](https://www.dofusdu.de/fr/item/${request.itemAnkamaId})`
    : `${request.quantity}x ${request.itemName}`;

  const embed = baseEmbed(`${Emoji.HAMMER} Demande de craft #${request.id}`, Colors.CRAFT)
    .addFields(
      { name: 'Métier', value: request.profession, inline: true },
      { name: 'Objet', value: itemDisplay, inline: true },
      { name: 'Statut', value: statusLabel, inline: true },
      { name: 'Demandeur', value: `<@${request.requesterId}>`, inline: true },
    );

  // Show item thumbnail from encyclopedia if available
  if (request.itemImageUrl) {
    embed.setThumbnail(request.itemImageUrl);
  }

  if (request.crafterId) {
    embed.addFields({ name: 'Artisan', value: `<@${request.crafterId}>`, inline: true });
  }

  if (request.description) {
    embed.addFields({ name: 'Description', value: truncate(request.description, 1024) });
  }

  return embed;
}

export function buildCraftRequestRow(request: CraftRequest): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (request.status === 'open') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`craft:prendre:${request.id}`)
        .setLabel('Prendre la demande')
        .setStyle(ButtonStyle.Success)
        .setEmoji(Emoji.HAMMER),
      new ButtonBuilder()
        .setCustomId(`craft:annuler:${request.id}`)
        .setLabel('Annuler')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(Emoji.CROSS),
    );
  } else if (request.status === 'taken') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`craft:cloturer:${request.id}`)
        .setLabel('Marquer comme terminé')
        .setStyle(ButtonStyle.Success)
        .setEmoji(Emoji.CHECK),
      new ButtonBuilder()
        .setCustomId(`craft:annuler:${request.id}`)
        .setLabel('Annuler')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(Emoji.CROSS),
    );
  }

  return row;
}
