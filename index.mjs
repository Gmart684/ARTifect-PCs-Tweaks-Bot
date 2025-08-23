import fs from 'node:fs';
import path from 'node:path';
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  REST,
  Routes
} from 'discord.js';

// Load dataset
const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

// Env vars from Railway
const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.GUILD_ID;           // optional (instant guild registration if set)
const CHANNEL_ID = process.env.CHANNEL_ID;       // REQUIRED: target text channel for posts/threads

if (!TOKEN || !APP_ID || !CHANNEL_ID) {
  console.error('Missing required env vars: DISCORD_TOKEN, DISCORD_APP_ID, CHANNEL_ID');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// --- One-time pinned command reference ---
const REFERENCE_MARKER = 'ARTIFECT_UTILS_BOT_COMMAND_REFERENCE_v1';
const COMMAND_REFERENCE = `**📌 ARTiFECT Utilities Command Deck**
${REFERENCE_MARKER}

**/debloat** — Strip the fluff, tighten privacy, and streamline Windows.
**/drivers** — Keep silicon happy: drivers, clean installs, zero leftovers.
**/cpuoc** — Multipliers, volts, and stability. Squeeze that silicon.
**/gpuoc** — Core clocks, fan curves, and frame-time truth.
**/fancontrol** — Curves that keep cool under fire.
**/rgb** — Open-source glow or vendor sync — your call.
**/power** — Efficiency vs beast mode. You choose.

**⚠️ Heads-up:** You’re playing with powerful tools. If deep system tweaks aren’t your jam, book a pro at **FPSHUB.org**.`;

// --- Quippy warning per-thread ---
const WARNING =
  "**⚠️⚡ HIGH-TECH DISCLAIMER ⚡⚠️**\n" +
  "These utilities are *NOT* built by ARTifect PCs. Use at your own risk!\n" +
  "If diving into Windows’ guts scares you, maybe book a session with a **PC Optimizer** like [FPSHUB.org](https://fpshub.org).";

function makeEmbed(item) {
  return new EmbedBuilder()
    .setTitle(item.name)
    .setURL(item.url)
    .setDescription(item.blurb)
    .setColor(0x00ffff);
}

// Auto-register slash commands on boot
async function registerSlashCommands() {
  try {
    const commandsPath = path.join(process.cwd(), 'commands.json');
    const commands = JSON.parse(fs.readFileSync(commandsPath, 'utf-8'));

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(APP_ID, GUILD_ID),
        { body: commands }
      );
      console.log('✅ Slash commands registered (guild).');
    } else {
      await rest.put(
        Routes.applicationCommands(APP_ID),
        { body: commands }
      );
      console.log('✅ Slash commands registered (global).');
    }
  } catch (err) {
    console.error('Slash command registration failed:', err);
  }
}

// v15-ready event name
client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Auto-register on boot
  await registerSlashCommands();

  // Ensure the pinned command deck exists
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel?.isTextBased()) {
      console.error('Configured CHANNEL_ID is not a text-based channel.');
      return;
    }

    const pins = await channel.messages.fetchPins();
    const exists = pins.some(m => m.content?.includes(REFERENCE_MARKER));
    if (!exists) {
      const msg = await channel.send(COMMAND_REFERENCE);
      await msg.pin();
      console.log('📌 Posted and pinned command reference.');
    } else {
      console.log('📌 Command reference already pinned; skipping. Total pins:', pins.size);
    }
  } catch (e) {
    console.error('Error ensuring pinned reference:', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = `/${interaction.commandName}`;
  if (!data[cmd]) {
    // Not one of our commands; ignore silently
    return;
  }

  try {
    const targetChannel = await client.channels.fetch(CHANNEL_ID);
    if (!targetChannel?.isTextBased()) {
      await interaction.reply({ content: '❌ Bot misconfigured: target channel not text-based.', ephemeral: true });
      return;
    }

    const thread = await targetChannel.threads.create({
      name: `${interaction.user.username}-${interaction.commandName}`,
      autoArchiveDuration: 60,
      type: ChannelType.PrivateThread
    });

    const warningMsg = await thread.send(WARNING);
    await warningMsg.pin();

    for (const item of data[cmd]) {
      await thread.send({ embeds: [makeEmbed(item)] });
    }

    await interaction.reply({ content: `🔒 Private thread created in <#${CHANNEL_ID}>: ${thread}`, ephemeral: true });
  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong creating your thread.', ephemeral: true });
    }
  }
});

client.login(TOKEN);
