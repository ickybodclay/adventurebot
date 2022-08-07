// const { generateDependencyReport } = require('@discordjs/voice');
// console.log(generateDependencyReport());

import { Configuration, OpenAIApi } from "openai";

const { 
    createAudioPlayer, 
    createAudioResource, 
    joinVoiceChannel, 
    AudioPlayerStatus, 
    VoiceConnectionStatus 
} = require('@discordjs/voice');

// Require the necessary discord.js classes
const { Client, GatewayIntentBits } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const voiceChannelId = process.env.DISCORD_VOICE_CHANNEL_ID

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
    setupVoice();
});

var channel, connection;

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
  
    if (interaction.commandName === 'hoopsPing') {
      await interaction.reply('Hoops: Pong!');
    } else if (interaction.commandName === 'hoopsJoin') {
        setupVoice();
    } else if (interaction.commandName === 'hoopsLeave') {
        if (!connection) connection.destroy();
    }
  });

// Login to Discord with your client's token
client.login();

function setupVoice() {
    if(!client) return console.error("Please connect to client first!");

    channel = client.channels.get(voiceChannelId); // on-air
    if (!channel) return console.error("The channel does not exist!");

    connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });
    
    const player = createAudioPlayer();
    const subscription = connection.subscribe(player);
    
    const resource = createAudioResource('.data/tmp.mp3');
    player.play(resource);
    
    connection.on(VoiceConnectionStatus.Ready, (oldState, newState) => {
        console.log('Connection is in the Ready state!');
    });
    
    // OR
    // connection.on('stateChange', (oldState, newState) => {
    // 	console.log(`Connection transitioned from ${oldState.status} to ${newState.status}`);
    // });
    
    player.on('error', error => {
        console.error(error);
    });
    
    
    player.on(AudioPlayerStatus.Idle, () => {
        // player.play(getNextResource());
    });
    
    player.on(AudioPlayerStatus.Playing, () => {
        // player.play(getNextResource());
    });
    
    player.on(AudioPlayerStatus.Pause, () => {
        // player.play(getNextResource());
    });
}
