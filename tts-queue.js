const { createReadStream } = require('node:fs');
const { join } = require('node:path');
const {  
  createAudioResource,
  AudioPlayerStatus, 
  StreamType,
  PlayerSubscription,
  VoiceConnectionStatus
} = require('@discordjs/voice');

module.exports = class TTSQueue {
  constructor() {
    this.mainPlayerQueue = [];
    this._isPlaying = false;
    this._isStopped = false;
    this._next = null;
    this._player = null;
    this._connection = null;
    this._subscription = null;
  }

  play(audio_file, close_callback = () => {}) {
    console.log(`playing: ${audio_file}`);
    console.log(`>> ${join(__dirname, audio_file)}`);
    const resource = createAudioResource(createReadStream(join(__dirname, audio_file)), {
      inputType: StreamType.OggOpus,
    });
    this._player.once(AudioPlayerStatus.Playing, () => {
      console.log("audio player entered playing state");
      
      this._player.once(AudioPlayerStatus.Idle, () => {
       console.log("audio player entered idle state");
        if (this._isPlaying) {
          this._isPlaying = false;
          if (close_callback) close_callback();
        }
      });
    });
    this._player.play(resource);
  }

//   vpause() {
//     this._player.pause();
//   }

//   vunpause() {
//     this._player.unpause();
//   }

//   vstop() {
//     this._player.stop();
//   }

  queue(message, generate, on_next_callback = () => {}) {
    console.log(`< queued: ${message.text}`);
    this.mainPlayerQueue.push({
      message: message,
      generate: generate,
      callback: on_next_callback,
    });
  }

  get size() {
    return this.mainPlayerQueue.length;
  }

  /**
   * Stops and clears the queue.
   */
  stop() {
    // this.vstop();
    this._isStopped = true;
    this.mainPlayerQueue = [];
  }

  /**
   * Resume the queue.
   */
  resume() {
    this._isStopped = false;
  }

  async processQueue() {
    if (!this._isPlaying && !this._isStopped && this.size > 0) {
      this._next = this.mainPlayerQueue.shift(); // dequeue
      this._isPlaying = true;
      this._next
        .generate(
          this._next.message.text,
          this._next.message.voice,
          this._next.message.languageCode,
          this._next.message.filename
        )
        .then((audio_data) => {
          console.log(`> playing: ${this._next.message.text}`);
          this.play(this._next.message.filename, this._next.callback);
        })
        .catch((err) => {
          console.log(err);
          this._isPlaying = false;
        });
    }

    setTimeout(this.processQueue.bind(this), 250);
  }
};
