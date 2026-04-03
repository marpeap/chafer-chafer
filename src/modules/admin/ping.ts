import { ChatInputCommandInteraction } from 'discord.js';
import { discordClient } from '../../core/client.js';
import { baseEmbed, Colors, Emoji } from '../../views/base.js';

export async function handlePing(interaction: ChatInputCommandInteraction): Promise<void> {
  const client = discordClient();
  const wsPing = client.ws.ping;
  const uptime = client.uptime ?? 0;

  const hours = Math.floor(uptime / 3_600_000);
  const minutes = Math.floor((uptime % 3_600_000) / 60_000);
  const seconds = Math.floor((uptime % 60_000) / 1_000);

  const embed = baseEmbed(`${Emoji.CHECK} Pong !`, Colors.SUCCESS)
    .addFields(
      { name: 'WebSocket', value: `${wsPing}ms`, inline: true },
      { name: 'Uptime', value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
    )
    .setDescription('Le bot est en ligne et fonctionne correctement.\n\n*Développé par **Marpeap** de chez **Marpeap Digitals** — [marpeap.com](https://marpeap.com)*');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
