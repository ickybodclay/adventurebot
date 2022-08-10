const {  
  createAudioResource,
  AudioPlayerStatus, 
  PlayerSubscription,
  VoiceConnectionStatus
} = require('@discordjs/voice');

module.exports = class TTSQueue {
  constructor() {
    this.mainPlayerQueue = [];
    this._subscription = null;
    this._isPlaying = false;
    this._isStopped = false;
    this._next = null;
  }

  play(audio_file, close_callback = () => {}) {
    const resource = createAudioResource(audio_file);
    this._subscription.player.play(resource);
    this._subscription.player.on(AudioPlayerStatus.Idle, () => {
      this._isPlaying = false;
      if (close_callback) close_callback();
  });
  }

  vpause() {
    this._subscription.player.pause();
  }

  vunpause() {
    this._subscription.player.unpause();
  }

  vstop() {
    this._subscription.player.stop();
  }

  queue(message, generate, on_next_callback = () => {}) {
    console.log(`< queued: ${message.text}`);
    this.mainPlayerQueue.push({
      message: message,
      generate: generate,
      callback: on_next_callback,
    });
  }

  /**
   * @param {PlayerSubscription} subscription
   */
  set subscription(subscription) {
    this.destroyConnection(); // check if subscription exists and if so, destroy it

    this._subscription = subscription;
    this._subscription.connection.on(VoiceConnectionStatus.Ready, (oldState, newState) => {
        console.log('Connection is in the Ready state!');
    });
    this._subscription.player.on('error', error => {
        console.error(error);
    });
  }

  destroyConnection() {
    if (this._subscription) {
      this._subscription.connection.destroy();
      this._subscription = null;
    }
  }

  get size() {
    return this.mainPlayerQueue.length;
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
