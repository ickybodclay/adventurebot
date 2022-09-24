const fetch = require("node-fetch");
const { json } = require("./utils");

// https://goose.ai/docs/api/engines
const engineId = "gpt-neo-20b"; //"gpt-j-6b"; //"gpt-neo-2-7b"; //"fairseq-13b";

function gooseGenerate(user, bot, prompt) {
  const requestUrl = `https://api.goose.ai/v1/engines/${engineId}/completions`;
  const stopTokenRegex = new RegExp(`(${user}:|${bot}:|"<|endoftext|>")$`, "im");
  const postData = {
    prompt: prompt,
    temperature: 0.5, // [0, 1.0]
    // top_p: 0.3, // [0, 1.0]
    // presence_penalty: 0, // [-2.0, 2.0]
    // frequency_penalty: 0, // [-2.0, 2.0]
    // repetition_penalty: 1.0, // [0, 8.0]
    min_tokens: 1,
    max_tokens: 150,
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
      return response.replace(stopTokenRegex, ""); // remove trailing stop tokens
    })
    .catch((ex) => {
      console.re.error(`gooseai generate error ${ex.name}: ${ex.message}`);
      if (ex.response) {
        console.re.error(ex.response.data);
      } else {
        console.re.error(ex.stack);
      }
    });
}

module.exports = { gooseGenerate };
