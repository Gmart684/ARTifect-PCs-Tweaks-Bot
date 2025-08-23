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

// ---- Config & Data ----
const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.GUILD_ID;     // optional (instant registration if set)
const CHANNEL_ID = process.env.CHANNEL_ID; // required text channel id

if (!TOKEN || !APP_ID || !CHANNEL_ID) {
  console.error('Missing required env vars: DISCORD_TOKEN, DISCORD_APP_ID, CHANNEL_ID');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

// ---- Client ----
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// ---- Safety: don't crash on unhandled promise rejections ----
process.on('unhandledRejection', (reason) => {
  console.error('UnhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});

// ---- Constants ----
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

// ---- Auto-register commands ----
async function registerSlashCommands() {
  try {
    const commands = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'commands.json'), 'utf-8'));
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: commands });
      console.log('✅ Slash commands registered (guild).');
    } else {
      await rest.put(Routes.applicationCommands(APP_ID), { body: commands });
      console.log('✅ Slash commands registered (global).');
    }
  } catch (err) {
    console.error('Slash command registration failed:', err);
  }
}

// ---- Ensure pinned Command Deck exists (idempotent) ----
async function ensurePinnedDeck(channel) {
  // 1) Check current pins
  const pins = await channel.messages.fetchPins().catch(() => null);
  if (pins) {
    for (const msg of pins.values()) {
      if (msg?.content?.includes(REFERENCE_MARKER)) {
        console.log('📌 Command reference already pinned; skipping.');
        return;
      }
    }
  }
  // 2) Scan recent messages (in case it exists but isn’t pinned)
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (recent) {
    for (const msg of recent.values()) {
      if (msg?.content?.includes(REFERENCE_MARKER)) {
        await msg.pin().catch(() => {});
        console.log('📌 Found existing command reference; pinned it.');
        return;
      }
    }
  }
  // 3) Post new and pin
  const posted = await channel.send(COMMAND_REFERENCE);
  await posted.pin();
  console.log('📌 Posted and pinned command reference.');
}

// ---- Events ----
client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerSlashCommands();
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel?.isTextBased()) {
      console.error('Configured CHANNEL_ID is not a text-based channel.');
      return;
    }
    await ensurePinnedDeck(channel);
  } catch (e) {
    console.error('Error ensuring pinned reference:', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = `/${interaction.commandName}`;
  if (!data[cmd]) return;

  // Defer immediately (ephemeral using flags)
  try {
    await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL
  } catch (_) {}

  try {
    const targetChannel = await client.channels.fetch(CHANNEL_ID);
    if (!targetChannel?.isTextBased()) {
      await interaction.editReply({ content: '❌ Bot misconfigured: target channel not text-based.' });
      return;
    }

    // Create a PRIVATE thread, allow inviting, and add the user
    const thread = await targetChannel.threads.create({
      name: `${interaction.user.username}-${interaction.commandName}`,
      autoArchiveDuration: 60,
      type: ChannelType.PrivateThread,
      invitable: true,
      reason: `Thread for ${interaction.user.tag} - ${interaction.commandName}`
    });

    // add the command user to the thread
    try {
      await thread.members.add(interaction.user.id);
    } catch (addErr) {
      console.error('Failed to add user to thread:', addErr);
      // proceed; they can be added manually if perms block it
    }

    // Pin the disclaimer
    const warningMsg = await thread.send(WARNING);
    await warningMsg.pin().catch(() => {});

    // Post each item as an embed
    for (const item of data[cmd]) {
      await thread.send({ embeds: [makeEmbed(item)] });
    }

    await interaction.editReply({
      content: `🔒 Private thread created in <#${CHANNEL_ID}> and you’ve been added: ${thread}`
    });
  } catch (err) {
    console.error('Handler error:', err);
    try {
      await interaction.editReply({ content: '❌ Something went wrong creating your thread.' });
    } catch {}
  }
});

client.login(TOKEN);
