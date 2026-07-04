import { SakhaAgent } from './agent.js';
import { renderComponent } from './components.js';
import { VoiceService } from './voice.js';
import { VisionService } from './vision.js';
import { initGalaxy } from './galaxy.js';
import { P2PService } from './p2p.js';

const els = {
    nameModal: document.getElementById('nameModal'),
    studentName: document.getElementById('studentName'),
    startBtn: document.getElementById('startBtn'),
    whatsappBtn: document.getElementById('whatsappBtn'),
    appContainer: document.getElementById('appContainer'),
    galaxyOverlay: document.getElementById('galaxyOverlay'),
    galaxyContainer: document.getElementById('galaxyContainer'),
    resetBtn: document.getElementById('resetBtn'),
    chatContainer: document.getElementById('chatContainer'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    topicIndicator: document.getElementById('topicIndicator'),
    offlineToggle: document.getElementById('offlineToggle'),
    micBtn: document.getElementById('micBtn'),
    cameraBtn: document.getElementById('cameraBtn'),
    shareBtn: document.getElementById('shareBtn'),
    peerIdDisplay: document.getElementById('peerIdDisplay')
};

let agent = null;
let voiceService = null;
let visionService = null;
let p2pService = null;
let isCameraActive = false;
let galaxyInstance = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    }

    // Show Galaxy first
    els.galaxyOverlay.classList.remove('hidden');
    galaxyInstance = initGalaxy('galaxyContainer', async (conceptId) => {
        // When user clicks a node
        els.galaxyContainer.classList.add('hidden');
        els.galaxyOverlay.classList.add('hidden');
        if (galaxyInstance) {
            const instance = await galaxyInstance;
            if (instance && instance.destroy) instance.destroy();
        }
        
        checkAuthAndStart(conceptId);
    });

    voiceService = new VoiceService((text) => {
        els.userInput.value = text;
        els.micBtn.classList.remove('active');
        handleSend();
    });

    visionService = new VisionService();

    p2pService = new P2PService((data) => {
        if (data.type === 'msg') {
            appendMessage(data.role, data.text);
        } else if (data.type === 'component') {
            appendComponent(data.component, data.props);
        }
    });
});

function checkAuthAndStart(conceptId) {
    const savedName = localStorage.getItem('sakha_name');
    if (savedName) {
        initAgent(null, conceptId, savedName);
    } else {
        els.nameModal.classList.remove('hidden');
        els.startBtn.onclick = () => {
            const name = els.studentName.value.trim();
            if (name) {
                localStorage.setItem('sakha_name', name);
                initAgent(null, conceptId, name);
            }
        };
    }
}

els.resetBtn.addEventListener('click', () => {
    location.reload();
});

function shareOnWhatsApp() {
    const text = encodeURIComponent(
        `🌟 Sakha — AI Study Buddy\n\nMaine yeh try kiya aur mujhe bahut achhe se samajh aaya!\n\nTum bhi try karo: ${window.location.href}\n\n✅ Free hai\n✅ Hindi/English dono\n✅ Install hota hai phone pe`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

els.whatsappBtn.addEventListener('click', shareOnWhatsApp);

// P2P Events
els.shareBtn.addEventListener('click', async () => {
    const id = prompt("Enter Peer ID to join, or leave blank to host a session:");
    if (!id) {
        try {
            const myId = await p2pService.init();
            els.peerIdDisplay.textContent = `ID: ${myId}`;
            els.peerIdDisplay.classList.remove('hidden');
        } catch (e) {
            alert("P2P init failed");
        }
    } else {
        await p2pService.init();
        p2pService.connectTo(id);
    }
});

// Voice & Vision Events
els.micBtn.addEventListener('mousedown', () => {
    els.micBtn.classList.add('active');
    voiceService.start();
});
els.micBtn.addEventListener('mouseup', () => {
    voiceService.stop();
});

els.cameraBtn.addEventListener('click', async () => {
    if (!isCameraActive) {
        isCameraActive = true;
        els.cameraBtn.classList.add('active');
        const camContainer = document.createElement('div');
        camContainer.id = 'cameraContainer';
        camContainer.className = 'message user';
        els.chatContainer.appendChild(camContainer);
        scrollToBottom();
        await visionService.startCamera(camContainer);
    } else {
        isCameraActive = false;
        els.cameraBtn.classList.remove('active');
        visionService.stopCamera();
    }
});

els.offlineToggle.addEventListener('change', async (e) => {
    if (!agent) return;
    const isOffline = e.target.checked;
    agent.setOfflineMode(isOffline);

    if (isOffline) {
        appendMessage('bot', 'Downloading local AI model. This might take a few minutes the first time...');
        try {
            await agent.initWebLLM((progress) => {
                console.log(progress.text);
            });
            appendMessage('bot', 'Local AI model loaded! Running 100% offline.');
        } catch (e) {
            appendMessage('bot', 'Failed to load local model: ' + e.message);
            els.offlineToggle.checked = false;
            agent.setOfflineMode(false);
        }
    }
});

async function initAgent(key, conceptId, studentName) {
    els.nameModal.classList.add('hidden');
    els.appContainer.classList.remove('hidden');
    
    agent = new SakhaAgent(key);
    localStorage.setItem('sakha_last_concept', conceptId || 'ice-melting');
    
    try {
        const concept = await agent.loadConcept(conceptId || 'ice-melting');
        els.topicIndicator.textContent = `Topic: ${concept.title}`;
        
        const initialMsg = `Hello ${studentName}! I'm Sakha. Today we are going to learn about "${concept.title}". What do you already know about this?`;
        appendMessage('bot', initialMsg);
        voiceService.speak(initialMsg);
        p2pService.send({ type: 'msg', role: 'bot', text: initialMsg });
    } catch (e) {
        appendMessage('bot', `Error loading concept: ${e.message}`);
    }
}

// UI Helpers
function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.textContent = text;
    
    // For mermaid diagrams injected in text as markdown (fallback)
    if (text.includes("```mermaid")) {
        const match = text.match(/```mermaid([\s\S]*?)```/);
        if (match) {
            appendComponent('MermaidDiagram', { code: match[1] });
            text = text.replace(match[0], '');
            div.textContent = text;
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

// Chat Interaction
async function handleSend() {
    let text = els.userInput.value.trim();
    
    if (isCameraActive) {
        const frame = visionService.captureFrame();
        if (frame) text += `\n[Attached Image]`;
    }

    if (!text || !agent) return;

    appendMessage('user', text);
    p2pService.send({ type: 'msg', role: 'user', text: text });
    els.userInput.value = '';
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot';
    loadingDiv.textContent = 'Thinking...';
    els.chatContainer.appendChild(loadingDiv);
    scrollToBottom();

    try {
        const responseJson = await agent.sendMessage(text);
        
        els.chatContainer.removeChild(loadingDiv);
        
        if (responseJson.message) {
            appendMessage('bot', responseJson.message);
            voiceService.speak(responseJson.message);
            p2pService.send({ type: 'msg', role: 'bot', text: responseJson.message });
        }
        
        if (responseJson.render_component && responseJson.render_component !== "none") {
            appendComponent(responseJson.render_component, responseJson.component_props || {});
            p2pService.send({ type: 'component', component: responseJson.render_component, props: responseJson.component_props });
        }

        if (responseJson.session_complete) {
            showSessionComplete(agent.concept.title, text);
        }

    } catch (e) {
        if(els.chatContainer.contains(loadingDiv)) els.chatContainer.removeChild(loadingDiv);
        appendMessage('bot', `Oops! Something went wrong: ${e.message}.`);
    }
}

els.sendBtn.addEventListener('click', handleSend);
els.userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

function showSessionComplete(conceptTitle, teachBackText) {
    const overlay = document.createElement('div');
    overlay.className = 'session-complete-overlay';
    overlay.innerHTML = `
        <div class="session-complete-card">
            <div class="stars">⭐⭐⭐</div>
            <h2>Wah yaar! 🎉</h2>
            <p><strong>${conceptTitle}</strong> — samajh aaya!</p>
            <p style="color: #666; font-size: 0.9rem">
                Tu ab kisi ko bhi yeh explain kar sakta hai.
            </p>
            <button id="returnToGalaxyBtn">Aur explore karo →</button>
            <button id="shareResultBtn" class="share-btn">📱 Share karo!</button>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('returnToGalaxyBtn').onclick = () => location.reload();
    document.getElementById('shareResultBtn').onclick = () => {
        const studentName = localStorage.getItem('sakha_name') || 'A student';
        const dataUrl = generateSummaryCard(studentName, conceptTitle, teachBackText);
        
        // Try to use Web Share API with the image
        fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], 'sakha-progress.png', { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share({
                        title: 'Sakha AI Study Buddy',
                        text: `Check out what ${studentName} just learned on Sakha!`,
                        files: [file]
                    });
                } else {
                    // Fallback: download the image
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = 'sakha-progress.png';
                    a.click();
                    alert("Card downloaded! Share it with your friends.");
                }
            });
    };
}

function generateSummaryCard(studentName, conceptTitle, teachBackText) {
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
    
    // Text: student understood [concept]
    ctx.font = 'bold 36px Fredoka, sans-serif';
    ctx.fillStyle = '#00bcd4';
    ctx.fillText(`${studentName} ne samjha:`, 60, 120);
    
    ctx.font = 'bold 48px Fredoka, sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText(conceptTitle, 60, 190);
    
    // Teach-back quote
    ctx.font = '24px Nunito, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`"${teachBackText.substring(0, 60)}..."`, 60, 280);
    
    // Sakha branding
    ctx.font = 'bold 20px Fredoka, sans-serif';
    ctx.fillStyle = '#4caf50';
    ctx.fillText('Sakha — AI Study Buddy', 60, 550);
    
    return canvas.toDataURL('image/png');
}
