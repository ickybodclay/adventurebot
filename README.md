# Hular Hoops Bot

Discord bot that generates TTS for Twitch chat and occasionally responds with AI generated text.

## Setup

1. Add required secret keys. You'll need the following (checkout `.env.example` for full list):

   - A Twitch bot (username and oauth token with ability to read and send messages)
   - A Discord bot (token and client id; make sure token has permission to use voice)
   - The Twitch channel that you want to observe chat of
   - The Discord guild id\* (server you want bot to join)
   - The Dicord voice channel id\* (voice channel you want bot to join)
   - KoboldAI United API Base Url (no trailing '/')
   - Optional: `AB_OVERLAY_ORIGIN` for CORS (use '*' to accept all) and `AB_TOKEN` as a password (can be set to anything) to secure your endpoint

   \*Note: use Discord developer mode so you can easily right click and "Copy ID" for these values

2. Invite Discord bot to your server.
3. Register slash commands by running `node deploy-commands.js` in terminal.

And that should be it!

## Optional Setup

### Adventure Bot Stream Overlay

A node app to display what is going on in your story in a nice neat stream overlay for OBS.

Source code: [Adveture Bot Stream Overlay](https://github.com/ickybodclay/adventurebotoverlay)

## Usage

### Discord commands

- `/ab prompt PROMPT` - Submit prompt to Adventure Bot for the current story (only valid during prompt round)
- `/ab skip` - Skip current TTS (if audio present)
- `/ab redo` - Regenerate the last AI response(s) (only valid during vote round)
- `/ab retry` - Retry entering the last prompt (only valid during vote round)
- `/ab continue` - Submit empty prompt to continue story (only valid during prompt round)
- `/ab next` - Skip the countdown and advance to the next round
- `/ab new` - Start a new story (saves previous story to txt file)
- `/ab start` - Start Adventure Bot game loop
- `/ab stop` - Stop Adventure Bot game loop
- `/ab model` - Get the current running AI model
- `/ab join` - Join voice channel (specified `.env` file)
- `/ab leave` - Leaves voice channel
- `/ab url URL (optional)` - Get/set the current KoboldAI base url (Note: for set, make sure there is no trailing '/')
- `/ab generate PROMPT` - Generates AI response for given prompt
- `/k9pause` - Pause TTS queue
- `/k9resume` - Resume TTS queue
- `/k9tts MESSAGE` - Add message directly to the TTS queue for K9000 to say

### Twitch commands

#### TTS commands

Note: for the following Twitch commands, must be channel owner or moderator.

- `!aplay` - Resume TTS (if audio present)
- `!apause` - Pause TTS (if audio present)
- `!askip` - Skip current TTS (if audio present)
- `!qplay` - Resume TTS queue
- `!qpause` - Pause TTS queue
- `!qstop` - Stop TTS queue
- `!setbotvoice` - change the TTS voice for K9000

#### Adventure Bot commands

- `!vote NUMBER` - vote for prompt (only valid during vote round, must be valid integer)

Note: for the following Twitch commands, must be channel owner or moderator.

- `!prompt PROMPT` - submit prompt (only valid during prompt round)
- `!continue` - submit empty prompt to continue story (only valid during prompt round)
- `!abnewstory` - start a new story (saves previous story to txt file)
- `!absave` - save current story to txt file
- `!abstart` - start adventure bot
- `!abstop` - stop adventure bot
- `!abremove NUMBER` - remove prompt (only valid during prompt round, must be valid integer)
- `!abredo` - regenerate the last response (only valid during vote round)
- `!abretry` - retry entering the last prompt
- `!abnext` - skip the countdown and advance to the next round
- `!abmodel` - get the current running koboldai model

## Endpoints

Adventure Bot provides a SSE endpoint to hook into for current story information.

### Adventure Bot

`GET /adventurebot/events` - server sent events for story info and current round of adventurebot
