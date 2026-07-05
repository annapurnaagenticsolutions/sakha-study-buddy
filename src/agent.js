export class SakhaAgent {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.history = [];
        this.concept = null;
        this.systemPrompt = '';
        this.isOffline = false;
        this.webLlmEngine = null;
        this.embedder = null;
    }

    setOfflineMode(isOffline) {
        this.isOffline = isOffline;
    }

    async initWebLLM(progressCallback) {
        if (this.webLlmEngine) return;

        progressCallback({ text: 'Downloading AI Engines (one-time)...' });
        const webllm = await import('@mlc-ai/web-llm');
        const { pipeline, env } = await import('@xenova/transformers');

        const appBaseUrl = new URL('./', window.location.href);
        env.allowLocalModels = true;
        env.localModelPath = new URL('models/', appBaseUrl).pathname;
        env.allowRemoteModels = true;

        const modelId = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
        const appConfig = {
            model_list: [
                {
                    model_id: modelId,
                    model_lib_url: webllm.modelLibURLPrefix + webllm.modelVersion + '/Phi3-mini-4k-instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm',
                    model_url: new URL('models/' + modelId + '/', appBaseUrl).href
                }
            ]
        };

        this.webLlmEngine = new webllm.MLCEngine();
        this.webLlmEngine.setInitProgressCallback(progressCallback);

        try {
            await this.webLlmEngine.reload(modelId, appConfig);
        } catch (e) {
            console.warn('Local model not found beside the app. Falling back to browser cache/HuggingFace...');
            await this.webLlmEngine.reload(modelId);
        }

        progressCallback({ text: 'Initializing Local RAG Embeddings...' });
        this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        progressCallback({ text: 'Ready!' });
    }

    async loadConcept(conceptId) {
        try {
            const res = await fetch('content/concepts/' + conceptId + '.json');
            if (!res.ok) throw new Error('Concept not found: ' + conceptId);
            this.concept = await res.json();

            const analogies = this.concept.indian_analogies?.join(', ') || '';
            const misconceptions = this.concept.misconceptions?.map(m =>
                '- Students often think: "' + m.belief + '". Probe: "' + m.probe + '"'
            ).join('\n') || '';
            const questionFlow = this.concept.question_flow?.map(q => q.q).join(' -> ') || '';

            let persona = '';
            if (this.language === 'English') {
                persona = `You speak in pure English (warm, friendly, and casual).
You say things like: "Think about it...", "Oh wow!", "Look -", "Interesting - but..."`;
            } else if (this.language === 'Hindi') {
                persona = `You speak in pure Hindi using Latin script / Roman Hindi (warm and casual).
You say things like: "Zara socho...", "Arre wah!", "Dekho -", "Rochak hai - par..."`;
            } else {
                persona = `You speak in Hinglish (Hindi + English mix, warm and casual).
You say things like: "Socho ek baar...", "Arre yaar!", "Dekh -", "Interesting - lekin..."`;
            }

            this.systemPrompt = `You are Sakha - NOT a teacher. You are a classmate who figured this out first.
${persona}
You NEVER give the answer. You ask questions. You wait. You guide.

CONCEPT: ${this.concept.title}
BIG IDEA: ${this.concept.big_idea || ''}
HOOK: ${this.concept.intro_hook || ''}

INDIAN ANALOGIES TO USE: ${analogies}

COMMON MISTAKES TO WATCH FOR:
${misconceptions}

QUESTION FLOW (follow this roughly):
${questionFlow}

CRITICAL: You must ALWAYS respond in valid JSON format exactly like this:
{
  "message": "Your conversational Hinglish response. No markdown or bullet points.",
  "render_component": "ParticleSimulator" | "MermaidDiagram" | "none",
  "component_props": { "temperature": "high" | "low" | "medium", "state": "solid" | "liquid" | "gas", "code": "mermaid code if applicable" },
  "session_complete": true | false
}

Guidelines:
- Set "session_complete": true ONLY when the student successfully explains the concept back to you (the teach-back moment). Otherwise false.
- Use ParticleSimulator for states of matter / heat.
`;

            this.history = [{ role: 'system', content: this.systemPrompt }];
            return this.concept;
        } catch (e) {
            console.error('Failed to load concept', e);
            throw e;
        }
    }

    async sendMessage(userMessage) {
        this.history.push({ role: 'user', content: userMessage });

        if (this.isOffline) {
            if (!this.webLlmEngine) throw new Error('Offline Engine not initialized');
            const reply = await this.webLlmEngine.chat.completions.create({
                messages: this.history,
                response_format: { type: 'json_object' }
            });
            const contentString = reply.choices[0].message.content;
            this.history.push({ role: 'assistant', content: contentString });
            return this.parseAgentJson(contentString);
        }

        const requestBody = {
            model: 'llama-3.3-70b-versatile',
            messages: this.history,
            temperature: 0.7,
            max_tokens: 700,
            response_format: { type: 'json_object' }
        };

        const proxyUrl = window.SAKHA_CONFIG?.proxyUrl || window.PROXY_URL || 'http://localhost:8787';
        const res = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            let details = res.statusText;
            try {
                const errorBody = await res.json();
                details = errorBody.error?.message || errorBody.error || details;
            } catch (_) {
                // Keep the status text when the proxy did not return JSON.
            }
            throw new Error('Proxy API request failed: ' + details);
        }

        const data = await res.json();
        const contentString = data.choices[0].message.content;
        this.history.push({ role: 'assistant', content: contentString });
        return this.parseAgentJson(contentString);
    }

    parseAgentJson(contentString) {
        try {
            return JSON.parse(contentString);
        } catch (e) {
            console.error('Model returned non-JSON content', contentString);
            return {
                message: contentString || 'Mujhe response samajhne mein dikkat hui. Ek baar phir try karein?',
                render_component: 'none',
                component_props: {},
                session_complete: false
            };
        }
    }
}
