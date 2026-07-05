# Deployment

## Static site

The site is deployed from the root of this GitHub Pages repository.

Before publishing:

```bash
npm run check
```

Commit these paths when changed:

- `index.html`
- `privacy.html`
- `config.js`
- `style.css`
- `manifest.json`
- `sw.js`
- `dist/`
- `content/`
- `lib/`
- `docs/`
- icons and favicons

Do not commit:

- `node_modules/`
- `models/`
- secrets
- local logs

## Build output

The public repo uses `src/app-static.js` as its source entry because this publish copy previously had a Windows file-permission issue around `src/app.js`.

The source mirror under `D:\vision_agentic\AI_native_Education\sakha-static-agent` uses `src/app.js`.

Keep both in sync when making application changes.

## Worker dependency

The static site expects the proxy URL in `config.js`:

```js
window.SAKHA_CONFIG = {
  proxyUrl: 'https://sakha-proxy.annapurnaagenticsolutions.workers.dev',
  appOrigin: 'https://annapurnaagenticsolutions.github.io'
};
```

The Worker repo should be deployed separately and must have `GROQ_API_KEY` configured as a Cloudflare secret.

## Post-deploy smoke test

1. Open the GitHub Pages URL in a private browser window.
2. Confirm the topic chooser appears without waiting for the galaxy.
3. Choose one topic and start a session.
4. Confirm nickname prompt appears if no nickname exists.
5. Send one message and confirm the Worker returns an AI response.
6. Open DevTools Network and confirm heavy chunks load only after their controls are used.
7. Confirm `privacy.html` loads.
