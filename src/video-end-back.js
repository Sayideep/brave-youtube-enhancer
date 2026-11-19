// brave-youtube-enhancer - Feature 1: "Go Back" when a video ends
//
// End detection (both signals PROVEN live in Brave 157 / Chromium, 2026-11-17):
//   - primary : HTMLMediaElement "ended" event, captured on document
//   - fallback: "timeupdate" where video.ended === true
//               (observed firing ~125 ms BEFORE the "ended" event)
//
// Safety guards (in evaluate order) - a back navigation only happens when ALL
// pass: enabled, main content video (inside #movie_player), not an ad, armed
// (one back per video), not fullscreen (if configured), not a playlist (unless
// configured), and a previous YouTube page exists in this tab's stack.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YTAEndBack = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createVideoEndBack(opts) {
    const nav = opts.nav;
    const settings = opts.settings;
    const doc = opts.doc;
    const win = opts.win;

    let armed = true;
    let started = false;
    let lastResult = null;

    function playerOf(video) {
      if (video && typeof video.closest === "function") {
        const p =
          video.closest("#movie_player") ||
          video.closest("ytm-player") ||
          video.closest(".html5-video-player");
        if (p) return p;
      }
      return doc.getElementById("movie_player") || doc.querySelector("ytm-player");
    }

    function debug(msg) {
      if (settings.get("debug") && win.console && win.console.debug) {
        win.console.debug("[YTA] " + msg);
      }
    }

    // Pure decision function: returns {ok, reason} - unit-test friendly.
    function evaluate(reason, video, state) {
      state = state || {};
      if (!settings.get("enabled")) return { ok: false, reason: "disabled" };
      if (!video || (video.tagName && video.tagName !== "VIDEO")) {
        return { ok: false, reason: "not-video" };
      }
      const player = state.player || playerOf(video);
      if (!player || (player.contains && !player.contains(video))) {
        return { ok: false, reason: "not-main-video" };
      }
      if (player.classList && player.classList.contains("ad-showing")) {
        return { ok: false, reason: "ad" };
      }
      if (!armed) return { ok: false, reason: "already-fired" };
      if (settings.get("skipIfFullscreen") && (state.fullscreen || doc.fullscreenElement)) {
        return { ok: false, reason: "fullscreen" };
      }
      let list = null;
      try {
        list = new URL(nav.currentUrl(), "https://www.youtube.com").searchParams.get("list");
      } catch (e) { /* ignore */ }
      if (list && !settings.get("backInPlaylists")) {
        return { ok: false, reason: "playlist" };
      }
      const prev = nav.previousUrl();
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
      win.location.href = verdict.previous;
      return verdict;
    }

    function isMainContentVideo(video) {
      const player = playerOf(video);
      return !!(player && video && player.contains && player.contains(video));
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
      armed = true; // a new page/video re-arms the feature
    }

    let unsubscribeNav = null;

    return {
      start: function () {
        if (started) return;
        started = true;
        doc.addEventListener("ended", onEnded, true);
        doc.addEventListener("timeupdate", onTimeUpdate, true);
        unsubscribeNav = nav.onNavigate(onNavigate);
      },
      stop: function () {
        if (!started) return;
        started = false;
        doc.removeEventListener("ended", onEnded, true);
        doc.removeEventListener("timeupdate", onTimeUpdate, true);
        if (unsubscribeNav) unsubscribeNav();
      },
      evaluate: evaluate,
      trigger: trigger,
      disarm: function () {
        armed = false;
      },
      arm: function () {
        armed = true;
      },
      isArmed: function () {
        return armed;
      },
      lastResult: function () {
        return lastResult;
      }
    };
  }

  return { createVideoEndBack: createVideoEndBack };
});
