# Hular Hoops Bot

Discord bot that generates TTS for Twitch chat and occasionally responds with AI generated text.

## Setup

1) Add required secret keys.  You'll need the following:

    - A Twitch bot (username and oauth token with ability to read and send messages)
    - A Discord bot (token and client id; make sure token has permission to use voice)
    - The Twitch channel that you want to observe chat of
    - The Discord guild id* (server you want bot to join)
    - The Dicord voice channel id* (voice channel you want bot to join)
    - An OpenAI API key

    *Note: use Discord developer mode so you can easily right click and "Copy ID" for these values
2) Invite Discord bot to your server.
3) Register slash commands by running `node deploy-commands.js` in terminal.

And that should be it!

## Usage

### Discord commands

`/k9ping` - Sends pong (simple test command for making sure you've setup Discord)

`/k9join` - Join voice channel (specified `.env` file)

`/k9leave` - Leaves voice channel

`/k9pause` - Pause TTS queue

`/k9resume` - Resume TTS queue

`/k9generate INPUT` - Generate AI response from input and then text-to-speech user input & response (test to make sure you've setup OpenAI)

`/k9tts MESSAGE` - Add message directly to the TTS queue for K9000 to say

### Twitch commands

`!!setvoice [1-24]` - changes the TTS voice for the user

Note: for the following Twitch commands, must be channel owner or moderator.

`!!play` - Resume TTS (if audio present)

`!!pause` - Pause TTS (if audio present)

`!!skip` - Skip current TTS (if audio present)

`!!qplay` - Resume TTS queue

`!!qpause` - Pause TTS queue

`!!qstop` - Stop TTS queue

`!!setbotvoice` - change the TTS voice for K9000

`!!clear` - clear user flags (useful if there was an error during TTS and user is not able talk to K9000)

### Adventure Bot commands (if running)

`!!prompt PROMPT` - submit prompt (only valid during prompt round)

`!!vote NUMBER` - vote for prompt (only valid during vote round, must be valid integer)

Note: for the following Twitch commands, must be channel owner or moderator.

`!!abnewstory` - start a new story (saves previous story to txt file)

`!!abstart` - start adventure bot

`!!abstop` - stop adventure bot

## Endpoints

Hular Hoops Bot provides optional endpoint to hook into for setting up stream labels or whatever!

### K9000

`/queue/users` - list of users currently in queue to talk to K9000

### Adventure Bot

`/adventurebot/round` - get story info and current round of adventurebot
