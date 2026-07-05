# Architecture

## Static-first design

Sakha Study Buddy is structured so the first page is useful before heavy features load. The landing page loads a lightweight concept index, lets the learner pick a topic, and only then fetches the full concept pack.

## Runtime flow

```text
index.html
  -> config.js
  -> dist/main.js
  -> content/concept-index-lite.json
  -> content/concepts/<concept-id>.json after selection
  -> Sakha proxy Worker for online AI chat
```

## Lazy-loaded features

- `src/galaxy.js`: imported only when the student clicks `Explore universe`.
- `src/p2p.js`: imported only when the student clicks `Share Session`.
- WebLLM and Transformers: imported only when `Offline AI` is enabled.
- Mermaid is loaded from `lib/mermaid.min.js` only when a Mermaid component is rendered.

## Progress storage

Progress is local-only:

- Key: `sakha_progress_v1`.
- Storage: browser `localStorage`.
- Data: recent topic status, confidence, first prediction, teach-back text, and next review time.

No local progress is sent to a backend by this static app.

## Service worker

`sw.js` caches the app shell, static content index, selected assets, and generated bundles. It bypasses AI/model/API hosts so chat requests and model downloads are not trapped in the static cache.

## Proxy boundary

The static app calls the Cloudflare Worker configured in `config.js`. The Worker owns API key secrecy, request validation, CORS, upstream timeout handling, and model allowlisting. The static app should not contain secrets.
