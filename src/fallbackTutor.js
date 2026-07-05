export const DEFAULT_API_CONCEPT_IDS = [
    'biomedical-monitoring',
    'drone-flight-controller',
    'earthquake-alert-system',
    'smart-traffic-signal',
    'solar-microgrid',
    'water-treatment-network'
];

export class FallbackTutor {
    constructor() {
        this.turn = 0;
    }

    reset() {
        this.turn = 0;
    }

    createResponse(concept, userMessage, apiFailed = false) {
        this.turn += 1;
        const text = userMessage.toLowerCase();
        const whiteboard = normalizeWhiteboard(concept.whiteboard, concept);
        const misconception = findMisconception(concept, text);
        const asksWhiteboard = /formula|equation|whiteboard|step|derive|symbol|meaning|deep|detail|samjhao|explain/.test(text);
        const saysClear = /clear|samajh|understand|yes|haan|ok|got it/.test(text);
        const saysNotClear = /not clear|confus|samajh nahi|doubt|no|nahi/.test(text);
        const likelyTeachBack = isLikelyTeachBack(userMessage, concept);

        if (likelyTeachBack && this.turn >= 3) {
            return jsonReply(
                'Nice. Tumne cause aur result connect kar diya. Ek last polish: apne answer mein heat/energy, particles, aur state change teenon words jod do, toh explanation aur strong ho jayegi.',
                'none',
                {},
                true
            );
        }

        if (asksWhiteboard) {
            return jsonReply(
                'Chalo whiteboard pe todte hain. Pehle symbols ka matlab, phir 1-2 steps. Uske baad tum mujhe bolna: clear hai ya doubt hai?',
                'Whiteboard',
                { whiteboard, title: concept.title },
                false
            );
        }

        if (saysNotClear) {
            return jsonReply(
                makeNotClearReply(concept, whiteboard),
                'Whiteboard',
                { whiteboard, title: concept.title, focus: 'basics' },
                false
            );
        }

        if (saysClear && this.turn > 1) {
            return jsonReply(
                'Good. Ab next small step: ' + getNextQuestion(concept, this.turn) + ' Short answer chalega, bas apne words mein.',
                'none',
                {},
                false
            );
        }

        if (misconception) {
            return jsonReply(
                'Good thought, but yahan ek common trap hai: "' + misconception.belief + '". Socho: ' + (misconception.probe || 'is observation ke peeche actual cause kya hai?') + ' Hint: ' + (misconception.repair || concept.big_idea || 'cause-process-result chain follow karo.'),
                'none',
                {},
                false
            );
        }

        if (apiFailed) {
            return jsonReply(
                'Online AI abhi available nahi hai, but guided mode se continue karte hain. ' + getFallbackTeachingMove(concept, whiteboard, this.turn),
                'none',
                {},
                false
            );
        }

        return jsonReply(
            getFallbackTeachingMove(concept, whiteboard, this.turn),
            this.turn === 1 ? 'Whiteboard' : 'none',
            this.turn === 1 ? { whiteboard, title: concept.title } : {},
            false
        );
    }
}

export function createGenericWhiteboard(concept) {
    const flow = Array.isArray(concept.flow) ? concept.flow : [];
    return {
        title: concept.title || 'Concept whiteboard',
        goal: concept.big_idea || 'Understand the idea step by step.',
        basics: [
            'Start from what you can observe.',
            'Find the cause that starts the change.',
            'Explain the process in small steps.',
            'End with the result in your own words.'
        ],
        formula: '',
        formula_reading: '',
        symbols: [],
        steps: flow.length ? flow.map((item, index) => ({ label: 'Step ' + (index + 1), detail: item })) : [
            { label: 'Observe', detail: concept.intro_hook || 'What do you notice?' },
            { label: 'Reason', detail: concept.big_idea || 'What cause explains it?' },
            { label: 'Teach back', detail: 'Explain it simply to a younger student.' }
        ],
        check_after_step: 2,
        feedback_prompt: 'Are these first steps clear? If not, say which word is confusing.',
        worked_example: concept.story || '',
        common_confusions: (concept.misconceptions || []).slice(0, 2).map((item) => ({
            confusion: item.belief,
            fix: item.repair || item.probe || ''
        }))
    };
}

export function normalizeWhiteboard(whiteboard, concept = {}) {
    if (whiteboard && !Array.isArray(whiteboard) && typeof whiteboard === 'object') {
        return whiteboard;
    }

    const legacyLines = Array.isArray(whiteboard) ? whiteboard : [];
    return {
        title: concept.title || 'Concept whiteboard',
        goal: concept.big_idea || 'Understand the idea step by step.',
        basics: legacyLines.length ? legacyLines : [concept.intro_hook || 'Start with the observation.'],
        formula: '',
        formula_reading: '',
        symbols: [],
        steps: legacyLines.map((line, index) => ({ label: 'Step ' + (index + 1), detail: line })),
        check_after_step: 2,
        feedback_prompt: 'Are these first steps clear? If not, say which word is confusing.',
        worked_example: concept.story || '',
        common_confusions: []
    };
}

function jsonReply(message, component, props, sessionComplete) {
    return {
        message,
        render_component: component,
        component_props: props,
        session_complete: sessionComplete
    };
}

function findMisconception(concept, text) {
    return (concept.misconceptions || []).find((item) => {
        const triggers = item.trigger_words || [];
        return triggers.some((word) => text.includes(String(word).toLowerCase()));
    });
}

function isLikelyTeachBack(message, concept) {
    const text = message.toLowerCase();
    const coreWords = [concept.title, 'because', 'heat', 'energy', 'particle', 'change', 'cause', 'result', 'steam', 'water']
        .filter(Boolean)
        .map((word) => String(word).toLowerCase());
    const matches = coreWords.filter((word) => text.includes(word)).length;
    return message.length > 60 && matches >= 2;
}

function getNextQuestion(concept, turn) {
    const questions = concept.question_flow || [];
    const index = Math.min(Math.max(turn - 1, 0), questions.length - 1);
    return questions[index]?.q || concept.teach_back_prompt || 'ab is idea ko ek simple example se explain karo.';
}

function makeNotClearReply(concept, whiteboard) {
    const firstBasic = whiteboard.basics?.[0] || concept.intro_hook || 'observation se start karte hain.';
    const firstStep = whiteboard.steps?.[0]?.detail || concept.big_idea || 'cause-process-result chain dekho.';
    return 'No problem. Bilkul basic se: ' + firstBasic + ' Pehla step sirf yeh hai: ' + firstStep + ' Ab bolo, confusion word mein hai, formula mein hai, ya example mein?';
}

function getFallbackTeachingMove(concept, whiteboard, turn) {
    const steps = whiteboard.steps || [];
    if (turn === 1) {
        return 'Main guided mode mein hoon, API ke bina bhi concept pack se padha sakta hoon. Pehle whiteboard dekho: symbols/steps ka matlab samjho. First 1-2 steps ke baad mujhe batao: clear hai ya doubt?';
    }
    if (turn === 2) {
        const step = steps[0]?.detail || concept.big_idea || 'cause identify karo.';
        return 'Step 1: ' + step + ' Iska simple meaning apne words mein likho. Agar clear hai toh "clear" bolo, warna doubt batao.';
    }
    if (turn === 3) {
        const step = steps[1]?.detail || getNextQuestion(concept, turn);
        return 'Step 2: ' + step + ' Ab compare karo: pehle kya tha, baad mein kya badla?';
    }
    return getNextQuestion(concept, turn) + ' Jab tum ready ho, teach-back mode mein 2-3 lines mein explain karo.';
}
