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

export function appendLearningCompanionCard({ concept, phase = 'start', container, onScroll }) {
    if (!concept || !container || !SHOWCASE_TOPIC_IDS.has(concept.id || concept.concept_id)) return;
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
    if (onScroll) onScroll();
}

export function captureLearningSignal(concept, text) {
    if (!concept?.id) return 'neutral';
    const normalized = String(text || '').toLowerCase();
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