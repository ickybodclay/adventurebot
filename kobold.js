const fetch = require("node-fetch");
const fs = require('fs');
const { matchVoiceAndPlay } = require("./tts");
const TTSQueue = require("./tts-queue");
const { json } = require("./utils");

module.exports = class KoboldAIClient {
  constructor() {
    // please make sure you are using KoboldAI United version for API
    this.baseUrl = process.env.KOBOLDAI_BASE_URL;
    this.prompts = [];
    this.votes = [];
    this._round = "START"; // START, [PROMPT, GENERATE, VOTE]
    this.roundStartTime = null;
    this.voteRoundTimeInMs = 2*60*1000;
    this.running = false;
    this._queue = null;
    this.voice = "en-US-Wavenet-C";
    this._twitch = null;
    this.channel = process.env.TWITCH_CHANNEL;
    this.currentPrompt = null;
    this.botResponses = [];
    this.winningResponse = null;
    this.botResponseCount = 3;
  }
  
  newStory() {
    console.re.log("starting a new story...");
    this.reset();
  }
  
  startAdventureBot() {
    this.running = true;
    this.round = "PROMPT";
    this.runAdventureBot();
  }

  stopAdvetnureBot() {
    this.running = false;
    this.roundStartTime = null;
  }
  
  saveStory(callback = () => {}) {
    console.re.log("saving current story...");
    this.saveStoryRemote();
    if (callback) callback();
  }
  
  reset() {
    this.round = "START";
    this.running = false;
    this.clearVotes();
    this.clearBotResponses();
    this.currentPrompt = null;
    this.winningResponse = null;
    this.roundStartTime = null;
  }
  
  get round() { return this._round; }
  
  set round(newRound) {
    if (
      newRound === "START" ||
      newRound === "PROMPT" ||
      newRound === "VOTE" ||
      newRound === "GENERATE"
    ) {
      this._round = newRound;
    }
  }
  
  /**
   * Set the TTS queue to use for adventure bot.
   * @param {!TTSQueue} newQueue text-to-speech queue to use for adventure bot
   */
  set queue(newQueue) {
    this._queue = newQueue;
  }
  
  set twitch(twitchClient) {
    this._twitch = twitchClient;
  }
  
  addPrompt(user, prompt) {
    if (this.round !== "PROMPT") return false; // only allow new prompts during prompt round
    // if (this.prompts.map((item) => item.user).indexOf(user) != -1) return false; // limit 1 per user
    this.prompts.push({user: user, prompt: prompt});
    return true;
  }
  
  removePrompt(promptIndex) {
    this.prompts.splice(promptIndex, 1);
    console.log(`removed prompt ${promptIndex}`);
  }
  
  clearPrompts() {
    this.prompts.splice(0, this.prompts.length);
    console.log("cleared prompts");
  }
  
  addVote(user, vote) {
    if (this.votes.map((item) => item.user).indexOf(user) != -1) return false;
    this.votes.push({user: user, vote: vote});
    return true;
  }
  
  clearVotes() {
    this.votes.splice(0, this.votes.length);
    console.log("cleared votes");
  }
  
  clearBotResponses() {
    this.botResponses.splice(0, this.botResponses.length);
    console.log("cleared bot responses");
  }
  
  // KoboldAI API Endpoints
  
  generate(user, bot, prompt, outputs=1) {
    const requestUrl = `${this.baseUrl}/api/v1/generate`;
    const postData = {
      prompt: prompt,
      use_story: true,
      use_memory: true,
      use_authors_note: true,
      disable_output_formatting: false,
      n: outputs // number of outputs to generate
    };
    return fetch(requestUrl, {
      method: "post",
      body: JSON.stringify(postData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then(json)
      .then((data) => {
        console.log(`KoboldAI:generate> ${JSON.stringify(data)}`);
        if (data && data.results && data.results.length > 0)
          return data.results;
        return [];
      })
      .catch((ex) => {
        console.re.error(`KoboldAI:generate> error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.re.error(ex.response.data);
        } else {
          console.re.error(ex.stack);
        }
        return [];
      });
  }
  
  addStory(prompt) {
    const requestUrl = `${this.baseUrl}/api/v1/story/end`;
    const postData = {
      prompt: prompt.prompt
    };
    return fetch(requestUrl, {
      method: "post",
      body: JSON.stringify(postData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then((res) => {
        console.re.log("KoboldAI> added story end");
      })
      .catch((ex) => {
        console.re.error(`koboldai add story end error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.re.error(ex.response.data);
        } else {
          console.re.error(ex.stack);
        }
      });
  }
  
  removeStoryEnd() {
    const requestUrl = `${this.baseUrl}/api/v1/story/end/delete`;
    const postData = {};
    return fetch(requestUrl, {
      method: "post",
      body: JSON.stringify(postData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then((res) => {
        console.re.log("KoboldAI> removed story end");
      })
      .catch((ex) => {
        console.re.error(`koboldai remove story end error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.re.error(ex.response.data);
        } else {
          console.re.error(ex.stack);
        }
      });
  }
  
  saveStoryRemote() {
    const requestUrl = `${this.baseUrl}/api/v1/story/save`;
    const saveName = `AdventureBot-${new Date(Date.now()).toISOString().replaceAll(':', '-')}`; 
    const postData = {
      name: saveName
    };
    return fetch(requestUrl, {
      method: "put",
      body: JSON.stringify(postData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then((res) => {
        console.re.log(`KoboldAI> saved story '${saveName}'`);
      })
      .catch((ex) => {
        console.re.error(`koboldai save story error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.re.error(ex.response.data);
        } else {
          console.re.error(ex.stack);
        }
      });
  }
  
  // ADVENTURE BOT
  
  calculateWinningPrompt(prompts, votes) {
    const voteTotals = prompts.map((item) => 0);
    for (let i=0; i<votes.length; ++i) {
      voteTotals[votes[i].vote]++;
    }
    var topPromptIndexes = [];
    var maxVote = -1;
    for (let i=0; i<voteTotals.length; ++i) {
      if (voteTotals[i] > maxVote) {
        topPromptIndexes = [];
        topPromptIndexes.push(i);
        maxVote = voteTotals[i];
      } else if (voteTotals[i] == maxVote) {
        topPromptIndexes.push(i);
      }
    }
    var topPromptIndex = -1;
    if (topPromptIndexes.length > 0) {
      // random tie breaker
      topPromptIndex = topPromptIndexes[Math.floor(Math.random() * topPromptIndexes.length)];
    }
    var topPrompt; 
    if (topPromptIndex == -1) {
      topPrompt = prompts[0];
      maxVote = 0;
    } else {
      topPrompt = prompts[topPromptIndex];
    }
    const response = {
      user: topPrompt.user, 
      prompt: topPrompt.prompt, 
      votes: maxVote
    };
    return response;
  }
  
  redo() {
    console.re.log("KoboldAI> redo previous action");
    
    if (this.round !== "VOTE") return;
    this.clearBotResponses();
    this.clearVotes();
    this.round = "GENERATE";
    this.roundStartTime = null;
  }
  
  nextRound() {
    this.roundStartTime = 1;
  }
  
  resetRoundTime() {
    this.roundStartTime = null;
  }
  
  async runAdventureBot() {
    if (!this.running) return;
    
    if (!this.roundStartTime) { // start of a new round
      this.roundStartTime = Date.now();
      
      if (this.round === "VOTE") {
        if (this._twitch) this._twitch.say(`#${this.channel}`, "Vote for your favorite AI response (ex '!!vote 1')");
        if (this._queue) matchVoiceAndPlay(this._queue, "Vote for your favorite AI response!", this.voice);
      }
    }
    
    const tickTime = Date.now();
    const deltaInMs = tickTime - this.roundStartTime;
    
    if (this.round === "PROMPT") {
      // no time limit, whenever a prompt is submitted by the DM
      if (this.prompts.length == 1) {
        this.round = "GENERATE";
        this.currentPrompt = this.prompts[0];
        await this.addStory(this.currentPrompt);
        this.roundStartTime = null;
        
        if (this._queue) matchVoiceAndPlay(this._queue, this.currentPrompt.prompt, this.voice);
      }
    } else if (this.round === "GENERATE") {
      if (this.botResponses.length == 0) {
        const genResponse = await this.generate(this.currentPrompt.user, "ai", "", this.botResponseCount);
        
        this.botResponses = genResponse.map((item) => {
          const response = { user: "ai", prompt: item.text.trim()};
          return response;
        });
        
        if (this.botResponses.length == 0) {
          console.re.warn(`KoboldAI:generate> bot response was empty`);
        } else {
          if (this._queue) {
            // TTS all the bot response options
            for(let i=0; i<this.botResponses.length; ++i) {
              matchVoiceAndPlay(this._queue, `Option ${i+1}: ${this.botResponses[i].prompt}`, this.voice);
            }
            // 1 second break then go to voice round
            this._queue.addBreak(() => {
              this.round = "VOTE";
              this.winningResponse = null;
              this.roundStartTime = null;
            });
          }
        }
      }
    } else if (this.round === "VOTE") {
      if (deltaInMs > this.voteRoundTimeInMs) {
        this.round = "PROMPT";
        this.winningResponse = this.calculateWinningPrompt(this.botResponses, this.votes);
        await this.addStory(this.winningResponse);
        
        this.clearPrompts();
        this.clearBotResponses();
        this.clearVotes();
        this.currentPrompt = null;
        this.roundStartTime = null;
        
        if (this._twitch) this._twitch.say(`#${this.channel}`, this.winningResponse.prompt);
        if (this._queue) matchVoiceAndPlay(this._queue, this.winningResponse.prompt, this.voice);
      }
    } 

    setTimeout(this.runAdventureBot.bind(this), 100);
  }
};
