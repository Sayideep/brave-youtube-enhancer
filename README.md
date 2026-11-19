# Brave YouTube Enhancer

Modular, additive YouTube features for Brave (desktop).

- **Feature 1:** When a YouTube video finishes, go Back to the previous page instead of staying trapped on the end-screen recommendations.
- **Feature 2:** Hide end-screen cards/recommendations overlay (`.ytp-endscreen-content`, cards, etc.).
- **Feature 3:** Hide Shorts shelves, tiles, and links.
- **Feature 4:** Hide the recommended video feed on the homepage only; search, subscriptions, and watch pages are not targeted.

Nothing in Brave or YouTube is modified. Plain MV3 content-script extension / userscript. Feature 1 navigates to the previous URL when the main video ends (with guards). Features 2–4 inject scoped CSS to hide their respective YouTube UI. The extension and userscript match both `www.youtube.com` and `m.youtube.com`; mobile selectors are included where YouTube's mobile DOM differs.

## Why this approach (research summary, 2026-11)

| Option | Verdict |
|---|---|
| Patch Brave/Chromium source | ❌ Rejected — huge diff, maintenance burden, unneeded |
| Brave Android feature | ❌ Not possible today — Brave Android extensions are experimental (brave-browser#59354, Sep 2026): flag-gated, tablets/foldables only, **no phone UI yet** |
| Userscript | ⚠️ Works, but no per-feature settings storage story |
| **MV3 extension (chosen)** | ✅ Smallest reliable unit; proven pattern used by AntiRecommend, Unhooked, YouTube-Enhancer (all MIT) |

Proven patterns reused (not copied wholesale — MIT licenses, clean-room here):

- **SPA navigation detection**: `yt-navigate-finish` + `yt-page-data-updated`
  + `popstate` + URL polling fail-safe.
- **End detection**: native `video` `ended` event (primary),
  `timeupdate` with `video.ended === true` (fail-safe — observed firing
  ~125 ms earlier than `ended`).

## Feature 1 safety guards

A back navigation happens only when **all** of these pass:

1. Feature enabled (`enabled`, default **on** after end-detection was proven)
2. Event came from the main content video inside `#movie_player`
3. No ad is showing (`ad-showing` class) — ads ending never navigate
4. Armed — exactly **one** back per video; re-armed on navigation
5. Not fullscreen, if `skipIfFullscreen` is enabled (default off)
6. Not a playlist, unless `backInPlaylists` is enabled (default off —
   never fights playlist auto-advance)
7. A **previous YouTube page exists in this tab's stack** — if the user
   opened the video directly, nothing happens (never dumps you out of YouTube)

Normal browser Back, YouTube's own navigation, fullscreen, PiP and scrolling
are untouched: the feature only *calls* `history.back()`; it never intercepts,
prevents, or rewrites any navigation event.

## Files

```
brave-youtube-enhancer/
├── manifest.json                 MV3 manifest (content scripts, storage permission)
├── README.md                     this file
├── package.json                  npm test / npm run check
├── src/
│   ├── youtube-navigation.js     SPA tracker + per-tab URL stack
│   ├── video-end-back.js         end detection + guards + history.back()
│   ├── hide-end-screen.js        Feature 2: hide player end-screen cards
│   ├── hide-shorts.js            Feature 3: hide Shorts shelves/tiles/links
│   ├── hide-home-recommendations.js Feature 4: hide homepage recommendation feed
│   └── main.js                   settings, feature registry, boot
└── tests/
    ├── helpers.js                fake DOM/video/history harness
    ├── youtube-navigation.test.js
    ├── video-end-back.test.js
    ├── main.test.js
    ├── hide-end-screen.test.js
    └── hide-page-content.test.js
```

## Install (Brave desktop, permanent)

1. Open `brave://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** → select this `brave-youtube-enhancer` folder
4. Open any YouTube video, play it to the end (or seek to the last seconds)
   → the page returns to wherever you came from

Temporary (flag) loading also works:

```
brave.exe --load-extension=C:\Users\sandeeps\brave-youtube-enhancer https://www.youtube.com/
```

## Test

```powershell
npm test          # 25 unit tests, node:test, no dependencies
npm run check     # syntax check of all 3 source files
```

Manual end-to-end (with the extension loaded):

1. Open `https://www.youtube.com/`
2. Click any video (SPA navigation — builds the history stack)
3. Seek to the last ~4 seconds and let it end
4. Expected: browser returns to the homepage within ~1 s

Debug decisions: `__yta.settings.set("debug", true)` in the DevTools console,
then watch `[YTA]` messages (`skip (ad)`, `going back to …`).

## Settings (chrome.storage.sync)

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch for Feature 1 |
| `backInPlaylists` | `false` | Also go back at the end of playlist items |
| `skipIfFullscreen` | `false` | Do nothing while fullscreen |
| `debug` | `false` | Log decisions to `console.debug` |
| `hideEndScreen` | `true` | Feature 2: hide end-screen cards/recommendations overlay |
| `hideShorts` | `true` | Feature 3: hide Shorts shelves, tiles, and links |
| `hideHomeRecommendations` | `true` | Feature 4: hide homepage recommendation feed only |

## Adding more features later

1. Create `src/<feature-name>.js` using the same UMD wrapper as the others,
   exposing a factory: `createX({ nav, settings, doc, win })` returning
   `{ start(), stop() }`.
2. Register it in `src/main.js` inside `createEnhancer()`:
   `api.register("feature-name", …)` (or at runtime: `__yta.register(...)`).
3. Add the file to `manifest.json` → `content_scripts[0].js` **before** `main.js`.
4. Add `tests/<feature-name>.test.js` and reuse `tests/helpers.js`.

Every feature gets the same navigation tracker (`nav`), settings store, and
lifecycle — no duplicated SPA plumbing.

## Desktop, laptop, and Android

Desktop and laptop Brave use `https://www.youtube.com/`. Android YouTube may
use `https://m.youtube.com/`; both hosts are included in the extension and
userscript matches. This is **code-level mobile-web compatibility**, not proof
of installation or live testing on an Android device.

Brave Android stable does not provide the normal extension installation path
used on desktop. If the phone browser cannot install a userscript manager,
these features cannot run there yet. The Android selectors are best-effort and
may need updates as YouTube changes its mobile DOM. The end-of-video feature
also depends on the mobile player exposing a video element within one of the
supported player containers.

## License

MIT
