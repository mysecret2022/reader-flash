class EventBus {
  constructor() {
    this.events = {};
  }

  $on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  $once(event, callback) {
    const onceFn = (...args) => {
      this.$off(event, onceFn);
      callback(...args);
    };
    onceFn._callback = callback;
    this.$on(event, onceFn);
  }

  $off(event, callback) {
    if (!this.events[event]) return;
    if (!callback) {
      delete this.events[event];
    } else {
      this.events[event] = this.events[event].filter(
        cb => cb !== callback && cb._callback !== callback
      );
    }
  }

  $emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(cb => {
      try {
        cb(...args);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }
}

export default new EventBus();
