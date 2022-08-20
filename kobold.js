const fetch = require("node-fetch");
const { escapeJsonValue, json } = require("./utils");

const baseUrl = "https://trycloudflare.com";

function koboldGenerate(user, bot, prompt) {
  const requestUrl = `${baseUrl}/api/v1/generate`;
  const postData = {
    prompt: escapeJsonValue(prompt),
    temperature: 0.9, // [0, 1.0]
    rep_pen: 1.0, // [1,]
    max_length: 100,
    // use_story: true,
    // use_memory: true,
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

module.exports = { koboldGenerate };
