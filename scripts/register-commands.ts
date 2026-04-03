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
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('alerte')
        .setDescription('S\'abonner/se désabonner d\'un type de bonus')
        .addStringOption(o => o.setName('type').setDescription('Type de bonus').setRequired(true).setAutocomplete(true))
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
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('consommable')
        .setDescription('Rechercher un consommable')
        .addStringOption(o => o.setName('query').setDescription('Nom').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('quete')
        .setDescription('Rechercher un objet de quête')
        .addStringOption(o => o.setName('query').setDescription('Nom').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('cosmetique')
        .setDescription('Rechercher un cosmétique')
        .addStringOption(o => o.setName('query').setDescription('Nom').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('panoplie')
        .setDescription('Rechercher une panoplie')
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

  // /classement
  new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Classements de la guilde')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('activites')
        .setDescription('Top participants aux sorties')
        .addStringOption(o => o.setName('periode').setDescription('Période').addChoices(
          { name: 'Cette semaine', value: 'semaine' },
          { name: 'Ce mois', value: 'mois' },
          { name: 'Ce trimestre', value: 'trimestre' },
          { name: 'Depuis toujours', value: 'tout' },
        ))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('crafts')
        .setDescription('Top artisans')
        .addStringOption(o => o.setName('periode').setDescription('Période').addChoices(
          { name: 'Cette semaine', value: 'semaine' },
          { name: 'Ce mois', value: 'mois' },
          { name: 'Ce trimestre', value: 'trimestre' },
          { name: 'Depuis toujours', value: 'tout' },
        ))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('recompenses')
        .setDescription('Top récompenses reçues')
        .addStringOption(o => o.setName('periode').setDescription('Période').addChoices(
          { name: 'Cette semaine', value: 'semaine' },
          { name: 'Ce mois', value: 'mois' },
          { name: 'Ce trimestre', value: 'trimestre' },
          { name: 'Depuis toujours', value: 'tout' },
        ))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('resume')
        .setDescription('Résumé hebdomadaire de la guilde')
    ),

  // /donjon
  new SlashCommandBuilder()
    .setName('donjon')
    .setDescription('Suivi de progression des donjons')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('fait')
        .setDescription('Marquer un donjon comme complété')
        .addStringOption(o => o.setName('nom').setDescription('Nom du donjon').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('retirer')
        .setDescription('Retirer un donjon de ta progression')
        .addStringOption(o => o.setName('nom').setDescription('Nom du donjon').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('progression')
        .setDescription('Voir ta progression donjon')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('guilde')
        .setDescription('Qui a fait ce donjon dans la guilde ?')
        .addStringOption(o => o.setName('nom').setDescription('Nom du donjon').setRequired(true).setAutocomplete(true))
    ),

  // /xp
  new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Calculateur d\'XP')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('personnage')
        .setDescription('XP nécessaire entre deux niveaux personnage')
        .addIntegerOption(o => o.setName('actuel').setDescription('Niveau actuel').setRequired(true).setMinValue(1).setMaxValue(200))
        .addIntegerOption(o => o.setName('cible').setDescription('Niveau cible').setRequired(true).setMinValue(1).setMaxValue(200))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('metier')
        .setDescription('XP nécessaire entre deux niveaux métier')
        .addIntegerOption(o => o.setName('actuel').setDescription('Niveau actuel').setRequired(true).setMinValue(1).setMaxValue(200))
        .addIntegerOption(o => o.setName('cible').setDescription('Niveau cible').setRequired(true).setMinValue(1).setMaxValue(200))
    ),

  // /chasse
  new SlashCommandBuilder()
    .setName('chasse')
    .setDescription('Assistant chasse au trésor')
    .addIntegerOption(o => o.setName('x').setDescription('Position X').setRequired(true))
    .addIntegerOption(o => o.setName('y').setDescription('Position Y').setRequired(true))
    .addStringOption(o => o.setName('direction').setDescription('Direction (haut/bas/gauche/droite)').setRequired(true).addChoices(
      { name: 'Haut', value: 'haut' },
      { name: 'Bas', value: 'bas' },
      { name: 'Gauche', value: 'gauche' },
      { name: 'Droite', value: 'droite' },
    )),

  // /export
  new SlashCommandBuilder()
    .setName('export')
    .setDescription('Exporter des donnees en CSV (admin)')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('membres')
        .setDescription('Exporter les membres approuves')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('activites')
        .setDescription('Exporter les activites (30 derniers jours)')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('recompenses')
        .setDescription('Exporter les recompenses')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('audit')
        .setDescription('Exporter le journal d\'audit (7 derniers jours)')
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

  // /admin
  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Administration des membres (officier+)')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('membres')
        .setDescription('Lister les membres approuves')
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('profil')
        .setDescription('Voir le profil detaille d\'un membre')
        .addUserOption(o => o.setName('utilisateur').setDescription('Le membre a consulter').setRequired(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('note')
        .setDescription('Ajouter une note au profil d\'un membre (admin)')
        .addUserOption(o => o.setName('utilisateur').setDescription('Le membre concerne').setRequired(true))
        .addStringOption(o => o.setName('texte').setDescription('Contenu de la note').setRequired(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('warn')
        .setDescription('Avertir un membre (admin)')
        .addUserOption(o => o.setName('utilisateur').setDescription('Le membre a avertir').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison de l\'avertissement').setRequired(true))
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('historique')
        .setDescription('Voir l\'historique d\'audit d\'un membre')
        .addUserOption(o => o.setName('utilisateur').setDescription('Le membre a consulter').setRequired(true))
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
