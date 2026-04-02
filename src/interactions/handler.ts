import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { childLogger } from '../core/logger.js';
import { handleInteractionError } from '../core/error-handler.js';
import { isEnabled } from '../core/feature-flags.js';
import { getMemberLevel, requireLevel, PermissionLevel, levelName } from '../core/permissions.js';
import { disabledModuleEmbed, noPermissionEmbed } from '../views/base.js';
import { MODULE_FLAGS } from '../core/feature-flags.js';

// Module handlers registry
import { handlePing } from '../modules/admin/ping.js';
import { handleConfigSalons, handleConfigRoles, handleConfigFlags, handleConfigPing } from '../modules/admin/config.js';
import { handleAlmanax, handleAlmanaxAutocomplete } from '../modules/D-almanax/commands.js';
import { handleDofus, handleDofusAutocomplete } from '../modules/C-encyclopedia/commands.js';
import { handleSortie, handleLfg } from '../modules/B-activities/commands.js';
import { handleActivityButton } from '../modules/B-activities/buttons.js';
import { handleActivityModal } from '../modules/B-activities/modals.js';
import { handleMetier, handleCraft, handleMetierAutocomplete } from '../modules/E-professions/commands.js';
import { handleCraftButton } from '../modules/E-professions/buttons.js';
import { handleRecompense } from '../modules/F-rewards/commands.js';
import { handleRewardButton } from '../modules/F-rewards/buttons.js';
import { handleRewardModal } from '../modules/F-rewards/modals.js';
import { handleDemande } from '../modules/H-forum/commands.js';
import { handleDemandeModal } from '../modules/H-forum/modals.js';

const log = childLogger('handler');

// Command → module mapping for feature flag checks
const COMMAND_MODULE: Record<string, string> = {
  sortie: 'B-activities',
  lfg: 'B-activities',
  dofus: 'C-encyclopedia',
  almanax: 'D-almanax',
  metier: 'E-professions',
  craft: 'E-professions',
  recompense: 'F-rewards',
  demande: 'H-forum',
};

// Command → required permission level
const COMMAND_PERMISSIONS: Record<string, PermissionLevel> = {
  config: PermissionLevel.ADMIN,
};

// Subcommand-level permission overrides
const SUBCOMMAND_PERMISSIONS: Record<string, Record<string, PermissionLevel>> = {
  sortie: {
    creer: PermissionLevel.OFFICER,
    annuler: PermissionLevel.OFFICER,
    cloturer: PermissionLevel.OFFICER,
  },
  recompense: {
    creer: PermissionLevel.OFFICER,
    payer: PermissionLevel.OFFICER,
    annuler: PermissionLevel.OFFICER,
  },
};

export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
      return;
    }
  } catch (err) {
    log.error({ err, type: interaction.type }, 'Unhandled interaction error');
    if (
      interaction.isRepliable() &&
      !interaction.isAutocomplete()
    ) {
      await handleInteractionError(
        interaction as ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
        err,
      );
    }
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction;
  const guildId = interaction.guildId;
  if (!guildId) return;

  log.info({ command: commandName, user: interaction.user.id, guild: guildId }, 'Command received');

  // Feature flag check
  const moduleName = COMMAND_MODULE[commandName];
  if (moduleName) {
    const flag = MODULE_FLAGS[moduleName];
    if (flag && !(await isEnabled(guildId, flag))) {
      await interaction.reply({ embeds: [disabledModuleEmbed(moduleName)], ephemeral: true });
      return;
    }
  }

  // Permission check
  const member = interaction.member;
  if (member && 'roles' in member) {
    const guildMember = member as import('discord.js').GuildMember;

    // Command-level permission
    const requiredLevel = COMMAND_PERMISSIONS[commandName];
    if (requiredLevel !== undefined) {
      const level = await getMemberLevel(guildMember);
      if (!requireLevel(requiredLevel, level)) {
        await interaction.reply({ embeds: [noPermissionEmbed(levelName(requiredLevel))], ephemeral: true });
        return;
      }
    }

    // Subcommand-level permission
    const subPerms = SUBCOMMAND_PERMISSIONS[commandName];
    if (subPerms) {
      const sub = interaction.options.getSubcommand(false);
      if (sub && subPerms[sub] !== undefined) {
        const level = await getMemberLevel(guildMember);
        if (!requireLevel(subPerms[sub], level)) {
          await interaction.reply({ embeds: [noPermissionEmbed(levelName(subPerms[sub]))], ephemeral: true });
          return;
        }
      }
    }
  }

  // Route to handler
  switch (commandName) {
    case 'ping': return handlePing(interaction);
    case 'config': {
      const sub = interaction.options.getSubcommand();
      switch (sub) {
        case 'salons': return handleConfigSalons(interaction);
        case 'roles': return handleConfigRoles(interaction);
        case 'flags': return handleConfigFlags(interaction);
        case 'ping': return handleConfigPing(interaction);
      }
      return;
    }
    case 'almanax': return handleAlmanax(interaction);
    case 'dofus': return handleDofus(interaction);
    case 'sortie': return handleSortie(interaction);
    case 'lfg': return handleLfg(interaction);
    case 'metier': return handleMetier(interaction);
    case 'craft': return handleCraft(interaction);
    case 'recompense': return handleRecompense(interaction);
    case 'demande': return handleDemande(interaction);
    default:
      log.warn({ command: commandName }, 'Unknown command');
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  log.info({ customId, user: interaction.user.id }, 'Button clicked');

  if (customId.startsWith('activity:') || customId.startsWith('lfg:')) {
    return handleActivityButton(interaction);
  }
  if (customId.startsWith('craft:')) {
    return handleCraftButton(interaction);
  }
  if (customId.startsWith('reward:')) {
    return handleRewardButton(interaction);
  }

  log.warn({ customId }, 'Unknown button');
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;
  log.info({ customId, user: interaction.user.id }, 'Modal submitted');

  if (customId.startsWith('activity:') || customId === 'sortie_creer' || customId === 'lfg_creer') {
    return handleActivityModal(interaction);
  }
  if (customId.startsWith('reward:') || customId === 'recompense_creer') {
    return handleRewardModal(interaction);
  }
  if (customId === 'demande_creer') {
    return handleDemandeModal(interaction);
  }

  log.warn({ customId }, 'Unknown modal');
}

async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const { commandName } = interaction;

  switch (commandName) {
    case 'almanax': return handleAlmanaxAutocomplete(interaction);
    case 'dofus': return handleDofusAutocomplete(interaction);
    case 'metier':
    case 'craft': return handleMetierAutocomplete(interaction);
    default:
      await interaction.respond([]);
  }
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  log.info({ customId: interaction.customId, user: interaction.user.id }, 'Select menu used');
  // Future: route to appropriate handler
}
