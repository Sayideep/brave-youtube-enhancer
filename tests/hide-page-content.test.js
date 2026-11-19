"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Shorts = require("../src/hide-shorts.js");
const Home = require("../src/hide-home-recommendations.js");

function harness() {
  const elements = new Map();
  const head = { appendChild(el) { elements.set(el.id, el); } };
  const doc = {
    head,
    documentElement: head,
    getElementById: (id) => elements.get(id) || null,
    createElement: () => ({ id: "", textContent: "", remove() { elements.delete(this.id); } })
  };
  const values = { hideShorts: true, hideHomeRecommendations: true };
  const listeners = [];
  const settings = {
    get: (key) => values[key],
    set(key, value) { values[key] = value; listeners.slice().forEach((fn) => fn()); },
    onChange(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); }
  };
  return { doc, settings };
}

test("hide Shorts injects CSS and removes it when toggled off", () => {
  const h = harness();
  const feature = Shorts.createHideShorts(h);
  feature.start();
  assert.match(h.doc.getElementById(Shorts.STYLE_ID).textContent, /ytd-reel-shelf-renderer/);
  h.settings.set("hideShorts", false);
  assert.equal(h.doc.getElementById(Shorts.STYLE_ID), null);
  feature.stop();
});

test("hide homepage recommendations is scoped to the home feed selector", () => {
  const h = harness();
  const feature = Home.createHideHomeRecommendations(h);
  feature.start();
  const css = h.doc.getElementById(Home.STYLE_ID).textContent;
  assert.match(css, /page-subtype="home"/);
  assert.match(css, /ytd-rich-grid-renderer/);
  assert.doesNotMatch(css, /ytd-watch-flexy|ytd-search/);
  h.settings.set("hideHomeRecommendations", false);
  assert.equal(h.doc.getElementById(Home.STYLE_ID), null);
  feature.stop();
});
