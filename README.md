# Hular Hoops Bot

Discord bot that generates TTS for Twitch chat and occasionally responds with AI generated text.

## Setup

1. Add required secret keys. You'll need the following:

   - A Twitch bot (username and oauth token with ability to read and send messages)
   - A Discord bot (token and client id; make sure token has permission to use voice)
   - The Twitch channel that you want to observe chat of
   - The Discord guild id\* (server you want bot to join)
   - The Dicord voice channel id\* (voice channel you want bot to join)
   - KoboldAI United API Base Url (no trailing '/')

   \*Note: use Discord developer mode so you can easily right click and "Copy ID" for these values

2. Invite Discord bot to your server.
3. Register slash commands by running `node deploy-commands.js` in terminal.

And that should be it!

## Usage

### Discord commands

`/k9ping` - Sends pong (simple test command for making sure you've setup Discord)

`/k9join` - Join voice channel (specified `.env` file)

`/k9leave` - Leaves voice channel

`/k9pause` - Pause TTS queue

`/k9resume` - Resume TTS queue

`/k9tts MESSAGE` - Add message directly to the TTS queue for K9000 to say

`/k9generate PROMPT` - Generates AI response for given prompt 

`/k9seturl URL` - Set the KoboldAI base url (no trailing '/')

`/k9url` - Get the currently KoboldAI base url

### Twitch commands

Note: for the following Twitch commands, must be channel owner or moderator.

`!aplay` - Resume TTS (if audio present)

`!apause` - Pause TTS (if audio present)

`!askip` - Skip current TTS (if audio present)

`!qplay` - Resume TTS queue

`!qpause` - Pause TTS queue

`!qstop` - Stop TTS queue

`!setbotvoice` - change the TTS voice for K9000

### Adventure Bot commands

`!prompt PROMPT` - submit prompt (only valid during prompt round)

`!vote NUMBER` - vote for prompt (only valid during vote round, must be valid integer)

Note: for the following Twitch commands, must be channel owner or moderator.

`!abnewstory` - start a new story (saves previous story to txt file)

`!absave` - save current story to txt file

`!abstart` - start adventure bot

`!abstop` - stop adventure bot

`!abremove NUMBER` - remove prompt (only valid during prompt round, must be valid integer)

`!abredo` - regenerate the last response (only valid during vote round)

`!abretry` - retry entering the last prompt

`!abnext` - skip the countdown and advance to the next round

`!abmodel` - get the current

## Endpoints

Hular Hoops Bot provides a SSE endpoint to hook into for current story information.

### Adventure Bot

`GET /adventurebot/events` - server sent events for story info and current round of adventurebot
