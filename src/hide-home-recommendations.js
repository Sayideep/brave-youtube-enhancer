// Feature: hide the recommended video feed on YouTube's homepage only.
// Search, subscriptions, watch pages, and the site header are left unchanged.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YTAHideHomeRecommendations = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STYLE_ID = "yta-hide-home-recommendations-style";
  const CSS = [
    'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,',
    'ytd-browse[page-subtype="home"] ytd-two-column-browse-results-renderer {',
    '  display: none !important;',
    '}',
    'ytm-browse[page-subtype="home"] ytm-rich-grid-renderer,',
    'ytm-browse[page-subtype="home"] ytm-rich-section-renderer {',
    '  display: none !important;',
    '}'
  ].join("\n");

  function createHideHomeRecommendations(opts) {
    const doc = opts.doc;
    const settings = opts.settings;
    let started = false;
    let unsubscribe = null;

    function apply() {
      const existing = doc.getElementById(STYLE_ID);
      if (settings.get("hideHomeRecommendations")) {
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

  return {
    createHideHomeRecommendations: createHideHomeRecommendations,
    STYLE_ID: STYLE_ID,
    CSS: CSS
  };
});
