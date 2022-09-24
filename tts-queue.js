const { createReadStream } = require('node:fs');
const { join } = require('node:path');
const {  
  createAudioResource,
  demuxProbe,
  AudioPlayerStatus, 
  StreamType,
  PlayerSubscription,
  VoiceConnectionStatus
} = require('@discordjs/voice');

module.exports = class TTSQueue {
  constructor() {
    this.mainPlayerQueue = [];
    this.pauseDelayInMs = 1*1000;
    this._isPlaying = false;
    this._isStopped = false;
    this._next = null;
    this._player = null;
    this._connection = null;
    this._subscription = null;
  }

  async play(audio_file, close_callback = () => {}) {
    const resource = await this.probeAndCreateResource(createReadStream(join(__dirname, audio_file)));
    
    this._player.once(AudioPlayerStatus.Playing, () => {
      // console.log("audio player entered playing state");
      
      this._player.once(AudioPlayerStatus.Idle, () => {
       // console.log("audio player entered idle state");
        if (this._isPlaying) {
          this._isPlaying = false;
          if (close_callback) close_callback();
        }
      });
    });
    this._player.play(resource);
  }
  
  async probeAndCreateResource(readableStream) {
    const { stream, type } = await demuxProbe(readableStream);
    return createAudioResource(stream, { inputType: type });
  }
  
  vdisconnect() {
    if (this._connection) {
      this._connection.destroy();
      
      this._player = null;
      this._connection = null;
      this._subscription = null;
    }
  }

  vpause() {
    if (this._player) this._player.pause();
  }

  vunpause() {
    if (this._player) this._player.unpause();
  }

  vstop() {
    if (this._player) this._player.stop();
  }

  queue(message, generate, on_next_callback = () => {}) {
    console.log(`< queued: ${message.text}`);
    this.mainPlayerQueue.push({
      event: "tts",
      message: message,
      generate: generate,
      callback: on_next_callback,
    });
  }
  
  addBreak(on_resume_callback = () => {}) {
    this.mainPlayerQueue.push({
      event: "pause",
      callback: on_resume_callback
    });
  }

  get size() {
    return this.mainPlayerQueue.length;
  }
  
  isConnected() {
    return this._subscription != null;
  }
  
  get isPlaying() {
    return this._isPlaying;
  }

  /**
   * Stops and clears the queue.
   */
  stop() {
    this.vstop();
    this._isStopped = true;
    this.mainPlayerQueue = [];
  }
  
  /**
   * Pauses the queue.
   */
  pause() {
    this.vpause();
    this._isStopped = true;
  }

  /**
   * Resume the queue.
   */
  resume() {
    this.vunpause();
    this._isStopped = false;
  }

  async processQueue() {
    if (!this._isPlaying && 
        !this._isStopped && 
        this.isConnected() &&
        this.size > 0) {
      this._next = this.mainPlayerQueue.shift(); // dequeue
      
      if (this._next.event === "pause") {
        console.log("> starting cooldown...");
        if (this._next.callback) this._next.callback();
        await new Promise(resolve => setTimeout(resolve, this.pauseDelayInMs));
        console.log("> done.");
      } else if (this._next.event === "tts") {
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
            console.re.error(err);
            this._isPlaying = false;
          });
      }
    }

    setTimeout(this.processQueue.bind(this), 250);
  }
};
