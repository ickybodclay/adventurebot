const fetch = require("node-fetch");
const { escapeJsonValue, json } = require("./utils");
const fs = require('fs');

module.exports = class KoboldAIClient {
  constructor() {
    // please make sure you are using KoboldAI United version for API
    this.baseUrl = process.env.KOBOLDAI_BASE_URL;
    this.story = [];
    this.prompts = [];
    this._prompt_users = {};
    this.votes = [];
    this._vote_users = {};
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
  
  addPrompt(user, prompt) {
    if (this._prompt_users[user]) return;
    
    this.prompts.push({user: user, prompt: prompt});
  }
  
  addVote(user, vote) {
    if (this._vote_users[user]) return;
    
    this.votes.push({user: user, vote: vote});
  }
  
  generate(user, bot, promt) {
    const requestUrl = `${this.baseUrl}/api/v1/generate`;
    this.story.push(prompt);
    const postData = {
      prompt: escapeJsonValue(this.story.join('\n')),
      temperature: 0.9, // [0, 1.0]
      rep_pen: 1.0, // [1,]
      max_length: 100,
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
};
