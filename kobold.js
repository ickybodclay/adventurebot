const fetch = require("node-fetch");
const fs = require('fs');
const { playMessage } = require("./tts");
const TTSQueue = require("./tts-queue");
const { json } = require("./utils");

module.exports = class KoboldAIClient {
  constructor() {
    // please make sure you are using KoboldAI United version for API
    this.baseUrl = process.env.KOBOLDAI_BASE_URL;
    this.story = [];
    this.prompts = [];
    this.votes = [];
    this._round = "START"; // START, [PROMPT, VOTE, GENERATE]
    this.roundStartTime = null;
    this.promptRoundTimeInMs = 2*60*1000; // not used in v2
    this.voteRoundTimeInMs = 2*60*1000; // 1 min v1, 2 min v2
    this.generateRoundTimeInMs = 1*60*1000; // not used in v2
    this.winningPrompt = null;
    this.botResponse = null;
    this.running = false;
    this._queue = null;
    this.voice = "en-US-Wavenet-C";
    this._twitch = null;
    this.channel = process.env.TWITCH_CHANNEL;
    // v2
    this.currentPrompt = null;
    this.botResponses = [];
    this.winningResponse = null;
  }
  
  startAdventureBot() {
    this.running = true;
    this.round = "PROMPT";
    // this.runAdventureBot();
    this.runAdventureBotV2();
  }

  stopAdvetnureBot() {
    this.running = false;
    this.roundStartTime = null;
  }
  
  newStory() {
    console.log("starting new story...");
    if (this.story.length > 0) {
      this.saveStory(() => this.reset());
    }
  }
  
  saveStory(callback = () => {}) {
    console.log("saving current story...");
    if (this.story.length == 0) return;
    // save locally v1
    const saveName = `AdventureBot-${new Date(Date.now()).toISOString().replaceAll(':', '-')}`; 
    const save = `.stories/${saveName}.txt`;
    fs.writeFile(
      save, 
      this.story.map((item) => {
        if(item.hasOwnProperty('votes'))
          return `${item.user} (${item.votes} votes): ${item.prompt}`;
        else
          return `${item.user}: ${item.prompt}`;
      }).join('\n'),
      (err) => {
        if (err) console.error(err);
        else {
          if (callback) callback();
          console.log("story saved to " + save);
        }
      }
    );
    // save to koboldai
    this.saveStoryRemote();
  }
  
  reset() {
    this.clearStory();
    // this.clearPrompts();
    this.clearVotes();
    // this.winningPrompt = null;
    // this.botResponse = null;
    this.roundStartTime = null;
    this.round = "START";
    this.running = false;
    
    // v2
    this.clearBotResponses();
    this.currentPrompt = null;
    this.winningResponse = null;
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
  
  clearStory() {
    this.story.splice(0, this.story.length);
  }
  
  addPrompt(user, prompt) {
    if (this.prompts.map((item) => item.user).indexOf(user) != -1) return false;
    this.prompts.push({user: user, prompt: prompt});
    if (this._queue) playMessage(this._queue, `${user} submitted prompt!`, this.voice);
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
        return [""];
      })
      .catch((ex) => {
        console.error(`KoboldAI:generate> error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.error(ex.response.data);
        } else {
          console.error(ex.stack);
        }
      });
  }
  
  addStory(prompt) {
    this.story.push(prompt);
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
        console.log("KoboldAI> added story end");
      })
      .catch((ex) => {
        console.error(`koboldai add story end error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.error(ex.response.data);
        } else {
          console.error(ex.stack);
        }
      });
  }
  
  removeStoryEnd() {
    this.story.pop();
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
        console.log("KoboldAI> removed story end");
      })
      .catch((ex) => {
        console.error(`koboldai remove story end error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.error(ex.response.data);
        } else {
          console.error(ex.stack);
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
        console.log(`KoboldAI> saved story '${saveName}'`);
      })
      .catch((ex) => {
        console.error(`koboldai save story error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.error(ex.response.data);
        } else {
          console.error(ex.stack);
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
    // console.log(`${JSON.stringify(voteTotals)} | ${JSON.stringify(this.prompts)}`);
    const response = {
      user: topPrompt.user, 
      prompt: topPrompt.prompt, 
      votes: maxVote
    };
    // console.log(`${JSON.stringify(response)}`);
    return response;
  }
  
  redo() {
    if (this.round !== "GENERATE") return;
    
    console.log("KoboldAI> redo previous action");
    // v1
    // this.removeStoryEnd()
    //   .then(() => {
    //     this.botResponse = null;
    //     this.roundStartTime = Date.now();
    //     console.log(`KoboldAI:redo> ${JSON.stringify(this.story)}`);
    //   });
    
    // v2
    this.clearBotResponses();
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
      
      if (this._twitch) { // round start twitch chat announcements
        if (this.round === "PROMPT") this._twitch.say(`#${this.channel}`, "Submit your prompts (ex '!!prompt Your silly prompt here')");
        else if (this.round === "VOTE") this._twitch.say(`#${this.channel}`, "Vote for your favorite prompt (ex '!!vote 1')");
        // else if (this.round === "GENERATE") this._twitch.say(`#${this.channel}`, "Generating response...");
      }

      if (this._queue) { // round start tts announcements
        if (this.round === "PROMPT") playMessage(this._queue, "Submit your prompts!", this.voice);
        else if (this.round === "VOTE") playMessage(this._queue, "Vote for your favorite prompt!", this.voice);
        // else if (this.round === "GENERATE") playMessage(this._queue, "Generating response...", this.voice);
      }
    }
    
    const tickTime = Date.now();
    const deltaInMs = tickTime - this.roundStartTime;
    
    if (this.round === "PROMPT") {
      if (deltaInMs > this.promptRoundTimeInMs) {
        if (this.prompts.length == 1) { // skip vote if only 1 prompt
          this.round = "GENERATE";
          this.winningPrompt = this.calculateWinningPrompt(this.prompts, this.votes);
          await this.addStory(this.winningPrompt);
        } else if (this.prompts.length > 1) {
          this.round = "VOTE";
          this.winningPrompt = null;
        } 
        
        this.botResponse = null;
        this.roundStartTime = null;
      }
    } else if (this.round === "VOTE") {
      if (deltaInMs > this.voteRoundTimeInMs) {
        this.round = "GENERATE";
        this.winningPrompt = this.calculateWinningPrompt(this.prompts, this.votes);
        
        await this.addStory(this.winningPrompt);
        
        this.roundStartTime = null;
        
        if (this._twitch) this._twitch.say(`#${this.channel}`, `${this.winningPrompt.user}: ${this.winningPrompt.prompt}`);
        if (this._queue) playMessage(this._queue, this.winningPrompt.prompt, this.voice);
      }
    } else if (this.round === "GENERATE") {
      if (!this.botResponse) {
        const genResponse = await this.generate(this.winningPrompt.user, "ai", "");
        this.botResponse = genResponse[0].text;
        
        if (this.botResponse && this.botResponse !== "") {
          await this.addStory({user: "ai", prompt: this.botResponse.trim()});
          console.log(`KoboldAI:generate> ${JSON.stringify(this.story)}`);
          
          if (this._twitch) this._twitch.say(`#${this.channel}`, `ai: ${this.botResponse}`);
          if (this._queue) playMessage(this._queue, this.botResponse, this.voice);
        } else {
          console.warn(`KoboldAI:generate> bot response was empty or null`);
        }
      }
      
      if (deltaInMs > this.generateRoundTimeInMs) {
        this.round = "PROMPT";
        
        this.clearPrompts();
        this.clearVotes();
        
        this.roundStartTime = null;
      }
    }

    setTimeout(this.runAdventureBot.bind(this), 100);
  }
  
  async runAdventureBotV2() {
    if (!this.running) return;
    
    if (!this.roundStartTime) { // start of a new round
      this.roundStartTime = Date.now();
      
      if (this.round === "VOTE") {
        if (this._twitch) this._twitch.say(`#${this.channel}`, "Vote for your favorite AI response (ex '!!vote 1')");
        if (this._queue) playMessage(this._queue, "Vote for your favorite AI response!", this.voice);
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
        this.clearBotResponses();
        this.roundStartTime = null;
      }
    } else if (this.round === "GENERATE") {
      if (this.botResponses.length == 0) {
        const genResponse = await this.generate(this.currentPrompt.user, "ai", "", 5);
        
        this.botResponses = genResponse.map((item) => {
          const response = { user: "ai", prompt: item.text.trim()};
          return response;
        });
        
        if (
          !this.botResponses || 
          this.botResponses.length == 0 ||
          this.botResponses[0] === ""
        ) {
          console.warn(`KoboldAI:generate> bot response was empty or null`);
        }
        
        this.round = "VOTE";
        this.clearVotes();
        this.winningResponse = null;
        this.roundStartTime = null;
      }
    } else if (this.round === "VOTE") {
      if (deltaInMs > this.voteRoundTimeInMs) {
        this.round = "PROMPT";
        this.winningResponse = this.calculateWinningPrompt(this.botResponses, this.votes);
        await this.addStory(this.winningResponse);
        
        this.currentPrompt = null;
        this.clearPrompts();
        this.roundStartTime = null;
        
        if (this._twitch) this._twitch.say(`#${this.channel}`, this.winningResponse.prompt);
        if (this._queue) playMessage(this._queue, this.winningResponse.prompt, this.voice);
      }
    } 

    setTimeout(this.runAdventureBotV2.bind(this), 100);
  }
};
