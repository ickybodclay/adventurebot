const fetch = require("node-fetch");
const { escapeJsonValue, json } = require("./utils");

const engineId = "gpt-neo-20b";

function gooseGenerate(user, bot, prompt) {
  const apiKey = process.env.GOOSE_API_KEY;
  const requestUrl = `https://api.goose.ai/v1/engines/${engineId}/completions`;
  const headers = {
    
  };
  var postData = {
    prompt: prompt,
    temperature: 0.9,
    stop: [` ${user}:`, ` ${bot}:`],
    presence_penalty: 0,
    frequency_penalty: 0
  };
  return fetch(requestUrl, {
    method: "post",
    body: JSON.stringify(postData),
  })
    .then(json)
    .then((data) => {
      
    })
    .catch((error) => {
      console.error("Goose request failed", error);
    });
}