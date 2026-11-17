// ==UserScript==
// @name         Brave YouTube Enhancer — Feature 1: Go Back on Video End
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  When a YouTube video finishes, go back to the previous page instead of being trapped on end-screen recommendations.
// @author       Sayideep
// @match        *://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  /* ── settings (edit these directly) ─────────────────────────────── */
  const SETTINGS = {
    enabled: true,        // master switch
    backInPlaylists: false,   // never fight playlist auto-advance unless true
    skipIfFullscreen: false,  // leave fullscreen users alone unless true
    debug: false          // log skip/back decisions to console.debug
  };

  /* ── SPA navigation tracker ─────────────────────────────────────── */
  // Proven pattern: yt-navigate-finish + yt-page-data-updated + popstate +
  // URL-polling fail-safe. Keeps a per-tab URL stack so "previous page" is known.
  let lastUrl = location.href;
  let stack = [lastUrl];
  const listeners = [];

  function sync(type) {
    const href = location.href;
    if (href === lastUrl) return;
    const previous = lastUrl;
    lastUrl = href;
    if (stack.length > 1 && stack[stack.length - 2] === href) {
      stack.pop(); // in-page Back: un-push
    } else if (stack[stack.length - 1] !== href) {
      stack.push(href);
    }
    const payload = { url: href, previous: previous, type: type };
    for (let i = 0; i < listeners.length; i++) {
      try {
        listeners[i](payload);
      } catch (e) { /* a broken listener must not break tracking */ }
    }
  }

  function startNavigation() {
    document.addEventListener("yt-navigate-finish", () => sync("yt"), true);
    document.addEventListener("yt-page-data-updated", () => sync("yt"), true);
    window.addEventListener("popstate", () => sync("popstate"), true);
    setInterval(() => sync("poll"), 1000); // fail-safe
  }

  function previousUrl() {
    return stack.length > 1 ? stack[stack.length - 2] : null;
  }

  function videoId(url) {
    try {
      return new URL(url, "https://www.youtube.com").searchParams.get("v");
    } catch (e) {
      return null;
    }
  }

  /* ── Feature 1: end-of-video back ───────────────────────────────── */
  let armed = true;
  let lastResult = null;

  function debug(msg) {
    if (SETTINGS.debug && console && console.debug) console.debug("[YTA] " + msg);
  }

  function playerOf(video) {
    if (video && typeof video.closest === "function") {
      const p = video.closest("#movie_player");
      if (p) return p;
    }
    return document.getElementById("movie_player");
  }

  function isMainContentVideo(video) {
    const player = playerOf(video);
    return !!(player && video && player.contains && player.contains(video));
  }

  // Pure decision function — unit-test friendly
  function evaluate(reason, video, state) {
    state = state || {};
    if (!SETTINGS.enabled) return { ok: false, reason: "disabled" };
    if (!video || video.tagName !== "VIDEO") return { ok: false, reason: "not-video" };
    const player = state.player || playerOf(video);
    if (!player || !player.contains || !player.contains(video)) return { ok: false, reason: "not-main-video" };
    if (player.classList && player.classList.contains("ad-showing")) return { ok: false, reason: "ad" };
    if (!armed) return { ok: false, reason: "already-fired" };
    if (SETTINGS.skipIfFullscreen && (state.fullscreen || document.fullscreenElement)) return { ok: false, reason: "fullscreen" };
    let list = null;
    try {
      list = new URL(location.href, "https://www.youtube.com").searchParams.get("list");
    } catch (e) { /* ignore */ }
    if (list && !SETTINGS.backInPlaylists) return { ok: false, reason: "playlist" };
    const prev = previousUrl();
    if (!prev) return { ok: false, reason: "no-previous-page" };
    return { ok: true, reason: reason, previous: prev };
  }

  function trigger(reason, video, state) {
    const verdict = evaluate(reason, video, state);
    lastResult = verdict;
    if (!verdict.ok) {
      debug("skip (" + verdict.reason + ")");
      return verdict;
    }
    armed = false;
    debug("going back to " + verdict.previous + " (" + verdict.reason + ")");
    window.history.back();
    return verdict;
  }

  function onEnded(e) {
    const video = e.target;
    if (!video || video.tagName !== "VIDEO") return;
    if (!isMainContentVideo(video)) return;
    trigger("ended", video);
  }

  function onTimeUpdate(e) {
    const video = e.target;
    if (!video || video.tagName !== "VIDEO" || !video.ended) return;
    if (!isMainContentVideo(video)) return;
    trigger("fail-safe", video);
  }

  function onNavigate() {
    armed = true; // new page/video re-arms the feature
  }

  document.addEventListener("ended", onEnded, true);
  document.addEventListener("timeupdate", onTimeUpdate, true);
  document.addEventListener("yt-navigate-finish", onNavigate, true);

  startNavigation();

  /* ── public debug handle ────────────────────────────────────────── */
  window.__ytaFeature1 = {
    evaluate: evaluate,
    trigger: trigger,
    disarm: function () { armed = false; },
    arm: function () { armed = true; },
    isArmed: function () { return armed; },
    lastResult: function () { return lastResult; },
    previousUrl: previousUrl,
    videoId: videoId,
    settings: SETTINGS
  };

  debug("loaded");
})();
