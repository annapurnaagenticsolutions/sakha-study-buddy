# Troubleshooting

## The page loads but chat fails

Check `config.js` and confirm `proxyUrl` points to the deployed Worker. Then check the Worker has `GROQ_API_KEY` configured.

## Local development gets CORS errors

The Worker allows the GitHub Pages origin by default. For local testing, configure the Worker with an explicit `ALLOWED_ORIGINS` value such as:

```toml
[vars]
ALLOWED_ORIGINS = "http://localhost:8080,http://127.0.0.1:8080"
```

## The old site keeps appearing

The service worker may have cached the shell. Hard refresh, unregister the service worker in DevTools, or bump cache/version strings when shipping new assets.

## Build fails after editing app code

Run:

```bash
npm install
npm run check
```

If `dist/main.js` exceeds 40 KB, move optional code behind dynamic imports.

## Offline AI is slow

That is expected. Offline AI downloads heavy model/runtime files and should remain opt-in. The public static app should not ship model files in Git.

## A topic does not appear

Check that the concept exists under `content/concepts/` and that `content/concept-index-lite.json` contains a matching `id`.
