// brave-youtube-enhancer - Feature 2: Hide end-screen cards/recommendations overlay
//
// Complements Feature 1 by removing the end-screen grid/cards that appear when
// a video finishes (or during playback as cards). Pure CSS injection, toggleable.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YTAHideEndScreen = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STYLE_ID = "yta-hide-endscreen-style";
  const CSS = [
    ".ytp-ce-element,",
    ".ytp-endscreen-content,",
    ".ytp-fullscreen-grid,",
    ".ytp-fullscreen-grid-stills-container,",
    ".html5-endscreen,",
    "ytd-endscreen-renderer {",
    "  display: none !important;",
    "}"
  ].join("\n");

  function createHideEndScreen(opts) {
    const doc = opts.doc;
    const settings = opts.settings;
    let started = false;

    function ensureStyle() {
      if (!settings.get("hideEndScreen")) return removeStyle();
      if (doc.getElementById(STYLE_ID)) return;
      const style = doc.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      (doc.head || doc.documentElement).appendChild(style);
    }

    function removeStyle() {
      const el = doc.getElementById(STYLE_ID);
      if (el) el.remove();
    }

    function apply() {
      if (settings.get("hideEndScreen")) ensureStyle();
      else removeStyle();
    }

    let unsub = null;

    return {
      start: function () {
        if (started) return;
        started = true;
        apply();
        if (settings.onChange) unsub = settings.onChange(apply);
      },
      stop: function () {
        if (!started) return;
        started = false;
        if (unsub) unsub();
        removeStyle();
      },
      apply: apply,
      STYLE_ID: STYLE_ID,
      CSS: CSS
    };
  }

  return { createHideEndScreen: createHideEndScreen, STYLE_ID: STYLE_ID, CSS: CSS };
});
