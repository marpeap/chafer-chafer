import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FLAGS = [
  'scheduled_activities_enabled',
  'quick_calls_enabled',
  'almanax_daily_enabled',
  'encyclopedia_enabled',
  'professions_enabled',
  'rewards_enabled',
  'forum_requests_enabled',
];

async function main() {
  const guildId = process.argv[2];
  if (!guildId) {
    console.error('Usage: tsx scripts/seed-feature-flags.ts <guild_id>');
    process.exit(1);
  }

  console.log(`Seeding feature flags for guild ${guildId}...`);

  for (const flag of FLAGS) {
    await prisma.featureFlag.upsert({
      where: { guildId_flag: { guildId, flag } },
      create: { guildId, flag, enabled: true },
      update: {},
    });
    console.log(`  ${flag}: enabled`);
  }

  console.log('Done!');
  await prisma.$disconnect();
}

main().catch(console.error);
