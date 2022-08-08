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
  
    if (interaction.commandName === 'k9ping') {
      await interaction.reply('Hoops: Pong!');
    } else if (interaction.commandName === 'k9join') {
      setupVoice();
      await interaction.reply({ content: 'Joining voice channel', ephemeral: true});
    } else if (interaction.commandName === 'k9leave') {
      if (!connection) connection.destroy();
      await interaction.reply({ content: 'Leaving voice channel', ephemeral: true});
    } else if (interaction.commandName === 'k9generate') {
      const response = await generate(interaction.user.username, interaction.options.getString('input'));
      await interaction.reply({ content: response, ephemeral: true });
    } 
  });

// Login to Discord with your client's token
//client.login();

function setupVoice() {
    if(!client) return console.error("Please connect to client first!");

    channel = client.channels.cache.get(voiceChannelId);
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

async function generate(user, prompt) {
  const chatPrompt = `The following is a conversation with an AI assistant named K9000. The assistant is very friendly, creative, and dumb.\n\n${user}: ${prompt}\nK9000:`;
  const completion = await openai.createCompletion({
    model: "text-davinci-002",
    prompt: chatPrompt,
    temperature: 0.9,
    max_tokens: 150,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6,
    stop: [` ${user}:`, " K9000:"],
  });
  return completion.data.choices[0].text;
}
