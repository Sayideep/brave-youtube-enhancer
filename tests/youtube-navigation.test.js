"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeEnv, navigate } = require("./helpers");
const YTANavigation = require("../src/youtube-navigation.js");

test("isWatchPage / videoIdFrom parse URLs correctly", () => {
  assert.equal(YTANavigation.isWatchPage("https://www.youtube.com/watch?v=abc"), true);
  assert.equal(YTANavigation.isWatchPage("https://www.youtube.com/"), false);
  assert.equal(YTANavigation.isWatchPage("https://www.youtube.com/shorts/xyz"), false);
  assert.equal(YTANavigation.videoIdFrom("https://www.youtube.com/watch?v=abc&list=PL1"), "abc");
  assert.equal(YTANavigation.videoIdFrom("https://www.youtube.com/"), null);
});

test("start/stop attaches and detaches all three SPA triggers", () => {
  const env = createFakeEnv();
  const nav = YTANavigation.createNavigation({ win: env.win, doc: env.doc, pollMs: 0 });
  nav.start();
  assert.equal(env.doc.listenerCount("yt-navigate-finish"), 1);
  assert.equal(env.doc.listenerCount("yt-page-data-updated"), 1);
  assert.equal(env.win.listenerCount("popstate"), 1);
  nav.stop();
  assert.equal(env.doc.listenerCount("yt-navigate-finish"), 0);
  assert.equal(env.win.listenerCount("popstate"), 0);
});

test("yt-navigate-finish fires onNavigate with url + previous", () => {
  const env = createFakeEnv();
  const nav = YTANavigation.createNavigation({ win: env.win, doc: env.doc, pollMs: 0 });
  nav.start();
  const seen = [];
  nav.onNavigate((p) => seen.push(p));
  navigate(env, "https://www.youtube.com/watch?v=abc");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "https://www.youtube.com/watch?v=abc");
  assert.equal(seen[0].previous, "https://www.youtube.com/");
  assert.equal(seen[0].type, "yt");
});

test("popstate (in-page Back) also triggers detection", () => {
  const env = createFakeEnv({ href: "https://www.youtube.com/watch?v=abc" });
  const nav = YTANavigation.createNavigation({ win: env.win, doc: env.doc, pollMs: 0 });
  nav.start();
  const seen = [];
  nav.onNavigate((p) => seen.push(p));
  env.win.location.href = "https://www.youtube.com/"; // user pressed Back
  env.win.dispatch("popstate");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].type, "popstate");
});

test("URL poll is the fail-safe when custom events never fire", () => {
  const env = createFakeEnv();
  const nav = YTANavigation.createNavigation({
    win: env.win,
    doc: env.doc,
    pollMs: 1000,
    timers: env.timers
  });
  nav.start();
  assert.equal(env.timers._intervalFns.length, 1);
  const seen = [];
  nav.onNavigate((p) => seen.push(p));
  env.win.location.href = "https://www.youtube.com/watch?v=abc"; // no events dispatched
  env.timers._intervalFns[0](); // poll tick
  assert.equal(seen.length, 1);
  assert.equal(seen[0].type, "poll");
});

test("duplicate syncs for the same URL do not stack entries", () => {
  const env = createFakeEnv();
  const nav = YTANavigation.createNavigation({ win: env.win, doc: env.doc, pollMs: 0 });
  nav.start();
  navigate(env, "https://www.youtube.com/watch?v=abc");
  env.doc.dispatch("yt-navigate-finish"); // same URL again
  env.doc.dispatch("yt-page-data-updated"); // and again
  assert.deepEqual(nav.stack(), [
    "https://www.youtube.com/",
    "https://www.youtube.com/watch?v=abc"
  ]);
});

test("SPA Back pops the stack so previousUrl() stays truthful", () => {
  const env = createFakeEnv();
  const nav = YTANavigation.createNavigation({ win: env.win, doc: env.doc, pollMs: 0 });
  nav.start();
  navigate(env, "https://www.youtube.com/watch?v=abc");
  navigate(env, "https://www.youtube.com/watch?v=def");
  assert.equal(nav.previousUrl(), "https://www.youtube.com/watch?v=abc");
  // SPA back: href goes back to the previous entry
  env.win.location.href = "https://www.youtube.com/watch?v=abc";
  env.win.dispatch("popstate");
  assert.deepEqual(nav.stack(), [
    "https://www.youtube.com/",
    "https://www.youtube.com/watch?v=abc"
  ]);
  assert.equal(nav.previousUrl(), "https://www.youtube.com/");
});

test("stack works from a cold start on a watch page", () => {
  const env = createFakeEnv({ href: "https://www.youtube.com/watch?v=abc" });
  const nav = YTANavigation.createNavigation({ win: env.win, doc: env.doc, pollMs: 0 });
  nav.start();
  assert.equal(nav.previousUrl(), null); // nothing to go back to *within YouTube*
  assert.equal(nav.isWatchPage(), true);
  assert.equal(nav.videoId(), "abc");
});
