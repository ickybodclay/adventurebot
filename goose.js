const fetch = require("node-fetch");
const { escapeJsonValue, json } = require("./utils");

const engineId = "gpt-neo-20b";

function gooseGenerate(user, bot, prompt) {
  const apiKey = process.env.GOOSE_API_KEY;
  const requestUrl = `https://api.goose.ai/v1/engines/${engineId}/completions`;
  const postData = {
    prompt: prompt,
    temperature: 0.9,
    stop: [` ${user}:`, ` ${bot}:`],
    presence_penalty: 0,
    frequency_penalty: 0
  };
  return fetch(requestUrl, {
    method: "post",
    body: JSON.stringify(postData),
    headers: {
      'Authorization': `Bearer ${process.env.GOOSE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  })
    .then(json)
    .then((data) => {
      console.log(`GOOSE> ${JSON.stringify(data)}`);
      return data.choices[0].text;
    })
    .catch((error) => {
      console.error("Goose request failed", error);
    });
}

module.exports = { gooseGenerate };
