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
// https://www.npmjs.com/package/@twurple/pubsub
// const { PubSubClient } = require("@twurple/pubsub");
// const { StaticAuthProvider } = require("@twurple/auth");

// https://twitchapps.com/tmi/ - changed scope to 'channel:read:redemptions'
// const accessToken = process.env.TWITCH_PUBSUB_OAUTH_TOKEN;
// const authProvider = new StaticAuthProvider("", accessToken);
// const pubSubClient = new PubSubClient();

// const IGNORE_REWARDS = [
//   "Highlight My Message"
// ];

const { playMessage, playMessageUD } = require("./tts");
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
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

const { gooseGenerate } = require("./goose");
const { koboldGenerate } = require("./kobold");

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
      playMessageUD(queue, `${botName}: ${response}`);
      await interaction.reply(`${botName}: ${response}`);
      await wait(1000);
      await interaction.deleteReply();
    } else if (interaction.commandName === 'k9pause') {
      queue.pause();
      await interaction.reply('TTS queue paused');
    } else if (interaction.commandName === 'k9resume') {
      queue.resume();
      await interaction.reply('TTS queue resumed');
    } else if (interaction.commandName === 'k9tts') {
      const message = interaction.options.getString('message');
      playMessage(queue, message);
      await interaction.reply(`Message added to TTS queue.`);
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

const IGNORED_USERS = ["nightbot", "streamelements"];
// Available Google Text-To-Speech Voices
const VOICES_MAP = [
  // male voices
  "en-US-Wavenet-A", // !!setvoice 1
  "en-US-Wavenet-B",
  "en-US-Wavenet-D",
  "en-US-Wavenet-I",
  "en-US-Wavenet-J",
  "en-GB-Wavenet-B",
  "en-GB-Wavenet-D",
  "en-AU-Wavenet-B",
  "en-AU-Wavenet-D",
  // "en-IN-Wavenet-B",
  // "en-IN-Wavenet-C",
  "de-DE-Wavenet-D",
  // female voices
  "en-US-Neural2-A", 
  "en-GB-Neural2-A",
  "en-GB-Neural2-C",
  "en-AU-Neural2-A",
  "en-AU-Neural2-C",
  // "en-US-Wavenet-C",
  "en-US-Wavenet-E",
  "en-US-Wavenet-F",
  "en-US-Wavenet-G",
  "en-US-Wavenet-H",
  "en-GB-Wavenet-A",
  "en-GB-Wavenet-C",
  "en-GB-Wavenet-F",
  "en-AU-Wavenet-A",
  "en-AU-Wavenet-C", // !!setvoice 24
  // "en-IN-Wavenet-A",
  // "en-IN-Wavenet-D",
];
const BOT_VOICE = "glados";
const cmdRegex = new RegExp(/^!!([a-zA-Z0-9]+)(?:\W+)?(.*)?/i);
const queueMax = 6;
const usersInQueue = {};
const voiceOverride = {};
var firstMessage = true;

twitch.on("message", (channel, userstate, message, self) => {
  // ignore echoed messages & commands
  if (self) return;
  
  const user = userstate.username;
  const isOwner = channel === `#${user}`;
  const isMod = userstate.mod;
  const isVip = userstate.badges != null && userstate.badges.vip;
  const isSubscriber = userstate.subscriber;
  const isReward = userstate["custom-reward-id"] != null;
  
  if (IGNORED_USERS.indexOf(user) > -1) return;
  
  const cmdFound = message.match(cmdRegex);
  if (cmdFound) {
    var [_, command, argument] = cmdFound;
    command = command.toLowerCase();
    
    if (command === "setvoice") {
      var voiceIndex = parseInt(argument);
      if (isNaN(voiceIndex) || voiceIndex < 1 || voiceIndex > VOICES_MAP.length) {
        voiceIndex = 1;
      }
      voiceOverride[user] = voiceIndex - 1;
      twitch.say(channel, `@${user} your TTS voice has been set to ${VOICES_MAP[voiceOverride[user]]}`);
    }
    
    if (!isOwner && !isMod) return;
    
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
      message.startsWith("$")) {
    const cleanMessage = censor.cleanProfanity(message.substring(1).trim());
    if (cleanMessage.length == 0) return;
    if (queue.size > queueMax) {
      twitch.say(channel, `@${user} K9000 chat queue is full, please wait & try again.`);
      return;
    }
    if (usersInQueue[user]) {
      twitch.say(channel, `@${user} already has chat pending for K9000, please wait for K9000 to respond.`);
      return;
    }
    
    usersInQueue[user] = true;
    
    var chatPrompt = "";
    // for KoboldAI only, use story and memory
    // if (firstMessage) {
    //   chatPrompt += `${botName} is an AI chatbot talking to a Twitch user named ${user}.  ${botName} responds like a News Anchor.\n\n`;
    //   firstMessage = false;
    // }
    chatPrompt += `${botName} is a friendly AI dog talking to a human named ${user}. ${botName} is wacky, weird, and likes to use a lot of flowery words.\n\n`;
    chatPrompt += `${user}: ${cleanMessage}\n${botName}:`;

    // fakeGenerate(user, message); // for testing only
    // gooseGenerate(user, botName, chatPrompt)
    // koboldGenerate(user, botName, chatPrompt)
    generate(user, botName, chatPrompt)
      .then((response) => {
        if (!response) return;
        const cleanResposne = censor.cleanProfanity(response.trim());
      
        var userVoice = mapUserToVoice(user, VOICES_MAP);
        if (voiceOverride[user]) {
          userVoice = VOICES_MAP[voiceOverride[user]];
        }

        playMessage(queue, `${user}: ${cleanMessage}`, userVoice);
        playMessageUD(queue, `${botName}: ${cleanResposne}`, BOT_VOICE);
        queue.addBreak(() => { 
          usersInQueue[user] = false; 
          twitch.say(channel, `@${user} ${cleanResposne}`);
        });  
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

async function generate(user, bot, prompt) {  
  try {
    const completion = await openai.createCompletion({
      model: "text-davinci-002",
      prompt: escapeJsonValue(prompt),
      temperature: 0.9,
      max_tokens: 100,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: [` ${user}:`, ` ${bot}:`]
    });
    return completion.data.choices[0].text;
  } catch (ex) {
    console.error(`openai generate error ${ex.name}: ${ex.message}`);
    if (ex.response) {
      console.error(ex.response.data);
    } else {
      console.error(ex.stack);
    }
  }
  
  return null;
}

async function fakeGenerate(username, prompt) {
  return `Squak! ${username} says ${prompt}`;
}

/**
 * Initializes Twitch pubsub listener.
 */
// async function setupPubsub() {
//   console.log("twitch-pubsub listening for channel point redemptions...");
//   const userId = await pubSubClient.registerUserListener(authProvider);
//   const redeemListener = await pubSubClient.onRedemption(userId, (message) => {
//     if (IGNORE_REWARDS.indexOf(message.rewardTitle) > -1) return;
//     console.log(`${message.userName} redeemed ${message.rewardTitle} (rewardId=${message.rewardId})`);
//     // https://twurple.js.org/reference/pubsub/classes/PubSubRedemptionMessage.html
//     if (message.rewardTitle === "Talk to K9000") {
//       if (!queue.isConnected()) return;
//       const user = message.userName;
//       const formattedMessage = censor.cleanProfanity(message.rewardPrompt.trim());
//       if (formattedMessage.length == 0) return;
//       usersInQueue[user] = true;
//       // fakeGenerate(user, message); // for testing only
//       generate(user, formattedMessage)
//         .then((response) => {
//           const cleanResposne = censor.cleanProfanity(response.trim());
//           var userVoice = mapUserToVoice(user, VOICES_MAP);
//           if (voiceOverride[user]) {
//             userVoice = VOICES_MAP[voiceOverride[user]];
//           }
//           playMessage(queue, `${user}: ${formattedMessage}`, userVoice);
//           playMessage(queue, `${botName}: ${cleanResposne}`, BOT_VOICE);
//           queue.addBreak();
//         });
//     }
//   });
// }

function start() {
  console.log("Starting hular hoops bot...");
  console.log(`# of voices available: ${VOICES_MAP.length}`);
  discord.login();
  twitch.connect();
  // setupPubsub();
}

// start();
