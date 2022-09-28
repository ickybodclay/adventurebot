const { Client: DiscordClient, GatewayIntentBits } = require('discord.js');
const { 
    createAudioPlayer, 
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const { Client: TwitchClient } = require("tmi.js");
const cors = require('cors');
const express = require("express");
const app = express();

const corsOptions = {
  origin: 'https://hular-hoops-stream-overlay.glitch.me',
  methods: "GET",
  exposedHeaders: "Authorization",
}
app.use(cors(corsOptions));

const KoboldAIClient = require("./kobold");
const koboldai = new KoboldAIClient();

const { matchVoiceAndPlay } = require("./tts");
const { wait } = require("./utils");
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
koboldai.twitch = twitch;

const consolere = require("console-remote-client");
consolere.connect({
  server: 'https://console.re', // optional, default: https://console.re
  channel: process.env.CONSOLERE_CHANNEL, // required
  redirectDefaultConsoleToRemote: true, // optional, default: false
  disableDefaultConsoleOutput: true, // optional, default: false
});

const voiceChannelId = process.env.DISCORD_VOICE_CHANNEL_ID
var botVoice = "glados-p2"; //"en-US-Wavenet-C";
var channel;

/**
 * DISCORD
 */
discord.once('ready', () => {
	console.re.log('Ready!');
});

discord.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
  
    if (interaction.commandName === 'k9join') {
      await setupVoice(queue);
      await interaction.reply("Joining voice channel...");
      await wait(1000);
      await interaction.deleteReply();
    } else if (interaction.commandName === 'k9leave') {
      queue.vdisconnect();
      await interaction.reply("Leaving voice channel...");
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
    } else if (interaction.commandName === 'k9generate') {
      const prompt = interaction.options.getString('prompt');
      const genOptions = {
        temperature: 0.6,
        top_p: 1.0,
        max_length: 40, // tokens to generate
      };
      const responses = await koboldai.generate(prompt, genOptions);
      if (responses.length > 0)
        await interaction.reply(`> ${responses[0]}`);
      else {
        await interaction.reply(`Bot response was `);
        await wait(1000);
        await interaction.deleteReply();
      }
    } else if (interaction.commandName === 'k9url') {
      await interaction.reply(`Current KoboldAI Base URL: ${koboldai.baseUrl}`);
    } else if (interaction.commandName === 'k9seturl') {
      const baseUrl = interaction.options.getString('url');
      koboldai.baseUrl = baseUrl;
      await interaction.reply(`KoboldAI Base URL updated!`);
      await wait(1000);
      await interaction.deleteReply();
    } 
  });

async function setupVoice(queue) {
    if(!discord) return console.re.error("Please connect to client first!");

    channel = await discord.channels.fetch(voiceChannelId);
    if (!channel) return console.re.error("The channel does not exist!");
  
    // console.log(`joining voice channel> channelName = ${channel.name}, channelId = ${channel.id}, guildId = ${channel.guild.id}`);

    const connection = joinVoiceChannel({
        channelId: `${channel.id}`,
        guildId: `${channel.guild.id}`,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });
    connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
      console.re.log('Connection is disconnected...');
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
      console.re.log(`! Discord voice connection: ${oldState.status} -> ${newState.status}`);
    });
    const player = createAudioPlayer();
    player.on('error', error => {
      console.re.error(error);
    });
    queue._connection = connection;
    queue._player = player;
    queue._subscription = connection.subscribe(player);
}

const IGNORED_USERS = ["nightbot", "streamelements"];
const cmdRegex = new RegExp(/^!([a-zA-Z0-9]+)(?:\W+)?(.*)?/i);

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
  if (!cmdFound) return;
  var [_, command, argument] = cmdFound;
  command = command.toLowerCase();

  // ADVENTURE BOT USER COMMANDS
  if (koboldai.running && command === "vote" && (koboldai.round === "VOTE" || koboldai.round === "GENERATE")) {
    const voteIndex = Math.abs(parseInt(argument));

    if (isNaN(voteIndex) || voteIndex < 1 || voteIndex > koboldai.botResponses.length) return;

    const success = koboldai.addVote(user, voteIndex - 1);
    if (success) twitch.say(channel, `@${user} vote added for bot response #${voteIndex}!`);
  }

  if (!isOwner && !isMod) return;

  // TTS MOD COMMANDS
  if (command === "aplay") {
    queue.vunpause();
  } else if (command === "apause") {
    queue.vpause();
  } else if (command === "askip") {
    queue.vstop();
  } else if (command === "qplay") {
    queue.resume();
  } else if (command === "qpause") {
    queue.pause();
  } else if (command === "qstop") {
    queue.stop();
  } else if (command === "setbotvoice") {
    botVoice = argument;
    koboldai.voice = argument;
  }
  // ADVENTURE BOT MOD COMMANDS
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
  } else if (command === "abredo" && koboldai.round === "VOTE") {
    koboldai.redo();
  } else if (command === "abretry" && koboldai.round !== "PROMPT") {
    koboldai.retry();
  } else if (command === "abnext") {
    koboldai.nextRound();
  } else if (command === "abaddtime") {
    koboldai.resetRoundTime();
  } else if (command === "prompt" && koboldai.round === "PROMPT") {
    const prompt = argument.trim();
    if (prompt === "") return;
    koboldai.addPrompt(user, prompt);
  }
});

/**
 * EXPRESS
 */
const AB_TOKEN = process.env.AB_TOKEN;
app.get("/adventurebot/events", async (request, response) => {
  if (!request.query.token || request.query.token !== AB_TOKEN) {
    response.status(403).send({ error: 'Forbidden' });
    return;
  }

  response.set({
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive'
  });
  response.flushHeaders();

  response.write('retry: 5000\n\n');
  const intervalId = setInterval(() => {
    const eventData = {
      round: koboldai.round,
      roundStartTime: koboldai.roundStartTime,
      story: koboldai.story,
      currentPrompt: koboldai.currentPrompt,
      botResponses: koboldai.botResponses,
      votes: koboldai.votes,
      winningResponse: koboldai.winningResponse,
    };
    
    response.write('event: heartbeat\n');
    response.write(`data: ${JSON.stringify(eventData)}\n\n`);
  }, 200);
  
  response.on('close', () => {
    console.re.log("AdventureBot> event source client closed");
    clearInterval(intervalId);
    response.end();
  });
});

/**
 * Starts everything need to run Hular Hoops Bot!
 */
function start() {
  console.re.log("Starting hular hoops bot...");
  discord.login();
  twitch.connect();
  const listener = app.listen(process.env.PORT, () => {
    console.re.log("Your app is listening on port " + listener.address().port);
  });
}

start();
