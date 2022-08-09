module.exports = class TTSQueue {
  constructor() {
    this.mainPlayerQueue = [];
    this.player = null;
    this._isPlaying = false;
    this._isStopped = false;
    this._next = null;
  }

  play(audio_data, close_callback = () => {}) {
    // TODO send audio data to Discord Bot player
  }

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
          this._next.message.languageCode
        )
        .then((audio_data) => {
          console.log(`> playing: ${this._next.message.text}`);
          this.play(audio_data, this._next.callback);
        })
        .catch((err) => {
          console.log(err);
          this._isPlaying = false;
        });
    }

    setTimeout(this.processQueue.bind(this), 250);
  }
};
