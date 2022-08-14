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

`/k9ping` - sends pong (simple test command for making sure you've setup Discord)

`/k9join` - join voice channel (specified `.env` file)

`/k9leave` - leaves voice channel

`/k9pause` - pause TTS queue

`/k9resume` - resume TTS queue

`/k9generate INPUT` - TTS user input & AI generated response (test to make sure you've setup OpenAI)
