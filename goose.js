const fetch = require("node-fetch");
const { escapeJsonValue, json } = require("./utils");

// https://goose.ai/docs/api/engines
const engineId = "gpt-neo-20b"; //"gpt-j-6b"; //"gpt-neo-2-7b"; //"fairseq-13b";

function gooseGenerate(user, bot, prompt) {
  const requestUrl = `https://api.goose.ai/v1/engines/${engineId}/completions`;
  const postData = {
    prompt: escapeJsonValue(prompt),
    temperature: 0.9, // [0, 1.0]
    presence_penalty: 0, // [-2.0, 2.0]
    frequency_penalty: 0, // [-2.0, 2.0]
    repetition_penalty: 1.0, // [0, 8.0]
    min_tokens: 1,
    max_tokens: 100,
    stop: [` ${user}:`, ` ${bot}:`, `\n${user}:`, `\n${bot}:`, "<|endoftext|>"]
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
    .catch((ex) => {
      console.error(`gooseai generate error ${ex.name}: ${ex.message}`);
      if (ex.response) {
        console.error(ex.response.data);
      } else {
        console.error(ex.stack);
      }
    });
}

module.exports = { gooseGenerate };
