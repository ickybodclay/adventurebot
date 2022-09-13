const fs = require("fs");
const fetch = require("node-fetch");
const { json } = require("./utils");

const languageCodeRegex = /([a-z]{2}-[A-Z]{2})-.+/i;
const googleVoiceRegex = /^[a-z]{2,3}-[a-z]{2,3}-/i

/**
 * Wrapper function to determine correct TTS service to use for the provided voice.
 */
function matchVoiceAndPlay(queue, message, voice) {
  if (voice.match(googleVoiceRegex)) {
    playMessage(queue, message, voice);
  } else {
    playMessageUD(queue, message, voice);
  }
}

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
  const postData = {
    input: {
      text: chunk,
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
    });
}

/**
 * Add TTS message to queue using uberduck.ai TTS.
 * @param {!TTSQueue} queue queue to add tts message to
 * @param {string} message TTS message
 * @param {string} [voice=glados] TTS voice
 */
function playMessageUD(
  queue,
  message,
  voice = "glados"
) {  
  // FIXME: determine actual chunk size
  const chunks = splitMessageToChunks(message, 5000);
  chunks.forEach((chunk) =>
    queue.queue(
      {
        text: chunk,
        voice: voice,
        languageCode: 'english',
        filename: ".data/tmp.wav",
      },
      syntehsize_UDTSS_chunk
    )
  );
}

const {createWriteStream} = require('node:fs');
const {pipeline} = require('node:stream');
const {promisify} = require('node:util');
const streamPipeline = promisify(pipeline);

function syntehsize_UDTSS_chunk(chunk, voice, languageCode, filename) {
  // https://uberduck.readme.io/reference/generate_speech_synchronously_speak_synchronous_post
    const requestUrl = "https://api.uberduck.ai/speak-synchronous";
    const postData = {
      voice: voice,
      speech: chunk
    };
    return fetch(requestUrl, {
      method: "post",
      body: JSON.stringify(postData),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(process.env.UBERDUCK_API_KEY + ":" + process.env.UBERDUCK_API_SECRET).toString('base64')}`,
        'uberduck-id': 'anonymous'
      }
    })
      .then((response) => {
        return streamPipeline(response.body, createWriteStream(filename));
      });
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

module.exports = { matchVoiceAndPlay, playMessage, playMessageUD };
