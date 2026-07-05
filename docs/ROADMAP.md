# Roadmap

## Done

- Static-first guided topic chooser.
- Lightweight concept index.
- Optional 3D universe.
- Optional P2P sharing.
- Optional offline AI.
- Local-only progress and revision cards.
- Prediction/confidence prompt.
- Privacy page.
- Static CSP and no Google Fonts.
- Bundle-size guard.

## Next static improvements

1. Add language mode: Hinglish, English, Hindi-first.
2. Add low-bandwidth mode that hides voice, 3D, P2P, and offline AI controls until selected.
3. Generate static concept detail pages from concept JSON.
4. Add practice mode after teach-back: three short questions from the concept pack.
5. Add local progress reset/export controls on the privacy page.
6. Add keyboard-only QA and color-contrast QA.
7. Add a script to regenerate `content/concept-index-lite.json` from concept packs.
8. Add schema validation for concept JSON files.

## Later backend improvements

These belong in the Worker or a future backend, not in the static app:

- Rate limiting and quotas.
- Abuse monitoring.
- Turnstile or challenge flow if abuse appears.
- Server-side moderation logs with privacy review.
- Parent/teacher dashboards.
- Consent, deletion, and export workflows.
