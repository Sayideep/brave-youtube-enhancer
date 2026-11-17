// brave-youtube-enhancer - boot + feature registry
//
// Wires navigation tracking + registered features together and exposes a
// console handle (window.__yta) for live verification. Adding Feature 2/3/4:
// create src/<feature>.js exposing a factory, then register it below (or at
// runtime via __yta.register("name", featureInstance)).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YTAEnhancer = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULTS = {
    enabled: true,            // master switch for Feature 1
    backInPlaylists: false,   // never fight playlist auto-advance unless the user opts in
    skipIfFullscreen: false,  // set true to leave fullscreen users alone
    debug: false,             // log skip/back decisions to console.debug
    hideEndScreen: true       // Feature 2: hide end-screen cards/recommendations overlay
  };

  const STORAGE_KEY = DEFAULTS; // used as chrome.storage.sync.get() defaults

  function createSettings(env) {
    const win = env.win;
    let values = Object.assign({}, DEFAULTS, env.initial || {});
    const listeners = [];
    const sync =
      typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync
        ? chrome.storage.sync
        : env.storage || null;

    function notify() {
      for (let i = 0; i < listeners.length; i++) {
        try {
          listeners[i](values);
        } catch (e) { /* ignore */ }
      }
    }

    if (sync && typeof sync.get === "function") {
      try {
        const ret = sync.get(STORAGE_KEY, function (stored) {
          if (stored) {
            values = Object.assign({}, values, stored);
            notify();
          }
        });
        if (ret && typeof ret.then === "function") ret.catch(function () {});
      } catch (e) { /* storage unavailable -> defaults stay */ }
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== "sync") return;
        let touched = false;
        for (const k in changes) {
          if (k in DEFAULTS) {
            values[k] = changes[k].newValue;
            touched = true;
          }
        }
        if (touched) notify();
      });
    }

    return {
      get: function (k) {
        return values[k];
      },
      all: function () {
        return Object.assign({}, values);
      },
      set: function (k, v) {
        values[k] = v;
        if (sync && typeof sync.set === "function") {
          try {
            const ret = sync.set({ [k]: v });
            if (ret && typeof ret.then === "function") ret.catch(function () {});
          } catch (e) { /* ignore */ }
        }
        notify();
      },
      onChange: function (cb) {
        listeners.push(cb);
        return function () {
          const i = listeners.indexOf(cb);
          if (i >= 0) listeners.splice(i, 1);
        };
      }
    };
  }

  function createEnhancer(env) {
    const win = env.win;
    const doc = env.doc;
    const nav =
      env.nav ||
      (env.YTANavigation ? env.YTANavigation.createNavigation({ win: win, doc: doc }) : null);
    const settings = env.settings || createSettings(env);
    const features = new Map();

    const api = {
      version: "0.1.0",
      nav: nav,
      settings: settings,
      features: features,
      register: function (name, feature) {
        features.set(name, feature);
        if (feature && typeof feature.start === "function" && nav) {
          try {
            feature.start();
          } catch (e) {
            if (win.console) win.console.error("[YTA] feature " + name + " failed:", e);
          }
        }
        return feature;
      },
      stop: function () {
        features.forEach(function (f) {
          if (f && typeof f.stop === "function") f.stop();
        });
        if (nav) nav.stop();
      }
    };

    // Feature 1
    if (nav && env.YTAEndBack) {
      const endBack = env.YTAEndBack.createVideoEndBack({
        nav: nav,
        settings: settings,
        doc: doc,
        win: win
      });
      api.register("video-end-back", endBack);
      api.endBack = endBack;
    }

    // Feature 2
    if (env.YTAHideEndScreen) {
      const hideEndScreen = env.YTAHideEndScreen.createHideEndScreen({
        settings: settings,
        doc: doc
      });
      api.register("hide-end-screen", hideEndScreen);
      api.hideEndScreen = hideEndScreen;
    }

    if (nav) nav.start();
    return api;
  }

  // Browser auto-boot (content script context only)
  function shouldAutoBoot() {
    if (typeof window === "undefined" || typeof document === "undefined") return false;
    if (window.__yta) return false;
    try {
      return /(^|\.)youtube\.com$/.test(location.hostname);
    } catch (e) {
      return false;
    }
  }

  if (shouldAutoBoot()) {
    const YTA = createEnhancer({
      win: window,
      doc: document,
      YTANavigation: root.YTANavigation,
      YTAEndBack: root.YTAEndBack
    });
    window.__yta = YTA;
    document.documentElement.setAttribute("data-yta", "ready");
    window.addEventListener(
      "yt-navigate-finish",
      function () {
        document.documentElement.setAttribute("data-yta", "ready");
      },
      true
    );
  }

  return {
    DEFAULTS: DEFAULTS,
    createSettings: createSettings,
    createEnhancer: createEnhancer
  };
});
