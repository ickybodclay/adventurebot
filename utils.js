const wait = require('node:timers/promises').setTimeout;

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

function json(response) {
  return response.json();
}

module.exports = { escapeJsonValue, json, wait };
