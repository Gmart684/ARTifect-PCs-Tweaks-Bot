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

// ===== Env / Config =====
const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.GUILD_ID;             // optional (instant registration if set)
const CHANNEL_ID = process.env.CHANNEL_ID;         // required text channel id
const SET_CHANNEL_TOPIC = process.env.SET_CHANNEL_TOPIC === '1' || process.env.SET_CHANNEL_TOPIC === 'true';

if (!TOKEN || !APP_ID || !CHANNEL_ID) {
  console.error('Missing required env vars: DISCORD_TOKEN, DISCORD_APP_ID, CHANNEL_ID');
  process.exit(1);
}

// ===== Data =====
const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

// ===== Client =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Safety: log instead of crash
process.on('unhandledRejection', (reason) => console.error('UnhandledRejection:', reason));
process.on('uncaughtException', (err) => console.error('UncaughtException:', err));

// ===== Text Blocks & Markers =====
const COMMAND_DECK_MARKER = 'ARTIFECT_UTILS_BOT_COMMAND_DECK_v1';
const INSTRUCTIONS_MARKER = 'ARTIFECT_UTILS_BOT_INSTRUCTIONS_v1';

const COMMAND_DECK = `# ⚡ ARTiFECT Utilities Command Deck
${COMMAND_DECK_MARKER}

**/debloat** — Strip the fluff, tighten privacy, and streamline Windows.  
**/drivers** — Keep silicon happy: clean installs, zero leftovers.  
**/cpuoc** — Multipliers, volts, and stability. Squeeze that silicon.  
**/gpuoc** — Core clocks, fan curves, and frame-time truth.  
**/fancontrol** — Curves that keep cool under fire.  
**/rgb** — Open-source glow or vendor sync — your call.  
**/power** — Efficiency vs beast mode. You choose.  

> Run a command anywhere and I’ll spawn your 🔒 private thread in this channel with links + blurbs.`;

const INSTRUCTIONS_AND_WARNING = `# 🧭 How to Use & ⚠️ High-Tech Disclaimer
${INSTRUCTIONS_MARKER}

Welcome to your **high-tech toolbox**. Each command creates a **private thread** for you with curated utilities and one-liners.

**How to use**
1. Type one of the commands (see Command Deck above).  
2. I’ll open a **private thread** here, add you, and pin a disclaimer.  
3. Browse the embeds and click through. No fluff, just tools.

**⚠️ HIGH-TECH DISCLAIMER**
These utilities are **NOT** built by ARTiFECT PCs. They can tweak registry, drivers, voltage, power, and privacy.  
**Use at your own risk.** If deep system tweaks aren’t your jam, book a pro at **[FPSHUB.org](https://fpshub.org)**.

**TL;DR:** You get the power — you also own the fallout.`;

const CHANNEL_TOPIC = `⚡ ARTiFECT Tweaks Bot — /debloat /drivers /cpuoc /gpuoc /fancontrol /rgb /power → spawns a private tool thread. ⚠️ Use at your own risk — see pinned posts.`;

const THREAD_WARNING =
  "**⚠️⚡ HIGH-TECH DISCLAIMER ⚡⚠️**\n" +
  "These utilities are *NOT* built by ARTifect PCs. Use at your own risk!\n" +
  "If deep Windows tweaks aren’t your thing, consider a **PC Optimizer**: [FPSHUB.org](https://fpshub.org).";

// Simple embed factory
function makeEmbed(item) {
  return new EmbedBuilder()
    .setTitle(item.name)
    .setURL(item.url)
    .setDescription(item.blurb)
    .setColor(0x00ffff);
}

// ===== Register Slash Commands on Boot =====
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

// ===== Ensure a message with marker exists & pinned (idempotent) =====
async function ensurePinnedWithMarker(channel, content, marker) {
  // Check current pins
  const pins = await channel.messages.fetchPins().catch(() => null);
  if (pins) {
    for (const msg of pins.values()) {
      if (msg?.content?.includes(marker)) return false; // already pinned
    }
  }
  // Check recent messages (in case posted but unpinned)
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (recent) {
    for (const msg of recent.values()) {
      if (msg?.content?.includes(marker)) {
        await msg.pin().catch(() => {});
        console.log(`📌 Found existing marker (${marker}); pinned it.`);
        return false;
      }
    }
  }
  // Post fresh and pin
  const posted = await channel.send(content);
  await posted.pin().catch(() => {});
  console.log(`📌 Posted and pinned marker (${marker}).`);
  return true; // newly posted
}

// ===== Unified startup =====
async function startup() {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerSlashCommands();

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel?.isTextBased()) {
      console.error('Configured CHANNEL_ID is not a text-based channel.');
      return;
    }

    await ensurePinnedWithMarker(channel, COMMAND_DECK, COMMAND_DECK_MARKER);
    await ensurePinnedWithMarker(channel, INSTRUCTIONS_AND_WARNING, INSTRUCTIONS_MARKER);

    if (SET_CHANNEL_TOPIC && 'setTopic' in channel) {
      try {
        await channel.setTopic(CHANNEL_TOPIC);
        console.log('📝 Channel topic set.');
      } catch (e) {
        console.warn('Could not set channel topic (missing permission or not a text channel).');
      }
    }
  } catch (e) {
    console.error('Startup pinning error:', e);
  }
}

// Support both v14 and v15 event names:
client.once('ready', startup);
client.once('clientReady', startup);

// ===== Command Handler =====
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = `/${interaction.commandName}`;
  if (!data[cmd]) return;

  // Defer immediately (ephemeral via flags)
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

    // Add the command user to the private thread
    try {
      await thread.members.add(interaction.user.id);
    } catch (addErr) {
      console.error('Failed to add user to thread:', addErr);
      // proceed; they can be added manually if perms block it
    }

    // Pin the disclaimer in the thread
    const warn = await thread.send(THREAD_WARNING);
    await warn.pin().catch(() => {});

    // Post the tool embeds
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

// ===== Go! =====
client.login(TOKEN);
