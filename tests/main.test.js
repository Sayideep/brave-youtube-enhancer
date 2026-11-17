"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeEnv, navigate } = require("./helpers");
const YTANavigation = require("../src/youtube-navigation.js");
const YTAEndBack = require("../src/video-end-back.js");
const YTAEnhancer = require("../src/main.js");

test("DEFAULTS are sane (Feature 1 ON, playlists untouched, fullscreen allowed, Feature 2 ON)", () => {
  assert.equal(YTAEnhancer.DEFAULTS.enabled, true);
  assert.equal(YTAEnhancer.DEFAULTS.backInPlaylists, false);
  assert.equal(YTAEnhancer.DEFAULTS.skipIfFullscreen, false);
  assert.equal(YTAEnhancer.DEFAULTS.debug, false);
  assert.equal(YTAEnhancer.DEFAULTS.hideEndScreen, true);
});

test("createEnhancer wires nav + video-end-back feature end-to-end", () => {
  const env = createFakeEnv();
  const api = YTAEnhancer.createEnhancer({
    win: env.win,
    doc: env.doc,
    YTANavigation,
    YTAEndBack,
    initial: { debug: false }
  });
  assert.ok(api.nav, "nav attached");
  assert.ok(api.endBack, "feature 1 attached");
  assert.equal(api.features.has("video-end-back"), true);
  // live pipeline: home -> watch -> video ends -> back called
  navigate(env, "https://www.youtube.com/");
  navigate(env, "https://www.youtube.com/watch?v=abc");
  env.video.ended = true;
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 1);
  api.stop();
});

test("settings: defaults from storage, set() persists and notifies", () => {
  const env = createFakeEnv();
  let persisted = null;
  const fakeStorage = {
    get(defaults, cb) {
      cb(Object.assign({}, defaults, { enabled: false }));
    },
    set(obj) {
      persisted = obj;
    }
  };
  const s = YTAEnhancer.createSettings({ win: env.win, storage: fakeStorage });
  assert.equal(s.get("enabled"), false); // loaded from storage
  let notified = 0;
  s.onChange(() => notified++);
  s.set("enabled", true);
  assert.equal(s.get("enabled"), true);
  assert.deepEqual(persisted, { enabled: true });
  assert.ok(notified >= 1);
});

test("settings: no storage available -> defaults still work", () => {
  const env = createFakeEnv();
  const s = YTAEnhancer.createSettings({ win: env.win, storage: null });
  assert.equal(s.get("enabled"), true);
  s.set("debug", true);
  assert.equal(s.get("debug"), true);
});

test("register() accepts future Feature 2/3/4 modules", () => {
  const env = createFakeEnv();
  const api = YTAEnhancer.createEnhancer({
    win: env.win,
    doc: env.doc,
    YTANavigation,
    YTAEndBack
  });
  let started = false;
  api.register("feature-2", {
    start() {
      started = true;
    },
    stop() {}
  });
  assert.equal(started, true);
  assert.equal(api.features.has("feature-2"), true);
  api.stop();
});

test("browser auto-boot does not run in Node (no window/document)", () => {
  // requiring main.js in Node must not throw or touch globals
  assert.equal(typeof YTAEnhancer.createEnhancer, "function");
});
