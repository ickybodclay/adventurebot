const fetch = require("node-fetch");
const fs = require('fs');
const { playMessage } = require("./tts");
const TTSQueue = require("./tts-queue");
const { escapeJsonValue, json } = require("./utils");

module.exports = class KoboldAIClient {
  constructor() {
    // please make sure you are using KoboldAI United version for API
    this.baseUrl = process.env.KOBOLDAI_BASE_URL;
    this.story = [];
    this.prompts = [];
    this.votes = [];
    this._round = "START"; // START, [PROMPT, VOTE, GENERATE]
    this.roundStartTime = null;
    this.promptRoundTimeInMs = 2*60*1000;
    this.voteRoundTimeInMs = 1*60*1000;
    this.generateRoundTimeInMs = 1*60*1000;
    this.winningPrompt = null;
    this.botResponse = null;
    this.running = false;
    this._queue = null;
    this.voice = "en-US-Wavenet-C";
    this._twitch = null;
    this.channel = process.env.TWITCH_CHANNEL;
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
  
  newStory() {
    console.log("starting new story...");
    if (this.story.length > 0) {
      this.saveStoryRemote();
      console.log("saving previous story...");
      const saveName = `AdventureBot-${new Date(Date.now()).toISOString().replaceAll(':', '-')}`; 
      const save = `.stories/${saveName}.txt`;
      fs.writeFile(
        save, 
        this.story.map((item) => `${item.user}: ${item.prompt}`).join('\n'),
        (err) => {
          if (err) console.error(err);
          else {
            this.reset();
            console.log("previous story saved to " + save);
          }
        }
      );
    }
  }
  
  saveStory() {
    console.log("saving current story...");
    if (this.story.length > 0) {
      const saveName = `AdventureBot-${new Date(Date.now()).toISOString().replaceAll(':', '-')}`; 
      const save = `.stories/${saveName}.txt`;
      fs.writeFile(
        save, 
        this.story.map((item) => `${item.user}: ${item.prompt}`).join('\n'),
        (err) => {
          if (err) console.error(err);
          else console.log("story saved to " + save);
        }
      );
    }
  }
  
  reset() {
    this.clearStory();
    this.clearPrompts();
    this.clearVotes();
    this.winningPrompt = null;
    this.botResponse = null;
    this.roundStartTime = null;
    this.round = "START";
    this.running = false;
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
  
  // KoboldAI API Endpoints
  
  generate(user, bot, prompt) {
    const requestUrl = `${this.baseUrl}/api/v1/generate`;
    const postData = {
      prompt: escapeJsonValue(prompt),
      // temperature: 0.9, // [0, 1.0]
      // rep_pen: 1.0, // [1,]
      // max_length: 80,
      use_story: true,
      use_memory: true,
      use_authors_note: true
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
        return data.results[0].text;
      })
      .catch((ex) => {
        console.error(`koboldai generate error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.error(ex.response.data);
        } else {
          console.error(ex.stack);
        }
      });
  }
  
  addStoryEnd(prompt) {
    const requestUrl = `${this.baseUrl}/api/v1/story/end`;
    const postData = {
      prompt: escapeJsonValue(prompt)
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
  
  calculateWinningPrompt() {
    const voteTotals = this.prompts.map((item) => 0);
    for (let i=0; i<this.votes.length; ++i) {
      voteTotals[this.votes[i].vote]++;
    }
    var topPromptIndex = -1;
    var maxVote = -1;
    for (let i=0; i<voteTotals.length; ++i) {
      if (voteTotals[i] > maxVote) {
        topPromptIndex = i;
        maxVote = voteTotals[i];
      }
    }
    var topPrompt; 
    if (topPromptIndex == -1) {
      topPrompt = this.prompts[0];
      maxVote = 0;
    } else {
      topPrompt = this.prompts[topPromptIndex];
    }
    console.log(`${JSON.stringify(voteTotals)} | ${JSON.stringify(this.prompts)}`);
    const response = {
      user: topPrompt.user, 
      prompt: topPrompt.prompt, 
      votes: maxVote
    };
    console.log(`${JSON.stringify(response)}`);
    return response;
  }
  
  redo() {
    console.log("KoboldAI> redo previous action");
    this.story.pop();
    this.removeStoryEnd();
    
    this.generate(this.winningPrompt.user, "ai", this.story.map((item) => item.prompt).join(''))
      .then((response) => {
        this.botResponse = response;
        this.roundStartTime = Date.now();
      
        this.story.push({user: "ai", prompt: this.botResponse.trim()});
        this.addStoryEnd(this.botResponse.trim());
      
        if (this._twitch) this._twitch.say(`#${this.channel}`, `ai: ${this.botResponse}`);
        if (this._queue) playMessage(this._queue, this.botResponse, this.voice);
      });
  }
  
  async runAdventureBot() {
    if (!this.running) return;
    
    if (!this.roundStartTime) { // start of a new round
      this.roundStartTime = Date.now();
      
      if (this._twitch) { // round start twitch chat announcements
        if (this.round === "PROMPT") this._twitch.say(`#${this.channel}`, "Submit your prompts (ex '!!prompt Your silly prompt here')");
        else if (this.round === "VOTE") this._twitch.say(`#${this.channel}`, "Vote for your favorite prompt (ex '!!vote 1')");
        else if (this.round === "GENERATE") this._twitch.say(`#${this.channel}`, "Generating response...");
      }

      if (this._queue) { // round start tts announcements
        if (this.round === "PROMPT") playMessage(this._queue, "Submit your prompts!", this.voice);
        else if (this.round === "VOTE") playMessage(this._queue, "Vote for your favorite prompt!", this.voice);
        else if (this.round === "GENERATE") playMessage(this._queue, "Generating response...", this.voice);
      }
    }
    
    const tickTime = Date.now();
    const deltaInMs = tickTime - this.roundStartTime;
    
    if (this.round === "PROMPT") {
      if (deltaInMs > this.promptRoundTimeInMs) {
        // only go to vote round if there are any prompts
        // FOR TESTING
        // if (this.prompts.length == 1) { // skip vote if only 1 prompt
        //   this.round = "GENERATE";
        //   this.winningPrompt = this.calculateWinningPrompt();
        // } else 
        if (this.prompts.length > 1) {
          this.round = "VOTE";
          this.winningPrompt = null;
          this.botResponse = null;
        } 
        
        // this.botResponse = null;
        this.roundStartTime = null;
      }
    } else if (this.round === "VOTE") {
      if (deltaInMs > this.voteRoundTimeInMs) {
        this.round = "GENERATE";
        this.roundStartTime = null;
        this.winningPrompt = this.calculateWinningPrompt();
        
        this.story.push({user: this.winningPrompt.user, prompt: this.winningPrompt.prompt.trim()});
        this.addStoryEnd(this.winningPrompt.prompt.trim());
        
        if (this._twitch) this._twitch.say(`#${this.channel}`, `${this.winningPrompt.user}: ${this.winningPrompt.prompt}`);
        if (this._queue) playMessage(this._queue, this.winningPrompt.prompt, this.voice);
      }
    } else if (this.round === "GENERATE") {
      if (!this.botResponse) {
        this.botResponse = await this.generate(
          this.winningPrompt.user, 
          "ai", 
          this.story.map((item) => item.prompt).join('')
        );
        
        this.story.push({user: "ai", prompt: this.botResponse.trim()});
        this.addStoryEnd(this.botResponse.trim());
        
        if (this._twitch) this._twitch.say(`#${this.channel}`, `ai: ${this.botResponse}`);
        if (this._queue) playMessage(this._queue, this.botResponse, this.voice);
      }
      
      if (deltaInMs > this.generateRoundTimeInMs) {
        this.round = "PROMPT";
        this.roundStartTime = null;
        this.clearPrompts();
        this.clearVotes();
      }
    }

    setTimeout(this.runAdventureBot.bind(this), 100);
  }
};
