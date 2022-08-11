// const { generateDependencyReport } = require('@discordjs/voice');
// console.log(generateDependencyReport());

const wait = require('node:timers/promises').setTimeout;
const { Configuration, OpenAIApi } = require('openai');
const { Client: DiscordClient, GatewayIntentBits } = require('discord.js');
const { 
    createAudioPlayer, 
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const { Client: TwitchClient } = require("tmi.js");


const { playMessage } = require("./tts");
const { escapeJsonValue } = require("./utils");
const TTSQueue = require("./tts-queue");

const queue = new TTSQueue();
queue.processQueue();

const discord = new DiscordClient({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ] 
});

const twitch = new TwitchClient({
  // options: { debug: true },
  connection: {
    secure: true,
    reconnect: true,
  },
  identity: {
    username: process.env.TWITCH_BOT_USERNAME,
    password: process.env.TWITCH_BOT_TOKEN,
  },
  channels: [process.env.TWITCH_CHANNEL],
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const voiceChannelId = process.env.DISCORD_VOICE_CHANNEL_ID
const botName = "K9000"; // Discord bot alias
var channel;

// When the client is ready, run this code (only once)
discord.once('ready', () => {
	console.log('Ready!');
});

discord.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
  
    if (interaction.commandName === 'k9ping') {
      await interaction.reply('Hoops: Pong!');
    } else if (interaction.commandName === 'k9join') {
      await setupVoice(queue);
      await interaction.reply("Joining voice channel...");
      await wait(1000);
      await interaction.deleteReply();
    } else if (interaction.commandName === 'k9leave') {
      queue.vdisconnect();
      await interaction.reply("Leaving voice channel...");
      await wait(1000);
      await interaction.deleteReply();
    } else if (interaction.commandName === 'k9generate') {
      const username = interaction.user.username;
      const prompt = interaction.options.getString('input');
      playMessage(queue, `${username}: ${prompt}`);
      // const response = await generate(username, prompt); // FIXME: disabled for testing
      const response = "Boom shakalaka!";
      playMessage(queue, `${botName}: ${response}`);
      await interaction.reply(`${botName}: ${response}`);
      await wait(1000);
      await interaction.deleteReply();
    }
  });

async function setupVoice(queue) {
    if(!discord) return console.error("Please connect to client first!");

    channel = await discord.channels.fetch(voiceChannelId);
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
      console.log(`! Discord voice connection: ${oldState.status} -> ${newState.status}`);
    });
    const player = createAudioPlayer();
    // player.on('stateChange', (oldState, newState) => {
    //   console.log(`Audio player transitioned from ${oldState.status} to ${newState.status}`);
    // });
    player.on('error', error => {
      console.error(error);
    });
    queue._connection = connection;
    queue._player = player;
    queue._subscription = connection.subscribe(player);
}

async function generate(user, prompt) {
  const chatPrompt = `The following is a conversation with an AI named ${botName}.\n\n${user}: ${escapeJsonValue(prompt)}\n${botName}:`;
  const completion = await openai.createCompletion({
    model: "text-davinci-002",
    prompt: chatPrompt,
    temperature: 0.6,
    max_tokens: 150,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6,
    stop: [` ${user}:`, ` ${botName}:`],
  });
  return completion.data.choices[0].text;
}

const IGNORED_USERS = ["nightbot", "streamelements"];
// Available Google Text-To-Speech Voices
const VOICES_MAP = [
  // male voices
  "en-US-Wavenet-A",
  "en-US-Wavenet-B",
  "en-US-Wavenet-D",
  "en-US-Wavenet-I",
  "en-US-Wavenet-J",
  "en-GB-Wavenet-B",
  "en-GB-Wavenet-D",
  "en-AU-Wavenet-B",
  "en-AU-Wavenet-D",
  "en-IN-Wavenet-B",
  "en-IN-Wavenet-C",
  "de-DE-Wavenet-D",
  // female voices
  "en-US-Wavenet-C",
  "en-US-Wavenet-E",
  // "en-US-Wavenet-F",
  "en-US-Wavenet-G",
  "en-US-Wavenet-H",
  "en-GB-Wavenet-A",
  "en-GB-Wavenet-C",
  "en-GB-Wavenet-F",
  "en-AU-Wavenet-A",
  "en-AU-Wavenet-C",
  "en-IN-Wavenet-A",
  "en-IN-Wavenet-D"
];
const BOT_VOICE = "en-US-Wavenet-F";
const cmdRegex = new RegExp(/^!!([a-zA-Z0-9]+)(?:\W+)?(.*)?/i);

twitch.on("message", async (channel, userstate, message, self) => {
  // ignore echoed messages & commands
  if (self) return;
  
  const user = userstate.username;
  const isOwner = channel === `#${user}`;
  const isMod = userstate.mod;
  
  if (IGNORED_USERS.indexOf(user) > -1) return;
  
  const cmdFound = message.match(cmdRegex);
  if (cmdFound && (isOwner || isMod)) {
    var [_, command, argument] = cmdFound;
    command = command.toLowerCase();
    
    if (command === "play") {
      queue.vunpause();
    } else if (command === "pause") {
      queue.vpause();
    } else if (command === "skip") {
      queue.vstop();
    } else if (command === "qplay") {
      queue.resume();
    } else if (command === "qpause") {
      queue.pause();
    } else if (command === "qstop") {
      queue.stop();
    }
    
    return;
  }
  
  if (message.startsWith("!")) return;
  
  if (queue.isConnected() && 
      queue.size == 0) {
    const userVoice = mapUserToVoice(user, VOICES_MAP);
    playMessage(queue, `${user}: ${message}`, userVoice);

    const response = await generate(user, message);
    // const response = await fakeGenerate(user, message); // for testing only
    playMessage(queue, `${botName}: ${response}`, BOT_VOICE);
    twitch.say(channel, `@${user} ${response}`);
  }
});

async function fakeGenerate(username, prompt) {
  return `Squak! ${username} says ${prompt}`;
}

function mapUserToVoice(user, voices) {
  var index = 0;
  for (let i = 0; i < user.length; i++) {
    index += user.charCodeAt(i)
  }
  return voices[index % voices.length];
}

function start() {
  console.log("Starting hular hoops bot...");
  discord.login();
  twitch.connect();
}

// start();
