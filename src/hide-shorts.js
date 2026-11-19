// Feature: hide YouTube Shorts shelves, tiles, and navigation links.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YTAHideShorts = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STYLE_ID = "yta-hide-shorts-style";
  const CSS = [
    'a[href^="/shorts/"],',
    'ytd-reel-shelf-renderer,',
    'ytd-rich-shelf-renderer[is-shorts],',
    'ytd-reel-item-renderer,',
    'ytm-reel-shelf-renderer,',
    'ytm-shorts-lockup-view-model { display: none !important; }'
  ].join("\n");

  function createHideShorts(opts) {
    const doc = opts.doc;
    const settings = opts.settings;
    let started = false;
    let unsubscribe = null;

    function apply() {
      const existing = doc.getElementById(STYLE_ID);
      if (settings.get("hideShorts")) {
        if (!existing) {
          const style = doc.createElement("style");
          style.id = STYLE_ID;
          style.textContent = CSS;
          (doc.head || doc.documentElement).appendChild(style);
        }
      } else if (existing) existing.remove();
    }

    return {
      start: function () {
        if (started) return;
        started = true;
        apply();
        if (settings.onChange) unsubscribe = settings.onChange(apply);
      },
      stop: function () {
        if (!started) return;
        started = false;
        if (unsubscribe) unsubscribe();
        const style = doc.getElementById(STYLE_ID);
        if (style) style.remove();
      },
      apply: apply
    };
  }

  return { createHideShorts: createHideShorts, STYLE_ID: STYLE_ID, CSS: CSS };
});
