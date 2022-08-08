// const { generateDependencyReport } = require('@discordjs/voice');
// console.log(generateDependencyReport());

const { Configuration, OpenAIApi } = require('openai');
const { Client, GatewayIntentBits } = require('discord.js');
const { 
    createAudioPlayer, 
    createAudioResource, 
    joinVoiceChannel, 
    AudioPlayerStatus, 
    VoiceConnectionStatus 
} = require('@discordjs/voice');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const voiceChannelId = process.env.DISCORD_VOICE_CHANNEL_ID

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
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
    } else if (interaction.commandName === 'hoopsGenerate') {
        const response = await generate(interaction.message.content);
        await interaction.reply(response);
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
    
    // const resource = createAudioResource('.data/tmp.mp3');
    // player.play(resource);
    
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

async function generate(prompt) {
  const completion = await openai.createCompletion({
    model: "text-davinci-002",
    prompt: prompt,
    temperature: 0.6,
  });
  return completion.data.choices[0].text;
}
