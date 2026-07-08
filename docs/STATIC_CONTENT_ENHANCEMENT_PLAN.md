# Static Content Enhancement Plan

Scope: GitHub Pages static deployment first. No account system, backend analytics, or required API dependency.

## Current priority

Make Sakha feel like a useful tutor even when no API key is used. The highest-value work is not more UI; it is better staged explanations, stronger whiteboards, and predictable local learning flow.

## Phase 1: Teaching quality and whiteboard flow

- Keep the right-side whiteboard expandable and closeable.
- Show only the current slice: basics first, then symbols/process, then worked example only when requested or late in the flow.
- For formula/process topics, pause after 1-2 steps and ask the student whether the step is clear.
- For non-formula topics, use the whiteboard for cause-process-result chains, comparison tables, symbols/terms, and worked examples.
- Enrich the top tested topics first, then expand by subject and class band.

## Phase 2: Static tutor simulation

- Use static concept JSON for most topics.
- Route common replies locally: clear, confused, repeat, example, formula/process, teach-back.
- Use the remote API only for allowlisted advanced/open-ended topics.
- Keep language consistent with the selected mode. English mode should not unexpectedly switch to Hinglish.

## Phase 3: Lightweight engagement

- Show topic difficulty and curiosity on topic cards.
- Save a local-only curiosity rating after completion.
- Add a local continue card for unfinished topics.
- Keep progress and ratings on the device only.
- Defer heavier features such as full constellations, weekly challenges, and simulated peer feeds until student feedback confirms they are useful.

## Phase 4: Performance and deployment discipline

- Keep `dist/main.js` under the current 40 KB guard.
- Lazy-load optional features and keep topic JSON loaded only after selection.
- Run build, size check, and content quality check before publishing.
- Keep the publish repo synchronized from the built source repo.

## Content quality bar

A feedback-ready topic should include:

- A real-life hook question.
- One beginner-friendly big idea.
- Whiteboard basics for students who do not know the vocabulary.
- A process/formula line when applicable.
- Symbol or term meanings.
- At least 4 small steps.
- A pause checkpoint after step 1 or 2.
- One worked example.
- Common confusions with fixes.
- A teach-back prompt.

## Defer for now

- Full badge collection and constellation UI.
- Real peer or classroom flows.
- Backend telemetry and dashboards.
- Any camera or image-understanding claim.
- Compliance claims beyond current privacy-safe static behavior.