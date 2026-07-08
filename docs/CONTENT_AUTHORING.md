# Content Authoring Guide

Sakha topics are content packs. A new topic should normally be added by creating one JSON file and updating the lightweight index.

## Add a concept

1. Add a file under `content/concepts/<concept-id>.json`.
2. Add or regenerate the entry in `content/concept-index-lite.json`.
3. Run `npm run check`.
4. Test topic selection and the first chat prompt locally.

## Recommended concept shape

```json
{
  "id": "boiling-water",
  "title": "Boiling Water",
  "class_band": [4, 5],
  "subjects": ["Physics", "Chemistry"],
  "place": "Kitchen",
  "intro_hook": "Why does water bubble when heated?",
  "big_idea": "Heating gives water molecules enough energy to become steam.",
  "indian_analogies": ["pressure cooker", "chai boiling"],
  "misconceptions": [
    {
      "belief": "Bubbles are air only.",
      "probe": "If bubbles were only air, why do they increase when water gets hotter?"
    }
  ],
  "question_flow": [
    { "q": "What do you notice before the bubbles appear?" },
    { "q": "Where do you think the bubbles come from?" }
  ],
  "practice_prompts": [
    "Explain why steam can burn skin."
  ],
  "teach_back_prompt": "Explain boiling to a younger student using a kitchen example."
}
```

## Lightweight index fields

`content/concept-index-lite.json` should stay small. Use only fields needed for the landing page:

- `id`
- `title`
- `subject`
- `subjects`
- `level`
- `class_band`
- `place`
- `unlocked`
- `hook`

Do not copy full question flows or long explanations into the lite index.

## Writing guidance

- Start from real-life context before formal terminology.
- Include one misconception probe per important idea.
- Prefer questions over explanations.
- Include a teach-back prompt for every topic.
- Keep language simple enough for the selected class band.
- Avoid medical, legal, or high-stakes advice in concept packs.

## Review checklist

- The topic title is student-readable.
- The hook is a question, not a lecture.
- Misconceptions are plausible and testable.
- The question flow leads toward teach-back.
- No private, identifying, or unsafe prompt is requested.


## Whiteboard authoring

Use `whiteboard` when a topic needs formula or deep step-by-step explanation. Write it for a learner who may not know the basic words yet.

Recommended fields:

```json
{
  "whiteboard": {
    "title": "Boiling Water Whiteboard",
    "goal": "Understand heat, particles, bubbles, and steam safety.",
    "basics": ["Heat is energy moving into water."],
    "formula": "Q = m x c x delta T",
    "formula_reading": "Heat needed = mass x heat per kg per degree x temperature change.",
    "symbols": [
      { "symbol": "Q", "means": "heat energy added", "example": "More Q means more stove energy." }
    ],
    "steps": [
      { "label": "Step 1", "detail": "Observe what changes first." }
    ],
    "check_after_step": 2,
    "feedback_prompt": "Are the first two steps clear?",
    "worked_example": "If 1 kg water warms by 10 C, Q = 1 x 4200 x 10.",
    "common_confusions": [
      { "confusion": "Bubbles are only air.", "fix": "Strong boiling bubbles are mostly water vapour." }
    ]
  }
}
```

The first two steps should be small enough that Sakha can pause and ask whether the formula is clear before continuing.

## Content quality command

Run this before publishing static content changes:

```bash
npm run content-check
```

The checker fails on invalid JSON, missing critical fields, broken lite-index references, or invalid difficulty/curiosity values. It reports whiteboard gaps as warnings so we can keep improving topic packs without blocking urgent deploys.

For student feedback topics, treat whiteboard warnings as high priority even when the command exits successfully.