// const { generateDependencyReport } = require('@discordjs/voice');
// console.log(generateDependencyReport());

const { Configuration, OpenAIApi } = require('openai');
const { Client, GatewayIntentBits } = require('discord.js');
const { 
    createAudioPlayer, 
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const { playMessage } = require("./tts");
const TTSQueue = require("./tts-queue");

const queue = new TTSQueue();
queue.processQueue();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ] 
});
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const voiceChannelId = process.env.DISCORD_VOICE_CHANNEL_ID
const botName = "K9000";
var channel;

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
  
    if (interaction.commandName === 'k9ping') {
      await interaction.reply('Hoops: Pong!');
    } else if (interaction.commandName === 'k9join') {
      await setupVoice(queue);
      // await interaction.reply({ content: 'Joining voice channel', ephemeral: true});
    } else if (interaction.commandName === 'k9leave') {
      queue.vdisconnect();
      // await interaction.reply({ content: 'Leaving voice channel', ephemeral: true});
    } else if (interaction.commandName === 'k9generate') {
      const username = interaction.user.username;
      const prompt = interaction.options.getString('input');
      playMessage(queue, `${username}: ${prompt}`);
      // const response = await generate(username, prompt); // FIXME: disabled for testing
      const response = "Boom shakalaka!";
      playMessage(queue, `${botName}: ${response}`);
      await interaction.reply({ content: response, ephemeral: true });
    } 
  });

async function setupVoice(queue) {
    if(!client) return console.error("Please connect to client first!");

    channel = await client.channels.fetch(voiceChannelId);
    if (!channel) return console.error("The channel does not exist!");
  
    console.log(`joining voice channel> channelName = ${channel.name}, channelId = ${channel.id}, guildId = ${channel.guild.id}`);

    const connection = joinVoiceChannel({
        channelId: `${channel.id}`,
        guildId: `${channel.guild.id}`,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });
    connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
      console.log('Connection is disconnected...');
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5),
          entersState(connection, VoiceConnectionStatus.Connecting, 5),
        ]);
        // Seems to be reconnecting to a new channel - ignore disconnect
      } catch (error) {
        // Seems to be a real disconnect which SHOULDN'T be recovered from
        connection.destroy();
      }
    });
    connection.on('stateChange', (oldState, newState) => {
      console.log(`Connection transitioned from ${oldState.status} to ${newState.status}`);
    });
    const player = createAudioPlayer();
    player.on('stateChange', (oldState, newState) => {
      console.log(`Audio player transitioned from ${oldState.status} to ${newState.status}`);
    });
    player.on('error', error => {
      console.error(error);
    });
    queue._connection = connection;
    queue._player = player;
    queue._subscription = connection.subscribe(player);
}

async function generate(user, prompt) {
  const chatPrompt = `The following is a conversation with an AI assistant named ${botName}. The assistant is very knowledgable, friendly, and dumb.\n\n${user}: ${prompt}\n${botName}:`;
  const completion = await openai.createCompletion({
    model: "text-davinci-002",
    prompt: chatPrompt,
    temperature: 0.9,
    max_tokens: 150,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6,
    stop: [` ${user}:`, ` ${botName}:`],
  });
  return completion.data.choices[0].text;
}

// Login to Discord with your client's token
client.login();
