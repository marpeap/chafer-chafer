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
//  PANNEAU CONFIG — admin uniquement (éphémère)
// ══════════════════════════════════════════════════

export function buildConfigPanelEmbed(): EmbedBuilder {
  return baseEmbed(`${Emoji.WRENCH} Configuration`, Colors.INFO)
    .setDescription('Choisis ce que tu veux configurer.');
}

export function buildConfigPanelRows(): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
  );
  return [row];
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
  return [row1, row2];
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

// Réutilise les modals existants — ces builders sont juste pour référence
// Les modals sortie_creer, lfg_creer, metier_inscrire, craft_demande,
// recompense_creer, demande_creer sont déjà dans leurs modules respectifs
