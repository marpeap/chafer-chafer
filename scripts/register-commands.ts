import { REST, Routes, SlashCommandBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import 'dotenv/config';

const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const APP_ID = process.env.DISCORD_APPLICATION_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const ACTIVITY_TYPES = [
  { name: 'Donjon', value: 'donjon' },
  { name: 'Kolizéum', value: 'koli' },
  { name: 'Songe', value: 'songe' },
  { name: 'Quête', value: 'quete' },
  { name: 'Farm', value: 'farm' },
  { name: 'PvP', value: 'pvp' },
  { name: 'Percepteur', value: 'perco' },
  { name: 'Autre', value: 'autre' },
];

const commands = [
  // /ping
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Vérifier que le bot fonctionne'),

  // /config
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configuration du bot (admin)')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('salons')
        .setDescription('Configurer les salons')
        .addChannelOption(o => o.setName('sorties').setDescription('Salon des sorties'))
        .addChannelOption(o => o.setName('almanax').setDescription('Salon almanax'))
        .addChannelOption(o => o.setName('metiers').setDescription('Salon métiers'))
        .addChannelOption(o => o.setName('forum').setDescription('Forum demandes'))
        .addChannelOption(o => o.setName('logs').setDescription('Salon logs bot'))
        .addChannelOption(o => o.setName('officiers').setDescription('Salon officiers'))
        .addChannelOption(o => o.setName('annonces').setDescription('Salon annonces'))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('roles')
        .setDescription('Configurer les rôles')
        .addRoleOption(o => o.setName('admin').setDescription('Rôle admin'))
        .addRoleOption(o => o.setName('officier').setDescription('Rôle officier'))
        .addRoleOption(o => o.setName('veteran').setDescription('Rôle vétéran'))
        .addRoleOption(o => o.setName('membre').setDescription('Rôle membre'))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('flags')
        .setDescription('Gérer les feature flags')
        .addStringOption(o => o.setName('flag').setDescription('Nom du flag').setRequired(false))
        .addBooleanOption(o => o.setName('valeur').setDescription('Activer/désactiver').setRequired(false))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('ping')
        .setDescription('Test de connectivité')
    ),

  // /almanax
  new SlashCommandBuilder()
    .setName('almanax')
    .setDescription('Almanax Dofus')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('today')
        .setDescription("Almanax du jour")
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('date')
        .setDescription('Almanax à une date précise')
        .addStringOption(o => o.setName('date').setDescription('Date (JJ/MM/AAAA)').setRequired(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('bonus')
        .setDescription('Prochain bonus de ce type')
        .addStringOption(o => o.setName('type').setDescription('Type de bonus').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('semaine')
        .setDescription('Almanax des 7 prochains jours')
    ),

  // /dofus
  new SlashCommandBuilder()
    .setName('dofus')
    .setDescription('Encyclopédie Dofus')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('chercher')
        .setDescription('Rechercher un objet')
        .addStringOption(o => o.setName('query').setDescription('Nom de l\'objet').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('equip')
        .setDescription('Rechercher un équipement')
        .addStringOption(o => o.setName('query').setDescription('Nom').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('ressource')
        .setDescription('Rechercher une ressource')
        .addStringOption(o => o.setName('query').setDescription('Nom').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('monture')
        .setDescription('Rechercher une monture')
        .addStringOption(o => o.setName('query').setDescription('Nom').setRequired(true).setAutocomplete(true))
    ),

  // /sortie
  new SlashCommandBuilder()
    .setName('sortie')
    .setDescription('Gérer les sorties')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('creer')
        .setDescription('Créer une nouvelle sortie')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('liste')
        .setDescription('Lister les sorties à venir')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('annuler')
        .setDescription('Annuler une sortie')
        .addIntegerOption(o => o.setName('id').setDescription('ID de la sortie').setRequired(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('cloturer')
        .setDescription('Clôturer une sortie')
        .addIntegerOption(o => o.setName('id').setDescription('ID de la sortie').setRequired(true))
    ),

  // /lfg
  new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Chercher un groupe rapidement'),

  // /metier
  new SlashCommandBuilder()
    .setName('metier')
    .setDescription('Gestion des métiers')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('inscrire')
        .setDescription('Inscrire un métier')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('chercher')
        .setDescription('Chercher un artisan')
        .addStringOption(o => o.setName('profession').setDescription('Métier recherché').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('dispo')
        .setDescription('Basculer votre disponibilité')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('liste')
        .setDescription('Lister vos métiers')
    ),

  // /craft
  new SlashCommandBuilder()
    .setName('craft')
    .setDescription('Demandes de craft')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('demande')
        .setDescription('Créer une demande de craft')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('prendre')
        .setDescription('Prendre une demande de craft')
        .addIntegerOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('cloturer')
        .setDescription('Clôturer une demande de craft')
        .addIntegerOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true))
    ),

  // /recompense
  new SlashCommandBuilder()
    .setName('recompense')
    .setDescription('Gestion des récompenses')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('creer')
        .setDescription('Créer une récompense (officier+)')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('liste')
        .setDescription('Voir vos récompenses')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('payer')
        .setDescription('Marquer une récompense comme payée (officier+)')
        .addIntegerOption(o => o.setName('id').setDescription('ID de la récompense').setRequired(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('annuler')
        .setDescription('Annuler une récompense (officier+)')
        .addIntegerOption(o => o.setName('id').setDescription('ID de la récompense').setRequired(true))
    ),

  // /demande
  new SlashCommandBuilder()
    .setName('demande')
    .setDescription('Créer une demande dans le forum')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('creer')
        .setDescription('Créer une nouvelle demande')
    ),

  // /panneau
  new SlashCommandBuilder()
    .setName('panneau')
    .setDescription('Afficher le panneau de commandes')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('principal')
        .setDescription('Poster le panneau principal (admin)')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('config')
        .setDescription('Panneau de configuration (admin)')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('officier')
        .setDescription('Panneau officier')
    ),
];

async function main() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  console.log(`Registering ${commands.length} commands...`);

  const body = commands.map(c => c.toJSON());

  if (GUILD_ID) {
    // Guild-specific (instant, for dev)
    await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body });
    console.log(`Registered ${commands.length} guild commands for ${GUILD_ID}`);
  } else {
    // Global (takes up to 1h to propagate)
    await rest.put(Routes.applicationCommands(APP_ID), { body });
    console.log(`Registered ${commands.length} global commands`);
  }
}

main().catch(console.error);
