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

    // Create a PRIVATE thread and make it invitable
    const thread = await targetChannel.threads.create({
      name: `${interaction.user.username}-${interaction.commandName}`,
      autoArchiveDuration: 60,
      type: ChannelType.PrivateThread,
      invitable: true, // allow adding non-moderators
      reason: `Thread for ${interaction.user.tag} - ${interaction.commandName}`
    });

    // ✅ Add the command user to the private thread
    try {
      await thread.members.add(interaction.user.id);
    } catch (addErr) {
      console.error('Failed to add user to thread:', addErr);
      // We'll still proceed; user can’t see it until added manually
    }

    // Pin the disclaimer
    const warningMsg = await thread.send(WARNING);
    await warningMsg.pin().catch(() => {});

    // Post the embeds
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
