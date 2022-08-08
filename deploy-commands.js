const { SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

const clientId = "";
const guildId = "";
const token = "";

const commands = [
	new SlashCommandBuilder().setName('hoopsPing').setDescription('Replies with pong!'),
  new SlashCommandBuilder().setName('hoopsJoin').setDescription('Joins voice channel'),
  new SlashCommandBuilder().setName('hoopsLeave').setDescription('Leavs voice channel'),
  new SlashCommandBuilder().setName('hoopsGenerate').setDescription('Generate text based on prompt')
]
	.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);