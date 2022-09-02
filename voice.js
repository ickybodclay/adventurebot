// const { generateDependencyReport } = require('@discordjs/voice');
// console.log(generateDependencyReport());

const wait = require('node:timers/promises').setTimeout;
const { Client: DiscordClient, GatewayIntentBits } = require('discord.js');
const { 
    createAudioPlayer, 
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const { Client: TwitchClient } = require("tmi.js");
const express = require("express");
const app = express();

// https://github.com/seiyria/censor-sensor
const { CensorSensor } = require("censor-sensor");
const censor = new CensorSensor();
censor.disableTier(2);
censor.disableTier(3);
censor.disableTier(4);
censor.addWord("rape");
censor.addWord("raping");
censor.addWord("rapist");

const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);
const { gooseGenerate } = require("./goose");
const KoboldAIClient = require("./kobold");
const koboldai = new KoboldAIClient();

const { playMessage, playMessageUD } = require("./tts");
const { escapeJsonValue } = require("./utils");
const TTSQueue = require("./tts-queue");
const queue = new TTSQueue();
koboldai.queue = queue;
queue.processQueue();

const discord = new DiscordClient({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ] 
});

const twitchChannel = process.env.TWITCH_CHANNEL;
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
  channels: [ twitchChannel ],
});

// https://www.npmjs.com/package/@twurple/pubsub
const { PubSubClient } = require("@twurple/pubsub");
const { StaticAuthProvider } = require("@twurple/auth");

// https://twitchapps.com/tmi/ - changed scope to 'channel:read:redemptions'
const twitchPubsubAccessToken = process.env.TWITCH_PUBSUB_OAUTH_TOKEN;
const authProvider = new StaticAuthProvider("", twitchPubsubAccessToken);
const pubSubClient = new PubSubClient();

const IGNORE_REWARDS = [
  "Highlight My Message"
];

const voiceChannelId = process.env.DISCORD_VOICE_CHANNEL_ID
const botName = "K9000"; // Discord bot alias
const botNamePhonetic = "Kay 9000";
var botVoice = "glados-p2"; //"en-US-Wavenet-C";
var channel;

/**
 * DISCORD
 */
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
      const response = await generate(username, prompt);
      matchVoiceAndPlay(queue, `${botName}: ${response}`, botVoice);
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
      matchVoiceAndPlay(queue, message, botVoice);
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
const cmdRegex = new RegExp(/^!!([a-zA-Z0-9]+)(?:\W+)?(.*)?/i);
const queueMax = 6;
const usersInQueue = [];
const voiceOverride = {};

/**
 * TWITCH
 */
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
    // KOBOLDAI ADVENTURE BOT COMMANDS
    else if (koboldai.running && command === "prompt" && koboldai.round === "PROMPT") {
      const prompt = argument;
      if (koboldai.prompts.length > 5) {
        twitch.say(channel, `@${user} sorry, prompts queue currently at maximum`);
      } else {
        koboldai.addPrompt(user, prompt);
        twitch.say(channel, `@${user} prompt added!`);
      }
    }
    else if (koboldai.running && command === "vote" && koboldai.round === "VOTE") {
      const voteIndex = parseInt(argument);
      if (isNaN(voteIndex) || voteIndex < 1 || voteIndex > koboldai.prompts.length) return;
      koboldai.addVote(user, voteIndex - 1);
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
    } else if (command === "setbotvoice") {
      botVoice = argument;
    } else if (command === "clear") {
      usersInQueue.splice(0, usersInQueue.length);
    } 
    // KOBOLDAI ADVENTURE BOT MOD COMMANDS
    else if (command === "abstart") {
      koboldai.startAdventureBot();
    } else if (command === "abstop") {
      koboldai.stopAdvetnureBot();
    } else if (command === "abnewstory") {
      koboldai.newStory();
    } else if (command === "absave") {
      koboldai.saveStory();
    } else if (command === "abremove" && koboldai.round === "PROMPT") {
      const promptIndex = parseInt(argument);
      if (isNaN(promptIndex) || promptIndex < 1 || promptIndex > koboldai.prompts.length) return;
      koboldai.removePrompt(promptIndex - 1);
    }
    
    return;
  }
  
  if (message.startsWith("!")) return;
  
  // if (queue.isConnected() && message.startsWith("$")) {
  //   talkToK9000(queue, channel, user, message.substring(1).trim());
  // }
});

function talkToK9000(queue, channel, user, message, enforceMax=true) {
  const cleanMessage = censor.cleanProfanity(message);
  if (cleanMessage.length == 0) return;
  if (enforceMax && queue.size > queueMax) {
    twitch.say(channel, `@${user} K9000 chat queue is full, please wait & try again.`);
    return;
  }
  if (usersInQueue.includes(user)) {
    twitch.say(channel, `@${user} already has chat pending for K9000, please wait for K9000 to respond.`);
    return;
  }

  usersInQueue.push(user);

  var chatPrompt = "";
  chatPrompt += `${botName} is a friendly AI dog talking to a Twitch user named ${user}. ${botName} talks like a drunken sailor.\n\n`;
  chatPrompt += `${user}: ${cleanMessage}\n${botName}:`;

  // fakeGenerate(user, message); // for testing only
  // gooseGenerate(user, botName, chatPrompt)
  // koboldai.generate(user, botName, chatPrompt)
  generate(user, botName, chatPrompt)
    .then((response) => {
      if (!response) return;
      const cleanResposne = censor.cleanProfanity(response.trim());

      var userVoice = mapUserToVoice(user, VOICES_MAP);
      if (voiceOverride[user]) {
        userVoice = VOICES_MAP[voiceOverride[user]];
      }

      playMessage(queue, `${user}: ${cleanMessage}`, userVoice);
      matchVoiceAndPlay(queue, `${botNamePhonetic}: ${cleanResposne}`, botVoice);
      queue.addBreak(() => { 
        usersInQueue.shift();
        if (channel) twitch.say(channel, `@${user} ${cleanResposne}`);
      });

      // koboldStoryAdd(`${user}: ${cleanMessage}\n${botName}: ${cleanResposne}\n`);
    })
    .catch((err) => {
      console.error(err);
      usersInQueue.shift();
    });
}

/**
 * Initializes Twitch pubsub listener.
 */
async function setupPubsub() {
  console.log("twitch-pubsub listening for channel point redemptions...");
  const userId = await pubSubClient.registerUserListener(authProvider);
  const redeemListener = await pubSubClient.onRedemption(userId, (message) => {
    if (IGNORE_REWARDS.indexOf(message.rewardTitle) > -1) return;
    console.log(`${message.userName} redeemed ${message.rewardTitle} (rewardId=${message.rewardId} status=${message.status} channelId=${message.channelId} userId=${userId})`);
    // https://twurple.js.org/reference/pubsub/classes/PubSubRedemptionMessage.html
    if (message.rewardTitle === "Talk to K9000") {
      console.log(`Talk to K9000 reward for ${message.userDisplayName}`);
      if (!queue.isConnected()) return;
      const user = message.userDisplayName;
      const prompt = message.message.trim();
      talkToK9000(queue, `#${twitchChannel}`, user, prompt, false);
    }
  });
}


/**
 * TTS
 */
const googleVoiceRegex = /^[a-z]{2,3}-[a-z]{2,3}-/i
/**
 * Wrapper function to determine correct TTS service to use for the provided voice.
 */
function matchVoiceAndPlay(queue, message, voice) {
  if (voice.match(googleVoiceRegex)) {
    playMessage(queue, message, voice);
  } else {
    playMessageUD(queue, message, voice);
  }
}

function mapUserToVoice(user, voices) {
  var index = 0;
  for (let i = 0; i < user.length; i++) {
    index += user.charCodeAt(i)
  }
  return voices[index % voices.length];
}

/**
 * OPENAI
 */
async function generate(user, bot, prompt) {  
  try {
    const completion = await openai.createCompletion({
      model: "text-curie-001", //"text-davinci-002",
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
 * EXPRESS
 */
// K9000 Endpoints
app.get("/queue/users", (request, response) => {
  response.json(usersInQueue);
});

// KoboldAI Adventure Bot Endpoints
app.get("/adventurebot/round", (request, response) => {
  response.json({
    round: koboldai.round,
    roundStartTime: koboldai.roundStartTime.getTime(),
    story: koboldai.story,
    prompts: koboldai.prompts,
    votes: koboldai.votes,
    winningPrompt: koboldai.winningPrompt,
    botResponse: koboldai.botResponse
  });
});

function start() {
  console.log("Starting hular hoops bot...");
  console.log(`# of voices available: ${VOICES_MAP.length}`);
  discord.login();
  twitch.connect();
  // setupPubsub();
  const listener = app.listen(process.env.PORT, () => {
    console.log("Your app is listening on port " + listener.address().port);
  });
}

// start();
