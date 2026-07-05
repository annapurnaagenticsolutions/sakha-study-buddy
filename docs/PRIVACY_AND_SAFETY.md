# Privacy and Safety Notes

This document describes the current product posture. It is not legal certification.

## Current static posture

- No account is required.
- Students are asked for a nickname, not a full name.
- Progress is stored on the same device in browser `localStorage`.
- No camera upload is shipped in the public static UI.
- No ads or behavioral analytics should be added to the student flow.
- Voice input is optional and user initiated.

## Data that may leave the browser

When online AI is used, chat text required for the answer is sent to the configured proxy Worker. Students should not enter private personal details in chat.

Local progress, selected topic, and nickname stay in the browser unless future features explicitly change this with consent and documentation.

## Safety rules for future work

- Do not add camera/image uploads without clear consent, true multimodal support, and cost/abuse controls.
- Do not add tracking pixels or behavioral analytics to the student flow.
- Do not claim COPPA, FERPA, GDPR, or school compliance without legal review.
- Add a deletion/export path before any server-side student profile exists.
- Keep AI prompts focused on learning support, not high-stakes advice.

## Parent/teacher messaging

Use plain language:

- Sakha is a study helper, not a replacement for teachers or parents.
- It asks questions and encourages teach-back.
- Students should avoid sharing private details.
- Current progress is stored only on the device.
