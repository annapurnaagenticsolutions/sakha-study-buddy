export class VoiceService {
    constructor(onResultCallback) {
        this.onResult = onResultCallback;
        this.recognition = null;
        this.isRecording = false;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            // Default to Hinglish (en-IN), fallback to Hindi (hi-IN) or English (en-US)
            const userLang = navigator.language || 'en-IN';
            this.recognition.lang = userLang.startsWith('hi') ? 'hi-IN' : 'en-IN';

            this.recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                if (this.onResult) this.onResult(text);
            };

            this.recognition.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                this.stop();
            };

            this.recognition.onend = () => {
                this.isRecording = false;
            };
        } else {
            console.warn("Speech Recognition API not supported in this browser.");
        }
    }

    start() {
        if (this.recognition && !this.isRecording) {
            this.isRecording = true;
            this.recognition.start();
        }
    }

    stop() {
        if (this.recognition && this.isRecording) {
            this.isRecording = false;
            this.recognition.stop();
        }
    }

    speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Try to find a Hinglish or Hindi voice
            const voices = window.speechSynthesis.getVoices();
            const hinglishVoice = voices.find(v => v.lang === 'en-IN');
            const hindiVoice = voices.find(v => v.lang === 'hi-IN');
            
            if (hinglishVoice) {
                utterance.voice = hinglishVoice;
            } else if (hindiVoice) {
                utterance.voice = hindiVoice;
            }

            utterance.rate = 0.9; // Slightly slower for clarity
            utterance.pitch = 1.1; // Friendlier tone
            window.speechSynthesis.speak(utterance);
        }
    }
}
