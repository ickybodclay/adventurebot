const fetch = require("node-fetch");
const { escapeJsonValue, json } = require("./utils");

module.exports = class KoboldAIClient {
  constructor() {
    // please make sure you are using KoboldAI United version for API
    this.baseUrl = process.env.KOBOLDAI_BASE_URL;
    this.story = [];
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
  
  storyAdd(action) {
    const requestUrl = `${this.baseUrl}/api/v1/story/end`;
    const postData = {
      prompt: escapeJsonValue(action)
    }
    return fetch(requestUrl, {
      method: "post",
      body: JSON.stringify(postData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .catch((ex) => {
        console.error(`koboldai story add error ${ex.name}: ${ex.message}`);
        if (ex.response) {
          console.error(ex.response.data);
        } else {
          console.error(ex.stack);
        }
      });
  }
};
