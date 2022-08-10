const fs = require("fs");
const fetch = require("node-fetch");

const languageCodeRegex = /([a-z]{2}-[A-Z]{2})-.+/i;

/**
 * Add TTS message to queue using Google Cloud TTS.
 * @param {!TTSQueue} queue queue to add tts message to
 * @param {string} message TTS message
 * @param {string} [voice=en-US-Wavenet-F] TTS voice
 */
function playMessage(
  queue,
  message,
  voice = "en-US-Wavenet-F"
) {
  var languageCode = "en-US";
  const languageFound = voice.match(languageCodeRegex);
  if (languageFound) {
    const [raw, langCode] = languageFound;
    languageCode = languageCode;
  }
  
  // chunk size based on quota limit https://cloud.google.com/text-to-speech/quotas
  const chunks = splitMessageToChunks(message, 5000);
  chunks.forEach((chunk) =>
    queue.queue(
      {
        text: chunk,
        voice: voice,
        languageCode: languageCode,
        filename: ".data/tmp.ogg",
      },
      syntehsize_GCTTS_chunk
    )
  );
}

function syntehsize_GCTTS_chunk(chunk, voice, languageCode, filename) {
  const apiKey = process.env.TTS_API_KEY;
  const requestUrl =
    "https://texttospeech.googleapis.com/v1/text:synthesize?alt=json&key=" +
    apiKey;
  var postData = {
    input: {
      text: escapeJsonValue(chunk),
    },
    audioConfig: {
      audioEncoding: "OGG_OPUS",
    },
    voice: {
      languageCode: languageCode,
      name: voice,
    },
  };
  return fetch(requestUrl, {
    method: "post",
    body: JSON.stringify(postData),
  })
    .then(json)
    .then((data) => {
      fs.writeFileSync(
        filename,
        Buffer.from(data.audioContent, "base64"),
        "binary"
      );
    })
    .catch((error) => {
      console.log("Request failed", error);
    });
}

function json(response) {
  return response.json();
}

function splitMessageToChunks(message, maxChunkLength) {
  const words = message.split(" ");
  const chunkedMsgArray = [];
  var currentChunk = "";
  words.forEach((word) => {
    if (currentChunk.length + word.length >= maxChunkLength) {
      chunkedMsgArray.push(currentChunk.trim());
      currentChunk = `${word} `;
    } else {
      currentChunk += `${word} `;
    }
  });
  if (currentChunk.length > 0) {
    chunkedMsgArray.push(currentChunk.trim());
  }
  return chunkedMsgArray;
}

function escapeJsonValue(unsafe) {
  return unsafe.replace(/'"]/g, function (c) {
    switch (c) {
      case "'":
        return "\\'";
      case '"':
        return '\\"';
    }
  });
}

module.exports = { playMessage };
