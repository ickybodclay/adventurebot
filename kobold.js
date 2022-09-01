const fetch = require("node-fetch");
const { escapeJsonValue, json } = require("./utils");
const fs = require('fs');

module.exports = class KoboldAIClient {
  constructor() {
    // please make sure you are using KoboldAI United version for API
    this.baseUrl = process.env.KOBOLDAI_BASE_URL;
    this.story = [];
    this.prompts = [];
    this.votes = [];
    this.round = "PROMPT"; // PROMPT, VOTE, GENERATE
    this.roundStartTime = null;
    this.promptRoundTimeInMs = 3*60*1000; // 3 minutes
    this.voteRoundTimeInMs = 2*60*1000; // 2 minutes
    this.generateRoundTimeInMs = 2*60*1000; // 2 minutes
    this.winningPrompt = null;
    this.botResponse = null;
  }
  
  newStory() {
    console.log("starting new story...");
    if (this.story.length > 0) {
      console.log("saving previous story...");
      const save = `.stories/${Date.now().toUTCString()}.txt`;
      fs.writeFile(
        save, 
        this.story.join('\n'),
        (err) => {
          if (err) console.error(err);
          
          this.stories.splice(0, this.stories.length);
          console.log("previous story saved to " + save);
        }
      );
    }
  }
  
  get round() { return this.round; }
  
  set round(newRound) {
    if (
      newRound !== "PROMPT" ||
      newRound !== "VOTE" ||
      newRound !== "GENERATE"
    ) return;
    
    this.round = newRound;
  }
  
  addPrompt(user, prompt) {
    if (this.promps.map((item) => item.user).indexOf(user) != -1) return;
    
    this.prompts.push({user: user, prompt: prompt});
  }
  
  clearPrompts() {
    this.prompts.splice(0, this.prompts.length);
    console.log("cleared prompts");
  }
  
  addVote(user, vote) {
    if (this.votes.map((item) => item.user).indexOf(user) != -1) return;
    
    this.votes.push({user: user, vote: vote});
  }
  
  clearVotes() {
    this.votes.splice(0, this.votes.length);
    console.log("cleared votes");
  }
  
  generate(user, bot, prompt) {
    const requestUrl = `${this.baseUrl}/api/v1/generate`;
    this.story.push({user: user, prompt: prompt});
    const postData = {
      prompt: escapeJsonValue(this.story.map((item) => item.prompt).join('\n')),
      temperature: 0.9, // [0, 1.0]
      rep_pen: 1.0, // [1,]
      max_length: 200,
      use_story: true,
      use_memory: true,
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
        console.log(`KOBOLD> ${JSON.stringify(data)}`);
        const response = data.results[0].text;
        this.story.push({user: bot, prompt: response});
        return response;
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
  
  calculateWinningPrompt() {
    // TODO tabulate votes
    // TODO break tie with random
    // TODO return winning prompt
    return {user: "test", prompt: "hello world"};
  }
  
  async startAdventureBot() {
    if (!this.roundStartTime) this.roundStartTime = Date.now();
    
    const tickTime = Date.now();
    const deltaInMs = tickTime.getTime() - this.roundStartTime.getTime();
    
    if (this.round === "PROMPT") {
      
      if (deltaInMs > this.promptRoundTimeInMs) {
        // only go to vote round if there are any prompts
        if (this.prompts.length > 0) {
          this.round = "VOTE";
        }
        
        this.roundStartTime = null;
        this.winningPromnpt = null;
        this.botResponse = null;
      }
    } else if (this.round === "VOTE") {
      
      if (deltaInMs > this.voteRoundTimeInMs) {
        this.round = "GENERATE";
        this.roundStartTime = null;
        this.winningPrompt = this.calculateWinningPrompt();
      }
    } else if (this.round === "GENERATE") {
      if (!this.botResponse) {
        this.botResponse = await this.generate(this.winningPrompt.user, "bot", this.winningPrompt.prompt);
      }
      
      if (deltaInMs > this.generateRoundTimeInMs) {
        this.round = "PROMPT";
        this.roundStartTime = null;
      }
    }

    setTimeout(this.startAdventureBot.bind(this), 100);
  }
};
