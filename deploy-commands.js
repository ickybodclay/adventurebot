const { SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

const clientId = process.env.DISCORD_BOT_CLIENT_ID;
const guildId = process.env.DISCORD_BOT_GUILD_ID;
const token = process.env.DISCORD_TOKEN;

const commands = [
	new SlashCommandBuilder().setName('k9ping').setDescription('Replies with pong!'),
  new SlashCommandBuilder().setName('k9join').setDescription('Joins voice channel'),
  new SlashCommandBuilder().setName('k9leave').setDescription('Leavs voice channel'),
  new SlashCommandBuilder().setName('k9pause').setDescription('Pause TTS queue'),
  new SlashCommandBuilder().setName('k9resume').setDescription('Resume TTS queue'),
  new SlashCommandBuilder()
    .setName('k9generate')
    .setDescription('Generate text based on prompt')
    .addStringOption(option =>
      option.setName('input')
        .setDescription('The prompt to send as input to OpenAI')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('k9tts')
    .setDescription('Adds TTS directly to queue')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('A message for K9000 to say via TTS')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('k9seturl')
    .setDescription('Set the KoboldAI base url')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('the new KoboldAI base url (no trailing /)')
        .setRequired(true)
    ),
]
	.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);