// brave-youtube-enhancer - YouTube SPA navigation tracker
//
// Proven pattern (AntiRecommend / YouTube-Enhancer / Unhooked):
//   1. "yt-navigate-finish" + "yt-page-data-updated"  (YouTube's own SPA events)
//   2. "popstate"                                     (in-page Back/Forward)
//   3. URL polling                                    (fail-safe if both miss)
// All three funnel into one idempotent sync() that keeps a per-tab stack of
// visited YouTube URLs so features can ask "where was I before this video?".
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YTANavigation = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function isWatchPage(url) {
    try {
      return new URL(url, "https://www.youtube.com").pathname === "/watch";
    } catch (e) {
      return false;
    }
  }

  function videoIdFrom(url) {
    try {
      return new URL(url, "https://www.youtube.com").searchParams.get("v");
    } catch (e) {
      return null;
    }
  }

  function createNavigation(opts) {
    const win = opts.win;
    const doc = opts.doc;
    const pollMs = opts.pollMs == null ? 1000 : opts.pollMs;
    const timers = opts.timers || {
      setInterval: function (fn, ms) { return setInterval(fn, ms); },
      clearInterval: function (id) { clearInterval(id); }
    };

    let lastUrl = win.location.href;
    let stack = [lastUrl];
    let started = false;
    let pollId = null;
    const listeners = [];

    // Idempotent: compares current href with last seen, keeps the stack honest.
    function sync(type) {
      const href = win.location.href;
      if (href === lastUrl) return;
      const previous = lastUrl;
      lastUrl = href;
      if (stack.length > 1 && stack[stack.length - 2] === href) {
        stack.pop(); // user went Back inside the SPA: un-push
      } else if (stack[stack.length - 1] !== href) {
        stack.push(href);
      }
      const payload = { url: href, previous: previous, type: type };
      for (let i = 0; i < listeners.length; i++) {
        try {
          listeners[i](payload);
        } catch (e) {
          /* a broken listener must not break navigation tracking */
        }
      }
    }

    function onYtEvent() {
      sync("yt");
    }
    function onPopstate() {
      sync("popstate");
    }

    return {
      start: function () {
        if (started) return;
        started = true;
        doc.addEventListener("yt-navigate-finish", onYtEvent, true);
        doc.addEventListener("yt-page-data-updated", onYtEvent, true);
        win.addEventListener("popstate", onPopstate, true);
        if (pollMs > 0) {
          pollId = timers.setInterval(function () {
            sync("poll");
          }, pollMs);
        }
      },
      stop: function () {
        if (!started) return;
        started = false;
        doc.removeEventListener("yt-navigate-finish", onYtEvent, true);
        doc.removeEventListener("yt-page-data-updated", onYtEvent, true);
        win.removeEventListener("popstate", onPopstate, true);
        if (pollId != null) timers.clearInterval(pollId);
      },
      // Force an immediate comparison (useful for tests and manual triggers.
      refresh: function () {
        sync("manual");
      },
      onNavigate: function (cb) {
        listeners.push(cb);
        return function () {
          const i = listeners.indexOf(cb);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
      currentUrl: function () {
        return win.location.href;
      },
      previousUrl: function () {
        return stack.length > 1 ? stack[stack.length - 2] : null;
      },
      stack: function () {
        return stack.slice();
      },
      isWatchPage: function (url) {
        return isWatchPage(url == null ? win.location.href : url);
      },
      videoId: function (url) {
        return videoIdFrom(url == null ? win.location.href : url);
      }
    };
  }

  return {
    createNavigation: createNavigation,
    isWatchPage: isWatchPage,
    videoIdFrom: videoIdFrom
  };
});
