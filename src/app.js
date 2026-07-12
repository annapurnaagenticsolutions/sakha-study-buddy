import { SakhaAgent } from './agent.js';

const els = {
    landingShell: document.getElementById('landingShell'),
    languageChoices: document.getElementById('languageChoices'),
    levelChoices: document.getElementById('levelChoices'),
    subjectChoices: document.getElementById('subjectChoices'),
    topicGrid: document.getElementById('topicGrid'),
    selectedTopicSummary: document.getElementById('selectedTopicSummary'),
    progressList: document.getElementById('progressList'),
    startGuidedBtn: document.getElementById('startGuidedBtn'),
    exploreUniverseBtn: document.getElementById('exploreUniverseBtn'),
    nameModal: document.getElementById('nameModal'),
    studentName: document.getElementById('studentName'),
    startBtn: document.getElementById('startBtn'),
    whatsappBtn: document.getElementById('whatsappBtn'),
    appContainer: document.getElementById('appContainer'),
    galaxyOverlay: document.getElementById('galaxyOverlay'),
    galaxyContainer: document.getElementById('galaxyContainer'),
    galaxyFilters: document.getElementById('galaxyFilters'),
    resetBtn: document.getElementById('resetBtn'),
    chatContainer: document.getElementById('chatContainer'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    topicIndicator: document.getElementById('topicIndicator'),
    offlineToggle: document.getElementById('offlineToggle'),
    micBtn: document.getElementById('micBtn'),
    shareBtn: document.getElementById('shareBtn'),
    whiteboardBtn: document.getElementById('whiteboardBtn'),
    whiteboardPanel: document.getElementById('whiteboardPanel'),
    whiteboardContent: document.getElementById('whiteboardContent'),
    whiteboardCloseBtn: document.getElementById('whiteboardCloseBtn'),
    peerIdDisplay: document.getElementById('peerIdDisplay')
};

const LANGUAGES = ['Hinglish', 'English', 'Hindi-first'];
const COMPLETION_MIN_DELAY_MS = 5500;
const COMPLETION_MAX_DELAY_MS = 30000;
const LEVELS = ['Foundations', 'Middle School', 'Advanced'];
const SUBJECT_ORDER = ['Physics', 'Chemistry', 'Biology', 'Math', 'Life Skills', 'Engineering', 'Science', 'Geography'];
const DEFAULT_CONCEPT = 'ice-melting';
const PROGRESS_KEY = 'sakha_progress_v1';
const SESSION_STATE_KEY = 'sakha_session_state';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_DELAYS_MS = [ONE_DAY_MS, 3 * ONE_DAY_MS, 7 * ONE_DAY_MS];

let agent = null;
let voiceService = null;
let voicePromise = null;
let p2pService = null;
let p2pPromise = null;
let learningCompanionPromise = null;
let activeWhiteboard = null;
let activeWhiteboardTitle = '';
let whiteboardStage = 'intro';
let completionTimer = null;
let galaxyInstance = null;
let conceptIndex = [];
let selectedLanguage = LANGUAGES[0];
let selectedLevel = LEVELS[0];
let selectedSubject = 'Physics';
let selectedConcept = null;
let progressState = loadProgress();

window.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    initVoice();
    wireStaticEvents();
    loadConceptIndex();
});

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js')
        .catch((err) => console.error('Service Worker registration failed', err));
}

function initVoice() {}

async function ensureVoiceService() {
    if (voiceService) return voiceService;
    if (!voicePromise) {
        voicePromise = import('./voice.js').then(({ VoiceService }) => new VoiceService((text) => {
            els.userInput.value = text;
            els.micBtn.classList.remove('active');
            handleSend();
        }));
    }
    voiceService = await voicePromise;
    return voiceService;
}

function wireStaticEvents() {
    els.startGuidedBtn.addEventListener('click', () => {
        if (!selectedConcept) return;
        startConcept(selectedConcept.id);
    });

    els.exploreUniverseBtn.addEventListener('click', startGalaxyMode);
    els.resetBtn.addEventListener('click', showHome);
    els.whatsappBtn.addEventListener('click', shareOnWhatsApp);
    els.shareBtn.addEventListener('click', handlePeerShare);
if (els.whiteboardBtn) els.whiteboardBtn.addEventListener('click', toggleWhiteboardPanel);
    if (els.whiteboardCloseBtn) els.whiteboardCloseBtn.addEventListener('click', closeWhiteboardPanel);
    els.sendBtn.addEventListener('click', handleSend);

    els.userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    });

    els.micBtn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        startMic();
    });
    els.micBtn.addEventListener('pointerup', stopMic);
    els.micBtn.addEventListener('pointercancel', stopMic);
    els.micBtn.addEventListener('pointerleave', stopMic);

    els.offlineToggle.addEventListener('change', handleOfflineToggle);

    // Quick Win #2: Mobile sticky CTA
    if (window.innerWidth <= 768) {
        const mobileCTA = document.createElement('button');
        mobileCTA.className = 'mobile-cta';
        mobileCTA.innerHTML = 'Start Learning →';
        mobileCTA.onclick = () => {
            document.getElementById('studentStart').scrollIntoView({ behavior: 'smooth' });
            // Auto-click the start button if topic is selected
            if (selectedConcept && !els.startGuidedBtn.disabled) {
                setTimeout(() => els.startGuidedBtn.click(), 500);
            }
        };
        document.body.appendChild(mobileCTA);

        // Hide CTA when app is active
        const observer = new MutationObserver(() => {
            mobileCTA.style.display = document.body.classList.contains('app-active') ? 'none' : 'flex';
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
}

async function loadConceptIndex() {
    els.topicGrid.textContent = 'Loading topics...';
    try {
        const res = await fetch('content/concept-index-lite.json', { cache: 'force-cache' });
        if (!res.ok) throw new Error('Lite concept index unavailable');
        conceptIndex = await res.json();
    } catch (error) {
        console.warn(error);
        conceptIndex = await loadFallbackConceptIndex();
    }

    selectedLanguage = localStorage.getItem('sakha_language') || LANGUAGES[0];
    selectedLevel = localStorage.getItem('sakha_level') || LEVELS[0];
    selectedSubject = localStorage.getItem('sakha_subject') || getSubjectsForLevel(selectedLevel)[0] || 'Physics';
    selectedConcept = findDefaultConcept();
    renderLandingChoices();
    renderProgressShelf();
}

async function loadFallbackConceptIndex() {
    const res = await fetch('content/all_concepts.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error('No concept index available');
    const concepts = await res.json();
    return concepts.map((concept) => ({
        id: concept.id,
        title: concept.title,
        subject: concept.subject || 'Science',
        subjects: concept.subjects || [concept.subject || 'Science'],
        level: concept.level || 'Foundations',
        class_band: concept.class_band || [],
        place: concept.place || 'Everyday life',
        unlocked: concept.unlocked !== false,
        hook: concept.hook || concept.intro_hook || ''
    }));
}

function getSubjectsForLevel(level) {
    const subjects = new Set();
    conceptIndex
        .filter((concept) => concept.level === level)
        .forEach((concept) => {
            const list = concept.subjects?.length ? concept.subjects : [concept.subject];
            list.filter(Boolean).forEach((subject) => subjects.add(subject));
        });

    return [...subjects].sort((a, b) => {
        const ai = SUBJECT_ORDER.indexOf(a);
        const bi = SUBJECT_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

function getVisibleTopics() {
    return conceptIndex
        .filter((concept) => concept.level === selectedLevel)
        .filter((concept) => {
            const subjects = concept.subjects?.length ? concept.subjects : [concept.subject];
            return subjects.includes(selectedSubject);
        })
        .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || a.title.localeCompare(b.title));
}

function findDefaultConcept() {
    const lastConcept = localStorage.getItem('sakha_last_concept');
    const topics = getVisibleTopics();
    return topics.find((concept) => concept.id === lastConcept) || topics.find((concept) => concept.unlocked) || topics[0] || conceptIndex[0] || null;
}

function renderLandingChoices() {
    if (els.languageChoices) {
        renderChoiceRow(els.languageChoices, LANGUAGES, selectedLanguage, (language) => {
            selectedLanguage = language;
            localStorage.setItem('sakha_language', language);
            renderLandingChoices();
        });
    }

    renderChoiceRow(els.levelChoices, LEVELS, selectedLevel, (level) => {
        selectedLevel = level;
        localStorage.setItem('sakha_level', level);
        const subjects = getSubjectsForLevel(level);
        if (!subjects.includes(selectedSubject)) {
            selectedSubject = subjects[0] || 'Physics';
            localStorage.setItem('sakha_subject', selectedSubject);
        }
        selectedConcept = findDefaultConcept();
        renderLandingChoices();
        renderProgressShelf();
    });

    renderChoiceRow(els.subjectChoices, getSubjectsForLevel(selectedLevel), selectedSubject, (subject) => {
        selectedSubject = subject;
        localStorage.setItem('sakha_subject', subject);
        selectedConcept = findDefaultConcept();
        renderLandingChoices();
        renderProgressShelf();
    });

    renderTopicCards();
    renderSelectedTopic();
}

function renderChoiceRow(container, values, selectedValue, onSelect) {
    container.replaceChildren();
    values.forEach((value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'choice-pill';
        button.textContent = value;
        button.setAttribute('aria-pressed', String(value === selectedValue));
        if (value === selectedValue) button.classList.add('active');
        button.addEventListener('click', () => onSelect(value));
        container.appendChild(button);
    });
}

function renderTopicCards() {
    els.topicGrid.replaceChildren();
    const topics = getVisibleTopics().slice(0, 12);

    if (!topics.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No topics found for this combination yet.';
        els.topicGrid.appendChild(empty);
        return;
    }

    topics.forEach((topic) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'topic-card';
        if (selectedConcept?.id === topic.id) button.classList.add('active');
        button.setAttribute('aria-pressed', String(selectedConcept?.id === topic.id));

        const title = document.createElement('strong');
        title.textContent = topic.title;

        const meta = document.createElement('span');
        const classBand = formatClassBand(topic.class_band);
        meta.textContent = [topic.place, classBand].filter(Boolean).join(' | ');

        const metrics = document.createElement('span');
        metrics.className = 'topic-metrics';
        metrics.textContent = 'Difficulty ' + (topic.difficulty || 3) + '/5 | Curiosity ' + (topic.curiosity_score || 3) + '/5';

        const hook = document.createElement('small');
        hook.textContent = topic.hook || 'Start with a real-life question.';

        button.append(title, meta, metrics, hook);
        button.addEventListener('click', () => {
            selectedConcept = topic;
            localStorage.setItem('sakha_last_concept', topic.id);
            renderTopicCards();
            renderSelectedTopic();
            renderProgressShelf();
        });
        els.topicGrid.appendChild(button);
    });
}

function formatClassBand(classBand) {
    if (!Array.isArray(classBand) || classBand.length === 0) return '';
    const sorted = [...classBand].sort((a, b) => a - b);
    return sorted.length === 1 ? 'Class ' + sorted[0] : 'Classes ' + sorted[0] + '-' + sorted[sorted.length - 1];
}

function renderSelectedTopic() {
    els.startGuidedBtn.disabled = !selectedConcept;
    if (!selectedConcept) {
        els.selectedTopicSummary.textContent = 'Select a topic to begin.';
        return;
    }
    els.selectedTopicSummary.textContent = selectedConcept.title + ': ' + (selectedConcept.hook || 'Sakha will start with a question.');
}


function loadProgress() {
    try {
        const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

function saveProgress() {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressState));
}

function loadSessionState() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SESSION_STATE_KEY) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function saveSessionState(patch) {
    if (!patch?.conceptId) return;
    const previous = loadSessionState() || {};
    localStorage.setItem(SESSION_STATE_KEY, JSON.stringify({
        ...previous,
        ...patch,
        updatedAt: new Date().toISOString()
    }));
}

function clearSessionState(conceptId) {
    const session = loadSessionState();
    if (!session || !conceptId || session.conceptId === conceptId) {
        localStorage.removeItem(SESSION_STATE_KEY);
    }
}


function getProgress(conceptId) {
    return progressState[conceptId] || null;
}

function updateProgress(conceptId, patch) {
    if (!conceptId) return;
    const previous = progressState[conceptId] || {};
    progressState[conceptId] = {
        ...previous,
        ...patch,
        updatedAt: new Date().toISOString()
    };
    saveProgress();
    renderProgressShelf();
}

function getReviewDelay(attempts) {
    return REVIEW_DELAYS_MS[Math.min(Math.max(attempts, 0), REVIEW_DELAYS_MS.length - 1)];
}

function getProgressLabel(entry) {
    if (!entry) return 'Not started';
    if (entry.status === 'teach_back_done') return 'Teach-back done';
    if (entry.status === 'needs_revision') return 'Revision due';
    if (entry.status === 'practicing') return 'Practicing';
    return 'Started';
}

function getProgressMeta(entry) {
    if (!entry) return 'Start this topic';
    if (entry.nextReviewAt && Date.parse(entry.nextReviewAt) <= Date.now()) return 'Ready for revision';
    if (entry.nextReviewAt) return 'Next revision: ' + new Date(entry.nextReviewAt).toLocaleDateString();
    return entry.confidence ? 'Confidence: ' + entry.confidence : 'Continue learning';
}

function getTrackedConcepts() {
    return Object.entries(progressState)
        .map(([id, entry]) => {
            const concept = conceptIndex.find((item) => item.id === id) || {};
            return { id, ...concept, ...entry };
        })
        .sort((a, b) => {
            const aDue = a.nextReviewAt && Date.parse(a.nextReviewAt) <= Date.now();
            const bDue = b.nextReviewAt && Date.parse(b.nextReviewAt) <= Date.now();
            if (aDue !== bDue) return aDue ? -1 : 1;
            return Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
        })
        .slice(0, 6);
}

function renderProgressShelf() {
    if (!els.progressList) return;
    els.progressList.replaceChildren();
    const activeSession = loadSessionState();
    const tracked = getTrackedConcepts();

    if (activeSession?.conceptId) {
        const resume = document.createElement('button');
        resume.type = 'button';
        resume.className = 'progress-card resume-card';
        const title = document.createElement('strong');
        title.textContent = 'Continue previous topic';
        const status = document.createElement('span');
        status.textContent = activeSession.title || activeSession.conceptId;
        const meta = document.createElement('small');
        meta.textContent = 'Saved on this device. Starts from the same topic.';
        resume.append(title, status, meta);
        resume.addEventListener('click', () => {
            const concept = conceptIndex.find((item) => item.id === activeSession.conceptId);
            if (concept) selectedConcept = concept;
            selectedLanguage = activeSession.language || selectedLanguage;
            startConcept(activeSession.conceptId);
        });
        els.progressList.appendChild(resume);
    }

    if (!tracked.length && !activeSession?.conceptId) {
        const demoCard = document.createElement('div');
        demoCard.className = 'demo-progress-card';
        demoCard.innerHTML = `
            <strong>Example: Floating and Sinking</strong>
            <span>Teach-back done</span>
            <small>This is what your progress will look like after your first session.</small>
        `;
        els.progressList.appendChild(demoCard);

        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Your recent topics and revision cards will appear here on this device.';
        empty.style.marginTop = '1rem';
        els.progressList.appendChild(empty);
        return;
    }

    tracked.forEach((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'progress-card';
        if (entry.nextReviewAt && Date.parse(entry.nextReviewAt) <= Date.now()) button.classList.add('due');

        const title = document.createElement('strong');
        title.textContent = entry.title || entry.id;

        const status = document.createElement('span');
        status.textContent = getProgressLabel(entry);

        const meta = document.createElement('small');
        meta.textContent = getProgressMeta(entry);

        button.append(title, status, meta);
        button.addEventListener('click', () => {
            const concept = conceptIndex.find((item) => item.id === entry.id);
            if (concept) selectedConcept = concept;
            localStorage.setItem('sakha_last_concept', entry.id);
            renderLandingChoices();
            startConcept(entry.id);
        });
        els.progressList.appendChild(button);
    });
}

function appendLearningPath(concept) {
    const card = document.createElement('section');
    card.className = 'learning-path';
    card.setAttribute('aria-label', 'Learning path');

    const title = document.createElement('h2');
    title.textContent = "Today\'s path";

    const steps = document.createElement('ol');
    ['Hook', 'Predict', 'Discuss', 'Practice', 'Teach back'].forEach((step, index) => {
        const item = document.createElement('li');
        item.textContent = String(index + 1) + '. ' + step;
        steps.appendChild(item);
    });

    const note = document.createElement('p');
    note.textContent = concept.big_idea || 'We will move from a real-life question to your own explanation.';

    card.append(title, steps, note);
    els.chatContainer.appendChild(card);
}

function ensureLearningCompanion() {
    if (!learningCompanionPromise) {
        learningCompanionPromise = import('./learning-companion.js');
    }
    return learningCompanionPromise;
}

async function appendLearningCompanionCard(concept, phase = 'start') {
    const mod = await ensureLearningCompanion();
    mod.appendLearningCompanionCard({
        concept,
        phase,
        container: els.chatContainer,
        onScroll: scrollToBottom
    });
}

async function saveLearningSignal(conceptId, patch) {
    const mod = await ensureLearningCompanion();
    mod.saveLearningSignal(conceptId, patch);
}

async function captureLearningSignal(concept, text) {
    const mod = await ensureLearningCompanion();
    return mod.captureLearningSignal(concept, text);
}
function getConceptWhiteboard(concept) {
    return concept?.whiteboard || activeWhiteboard || null;
}

function setActiveWhiteboard(concept) {
    activeWhiteboard = getConceptWhiteboard(concept);
    activeWhiteboardTitle = concept?.title || 'Concept whiteboard';
    if (els.whiteboardBtn) {
        els.whiteboardBtn.disabled = !activeWhiteboard;
        els.whiteboardBtn.classList.toggle('attention', Boolean(activeWhiteboard));
        els.whiteboardBtn.setAttribute('aria-expanded', isWhiteboardOpen() ? 'true' : 'false');
    }
    if (activeWhiteboard && isWhiteboardOpen()) {
        renderWhiteboardIntroPanel();
    }
}

function isWhiteboardOpen() {
    return Boolean(els.whiteboardPanel && !els.whiteboardPanel.classList.contains('collapsed'));
}

function showWhiteboardPanel() {
    if (!els.whiteboardPanel) return;
    els.whiteboardPanel.classList.remove('collapsed');
    els.whiteboardPanel.setAttribute('aria-hidden', 'false');
    if (els.whiteboardBtn) {
        els.whiteboardBtn.classList.add('open');
        els.whiteboardBtn.setAttribute('aria-expanded', 'true');
    }
}

function renderWhiteboardIntroPanel() {
    if (!activeWhiteboard || !els.whiteboardPanel || !els.whiteboardContent) return;
    const card = document.createElement('section');
    card.className = 'whiteboard-intro-card';
    const heading = document.createElement('h2');
    heading.textContent = 'Whiteboard';
    const text = document.createElement('p');
    text.textContent = 'Formula, symbols, and steps appear here slowly. After 1-2 steps, tell Sakha: clear or confusing.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Open whiteboard';
    button.addEventListener('click', () => openActiveWhiteboard('start'));
    card.append(heading, text, button);
    els.whiteboardContent.replaceChildren(card);
    showWhiteboardPanel();
}

function getWhiteboardView(whiteboard, stage) {
    const basicsLimit = stage === 'full' ? 99 : stage === 'steps' ? 3 : 2;
    const symbolsLimit = stage === 'full' ? 99 : stage === 'steps' ? 5 : 2;
    const stepsLimit = stage === 'full' ? 99 : stage === 'steps' ? 4 : 2;
    return {
        ...whiteboard,
        basics: (whiteboard.basics || []).slice(0, basicsLimit),
        symbols: (whiteboard.symbols || []).slice(0, symbolsLimit),
        steps: (whiteboard.steps || []).slice(0, stepsLimit),
        worked_example: stage === 'full' ? whiteboard.worked_example : '',
        common_confusions: stage === 'full' ? (whiteboard.common_confusions || []) : []
    };
}

async function renderWhiteboardPanel(whiteboard, title, stage = 'start') {
    if (!whiteboard || !els.whiteboardPanel || !els.whiteboardContent) return;
    whiteboardStage = stage;
    const { renderComponent } = await import('./components.js');
    const board = renderComponent('Whiteboard', { whiteboard: getWhiteboardView(whiteboard, stage), title });
    els.whiteboardContent.replaceChildren(board);
    showWhiteboardPanel();
}

function openActiveWhiteboard(stage = 'start') {
    if (!activeWhiteboard) return;
    renderWhiteboardPanel(activeWhiteboard, activeWhiteboardTitle, stage);
}

function closeWhiteboardPanel() {
    if (!els.whiteboardPanel) return;
    els.whiteboardPanel.classList.add('collapsed');
    els.whiteboardPanel.setAttribute('aria-hidden', 'true');
    if (els.whiteboardBtn) {
        els.whiteboardBtn.classList.remove('open');
        els.whiteboardBtn.setAttribute('aria-expanded', 'false');
    }
}

function applyWhiteboardAction(board, action) {
    if (!board.basics) board.basics = [];
    if (!board.steps) board.steps = [];
    if (!board.symbols) board.symbols = [];
    if (!board.common_confusions) board.common_confusions = [];

    switch (action.type) {
        case 'ADD_BASIC':
            if (!board.basics.includes(action.text)) {
                board.basics.push({ id: action.id, text: action.text });
            }
            break;
        case 'ADD_STEP':
            board.steps.push({ id: action.id, label: action.label, detail: action.detail });
            break;
        case 'REVEAL_FORMULA':
            board.formula = action.formula;
            board.formula_reading = action.formula_reading;
            board.latestActionId = action.id || 'formula';
            break;
        case 'ADD_SYMBOL':
            board.symbols.push({ id: action.id, symbol: action.symbol, means: action.means, example: action.example });
            break;
        case 'ADD_CONFUSION':
            board.common_confusions.push({ id: action.id, confusion: action.confusion, fix: action.fix });
            break;
    }
}

function toggleWhiteboardPanel() {
    if (isWhiteboardOpen()) {
        closeWhiteboardPanel();
        return;
    }
    openActiveWhiteboard();
}

function appendDiagnosticCard(concept) {
    const card = document.createElement('section');
    card.className = 'diagnostic-card';
    card.setAttribute('aria-label', 'Prediction check');

    const heading = document.createElement('h2');
    heading.textContent = 'Before Sakha explains';

    const prompt = document.createElement('p');
    prompt.textContent = 'Make a quick prediction. It is okay if it is wrong.';

    const input = document.createElement('textarea');
    input.rows = 2;
    input.placeholder = 'I think...';
    input.setAttribute('aria-label', 'Your prediction');

    const confidence = document.createElement('div');
    confidence.className = 'confidence-row';
    const values = ['Not sure', 'Some idea', 'Confident'];
    let selectedConfidence = values[0];
    values.forEach((value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = value;
        button.setAttribute('aria-pressed', String(value === selectedConfidence));
        if (value === selectedConfidence) button.classList.add('active');
        button.addEventListener('click', () => {
            selectedConfidence = value;
            [...confidence.querySelectorAll('button')].forEach((btn) => {
                const isActive = btn.textContent === value;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', String(isActive));
            });
        });
        confidence.appendChild(button);
    });

    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'primary-action diagnostic-start';
    start.textContent = 'Use this as my first answer';
    start.addEventListener('click', () => {
        const prediction = input.value.trim() || 'I am not sure yet.';
        saveLearningSignal(concept.id, {
            confidence: selectedConfidence,
            firstPrediction: prediction
        });
        updateProgress(concept.id, {
            status: 'practicing',
            title: concept.title,
            confidence: selectedConfidence,
            firstPrediction: prediction,
            lastStudiedAt: new Date().toISOString()
        });
        els.userInput.value = 'My prediction: ' + prediction + ' Confidence: ' + selectedConfidence;
        card.remove();
        handleSend();
    });

    card.append(heading, prompt, input, confidence, start);
    els.chatContainer.appendChild(card);
}

async function startGalaxyMode() {
    hideHome();
    els.galaxyContainer.classList.remove('hidden');
    els.galaxyOverlay.classList.remove('hidden');
    els.galaxyFilters.classList.remove('hidden');

    if (!galaxyInstance) {
        const { initGalaxy } = await import('./galaxy.js');
        galaxyInstance = initGalaxy('galaxyContainer', async (conceptId) => {
            await cleanupGalaxy();
            startConcept(conceptId);
        });
    }
}

async function cleanupGalaxy() {
    els.galaxyContainer.classList.add('hidden');
    els.galaxyOverlay.classList.add('hidden');
    els.galaxyFilters.classList.add('hidden');

    if (galaxyInstance?.destroy) {
        galaxyInstance.destroy();
    }
    galaxyInstance = null;
}

function startConcept(conceptId) {
    hideHome();
    checkAuthAndStart(conceptId || selectedConcept?.id || DEFAULT_CONCEPT);
}

function hideHome() {
    document.body.classList.add('app-active');
    els.landingShell.classList.add('hidden');
}

async function showHome() {
    await cleanupGalaxy();
    document.body.classList.remove('app-active');
    els.appContainer.classList.add('hidden');
    els.nameModal.classList.add('hidden');
    els.landingShell.classList.remove('hidden');
    els.chatContainer.replaceChildren();
    if (completionTimer) window.clearTimeout(completionTimer);
    completionTimer = null;
    activeWhiteboard = null;
    activeWhiteboardTitle = '';
    whiteboardStage = 'intro';
    if (els.whiteboardBtn) {
        els.whiteboardBtn.disabled = true;
        els.whiteboardBtn.classList.remove('attention');
    }
    agent = null;
    if (els.offlineToggle) els.offlineToggle.checked = false;
}

function checkAuthAndStart(conceptId) {
    const savedName = localStorage.getItem('sakha_name');
    if (savedName) {
        initAgent(null, conceptId, savedName);
        return;
    }

    els.nameModal.classList.remove('hidden');
    els.startBtn.onclick = () => {
        const name = els.studentName.value.trim().slice(0, 20);
        if (!name) return;
        localStorage.setItem('sakha_name', name);
        initAgent(null, conceptId, name);
    };
}

function shareOnWhatsApp() {
    const text = encodeURIComponent(
        'Sakha - AI Study Buddy\n\nI tried a guided concept session. It starts with questions and works in Hinglish/English.\n\nTry it here: ' + window.location.href
    );
    window.open('https://wa.me/?text=' + text, '_blank', 'noopener,noreferrer');
}

async function ensureP2PService() {
    if (p2pService) return p2pService;
    if (!p2pPromise) {
        p2pPromise = import('./p2p.js').then(({ P2PService }) => new P2PService((data) => {
            if (data.type === 'msg') {
                appendMessage(data.role, data.text);
            } else if (data.type === 'component') {
                appendComponent(data.component, data.props);
            }
        }));
    }
    p2pService = await p2pPromise;
    return p2pService;
}

async function handlePeerShare() {
    const service = await ensureP2PService();
    const id = prompt('Enter Peer ID to join, or leave blank to host a session:');
    if (!id) {
        try {
            const myId = await service.init();
            els.peerIdDisplay.textContent = 'ID: ' + myId;
            els.peerIdDisplay.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            alert('P2P init failed');
        }
        return;
    }

    await service.init();
    service.connectTo(id);
}

async function startMic() {
    els.micBtn.classList.add('active');
    const service = await ensureVoiceService();
    service.start();
}

function stopMic() {
    els.micBtn.classList.remove('active');
    if (voiceService) voiceService.stop();
}

async function handleOfflineToggle(event) {
    if (!agent) return;
    const isOffline = event.target.checked;
    agent.setOfflineMode(isOffline);

    if (!isOffline) return;

    appendMessage('bot', 'Downloading local AI model. This is optional and can take a few minutes the first time.');
    try {
        await agent.initWebLLM(() => {});
        appendMessage('bot', 'Local AI model loaded. You can continue offline now.');
    } catch (error) {
        appendMessage('bot', 'Local model could not load: ' + error.message);
        els.offlineToggle.checked = false;
        agent.setOfflineMode(false);
    }
}

async function initAgent(key, conceptId, studentName) {
    els.nameModal.classList.add('hidden');
    els.appContainer.classList.remove('hidden');
    els.chatContainer.replaceChildren();

    agent = new SakhaAgent(key);
    agent.setLanguage(selectedLanguage);
    const activeConceptId = conceptId || DEFAULT_CONCEPT;
    localStorage.setItem('sakha_last_concept', activeConceptId);

    try {
        const concept = await agent.loadConcept(activeConceptId);
        concept.id = activeConceptId;
        selectedConcept = conceptIndex.find((item) => item.id === activeConceptId) || selectedConcept;
        els.topicIndicator.textContent = 'Topic: ' + concept.title;
        updateProgress(activeConceptId, {
            status: 'started',
            title: concept.title,
            level: selectedConcept?.level || concept.level || selectedLevel,
            subject: selectedConcept?.subject || concept.subject || selectedSubject,
            lastStudiedAt: new Date().toISOString()
        });
        saveSessionState({
            conceptId: activeConceptId,
            title: concept.title,
            language: selectedLanguage,
            stage: 'started'
        });
        setActiveWhiteboard(concept);
        renderWhiteboardIntroPanel();
        appendLearningPath(concept);

        const hook = concept.intro_hook || selectedConcept?.hook || 'What do you already know about this?';
        const initialMsg = selectedLanguage === 'English'
            ? 'Hello ' + studentName + '. Today we will understand "' + concept.title + '". First question: ' + hook
            : selectedLanguage === 'Hindi-first'
                ? 'Namaste ' + studentName + '. Aaj hum "' + concept.title + '" ko samjhenge. Pehla sawaal: ' + hook
                : 'Hello ' + studentName + '. Aaj hum "' + concept.title + '" ko samjhenge. Pehla sawaal: ' + hook;
        appendMessage('bot', initialMsg);
        await appendLearningCompanionCard(concept, 'start');
        appendDiagnosticCard(concept);
        if (voiceService) voiceService.speak(initialMsg);
        if (p2pService) p2pService.send({ type: 'msg', role: 'bot', text: initialMsg });
    } catch (error) {
        appendMessage('bot', 'Error loading concept: ' + error.message);
    }
}

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'message ' + role;
    div.textContent = text;

    if (text.includes('```mermaid')) {
        const match = text.match(/```mermaid([\s\S]*?)```/);
        if (match) {
            appendComponent('MermaidDiagram', { code: match[1] });
            div.textContent = text.replace(match[0], '');
        }
    }

    els.chatContainer.appendChild(div);
    scrollToBottom();
}

async function appendComponent(componentName, props) {
    if (componentName === 'Whiteboard') {
        if (props?.whiteboardAction) {
            if (!activeWhiteboard) activeWhiteboard = { basics: [], steps: [], symbols: [], common_confusions: [] };
            applyWhiteboardAction(activeWhiteboard, props.whiteboardAction);
            activeWhiteboard.latestActionId = props.whiteboardAction.id || Date.now();
        } else {
            activeWhiteboard = props?.whiteboard || activeWhiteboard;
        }
        activeWhiteboardTitle = props?.title || activeWhiteboardTitle;
        if (els.whiteboardBtn) {
            els.whiteboardBtn.disabled = !activeWhiteboard;
            els.whiteboardBtn.classList.toggle('attention', Boolean(activeWhiteboard));
        }
        openActiveWhiteboard(props?.stage || whiteboardStage || 'steps');
        return;
    }
    
    if (componentName === 'ConceptVisualizer' || componentName === 'PlantVisualizer') {
        const mod = await import(new URL('./concept-visualizers.js', import.meta.url));
        mod.appendConceptVisualizer({ concept: agent.concept, container: els.chatContainer });
        scrollToBottom();
        return;
    }

    const { renderComponent } = await import('./components.js');
    const el = renderComponent(componentName, props);
    els.chatContainer.appendChild(el);
    scrollToBottom();
}

function scrollToBottom() {
    els.chatContainer.scrollTop = els.chatContainer.scrollHeight;
}

async function handleSend() {
    const text = els.userInput.value.trim();
    if (!text || !agent) return;

    appendMessage('user', text);
    const learningPhase = await captureLearningSignal(agent.concept, text);
    saveSessionState({
        conceptId: agent.concept?.id,
        title: agent.concept?.title,
        language: selectedLanguage,
        lastUserMessage: text,
        stage: 'in_progress'
    });
    if (p2pService) p2pService.send({ type: 'msg', role: 'user', text });
    els.userInput.value = '';

    if (agent.concept?.visualizer && learningPhase[0] === 'v') {
        const mod = await import(new URL('./concept-visualizers.js', import.meta.url));
        mod.appendConceptVisualizer({ concept: agent.concept, container: els.chatContainer });
        scrollToBottom();
        return;
    }

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot';
    loadingDiv.textContent = 'Thinking...';
    els.chatContainer.appendChild(loadingDiv);
    scrollToBottom();

    try {
        const responseJson = await agent.sendMessage(text);
        loadingDiv.remove();

        if (responseJson.message) {
            appendMessage('bot', responseJson.message);
            if (voiceService) voiceService.speak(responseJson.message);
            if (p2pService) p2pService.send({ type: 'msg', role: 'bot', text: responseJson.message });
        }

        if (responseJson.render_component && responseJson.render_component !== 'none') {
            appendComponent(responseJson.render_component, responseJson.component_props || {});
            if (p2pService) {
                p2pService.send({
                    type: 'component',
                    component: responseJson.render_component,
                    props: responseJson.component_props
                });
            }
        }

        if (learningPhase === 'clear' || learningPhase === 'confused') {
            await appendLearningCompanionCard(agent.concept, learningPhase);
        }

        if (responseJson.session_complete) {
            const attempts = (getProgress(agent.concept.id)?.reviewAttempts || 0) + 1;
            updateProgress(agent.concept.id, {
                status: 'teach_back_done',
                title: agent.concept.title,
                reviewAttempts: attempts,
                completedAt: new Date().toISOString(),
                lastTeachBack: text,
                nextReviewAt: new Date(Date.now() + getReviewDelay(attempts - 1)).toISOString()
            });
            clearSessionState(agent.concept.id);
            scheduleSessionComplete(agent.concept.title, text, responseJson.message || '');
        }
    } catch (error) {
        loadingDiv.remove();
        appendMessage('bot', 'Oops. Something went wrong: ' + error.message + '.');
    }
}

function isSakhaSpeaking() {
    return Boolean(voiceService?.isSynthesizing) || Boolean(window.speechSynthesis?.speaking || window.speechSynthesis?.pending);
}

function scheduleSessionComplete(conceptTitle, teachBackText, finalMessage) {
    if (completionTimer) window.clearTimeout(completionTimer);
    const wordCount = String(finalMessage || '').trim().split(/\s+/).filter(Boolean).length;
    const readDelay = Math.min(COMPLETION_MAX_DELAY_MS, Math.max(COMPLETION_MIN_DELAY_MS, wordCount * 420));
    const openWhenReady = () => {
        if (isSakhaSpeaking()) {
            completionTimer = window.setTimeout(openWhenReady, 1000);
            return;
        }
        completionTimer = null;
        showSessionComplete(conceptTitle, teachBackText);
    };
    completionTimer = window.setTimeout(openWhenReady, readDelay);
}

async function showSessionComplete(conceptTitle, teachBackText) {
    const mod = await import('./session-complete.js');
    mod.showSessionCompleteModal({
        conceptTitle,
        teachBackText,
        conceptId: agent && agent.concept ? agent.concept.id : null,
        language: selectedLanguage,
        onReturn: showHome
    });
}
