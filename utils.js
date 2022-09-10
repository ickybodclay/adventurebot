const wait = require('node:timers/promises').setTimeout;

function json(response) {
  return response.json();
}

module.exports = { json, wait };
