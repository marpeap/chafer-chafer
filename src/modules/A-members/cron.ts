import { db } from '../../core/database.js';
import { registerJob } from '../../core/scheduler.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('members:cron');

export function registerMemberCrons(): void {
  registerJob({
    name: 'reset-availability',
    schedule: '0 */3 * * *', // Every 3 hours at minute 0
    handler: handleResetAvailability,
  });
}

async function handleResetAvailability(): Promise<void> {
  // Reset globalAvailable on PlayerProfile ("Glandeur Dispo")
  const profileReset = await db().playerProfile.updateMany({
    where: { globalAvailable: true },
    data: { globalAvailable: false },
  });

  // Reset CrafterAvailability
  const crafterReset = await db().crafterAvailability.updateMany({
    where: { available: true },
    data: { available: false },
  });

  // Reset ProfessionProfile availability
  const professionReset = await db().professionProfile.updateMany({
    where: { available: true },
    data: { available: false },
  });

  log.info({
    profilesReset: profileReset.count,
    craftersReset: crafterReset.count,
    professionsReset: professionReset.count,
  }, 'Availability reset completed');
}
