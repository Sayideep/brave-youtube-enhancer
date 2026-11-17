"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeEnv, navigate } = require("./helpers");
const YTANavigation = require("../src/youtube-navigation.js");
const YTAEndBack = require("../src/video-end-back.js");

function makeFeature(opts) {
  opts = opts || {};
  const env = opts.env || createFakeEnv(opts);
  const nav =
    opts.nav ||
    YTANavigation.createNavigation({ win: env.win, doc: env.doc, pollMs: 0 });
  if (!opts.nav) {
    nav.start();
    if (opts.stack !== false) navigate(env, "https://www.youtube.com/"); // home -> watch
    if (opts.stack !== false) navigate(env, "https://www.youtube.com/watch?v=abc");
  }
  const values = Object.assign(
    { enabled: true, backInPlaylists: false, skipIfFullscreen: false, debug: false },
    opts.settings || {}
  );
  const settings = {
    get: (k) => values[k],
    set: (k, v) => {
      values[k] = v;
    }
  };
  const feature = YTAEndBack.createVideoEndBack({
    nav,
    settings,
    doc: env.doc,
    win: env.win
  });
  feature.start();
  return { env, nav, feature, settings, values };
}

test("happy path: real 'ended' event on main video triggers exactly one back navigation", () => {
  const { env, feature } = makeFeature();
  env.video.ended = true;
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 1);
  assert.equal(feature.isArmed(), false);
  // second 'ended' (e.g. replay) without navigation must NOT fire again
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 1);
  assert.equal(feature.lastResult().reason, "already-fired");
});

test("fail-safe: timeupdate with video.ended=true also triggers", () => {
  const { env, feature } = makeFeature();
  env.video.ended = true;
  env.doc.dispatch("timeupdate", { target: env.video });
  assert.equal(env.win.navigations.length, 1);
  assert.equal(feature.lastResult().reason, "fail-safe");
});

test("timeupdate with video.ended=false does nothing", () => {
  const { env } = makeFeature();
  env.video.ended = false;
  env.doc.dispatch("timeupdate", { target: env.video });
  assert.equal(env.win.navigations.length, 0);
});

test("P0-4 guard: ad-showing player never triggers back", () => {
  const { env, feature } = makeFeature();
  env.player.classList.add("ad-showing");
  env.video.ended = true;
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 0);
  assert.equal(feature.lastResult().reason, "ad");
  // ad ends -> still armed for the real video
  env.player.classList.remove("ad-showing");
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 1);
});

test("P0-4 guard: disabled setting blocks back", () => {
  const { env, values } = makeFeature({ settings: { enabled: false } });
  env.video.ended = true;
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 0);
  assert.equal(values.enabled, false);
});

test("P0-4 guard: no previous YouTube page -> no back (never dump user out of YouTube)", () => {
  const { env } = makeFeature({ stack: false }); // cold start ON the watch page
  env.video.ended = true;
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 0);
});

test("P0-4 guard: playlists are untouched by default, opt-in works", () => {
  // default: playlist URL -> no back
  const a = makeFeature();
  a.env.win.location.href = "https://www.youtube.com/watch?v=abc&list=PL123";
  // reset navigations count for this specific assignment (it was a test setup, not a feature nav)
  a.env.win.navigations.length = 0;
  a.env.video.ended = true;
  a.env.doc.dispatch("ended", { target: a.env.video });
  assert.equal(a.env.win.navigations.length, 0);
  assert.equal(a.feature.lastResult().reason, "playlist");

  // opted in -> back allowed
  const b = makeFeature({ settings: { backInPlaylists: true } });
  b.env.win.location.href = "https://www.youtube.com/watch?v=abc&list=PL123";
  b.env.win.navigations.length = 0;
  b.env.video.ended = true;
  b.env.doc.dispatch("ended", { target: b.env.video });
  assert.equal(b.env.win.navigations.length, 1);
});

test("P0-4 guard: fullscreen skipped when skipIfFullscreen=true", () => {
  const { env, feature } = makeFeature({ settings: { skipIfFullscreen: true } });
  env.doc.fullscreenElement = env.player;
  env.video.ended = true;
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 0);
  assert.equal(feature.lastResult().reason, "fullscreen");
  env.doc.fullscreenElement = null;
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 1);
});

test("videos outside #movie_player (thumbnails, ads iframe previews) never trigger", () => {
  const { env } = makeFeature();
  const stray = { tagName: "VIDEO", ended: true, closest: () => null };
  env.doc.dispatch("ended", { target: stray });
  assert.equal(env.win.navigations.length, 0);
});

test("navigation re-arms the feature for the next video", () => {
  const { env, nav, feature } = makeFeature();
  env.video.ended = true;
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 1);
  navigate(env, "https://www.youtube.com/watch?v=def"); // next video loads
  assert.equal(feature.isArmed(), true);
  env.doc.dispatch("ended", { target: env.video });
  assert.equal(env.win.navigations.length, 2);
  assert.equal(nav.videoId(), "def");
});

test("evaluate() returns structured verdicts for every guard", () => {
  const { feature, env } = makeFeature();
  const ok = feature.evaluate("test", env.video, { player: env.player });
  assert.equal(ok.ok, true);
  assert.equal(ok.reason, "test");
  assert.ok(ok.previous);

  const notVideo = feature.evaluate("test", { tagName: "DIV" }, { player: env.player });
  assert.equal(notVideo.ok, false);
  assert.equal(notVideo.reason, "not-video");
});
