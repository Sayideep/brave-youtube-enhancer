// Shared fakes for brave-youtube-enhancer tests
"use strict";

class FakeTarget {
  constructor() {
    this._listeners = Object.create(null);
  }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  removeEventListener(type, fn) {
    const arr = this._listeners[type];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }
  dispatch(type, event) {
    const arr = (this._listeners[type] || []).slice();
    for (const fn of arr) fn(event || { type: type });
  }
  listenerCount(type) {
    return (this._listeners[type] || []).length;
  }
}

class FakeClassList {
  constructor(names) {
    this._set = new Set(names || []);
  }
  contains(n) {
    return this._set.has(n);
  }
  add(n) {
    this._set.add(n);
  }
  remove(n) {
    this._set.delete(n);
  }
}

function makeUrl(href) {
  return new URL(href, "https://www.youtube.com");
}

function createFakeEnv(opts) {
  opts = opts || {};
  const doc = new FakeTarget();
  const win = new FakeTarget();

  let _href = opts.href || "https://www.youtube.com/";
  win.navigations = [];
  win.location = {
    get href() {
      return _href;
    },
    set href(v) {
      win.navigations.push(v);
      _href = v;
    },
    get pathname() {
      return makeUrl(_href).pathname;
    },
    get search() {
      return makeUrl(_href).search;
    }
  };

  win.history = {
    backCalls: 0,
    back() {
      this.backCalls += 1;
      if (this.onBack) this.onBack();
    }
  };

  const timers = {
    _intervalFns: [],
    setInterval(fn) {
      timers._intervalFns.push(fn);
      return timers._intervalFns.length;
    },
    clearInterval() {}
  };

  // main video + player
  const player = {
    classList: new FakeClassList(opts.adShowing ? ["ad-showing"] : []),
    contains(v) {
      return v === video;
    }
  };
  const video = {
    tagName: "VIDEO",
    ended: false,
    currentTime: 0,
    duration: 100,
    closest(sel) {
      return sel === "#movie_player" ? player : null;
    }
  };
  doc.getElementById = (id) => (id === "movie_player" ? player : null);
  doc.fullscreenElement = opts.fullscreen ? player : null;

  win.console = { debug() {}, error() {} };

  return { doc, win, player, video, timers };
}

function navigate(env, href) {
  env.win.location.href = href;
  env.doc.dispatch("yt-navigate-finish");
}

module.exports = { FakeTarget, FakeClassList, createFakeEnv, navigate };
