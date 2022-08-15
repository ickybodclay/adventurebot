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
const { CensorSensor } = require("censor-sensor");


const { playMessage } = require("./tts");
const { escapeJsonValue } = require("./utils");
const TTSQueue = require("./tts-queue");

// https://github.com/seiyria/censor-sensor
const censor = new CensorSensor();
censor.disableTier(2);
censor.disableTier(3);
censor.disableTier(4);
censor.addWord("rape");
censor.addWord("raping");
censor.addWord("rapist");

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
  // apiKey: process.env.GOOSE_API_KEY,
  // basePath: 'https://api.goose.ai/v1',
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
    } else if (interaction.commandName === 'k9pause') {
      queue.pause();
      await interaction.reply('TTS queue paused');
    } else if (interaction.commandName === 'k9resume') {
      queue.resume();
      await interaction.reply('TTS queue resumed');
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
const queueMax = 10;

twitch.on("message", (channel, userstate, message, self) => {
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
      // queue.size == 0 &&
      // !queue.isPlaying &&
      message.startsWith("$")) {
    const formattedMessage = censor.cleanProfanity(message.substring(1).trim());
    if (formattedMessage.length == 0) return;
    if (queue.size > queueMax) {
      twitch.say(channel, `@${user} K9000 chat queue is full, please wait & try again.`);
      return;
    }
    
    const userVoice = mapUserToVoice(user, VOICES_MAP);
    
    // fakeGenerate(user, message); // for testing only
    generate(user, formattedMessage)
      .then((response) => {
        const cleanResposne = censor.cleanProfanity(response.trim());

        playMessage(queue, `${user}: ${formattedMessage}`, userVoice);
        playMessage(queue, `${botName}: ${cleanResposne}`, BOT_VOICE);
        // twitch.say(channel, `@${user} ${response}`);
      });
  }
});

function mapUserToVoice(user, voices) {
  var index = 0;
  for (let i = 0; i < user.length; i++) {
    index += user.charCodeAt(i)
  }
  return voices[index % voices.length];
}

const recentChats = [];
const recentChatMax = 10;
async function generate(user, prompt) {
  var chatPrompt = `${botName} is an AI chatbot that has an answer for everything, even if it's incorrect. ${botName} is helpful, creative, and enthusiastic.\n\n`;
  if (recentChats.length > 0) recentChats.forEach(chat => chatPrompt += `${chat.user}: ${escapeJsonValue(chat.message)}\n`);
  chatPrompt += `${user}: ${escapeJsonValue(prompt)}\n${botName}:`;
  
  const completion = await openai.createCompletion({
    model: "text-davinci-002", // "gpt-neo-20b",
    prompt: chatPrompt,
    temperature: 0.9,
    max_tokens: 150,
    top_p: 1,
    frequency_penalty: 0.35,
    presence_penalty: 0,
    stop: [` ${user}:`, ` ${botName}:` ]
  });
  const response = completion.data.choices[0].text;
  
  recentChats.push({user: user, message: prompt});
  if (recentChats.length > recentChatMax) recentChats.shift();
  
  recentChats.push({user: botName, message: response});
  if (recentChats.length > recentChatMax) recentChats.shift();
  
  return response;
}

async function fakeGenerate(username, prompt) {
  return `Squak! ${username} says ${prompt}`;
}

function start() {
  console.log("Starting hular hoops bot...");
  discord.login();
  twitch.connect();
}

start();
