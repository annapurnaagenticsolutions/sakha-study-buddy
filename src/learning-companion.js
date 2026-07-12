const LEARNING_SIGNAL_KEY = 'sakha_learning_signal_v1';
const SHOWCASE_TOPIC_IDS = new Set([
    'boiling-water',
    'magnets-at-home',
    'clothes-drying-sun-wind',
    'ohms_law'
]);

function getLearningShowcase(concept) {
    const fromContent = concept?.learning_showcase || {};
    const firstMisconception = concept?.misconceptions?.[0];
    const firstConfusion = concept?.whiteboard?.common_confusions?.[0];
    const subjectText = Object.entries(concept?.subject_lenses || {})
        .slice(0, 2)
        .map(([subject, explanation]) => subject + ': ' + explanation)
        .join(' ');

    return {
        tryFirst: fromContent.try_first || 'Make a quick guess before the explanation. A rough answer shows where to begin.',
        simpleIdea: fromContent.simple_idea || concept?.big_idea || 'Start from the everyday observation.',
        formalIdea: fromContent.formal_idea || subjectText || concept?.whiteboard?.formula_reading || '',
        commonTrap: fromContent.common_trap || firstConfusion?.confusion || firstMisconception?.belief || '',
        trapFix: fromContent.trap_fix || firstConfusion?.fix || firstMisconception?.repair || '',
        memoryAnchor: fromContent.memory_anchor || concept?.story || '',
        friendNudge: fromContent.friend_nudge || 'If anything feels unclear, say the exact word or step. Sakha will slow down there.',
        teachBackGoal: fromContent.teach_back_goal || concept?.teach_back_prompt || 'Explain the idea in your own words.',
        reviewPlan: Array.isArray(fromContent.review_plan) && fromContent.review_plan.length
            ? fromContent.review_plan
            : ['Today: explain it once', 'Tomorrow: recall the main chain', 'In 3 days: try one new example']
    };
}

function loadLearningSignal(conceptId) {
    try {
        const all = JSON.parse(localStorage.getItem(LEARNING_SIGNAL_KEY) || '{}') || {};
        return all[conceptId] || {};
    } catch (_) {
        return {};
    }
}

export function saveLearningSignal(conceptId, patch) {
    if (!conceptId) return;
    try {
        const all = JSON.parse(localStorage.getItem(LEARNING_SIGNAL_KEY) || '{}') || {};
        all[conceptId] = {
            ...(all[conceptId] || {}),
            ...patch,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(LEARNING_SIGNAL_KEY, JSON.stringify(all));
    } catch (_) {
        // Local learning signals are helpful, not required for the lesson.
    }
}

function appendVisualizerPrompt(concept, container, onScroll) {
    if (!concept?.visualizer?.id || concept._vizo) return false;
    concept._vizo = concept._viz = 1;
    const prompt = document.createElement('div');
    prompt.className = 'message bot';
    prompt.textContent = 'Want to visualize it? Say yes.';
    container.appendChild(prompt);
    if (onScroll) onScroll();
    return true;
}
export function appendLearningCompanionCard({ concept, phase = 'start', container, onScroll }) {
    if (!concept || !container) return;
    if (!SHOWCASE_TOPIC_IDS.has(concept.id || concept.concept_id)) {
        if (phase === 'clear') appendVisualizerPrompt(concept, container, onScroll);
        return;
    }
    const showcase = getLearningShowcase(concept);
    const conceptId = concept.id || concept.concept_id;
    const signal = loadLearningSignal(conceptId);
    if (phase !== 'start' && signal.lastCompanionPhase === phase) return;

    const card = document.createElement('section');
    card.className = 'learning-companion-card';
    card.setAttribute('aria-label', 'Learning support');

    const heading = document.createElement('h2');
    heading.textContent = phase === 'clear'
        ? 'Make it stick'
        : phase === 'confused'
            ? 'Let us slow down'
            : 'Start with your thinking';

    const lead = document.createElement('p');
    if (phase === 'clear') {
        lead.textContent = showcase.memoryAnchor || 'Good. Now connect the idea to one real example so it stays in memory.';
    } else if (phase === 'confused') {
        lead.textContent = 'No issue. We will use one small step, one example, and the whiteboard. Tell me the word or step that feels heavy.';
    } else {
        lead.textContent = showcase.tryFirst;
    }

    const list = document.createElement('div');
    list.className = 'learning-companion-grid';

    const items = [];
    if (phase === 'start') {
        items.push(['Simple idea', showcase.simpleIdea]);
        if (showcase.commonTrap) items.push(['Watch for', showcase.commonTrap]);
        items.push(['How to answer', showcase.friendNudge]);
    } else if (phase === 'clear') {
        if (showcase.formalIdea) items.push(['School language', showcase.formalIdea]);
        items.push(['Teach-back target', showcase.teachBackGoal]);
        items.push(['Next recall', showcase.reviewPlan[0] || 'Explain it once today']);
    } else {
        if (showcase.trapFix) items.push(['Repair hint', showcase.trapFix]);
        items.push(['Next move', 'Look at the first two whiteboard steps, then reply clear or confusing.']);
        items.push(['Your pace', signal.confidence ? 'Earlier confidence: ' + signal.confidence : 'No pressure. We can rebuild from basics.']);
    }

    items.forEach(([labelText, bodyText]) => {
        const item = document.createElement('div');
        item.className = 'learning-companion-item';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const body = document.createElement('span');
        body.textContent = bodyText;
        item.append(label, body);
        list.appendChild(item);
    });

    card.append(heading, lead, list);
    container.appendChild(card);
    saveLearningSignal(conceptId, { lastCompanionPhase: phase });
    appendVisualizerPrompt(concept, container, onScroll);
    if (onScroll) onScroll();
}

export function captureLearningSignal(concept, text) {
    if (!concept?.id) return 'neutral';
    const normalized = String(text || '').toLowerCase();
    if (concept._viz && /\b(yes|ok)\b|visual|show/.test(normalized)) {
        concept._viz = 0;
        return 'visualize';
    }
    const saysConfused = /not clear|confus|doubt|samajh nahi|\bno\b|\bnahi\b|stuck|slow/.test(normalized);
    const saysClear = /clear|understand|samajh|got it|\byes\b|\bhaan\b|\bok\b/.test(normalized) && !saysConfused;
    const asksExample = /example|try|practice|draw|diagram|whiteboard|formula|step/.test(normalized);

    saveLearningSignal(concept.id, {
        lastInputType: saysConfused ? 'confused' : saysClear ? 'clear' : asksExample ? 'example_or_step' : 'answer',
        lastMessageAt: new Date().toISOString()
    });

    if (saysConfused) return 'confused';
    if (saysClear) return 'clear';
    if (asksExample) return 'example_or_step';
    return 'neutral';
}

export class StateTutor {
    constructor() {
        this.currentStateId = 'START';
    }

    reset() {
        this.currentStateId = 'START';
    }

    processMessage(concept, userMessage, language = 'Hinglish') {
        if (!concept || !concept.conversationStates) return null;
        
        const text = (userMessage || '').trim().toLowerCase();
        let stateObj = concept.conversationStates[this.currentStateId] || concept.conversationStates['START'];
        if (!stateObj) return null;

        let responseCategory = 'UNMATCHED';
        let matchedNextStateId = null;

        if (stateObj.misconceptions) {
            for (const m of stateObj.misconceptions) {
                if (m.patterns && m.patterns.some(p => text.includes(p.toLowerCase()))) {
                    responseCategory = 'MISCONCEPTION';
                    matchedNextStateId = m.repairState;
                    break;
                }
            }
        }

        if (responseCategory === 'UNMATCHED' && stateObj.expectedIdeas) {
            if (stateObj.expectedIdeas.some(p => text.includes(p.toLowerCase()))) {
                responseCategory = 'CORRECT';
                matchedNextStateId = stateObj.nextStates?.correct;
            }
        }

        if (responseCategory === 'UNMATCHED' && stateObj.partialIdeas) {
            if (stateObj.partialIdeas.some(p => text.includes(p.toLowerCase()))) {
                responseCategory = 'PARTIAL';
                matchedNextStateId = stateObj.nextStates?.partial;
            }
        }

        if (responseCategory === 'UNMATCHED' && stateObj.uncertaintyPatterns) {
            if (stateObj.uncertaintyPatterns.some(p => text.includes(p.toLowerCase()))) {
                responseCategory = 'UNCERTAIN';
                matchedNextStateId = stateObj.nextStates?.uncertain;
            }
        }

        if (responseCategory === 'UNMATCHED') {
            if (/not clear|confus|samajh nahi|doubt|\bno\b|\bnahi\b|kya matlab/.test(text)) {
                responseCategory = 'UNCERTAIN';
                matchedNextStateId = stateObj.nextStates?.uncertain;
            } else if (/clear|samajh|understand|\byes\b|\bhaan\b|\bok\b|got it|sahi/.test(text)) {
                responseCategory = 'PARTIAL';
                matchedNextStateId = stateObj.nextStates?.partial || stateObj.nextStates?.correct;
            } else if (text.length > 15) {
                responseCategory = 'PARTIAL';
                matchedNextStateId = stateObj.nextStates?.partial;
            } else {
                responseCategory = 'UNCERTAIN';
                matchedNextStateId = stateObj.nextStates?.uncertain;
            }
        }

        if (!matchedNextStateId) {
            matchedNextStateId = stateObj.nextStates?.default || Object.values(stateObj.nextStates || {})[0] || this.currentStateId;
        }

        this.currentStateId = matchedNextStateId;
        const nextStateObj = concept.conversationStates[this.currentStateId];
        
        if (!nextStateObj || !nextStateObj.onEnter) {
            return {
                message: "Let's keep going.",
                render_component: 'none',
                component_props: {},
                session_complete: false
            };
        }

        const onEnter = nextStateObj.onEnter;

        return {
            message: onEnter.message || "...",
            render_component: onEnter.render_component || 'none',
            component_props: onEnter.component_props || {
                whiteboardAction: onEnter.whiteboardAction,
                visualAction: onEnter.visualAction
            },
            session_complete: !!onEnter.session_complete,
            state: this.currentStateId,
            response_category: responseCategory
        };
    }
}