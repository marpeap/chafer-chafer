import { ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../core/database.js';
import { getAllFlags, setFlag, FLAGS } from '../../core/feature-flags.js';
import { audit } from '../../core/audit.js';
import { baseEmbed, successEmbed, errorEmbed, Colors, Emoji } from '../../views/base.js';

// ────────────────── /config salons ──────────────────

const CHANNEL_FIELDS = [
  { option: 'sorties', dbField: 'sortiesChannelId' },
  { option: 'almanax', dbField: 'almanaxChannelId' },
  { option: 'metiers', dbField: 'metiersChannelId' },
  { option: 'forum', dbField: 'forumChannelId' },
  { option: 'logs', dbField: 'logChannelId' },
  { option: 'officers', dbField: 'officersChannelId' },
  { option: 'annonces', dbField: 'annoncesChannelId' },
] as const;

export async function handleConfigSalons(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const updates: Record<string, string | null> = {};
  const changed: string[] = [];

  for (const { option, dbField } of CHANNEL_FIELDS) {
    const channel = interaction.options.getChannel(option);
    if (channel) {
      updates[dbField] = channel.id;
      changed.push(`${option} -> #${channel.name}`);
    }
  }

  if (changed.length === 0) {
    await interaction.reply({
      embeds: [errorEmbed('Aucun salon fourni. Utilise les options pour assigner des salons.')],
      ephemeral: true,
    });
    return;
  }

  await db().discordGuild.upsert({
    where: { guildId },
    create: { guildId, name: interaction.guild?.name, ...updates },
    update: updates,
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'config.salons',
    details: updates,
  });

  const embed = successEmbed('Salons mis a jour')
    .addFields({ name: 'Modifications', value: changed.map((c) => `${Emoji.CHECK} ${c}`).join('\n') });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ────────────────── /config roles ──────────────────

const ROLE_FIELDS = [
  { option: 'admin', dbField: 'adminRoleId' },
  { option: 'officer', dbField: 'officerRoleId' },
  { option: 'veteran', dbField: 'veteranRoleId' },
  { option: 'member', dbField: 'memberRoleId' },
] as const;

export async function handleConfigRoles(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const updates: Record<string, string | null> = {};
  const changed: string[] = [];

  for (const { option, dbField } of ROLE_FIELDS) {
    const role = interaction.options.getRole(option);
    if (role) {
      updates[dbField] = role.id;
      changed.push(`${option} -> @${role.name}`);
    }
  }

  if (changed.length === 0) {
    await interaction.reply({
      embeds: [errorEmbed('Aucun role fourni. Utilise les options pour assigner des roles.')],
      ephemeral: true,
    });
    return;
  }

  await db().discordGuild.upsert({
    where: { guildId },
    create: { guildId, name: interaction.guild?.name, ...updates },
    update: updates,
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'config.roles',
    details: updates,
  });

  const embed = successEmbed('Roles mis a jour')
    .addFields({ name: 'Modifications', value: changed.map((c) => `${Emoji.CHECK} ${c}`).join('\n') });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ────────────────── /config flags ──────────────────

export async function handleConfigFlags(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const flagName = interaction.options.getString('flag');
  const flagValue = interaction.options.getBoolean('valeur');

  // No arguments: show all flags
  if (!flagName) {
    const flags = await getAllFlags(guildId);

    const lines = FLAGS.map((f) => {
      const enabled = flags[f] ?? false;
      return `${enabled ? Emoji.CHECK : Emoji.CROSS} \`${f}\``;
    });

    const embed = baseEmbed(`${Emoji.WRENCH} Feature Flags`, Colors.INFO)
      .setDescription(lines.join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Validate flag name
  if (!FLAGS.includes(flagName as typeof FLAGS[number])) {
    const available = FLAGS.map((f) => `\`${f}\``).join(', ');
    await interaction.reply({
      embeds: [errorEmbed(`Flag inconnu : \`${flagName}\`\nFlags disponibles : ${available}`)],
      ephemeral: true,
    });
    return;
  }

  // Toggle or set explicit value
  if (flagValue !== null) {
    await setFlag(guildId, flagName, flagValue);
  } else {
    // Toggle: read current then invert
    const current = await getAllFlags(guildId);
    await setFlag(guildId, flagName, !(current[flagName] ?? false));
  }

  const newFlags = await getAllFlags(guildId);
  const newState = newFlags[flagName] ?? false;

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'config.flags',
    details: { flag: flagName, enabled: newState },
  });

  const embed = successEmbed(
    `Flag \`${flagName}\` est maintenant **${newState ? 'active' : 'desactive'}**.`,
  );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ────────────────── /config ping ──────────────────

export async function handleConfigPing(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;

  // Quick DB connectivity test
  const start = Date.now();
  await db().discordGuild.findUnique({ where: { guildId } });
  const dbLatency = Date.now() - start;

  const embed = baseEmbed(`${Emoji.CHECK} Connectivite OK`, Colors.SUCCESS)
    .addFields(
      { name: 'Base de donnees', value: `${dbLatency}ms`, inline: true },
      { name: 'Serveur', value: guildId, inline: true },
    )
    .setDescription('Le bot repond correctement sur ce serveur.');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
