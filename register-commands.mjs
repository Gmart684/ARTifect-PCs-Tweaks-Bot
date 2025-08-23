import fs from 'node:fs';
import { REST, Routes } from 'discord.js';

const commands = JSON.parse(fs.readFileSync('./commands.json', 'utf-8'));
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_APP_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log("✅ Registered guild commands.");
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_APP_ID),
        { body: commands }
      );
      console.log("✅ Registered global commands.");
    }
  } catch (err) {
    console.error(err);
  }
})();
