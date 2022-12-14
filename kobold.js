const fetch = require("node-fetch");
const fs = require('fs');
const { matchVoiceAndPlay } = require("./tts");
const TTSQueue = require("./tts-queue");
const { json } = require("./utils");
const { censor } = require("./censor");

module.exports = class KoboldAIClient {
  constructor() {
    this.loadBaseUrl();
    this.prompts = [];
    this.votes = [];
    this._round = "START"; // START, [PROMPT, GENERATE, VOTE], END
    this.roundStartTime = null;
    this.voteRoundTimeInMs = 90*1000; // 90 seconds
    this.running = false;
    this._queue = null;
    this.voice = "en-US-Wavenet-C";
    this._twitch = null;
    this.channel = process.env.TWITCH_CHANNEL;
    this.currentPrompt = null;
    this.botResponses = [];
    this.winningResponse = null;
    this.botResponseCount = 3;
    this.lastVoteTime = null;
    this.voteTimeoutInMs = 30*1000;
    this.endPromot = null;
    this.endResponse = null;
    this.saved = false;
  }
  
  loadBaseUrl() {
    fs.readFile(".data/kobold_base_url.txt", "utf-8", (err, data) => {
      if (err) console.re.error(err);
      else {
        this.baseUrl = data;
        console.re.log("Loaded KoboldAI base url");
      }
    });
  }
  
  async saveBaseUrl(baseUrl) {
    this.baseUrl = baseUrl;
    fs.writeFile(".data/kobold_base_url.txt", baseUrl, "utf-8", (err) => {
      if (err) console.re.error(err);
      else console.re.log("Saved KoboldAI base url!");
    });
  }
  
  async newStory() {
    console.re.log("starting a new story...");
    if (!this.saved) await this.saveStoryRemote();
    await this.clearStory();
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
    console.re.log("resetting adventure bot...");
    this.round = "START";
    this.running = false;
    this.clearVotes();
    this.clearBotResponses();
    this.currentPrompt = null;
    this.winningResponse = null;
    this.roundStartTime = null;
    this.endPromot = null;
    this.endResponse = null;
    this.saved = false;
  }
  
  get round() { return this._round; }
  
  set round(newRound) {
    if (
      newRound === "START" ||
      newRound === "PROMPT" ||
      newRound === "VOTE" ||
      newRound === "GENERATE" ||
      newRound === "END"
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
    if (!prompt) return false;
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
    this.lastVoteTime = Date.now();
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
  
  generate(prompt, options={}) {
    const requestUrl = `${this.baseUrl}/api/v1/generate`;
    const postData = {
      prompt: prompt,
      ...options
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
    if (!prompt || !prompt.prompt) {
      console.re.warn("KoboldAI> prompt is missing");
      return;
    }
    
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
        this.saved = false;
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
        this.saved = true;
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
  
  getCurrentModel() {
    const requestUrl = `${this.baseUrl}/api/v1/model`;
    return fetch(requestUrl, {
      method: "get",
      headers: {
        'Accept': 'application/json'
      }
    })
      .then(json)
      .then((data) => {
        return data.result;
      })
      .catch((ex) => {
        console.re.error(`koboldai get model error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.re.error(ex.response.data);
        } else {
          console.re.error(ex.stack);
        }
        return "error fetching model name";
      });
  }
  
  clearStory() {
    const requestUrl = `${this.baseUrl}/api/v1/story`;
    return fetch(requestUrl, {
      method: "delete",
      headers: {
        'Accept': 'application/json'
      }
    })
      .then((res) => {
        console.re.log(`KoboldAI> cleared story`);
      })
      .catch((ex) => {
        console.re.error(`koboldai clear story error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.re.error(ex.response.data);
        } else {
          console.re.error(ex.stack);
        }
        return "error clearing story";
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
    if (this.round !== "VOTE") return;
    
    console.re.log("KoboldAI> redo previous action");
    
    this.clearBotResponses();
    this.clearVotes();
    this.round = "GENERATE";
    this.roundStartTime = null;
    this.lastVoteTime = null;
  }
  
  retry() {
    if (this.round !== "VOTE") return;
    
    console.re.log("KoboldAI> retry prompt");
    
    this.round = "PROMPT";
    this.clearPrompts();
    this.clearBotResponses();
    this.clearVotes();
    this.roundStartTime = null;
    this.currentPrompt = null;
    this.lastVoteTime = null;
  }
  
  nextRound() {
    this.roundStartTime = 1;
  }
  
  resetRoundTime() {
    this.roundStartTime = null;
  }
  
  async endStory() {
    if (this.round !== "PROMPT") return;

    console.re.log("KoboldAI> ending the story");

    this.round = "END";
    this.running = false;
    const endOptions = [
      "\nThe moral of the story:",
      "\nEpilogue:",
      "\nIn the sequel:"
    ];
    this.endPrompt = `The end. ${endOptions[Math.floor(Math.random()*endOptions.length)]}`;
    const genOptions = {
      use_story: true,
      use_memory: true,
      use_authors_note: true,
      disable_output_formatting: false
    };
    if (this._queue) matchVoiceAndPlay(this._queue, this.endPrompt, this.voice);
    const rawResponse = await this.generate(this.endPrompt, genOptions);
    if (rawResponse && rawResponse.length > 0) {
      this.endResponse = censor(rawResponse[0].text);
      if (this._queue) matchVoiceAndPlay(this._queue, this.endResponse, this.voice);
      await this.addStory({ prompt: this.endPrompt });
      await this.addStory({ prompt: this.endResponse });
      await this.saveStoryRemote();
    }
  }
  
  async runAdventureBot() {
    if (!this.running) return;
    
    if (!this.roundStartTime) { // start of a new round
      this.roundStartTime = Date.now();
      
      if (this.round === "VOTE") {
        if (this._twitch) this._twitch.say(`#${this.channel}`, "Vote for your favorite AI response (ex '!vote 1')");
        if (this._queue) matchVoiceAndPlay(this._queue, "Vote for your favorite AI response!", this.voice);
      }
    }
    
    const tickTime = Date.now();
    const timeSinceRoundStartInMs = tickTime - this.roundStartTime;
    
    if (this.round === "PROMPT") {
      // no time limit, whenever a prompt is submitted by the DM
      if (this.prompts.length == 1) {
        this.round = "GENERATE";
        this.currentPrompt = this.prompts[0];
        this.roundStartTime = null;
        this.lastVoteTime = null;
        
        if (this._queue) matchVoiceAndPlay(this._queue, this.currentPrompt.prompt, this.voice);
      }
    } else if (this.round === "GENERATE") {
      if (this.botResponses.length == 0) {
        const genOptions = {
          use_story: true,
          use_memory: true,
          use_authors_note: true,
          disable_output_formatting: false,
          n: this.botResponseCount
        };
        const genResponse = await this.generate(this.currentPrompt.prompt, genOptions);
        
        this.botResponses = genResponse.map((item) => {
          const response = { user: "ai", prompt: censor(item.text.trim())};
          return response;
        });
        
        if (this.botResponses.length == 0) {
          console.re.warn(`KoboldAI:generate> bot response was empty`);
        } else {
          if (this._queue && this._queue.isConnected()) {
            // TTS all the bot response options
            for(let i=0; i<this.botResponses.length; ++i) {
              matchVoiceAndPlay(this._queue, `Option ${i+1}: ${this.botResponses[i].prompt}`, this.voice);
            }
            // 1 second break then go to vote round
            this._queue.addBreak(() => {
              this.round = "VOTE";
              this.winningResponse = null;
              this.roundStartTime = null;
            });
          } else {
            this.round = "VOTE";
            this.winningResponse = null;
            this.roundStartTime = null;
          }
        }
      }
    } else if (this.round === "VOTE") {
      if (this.lastVoteTime && this.lastVoteTime < this.roundStartTime) this.lastVotTime = this.roundStartTime;
      const shouldVoteTimeout = this.lastVoteTime && (tickTime - this.lastVoteTime) > this.voteTimeoutInMs;
      
      if (timeSinceRoundStartInMs > this.voteRoundTimeInMs || shouldVoteTimeout) {
        this.round = "PROMPT";
        this.winningResponse = this.calculateWinningPrompt(this.botResponses, this.votes);
        await this.addStory(this.currentPrompt);
        await this.addStory(this.winningResponse);
        
        this.clearPrompts();
        this.clearBotResponses();
        this.clearVotes();
        this.currentPrompt = null;
        this.roundStartTime = null;
        this.lastVoteTime = null;
        
        if (this._twitch) this._twitch.say(`#${this.channel}`, this.winningResponse.prompt);
        if (this._queue) matchVoiceAndPlay(this._queue, this.winningResponse.prompt, this.voice);
      }
    } 

    setTimeout(this.runAdventureBot.bind(this), 100);
  }
};
