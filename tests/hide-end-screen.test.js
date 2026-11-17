"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const YTAHideEndScreen = require("../src/hide-end-screen.js");

function makeDoc() {
  const els = new Map();
  const head = {
    children: [],
    appendChild(el) {
      this.children.push(el);
      els.set(el.id, el);
    }
  };
  return {
    head,
    documentElement: head,
    getElementById(id) {
      return els.get(id) || null;
    },
    createElement(tag) {
      return {
        tag,
        id: "",
        textContent: "",
        remove() {
          for (const [k, v] of els) if (v === this) els.delete(k);
          const i = head.children.indexOf(this);
          if (i >= 0) head.children.splice(i, 1);
        }
      };
    },
    _els: els
  };
}

function makeSettings(initial) {
  let v = initial;
  const cbs = [];
  return {
    get: (k) => v[k],
    set: (k, val) => {
      v[k] = val;
      cbs.forEach((cb) => cb(v));
    },
    onChange: (cb) => {
      cbs.push(cb);
      return () => {
        const i = cbs.indexOf(cb);
        if (i >= 0) cbs.splice(i, 1);
      };
    }
  };
}

test("Feature 2: injects style when hideEndScreen=true", () => {
  const doc = makeDoc();
  const settings = makeSettings({ hideEndScreen: true });
  const f = YTAHideEndScreen.createHideEndScreen({ doc, settings });
  f.start();
  assert.ok(doc.getElementById(YTAHideEndScreen.STYLE_ID));
  assert.match(doc.getElementById(YTAHideEndScreen.STYLE_ID).textContent, /\.ytp-endscreen-content/);
  f.stop();
  assert.equal(doc.getElementById(YTAHideEndScreen.STYLE_ID), null);
});

test("Feature 2: removes style when disabled", () => {
  const doc = makeDoc();
  const settings = makeSettings({ hideEndScreen: true });
  const f = YTAHideEndScreen.createHideEndScreen({ doc, settings });
  f.start();
  assert.ok(doc.getElementById(YTAHideEndScreen.STYLE_ID));
  settings.set("hideEndScreen", false);
  assert.equal(doc.getElementById(YTAHideEndScreen.STYLE_ID), null);
  settings.set("hideEndScreen", true);
  assert.ok(doc.getElementById(YTAHideEndScreen.STYLE_ID));
  f.stop();
});

test("Feature 2: no style when initially disabled", () => {
  const doc = makeDoc();
  const settings = makeSettings({ hideEndScreen: false });
  const f = YTAHideEndScreen.createHideEndScreen({ doc, settings });
  f.start();
  assert.equal(doc.getElementById(YTAHideEndScreen.STYLE_ID), null);
  f.stop();
});
