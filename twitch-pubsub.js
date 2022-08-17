// https://www.npmjs.com/package/@twurple/pubsub
const { PubSubClient } = require("@twurple/pubsub");
const { StaticAuthProvider } = require("@twurple/auth");

// https://twitchapps.com/tmi/ - changed scope to 'channel:read:redemptions'
const accessToken = process.env.TWITCH_PUBSUB_OAUTH_TOKEN;
const authProvider = new StaticAuthProvider("", accessToken);
const pubSubClient = new PubSubClient();

const IGNORE_REWARDS = [
  "Highlight My Message"
];

/**
 * Initializes Twitch pubsub listener.
 * @param {!FFPlayQueue} queue queue to add tts message to
 */
async function setupPubsub(queue) {
  console.log("twitch-pubsub listening for channel point redemptions...");
  const userId = await pubSubClient.registerUserListener(authProvider);
  const redeemListener = await pubSubClient.onRedemption(userId, (message) => {
    if (IGNORE_REWARDS.indexOf(message.rewardTitle) > -1) return;

    // https://twurple.js.org/reference/pubsub/classes/PubSubRedemptionMessage.html
    // const redemptionMsg = `${message.userDisplayName} redeemed ${message.rewardTitle}`;
    // playMessageMS(queue, redemptionMsg);
  });
}

module.exports = { setupPubsub };
