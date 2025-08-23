# ARTiFECT PCs Utility Bot

Discord bot that lists PC utilities/tweaks via slash commands, creates a **private thread** per request, and maintains a **pinned Command Deck** message in a specific channel.

## Files
- `package.json` – Node module manifest (Railway-ready).
- `data.json` – All tool entries (name, url, blurb) for `/debloat`, `/drivers`, `/cpuoc`, `/gpuoc`, `/fancontrol`, `/rgb`, `/power`.
- `commands.json` – Slash command definitions.
- `index.mjs` – Bot logic. Restricts posting to a specific channel, ensures a one-time pinned Command Deck, and creates private threads with a pinned disclaimer.
- `register-commands.mjs` – Registers commands using your env vars.

## Railway Env Vars
Set these in Railway → Variables:
- `DISCORD_TOKEN` – Your bot token.
- `DISCORD_APP_ID` – Your application (client) ID.
- `GUILD_ID` – Optional; for fast guild-local command registration.
- `CHANNEL_ID` – **Required**; the text channel where the bot posts & creates threads.

## Register Commands
On Railway shell (or locally with env vars set):
```bash
npm run register
```

## Start Bot
Railway will run:
```bash
npm start
```

## Permissions
Bot role needs:
- Create Private Threads
- Send Messages in Threads
- Manage Threads
- Send Messages
- Read Message History
- (Recommended) Embed Links, Use External Emojis
