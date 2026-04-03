import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
} from 'discord.js';
import { baseEmbed, Colors, Emoji } from '../../views/base.js';

// ══════════════════════════════════════════════════
//  PANNEAU PRINCIPAL — visible par tous les membres
// ══════════════════════════════════════════════════

export function buildMainPanelEmbed(): EmbedBuilder {
  return baseEmbed(`${Emoji.SHIELD} Chafer Chafer`, Colors.PRIMARY)
    .setDescription(
      'Bienvenue ! Clique sur 💀 **Devenir Chafer** pour rejoindre la guilde.\n' +
      'Une fois validé, tous les boutons ci-dessous seront à ta disposition.',
    )
    .addFields(
      {
        name: '💀 Adhésion & Profil',
        value: 'Rejoins la guilde, consulte ton profil et tes récompenses.',
        inline: false,
      },
      {
        name: `${Emoji.SWORD} Activités`,
        value: 'Crée une sortie, cherche un groupe ou consulte l\'agenda.',
        inline: false,
      },
      {
        name: `${Emoji.HAMMER} Métiers & Craft`,
        value: 'Inscris tes métiers, trouve un artisan ou fais une demande de craft.',
        inline: false,
      },
      {
        name: `${Emoji.BOOK} Outils & Infos`,
        value: 'Almanax, encyclopédie Dofus et demandes forum.',
        inline: false,
      },
      {
        name: '📋 Autres panneaux',
        value:
          '`/panneau outils` — Classements, donjons, XP, chasse au trésor\n' +
          '`/panneau officier` — Actions officier & admin\n' +
          '`/panneau config` — Configuration du bot (admin)',
        inline: false,
      },
    )
    .setFooter({ text: 'Chafer Chafer — Développé par Marpeap de chez Marpeap Digitals · marpeap.com' });
}

export function buildMainPanelRows(): ActionRowBuilder<ButtonBuilder>[] {
  // Row 1 — Adhésion & Profil (personnel, calme)
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:devenir_chafer')
      .setLabel('Devenir Chafer')
      .setEmoji('💀')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('panel:profile')
      .setLabel('Mon Profil')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:recompense_liste')
      .setLabel('Mes Récompenses')
      .setEmoji(Emoji.COIN)
      .setStyle(ButtonStyle.Primary),
  );

  // Row 2 — Activités (énergie, participation)
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:sortie_creer')
      .setLabel('Créer sortie')
      .setEmoji(Emoji.SWORD)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('panel:lfg')
      .setLabel('Chercher groupe')
      .setEmoji(Emoji.PEOPLE)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('panel:sortie_liste')
      .setLabel('Sorties à venir')
      .setEmoji(Emoji.CLOCK)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel:glandeur_dispo')
      .setLabel('Dispo glandeur')
      .setEmoji('🚀')
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 3 — Métiers & Craft (alternance bleu/gris)
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:metier_inscrire')
      .setLabel('Mon métier')
      .setEmoji(Emoji.HAMMER)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:metier_chercher')
      .setLabel('Chercher artisan')
      .setEmoji(Emoji.SEARCH)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel:craft_demande')
      .setLabel('Demande craft')
      .setEmoji('📦')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:metier_dispo')
      .setLabel('Ma dispo')
      .setEmoji('💼')
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 4 — Outils & Infos (exploration, lecture)
  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:almanax_today')
      .setLabel('Almanax')
      .setEmoji(Emoji.CALENDAR)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:almanax_bonus')
      .setLabel('Bonus')
      .setEmoji(Emoji.SEARCH)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel:almanax_semaine')
      .setLabel('Semaine')
      .setEmoji(Emoji.CALENDAR)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel:dofus_chercher')
      .setLabel('Encyclopédie')
      .setEmoji(Emoji.BOOK)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:demande_creer')
      .setLabel('Forum')
      .setEmoji(Emoji.SCROLL)
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2, row3, row4];
}

// ══════════════════════════════════════════════════
//  PANNEAU OUTILS — visible par tous les membres
// ══════════════════════════════════════════════════

export function buildOutilsPanelEmbed(): EmbedBuilder {
  return baseEmbed(`${Emoji.WRENCH} Outils & Statistiques`, Colors.INFO)
    .setDescription(
      'Classements, progression donjons, calculateurs et plus encore.',
    )
    .addFields(
      {
        name: `${Emoji.TROPHY} Classements`,
        value: 'Top participants, artisans, récompenses et résumé de la guilde.',
        inline: false,
      },
      {
        name: `${Emoji.SWORD} Donjons`,
        value: 'Suis ta progression et découvre qui a fait chaque donjon.',
        inline: false,
      },
      {
        name: `${Emoji.STAR} Calculateurs & Chasse`,
        value: 'XP personnage/métier et assistant chasse au trésor.',
        inline: false,
      },
      {
        name: `${Emoji.BELL} Almanax+`,
        value: 'Alertes bonus et recherche par date.',
        inline: false,
      },
    );
}

export function buildOutilsPanelRows(): ActionRowBuilder<ButtonBuilder>[] {
  // Row 1 — Classements
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:classement_activites')
      .setLabel('Top Sorties')
      .setEmoji(Emoji.TROPHY)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:classement_crafts')
      .setLabel('Top Crafts')
      .setEmoji(Emoji.TROPHY)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:classement_recompenses')
      .setLabel('Top Récompenses')
      .setEmoji(Emoji.TROPHY)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:classement_resume')
      .setLabel('Résumé guilde')
      .setEmoji(Emoji.FIRE)
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 2 — Donjons
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:donjon_fait')
      .setLabel('Donjon fait')
      .setEmoji(Emoji.CHECK)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('panel:donjon_progression')
      .setLabel('Ma progression')
      .setEmoji(Emoji.BOOK)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:donjon_guilde')
      .setLabel('Qui l\'a fait ?')
      .setEmoji(Emoji.PEOPLE)
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 3 — XP & Chasse
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:xp_perso')
      .setLabel('XP Perso')
      .setEmoji(Emoji.STAR)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:xp_metier')
      .setLabel('XP Métier')
      .setEmoji(Emoji.STAR)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:chasse')
      .setLabel('Chasse au trésor')
      .setEmoji('🗺️')
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 4 — Almanax+
  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:almanax_alerte')
      .setLabel('Mes alertes')
      .setEmoji(Emoji.BELL)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:almanax_date')
      .setLabel('Almanax date')
      .setEmoji(Emoji.CALENDAR)
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2, row3, row4];
}

// ══════════════════════════════════════════════════
//  PANNEAU CONFIG — admin uniquement (éphémère)
// ══════════════════════════════════════════════════

export function buildConfigPanelEmbed(): EmbedBuilder {
  return baseEmbed(`${Emoji.WRENCH} Configuration`, Colors.INFO)
    .setDescription('Configuration du bot et exports de données.');
}

export function buildConfigPanelRows(): ActionRowBuilder<ButtonBuilder>[] {
  // Row 1 — Configuration
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:config_salons')
      .setLabel('Configurer salons')
      .setEmoji('📺')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:config_roles')
      .setLabel('Configurer rôles')
      .setEmoji(Emoji.PEOPLE)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:config_flags')
      .setLabel('Feature flags')
      .setEmoji('🚩')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel:ping')
      .setLabel('Ping')
      .setEmoji(Emoji.CHECK)
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 2 — Exports
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:export_membres')
      .setLabel('Export membres')
      .setEmoji('📤')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:export_activites')
      .setLabel('Export activités')
      .setEmoji('📤')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:export_recompenses')
      .setLabel('Export récompenses')
      .setEmoji('📤')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel:export_audit')
      .setLabel('Export audit')
      .setEmoji('📤')
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

// ── Channel select menus ──

export function buildChannelSelectEmbed(): EmbedBuilder {
  return baseEmbed('📺 Configuration des salons', Colors.INFO)
    .setDescription(
      'Sélectionne les salons dans les menus ci-dessous.\n' +
      'Tu peux configurer chaque salon un par un.',
    );
}

export function buildChannelSelectRows(): ActionRowBuilder<ChannelSelectMenuBuilder | ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('panel:select_channel:sorties')
      .setPlaceholder('Salon des sorties')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1),
  );

  const row2 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('panel:select_channel:almanax')
      .setPlaceholder('Salon almanax')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1),
  );

  const row3 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('panel:select_channel:metiers')
      .setPlaceholder('Salon métiers')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1),
  );

  const row4 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('panel:select_channel:logs')
      .setPlaceholder('Salon logs bot')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1),
  );

  const row5 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('panel:select_channel:forum')
      .setPlaceholder('Forum demandes')
      .setChannelTypes(ChannelType.GuildForum, ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1),
  );

  // Discord limits messages to 5 action rows, so officiers + annonces are on page 2
  return [row1, row2, row3, row4, row5];
}

export function buildChannelSelectRowsPage2(): ActionRowBuilder<ChannelSelectMenuBuilder | ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('panel:select_channel:officiers')
      .setPlaceholder('Salon officiers')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1),
  );

  const row2 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('panel:select_channel:annonces')
      .setPlaceholder('Salon annonces')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1),
  );

  return [row1, row2];
}

// ── Role select menus ──

export function buildRoleSelectEmbed(): EmbedBuilder {
  return baseEmbed(`${Emoji.PEOPLE} Configuration des rôles`, Colors.INFO)
    .setDescription(
      'Sélectionne le rôle Discord correspondant à chaque niveau de permission.',
    );
}

export function buildRoleSelectRows(): ActionRowBuilder<RoleSelectMenuBuilder>[] {
  const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('panel:select_role:admin')
      .setPlaceholder('Rôle Admin')
      .setMinValues(0)
      .setMaxValues(1),
  );

  const row2 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('panel:select_role:officier')
      .setPlaceholder('Rôle Officier')
      .setMinValues(0)
      .setMaxValues(1),
  );

  const row3 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('panel:select_role:veteran')
      .setPlaceholder('Rôle Vétéran')
      .setMinValues(0)
      .setMaxValues(1),
  );

  const row4 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('panel:select_role:membre')
      .setPlaceholder('Rôle Membre')
      .setMinValues(0)
      .setMaxValues(1),
  );

  return [row1, row2, row3, row4];
}

// ── Feature flags select ──

export function buildFlagsEmbed(flags: Record<string, boolean>): EmbedBuilder {
  const embed = baseEmbed('🚩 Feature Flags', Colors.INFO);
  const lines = Object.entries(flags).map(
    ([flag, enabled]) => `${enabled ? Emoji.CHECK : Emoji.CROSS} \`${flag}\``,
  );
  embed.setDescription(lines.join('\n') || 'Aucun flag configuré.');
  return embed;
}

export function buildFlagsSelectRow(flags: Record<string, boolean>): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const options = Object.entries(flags).map(([flag, enabled]) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(flag.replace(/_/g, ' ').replace('enabled', '').trim())
      .setDescription(enabled ? 'Activé — cliquer pour désactiver' : 'Désactivé — cliquer pour activer')
      .setValue(flag)
      .setEmoji(enabled ? Emoji.CHECK : Emoji.CROSS),
  ).slice(0, 25);

  if (options.length === 0) return [];

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('panel:toggle_flag')
      .setPlaceholder('Cliquer pour activer/désactiver un module')
      .addOptions(options),
  );

  return [row];
}

// ══════════════════════════════════════════════════
//  PANNEAU OFFICIER — éphémère
// ══════════════════════════════════════════════════

export function buildOfficerPanelEmbed(): EmbedBuilder {
  return baseEmbed(`${Emoji.SHIELD} Actions Officier`, Colors.WARNING)
    .setDescription(
      'Actions réservées aux officiers et admins.\n' +
      'Les actions sur les sorties et récompenses existantes sont disponibles directement sur leurs cartes.',
    );
}

export function buildOfficerPanelRows(): ActionRowBuilder<ButtonBuilder>[] {
  // Row 1 — Création
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:sortie_creer')
      .setLabel('Créer sortie')
      .setEmoji(Emoji.SWORD)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('panel:recompense_creer')
      .setLabel('Créer récompense')
      .setEmoji(Emoji.TROPHY)
      .setStyle(ButtonStyle.Success),
  );

  // Row 2 — Membres
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:admin_membres')
      .setLabel('Liste membres')
      .setEmoji(Emoji.PEOPLE)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:admin_historique')
      .setLabel('Historique')
      .setEmoji(Emoji.SCROLL)
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 3 — Actions sur un membre
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:admin_profil')
      .setLabel('Profil membre')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:admin_note')
      .setLabel('Ajouter note')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel:admin_warn')
      .setLabel('Avertissement')
      .setEmoji('⚠️')
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2, row3];
}

// ══════════════════════════════════════════════════
//  MODALS pour les actions qui demandent un input
// ══════════════════════════════════════════════════

import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

export function buildSearchItemModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_dofus_chercher')
    .setTitle('Rechercher un objet Dofus')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('query')
          .setLabel('Nom de l\'objet')
          .setPlaceholder('Ex: Chafer, Gelano, Dofus Turquoise...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
    );
}

export function buildSearchArtisanModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_metier_chercher')
    .setTitle('Chercher un artisan')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('profession')
          .setLabel('Métier recherché')
          .setPlaceholder('Ex: Bijoutier, Cordonnier, Forgeur de Dagues...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50),
      ),
    );
}

export function buildSearchBonusModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_almanax_bonus')
    .setTitle('Chercher un bonus Almanax')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('bonus_type')
          .setLabel('Type de bonus')
          .setPlaceholder('Ex: Prospection, Sagesse, Force, Butin...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50),
      ),
    );
}

export function buildHistoriqueUserModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('admin:modal_historique')
    .setTitle('Voir l\'historique d\'un membre')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('ID utilisateur ou @mention')
          .setPlaceholder('Ex: 123456789012345678')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30),
      ),
    );
}

// ── Modals Outils ──

export function buildDonjonFaitModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_donjon_fait')
    .setTitle('Marquer un donjon complété')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('nom')
          .setLabel('Nom du donjon')
          .setPlaceholder('Ex: Chafer, Bworker, Comte Harebourg...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80),
      ),
    );
}

export function buildDonjonGuildeModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_donjon_guilde')
    .setTitle('Qui a fait ce donjon ?')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('nom')
          .setLabel('Nom du donjon')
          .setPlaceholder('Ex: Chafer, Bworker, Comte Harebourg...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80),
      ),
    );
}

export function buildXpPersoModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_xp_perso')
    .setTitle('Calculateur XP Personnage')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('actuel')
          .setLabel('Niveau actuel')
          .setPlaceholder('Ex: 150')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('cible')
          .setLabel('Niveau cible')
          .setPlaceholder('Ex: 200')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3),
      ),
    );
}

export function buildXpMetierModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_xp_metier')
    .setTitle('Calculateur XP Métier')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('actuel')
          .setLabel('Niveau actuel')
          .setPlaceholder('Ex: 100')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('cible')
          .setLabel('Niveau cible')
          .setPlaceholder('Ex: 200')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3),
      ),
    );
}

export function buildChasseModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_chasse')
    .setTitle('Chasse au trésor')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('x')
          .setLabel('Position X')
          .setPlaceholder('Ex: 5')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(5),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('y')
          .setLabel('Position Y')
          .setPlaceholder('Ex: -18')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(5),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('direction')
          .setLabel('Direction (haut/bas/gauche/droite)')
          .setPlaceholder('haut')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(7),
      ),
    );
}

export function buildAlmanaxDateModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_almanax_date')
    .setTitle('Almanax à une date précise')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('date')
          .setLabel('Date (AAAA-MM-JJ)')
          .setPlaceholder('Ex: 2026-04-15')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(10),
      ),
    );
}

export function buildAlmanaxAlerteModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_almanax_alerte')
    .setTitle('Gérer une alerte bonus')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('bonus_type')
          .setLabel('Type de bonus')
          .setPlaceholder('Ex: Prospection, Sagesse, Force...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50),
      ),
    );
}

// ── Modals Admin (officer panel) ──

export function buildAdminProfilModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_admin_profil')
    .setTitle('Voir le profil d\'un membre')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('ID utilisateur Discord')
          .setPlaceholder('Ex: 123456789012345678')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30),
      ),
    );
}

export function buildAdminNoteModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_admin_note')
    .setTitle('Ajouter une note à un membre')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('ID utilisateur Discord')
          .setPlaceholder('Ex: 123456789012345678')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('texte')
          .setLabel('Contenu de la note')
          .setPlaceholder('Note sur le membre...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500),
      ),
    );
}

export function buildAdminWarnModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('panel:modal_admin_warn')
    .setTitle('Avertir un membre')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('ID utilisateur Discord')
          .setPlaceholder('Ex: 123456789012345678')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('raison')
          .setLabel('Raison de l\'avertissement')
          .setPlaceholder('Détails...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500),
      ),
    );
}
