import { GuildMember } from 'discord.js';
import { db } from './database.js';

export enum PermissionLevel {
  MEMBER = 0,
  VETERAN = 1,
  OFFICER = 2,
  ADMIN = 3,
}

const LEVEL_NAMES: Record<PermissionLevel, string> = {
  [PermissionLevel.MEMBER]: 'Membre',
  [PermissionLevel.VETERAN]: 'Vétéran',
  [PermissionLevel.OFFICER]: 'Officier',
  [PermissionLevel.ADMIN]: 'Admin',
};

export function levelName(level: PermissionLevel): string {
  return LEVEL_NAMES[level];
}

export async function getMemberLevel(member: GuildMember): Promise<PermissionLevel> {
  // Admin override: guild owner or Discord administrator permission
  if (member.permissions.has('Administrator') || member.guild.ownerId === member.id) {
    return PermissionLevel.ADMIN;
  }

  // Check mapped roles from DB
  const guildConfig = await db().discordGuild.findUnique({
    where: { guildId: member.guild.id },
  });

  if (guildConfig) {
    if (guildConfig.adminRoleId && member.roles.cache.has(guildConfig.adminRoleId)) {
      return PermissionLevel.ADMIN;
    }
    if (guildConfig.officerRoleId && member.roles.cache.has(guildConfig.officerRoleId)) {
      return PermissionLevel.OFFICER;
    }
    if (guildConfig.veteranRoleId && member.roles.cache.has(guildConfig.veteranRoleId)) {
      return PermissionLevel.VETERAN;
    }
  }

  return PermissionLevel.MEMBER;
}

export function requireLevel(required: PermissionLevel, actual: PermissionLevel): boolean {
  return actual >= required;
}
