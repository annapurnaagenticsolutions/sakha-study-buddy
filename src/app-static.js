import { SakhaAgent } from './agent.js';
import { renderComponent } from './components.js';
import { VoiceService } from './voice.js';

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
    peerIdDisplay: document.getElementById('peerIdDisplay')
};

const LANGUAGES = ['Hinglish', 'English', 'Hindi-first'];
const LEVELS = ['Foundations', 'Middle School', 'Advanced'];
const SUBJECT_ORDER = ['Physics', 'Chemistry', 'Biology', 'Math', 'Life Skills', 'Engineering', 'Science', 'Geography'];
const DEFAULT_CONCEPT = 'ice-melting';
const PROGRESS_KEY = 'sakha_progress_v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_DELAYS_MS = [ONE_DAY_MS, 3 * ONE_DAY_MS, 7 * ONE_DAY_MS];

let agent = null;
let voiceService = null;
let p2pService = null;
let p2pPromise = null;
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
        .then((reg) => console.log('Service Worker registered', reg))
        .catch((err) => console.error('Service Worker registration failed', err));
}

function initVoice() {
    voiceService = new VoiceService((text) => {
        els.userInput.value = text;
        els.micBtn.classList.remove('active');
        handleSend();
    });
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

        const hook = document.createElement('small');
        hook.textContent = topic.hook || 'Start with a real-life question.';

        button.append(title, meta, hook);
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
    const tracked = getTrackedConcepts();

    if (!tracked.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Your recent topics and revision cards will appear here on this device.';
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

function appendModeCard(concept) {
    const usesApi = agent?.shouldUseRemoteApi?.() || false;
    const card = document.createElement('section');
    card.className = usesApi ? 'mode-card api-mode' : 'mode-card guided-mode';

    const title = document.createElement('strong');
    title.textContent = usesApi ? 'AI-assisted topic' : 'Guided no-API topic';

    const detail = document.createElement('span');
    detail.textContent = usesApi
        ? 'This advanced topic may use the secure proxy for flexible conversation.'
        : 'This topic runs from reviewed concept content, whiteboard steps, and guided questions.';

    card.append(title, detail);
    els.chatContainer.appendChild(card);
}

function appendWhiteboardCard(concept) {
    if (!concept.whiteboard) return;
    const wrapper = document.createElement('section');
    wrapper.className = 'whiteboard-launch-card';

    const copy = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = 'Whiteboard';
    const text = document.createElement('p');
    text.textContent = 'Formula, symbols, and steps are explained slowly here. After 1-2 steps, tell Sakha if it is clear or confusing.';
    copy.append(heading, text);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-action';
    button.textContent = 'Open whiteboard';
    button.addEventListener('click', () => appendComponent('Whiteboard', {
        whiteboard: concept.whiteboard,
        title: concept.title
    }));

    wrapper.append(copy, button);
    els.chatContainer.appendChild(wrapper);
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

function startMic() {
    els.micBtn.classList.add('active');
    voiceService.start();
}

function stopMic() {
    els.micBtn.classList.remove('active');
    voiceService.stop();
}

async function handleOfflineToggle(event) {
    if (!agent) return;
    const isOffline = event.target.checked;
    agent.setOfflineMode(isOffline);

    if (!isOffline) return;

    appendMessage('bot', 'Downloading local AI model. This is optional and can take a few minutes the first time.');
    try {
        await agent.initWebLLM((progress) => console.log(progress.text));
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
        appendLearningPath(concept);
        appendModeCard(concept);
        appendWhiteboardCard(concept);

        const hook = concept.intro_hook || selectedConcept?.hook || 'What do you already know about this?';
        const languageNote = selectedLanguage === 'English' ? 'Please answer in English if you prefer.' : selectedLanguage === 'Hindi-first' ? 'Hindi mein answer karna comfortable ho toh Hindi use karo.' : 'Hinglish comfortable ho toh Hinglish use karo.';
        const initialMsg = 'Hello ' + studentName + '. Aaj hum "' + concept.title + '" ko samjhenge. ' + languageNote + ' Pehla sawaal: ' + hook;
        appendMessage('bot', initialMsg);
        appendDiagnosticCard(concept);
        voiceService.speak(initialMsg);
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

function appendComponent(componentName, props) {
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
    if (p2pService) p2pService.send({ type: 'msg', role: 'user', text });
    els.userInput.value = '';

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
            voiceService.speak(responseJson.message);
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
            showSessionComplete(agent.concept.title, text);
        }
    } catch (error) {
        loadingDiv.remove();
        appendMessage('bot', 'Oops. Something went wrong: ' + error.message + '.');
    }
}

function showSessionComplete(conceptTitle, teachBackText) {
    const overlay = document.createElement('div');
    overlay.className = 'session-complete-overlay';

    const card = document.createElement('div');
    card.className = 'session-complete-card';

    const stars = document.createElement('div');
    stars.className = 'stars';
    stars.textContent = '***';

    const heading = document.createElement('h2');
    heading.textContent = 'Wah yaar!';

    const result = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = conceptTitle;
    result.append(strong, ' samajh aaya!');

    const note = document.createElement('p');
    note.className = 'session-complete-note';
    note.textContent = 'Ab tum is idea ko apne words mein explain kar sakte ho.';

    const returnButton = document.createElement('button');
    returnButton.id = 'returnToGalaxyBtn';
    returnButton.textContent = 'Choose another topic';

    const shareButton = document.createElement('button');
    shareButton.id = 'shareResultBtn';
    shareButton.className = 'share-btn';
    shareButton.textContent = 'Share progress card';

    card.append(stars, heading, result, note, returnButton, shareButton);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    returnButton.onclick = () => {
        overlay.remove();
        showHome();
    };
    shareButton.onclick = () => shareProgressCard(conceptTitle, teachBackText);
}

function shareProgressCard(conceptTitle, teachBackText) {
    const studentName = localStorage.getItem('sakha_name') || 'A student';
    const dataUrl = generateSummaryCard(studentName, conceptTitle, teachBackText);

    fetch(dataUrl)
        .then((res) => res.blob())
        .then((blob) => {
            const file = new File([blob], 'sakha-progress.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                    title: 'Sakha AI Study Buddy',
                    text: 'Check out what ' + studentName + ' just learned on Sakha.',
                    files: [file]
                });
            } else {
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = 'sakha-progress.png';
                a.click();
                alert('Card downloaded. You can share it from your device.');
            }
        });
}

function generateSummaryCard(studentName, conceptTitle, teachBackText) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, '#12372a');
    grad.addColorStop(1, '#245953');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    ctx.font = 'bold 36px Fredoka, sans-serif';
    ctx.fillStyle = '#dff7e2';
    ctx.fillText(studentName + ' understood:', 60, 120);

    ctx.font = 'bold 48px Fredoka, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(conceptTitle, 60, 190);

    ctx.font = '24px Nunito, sans-serif';
    ctx.fillStyle = '#d7e8df';
    ctx.fillText('"' + teachBackText.substring(0, 60) + '..."', 60, 280);

    ctx.font = 'bold 20px Fredoka, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('Sakha - AI Study Buddy', 60, 550);

    return canvas.toDataURL('image/png');
}
