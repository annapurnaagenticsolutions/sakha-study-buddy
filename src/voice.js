import { pipeline, env } from '@xenova/transformers';

// Disable local models since we are running in the browser
env.allowLocalModels = false;

export class VoiceService {
    constructor(onResultCallback) {
        this.onResult = onResultCallback;
        this.recognition = null;
        this.isRecording = false;

        this.synthesizer = null;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.currentSource = null;
        this.isSynthesizing = false;

        // Initialize Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
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

        // Preload the TTS model in the background
        this.initTTS();
    }

    async initTTS() {
        try {
            console.log("Loading speecht5_tts model...");
            this.synthesizer = await pipeline('text-to-speech', 'Xenova/speecht5_tts', { quantized: true });
            console.log("speecht5_tts model loaded successfully!");
        } catch (e) {
            console.error("Failed to load TTS model", e);
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

    async speak(text) {
        // Stop any current audio
        this.stopSpeaking();

        if (!this.synthesizer) {
            console.warn("TTS model not loaded yet. Falling back to speechSynthesis.");
            this.fallbackSpeak(text);
            return;
        }

        try {
            this.isSynthesizing = true;
            
            // Clean up text for TTS (remove emojis, keep basic punctuation)
            const cleanText = text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
                                  .replace(/[^\w\s.,?!'-]/g, ' ')
                                  .trim();

            if (!cleanText) return;

            // Split into sentences for better synthesis performance
            const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];

            const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/cmu-arctic-xvectors-extracted/resolve/main/cmu_us_slt_arctic-wav-arctic_a0001.bin';

            for (const sentence of sentences) {
                if (!this.isSynthesizing) break; // Interrupted
                if (sentence.trim().length === 0) continue;
                
                const out = await this.synthesizer(sentence.trim(), { speaker_embeddings });
                
                if (!this.isSynthesizing) break;

                await this.playAudioData(out.audio, out.sampling_rate);
            }
        } catch (error) {
            console.error("TTS generation error:", error);
            this.fallbackSpeak(text);
        } finally {
            this.isSynthesizing = false;
        }
    }

    playAudioData(audioArray, sampleRate) {
        return new Promise((resolve) => {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const buffer = this.audioContext.createBuffer(1, audioArray.length, sampleRate);
            buffer.getChannelData(0).set(audioArray);
            
            this.currentSource = this.audioContext.createBufferSource();
            this.currentSource.buffer = buffer;
            this.currentSource.connect(this.audioContext.destination);
            
            this.currentSource.onended = () => {
                resolve();
            };
            
            this.currentSource.start();
        });
    }

    stopSpeaking() {
        this.isSynthesizing = false;
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {}
            this.currentSource = null;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }

    fallbackSpeak(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const hinglishVoice = voices.find(v => v.lang === 'en-IN');
            if (hinglishVoice) utterance.voice = hinglishVoice;
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            window.speechSynthesis.speak(utterance);
        }
    }
}
