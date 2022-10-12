const { SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

const clientId = process.env.DISCORD_BOT_CLIENT_ID;
const guildId = process.env.DISCORD_BOT_GUILD_ID;
const token = process.env.DISCORD_TOKEN;

const commands = [
  new SlashCommandBuilder().setName('k9join').setDescription('Joins voice channel'),
  new SlashCommandBuilder().setName('k9leave').setDescription('Leavs voice channel'),
  new SlashCommandBuilder().setName('k9pause').setDescription('Pause TTS queue'),
  new SlashCommandBuilder().setName('k9resume').setDescription('Resume TTS queue'),
  new SlashCommandBuilder()
    .setName('k9tts')
    .setDescription('Adds TTS directly to queue')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('A message for K9000 to say via TTS')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('k9generate')
    .setDescription('Generates AI response for given prompt')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('A prompt for the AI')
        .setRequired(true)
    ),
  new SlashCommandBuilder().setName('k9url').setDescription('Get the currently KoboldAI base url'),
  new SlashCommandBuilder()
    .setName('k9seturl')
    .setDescription('Set the KoboldAI base url')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('the new KoboldAI base url (no trailing /)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('ab')
    .setDescription('Adventure Bot commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('prompt')
        .setDescription('submit prompt (only valid during prompt round)')
        .addStringOption(option =>
          option.setName('prompt')
            .setDescription('A prompt for the AI')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('Skip current TTS (if audio present)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('redo')
        .setDescription('regenerate the last response(s) (only valid during vote round)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('retry')
        .setDescription('retry entering the last prompt (only valid during vote round)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('continue')
        .setDescription('submit empty prompt to continue story (only valid during prompt round)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('next')
        .setDescription('skip the countdown and advance to the next round')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('new')
        .setDescription('start a new story (saves previous story to txt file)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('start adventure bot game loop')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('stop adventure bot game loop')
    )
]
	.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);