# Sakha Static Page Improvement Notes

Scope: static GitHub Pages experience only. Backend, Worker quotas, user accounts, and server-side analytics are parked for a later phase.

## Implemented in this static pass

- Start with a guided chooser instead of the 3D universe. The first screen now lets a student pick level, subject, and topic without loading Three.js.
- Load a lightweight concept index first: `content/concept-index-lite.json`. Full concept JSON loads only after a topic is selected.
- Keep the 3D universe as optional exploration. It loads only after the student clicks `Explore universe`.
- Keep collaboration optional. P2P code loads only when the share-session control is used.
- Removed camera/image-understanding pitch from the static flow. There is no camera upload in this static phase.
- Added parent, teacher, and privacy/safety copy directly to the first page.
- Kept nickname-only onboarding and warns students not to enter a full name.
- Updated service-worker cache to include the lightweight index and current generated assets.

## Student experience improvements to build next

1. Add a two-minute diagnostic at topic start: one prediction, one misconception probe, one confidence check.
2. Add a visible learning path inside each topic: hook, observe, predict, explain, practice, teach-back.
3. Add local-only mastery state in `localStorage`: not started, practicing, teach-back done, revisit later.
4. Add spaced revision cards on the landing page using only local progress, no account required.
5. Add teacher-reviewable concept pages for each static topic: big idea, misconceptions, examples, practice prompts.
6. Add a low-bandwidth mode toggle that hides voice, 3D, and rich components until selected.
7. Add language mode control: Hinglish, English, Hindi-first. Persist locally.
8. Add accessibility pass: skip link, stronger color checks, reduced-motion support, and keyboard-only checks.

## Static loading and efficiency plan

- Keep `dist/main.js` small and interaction-first. Anything large must be behind dynamic import.
- Keep Three.js, Mermaid, WebLLM, Transformers, and PeerJS out of the initial route.
- Use the lite concept index for the landing page; fetch `content/concepts/<id>.json` only after selection.
- Keep service-worker navigation network-first so GitHub Pages updates are not stuck behind an old shell.
- Add content hashes or version query strings when changing `dist`, `style.css`, or `sw.js`.
- Avoid production source maps on GitHub Pages unless debugging a release.
- Consider replacing Google Fonts with local subset fonts or system fonts if Lighthouse still flags font latency.

## Static safety, privacy, and compliance checklist

- No full name requirement; nickname only.
- No camera feature unless the app actually sends images to a vetted multimodal model with clear consent.
- No ads, tracking pixels, or third-party behavioral analytics in the student flow.
- Voice input must remain user-initiated and clearly optional.
- Make privacy copy visible from the first screen and add a separate static privacy page before broader public use.
- Keep all progress local until there is a consented account model and deletion path.
- Do not claim school compliance or child-privacy compliance as complete until legal review is done.

## Later backend/security items, not for static-only phase

- Worker-side rate limiting, quotas, and abuse protection.
- Turnstile or lightweight challenge only when abuse appears; avoid adding friction before it is needed.
- Server-side moderation and prompt-injection logging.
- Parent/teacher dashboards with explicit consent and deletion workflows.
- Real usage telemetry with privacy review, sampling, and opt-out.

## Acceptance checks for the static page

- Initial page is usable before the galaxy or offline AI loads.
- Selecting a topic fetches only that concept pack before chat starts.
- `Explore universe` loads the 3D chunk only after click.
- `Share Session` loads P2P only after click.
- Camera/image wording is absent until true multimodal support exists.
- Mobile layout scrolls without overlapping controls.
- Build output contains no `models/` or `node_modules/` payload.

## Implemented in static pass 2

- Added local-only progress tracking in browser local storage with recent topics and revision due cards.
- Added a landing-page `Continue or revise` shelf so students can resume without an account.
- Added an in-session learning path: Hook, Predict, Discuss, Practice, Teach back.
- Added a prediction and confidence prompt before the first AI answer, so the tutor can start from the student's mental model.
- Added a 40 KB `dist/main.js` build-size guard through `scripts/check-bundle-size.js`.
- Kept all progress static and device-local; no backend, accounts, or tracking were added.

## Implemented in static pass 3

- Removed Google Fonts from the first page to reduce third-party requests and improve privacy posture.
- Moved runtime configuration into `config.js` so the HTML no longer needs an inline configuration script.
- Added a static Content Security Policy meta tag for the static pages.
- Moved nickname modal inline styles into `style.css`.
- Added a skip link and reduced-motion CSS support.
- Fixed chat input semantics by removing the incorrect search role.
- Reordered the session start so Sakha's first question appears before the prediction card.
- Left Cloudflare Worker code unchanged; read-only review notes remain backend follow-up items.

## Implemented in static pass 4

- Added a rich `Whiteboard` component for formula, symbols, basic ideas, worked examples, checkpoints, and common confusions.
- Enriched `boiling-water.json` with a beginner-friendly heat formula board: `Q = m x c x delta T`, particle explanation, boiling-point steps, latent heat, bubbles, and steam safety.
- Added a deterministic fallback tutor so most topics can run without Groq/API calls.
- Added an API allowlist in `config.js`; only selected advanced/open-ended topics use the remote API by default.
- Added a whiteboard launch card inside each session. After 1-2 formula steps, the board asks the learner to confirm whether the idea is clear.
- Kept offline/local progress and static concept packs as the default learning path.

## Implemented in static pass 5

- Wired the Language chooser so it no longer renders as an empty control.
- Added a visible topic mode card: guided no-API topics vs AI-assisted allowlisted topics.
- Bumped static asset versions and service-worker cache name to force a clean deployment refresh after whiteboard changes.
- Added a rich no-API whiteboard for `ice-melting.json`, including heat direction, particles, melting point, and common confusions.
- Kept the first-load bundle under the 40 KB guard.

## Implemented in static pass 8

- Every loaded concept now normalizes to the rich whiteboard format, even if the source JSON only has old whiteboard lines.
- The whiteboard derives formula/process lines from equations, cause-process-result fields, and flow arrays.
- Legacy formulas such as fractions, Ohm's Law, and weight/mass are cleaned into student-friendly relationship lines.
- The board now consistently includes basics, symbol meanings, step flow, a pause checkpoint after early steps, a worked example where available, and common confusions.
- Sakha's guided fallback now explicitly points students to the right-side board for formula/process, symbols, and step explanation.

## Audit pass after progressive whiteboard

- Removed the visible no-API mode card from the chat because it exposed implementation detail to students.
- Changed the session header to match the landing brand: Sakha Study Buddy.
- Moved whiteboard intro/open controls into the right-side whiteboard panel only.
- Made whiteboard reveal progressive: intro first, then limited basics/formula/symbols/steps, with deeper slices on formula/process requests.
- Fixed English mode startup copy and carried the selected language into guided fallback responses.
- Reduced bundle size from the one-byte guard edge to a safer margin and removed stale generated chunk files from the publish dist.
- Remaining optional polish: replace browser prompt/alert flows for peer sharing and downloaded progress cards with in-app modals.


## Implemented in static pass 9

- Added `docs/STATIC_CONTENT_ENHANCEMENT_PLAN.md` as the static-first roadmap derived from the Kiro specs.
- Added `scripts/check-content-quality.js` and `npm run content-check` to validate concept JSON, lite-index references, difficulty/curiosity ranges, and whiteboard readiness warnings.
- Added topic-card difficulty and curiosity labels from the lightweight concept index.
- Added local-only unfinished-session state so the landing page can offer a `Continue previous topic` card.
- Added local-only curiosity rating buttons to the completion modal.
- Improved guided fallback behavior so the right-side whiteboard progresses from basics to steps to full examples only as the conversation requires.
- Enriched `magnets-at-home.json` and `clothes-drying-sun-wind.json` with structured beginner-friendly whiteboards, checkpoints, examples, and common confusions.

## Next static content work

1. Use `npm run content-check` to identify weaker topic packs.
2. Enrich the next 10 most likely feedback topics before broader student testing.
3. Keep any new engagement UI behind the 40 KB main-bundle guard.
4. After feedback, decide whether heavier Kiro engagement features are worth adding.