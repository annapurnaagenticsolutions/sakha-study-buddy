# Sakha Study Buddy

Sakha Study Buddy is a static GitHub Pages learning app for guided concept learning. It uses static concept packs, a lightweight topic chooser, optional voice, optional 3D exploration, and an AI proxy Worker for online tutoring.

Live site: https://annapurnaagenticsolutions.github.io/sakha-study-buddy/

## What this repo contains

- Static app shell for GitHub Pages.
- Concept-pack content under `content/`.
- Lightweight first-load index: `content/concept-index-lite.json`.
- Bundled frontend assets under `dist/`.
- Optional static libraries under `lib/`.
- Documentation under `docs/`.

The app is intentionally static-first. There are no accounts, databases, dashboards, or server-side progress storage in this repo.

## Student flow

1. Choose level, subject, and topic.
2. Start a guided session.
3. Answer a quick prediction/confidence prompt.
4. Chat with Sakha using a question-led flow.
5. Complete the teach-back moment.
6. See local revision cards on the landing page.

Progress is stored only in the browser using `localStorage`.

## Performance model

The first page is designed to stay small and useful:

- `dist/main.js` is guarded by `scripts/check-bundle-size.js` and should stay under 40 KB.
- Concept detail JSON is loaded only after topic selection.
- Three.js galaxy loads only after `Explore universe`.
- PeerJS collaboration loads only after `Share Session`.
- WebLLM and Transformers load only after `Offline AI`.
- Google Fonts are not used; the app uses system fonts.

## Run locally

Install dependencies only in a working copy, not on GitHub Pages output hosts:

```bash
npm install
npm run build
python -m http.server 8080
```

Open http://localhost:8080.

For the online AI path, the configured Worker must allow your local origin through its `ALLOWED_ORIGINS` setting.

## Validate

```bash
npm run check
```

This rebuilds the app and runs the bundle-size guard.

## Deploy

1. Run `npm run check`.
2. Commit `index.html`, `style.css`, `config.js`, `manifest.json`, `sw.js`, `dist/`, `content/`, `lib/`, icons, and docs.
3. Do not commit `node_modules/` or `models/`.
4. Deploy or update the proxy Worker in `../sakha-proxy-worker`.
5. Confirm GitHub Pages serves from the repository root.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Important files

- [index.html](index.html): static app shell and landing page.
- [config.js](config.js): runtime frontend configuration.
- [src/app-static.js](src/app-static.js): source entry used by this GitHub Pages repo.
- [src/agent.js](src/agent.js): concept loading and AI message handling.
- [sw.js](sw.js): service worker cache strategy.
- [privacy.html](privacy.html): static privacy and safety page.
- [STATIC_PAGE_IMPROVEMENT_NOTES.md](STATIC_PAGE_IMPROVEMENT_NOTES.md): implementation notes and backlog.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Content authoring](docs/CONTENT_AUTHORING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Privacy and safety](docs/PRIVACY_AND_SAFETY.md)
- [Roadmap](docs/ROADMAP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Current boundaries

- No camera upload or image understanding in the public static UI.
- No server-side student profile.
- No ads or behavioral analytics.
- Offline AI is optional and heavy; it should stay opt-in.
- Formal compliance claims require legal review before public use.
