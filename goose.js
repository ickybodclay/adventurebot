const fetch = require("node-fetch");
const { escapeJsonValue, json } = require("./utils");

// https://goose.ai/docs/api/engines
const engineId = "gpt-neo-2-7b"; //"fairseq-13b"; //"gpt-neo-20b";

function gooseGenerate(user, bot, prompt) {
  const apiKey = process.env.GOOSE_API_KEY;
  const requestUrl = `https://api.goose.ai/v1/engines/${engineId}/completions`;
  const postData = {
    prompt: prompt,
    temperature: 0.9,
    stop: [` ${user}:`, ` ${bot}:`, `\n${user}:`, `\n${bot}:`, "<|endoftext|>"],
    presence_penalty: 0,
    frequency_penalty: 0,
    max_tokens: 100,
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
      const response = data.choices[0].text;
      return response.replace(`/(${user}:|${bot}:)$/i`, ""); // remove trailing stop tokens
    })
    .catch((error) => {
      console.error("Goose request failed", error);
    });
}

module.exports = { gooseGenerate };
