// We will dynamically import these to enable code splitting
// import * as webllm from "@mlc-ai/web-llm";
// import { pipeline, env } from "@xenova/transformers";

export class SakhaAgent {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.history = [];
        this.concept = null;
        this.systemPrompt = "";
        this.isOffline = false;
        this.webLlmEngine = null;
        this.embedder = null;
    }

    setOfflineMode(isOffline) {
        this.isOffline = isOffline;
    }

    async initWebLLM(progressCallback) {
        if (this.webLlmEngine) return;
        
        // Dynamic import triggers ESBuild code splitting
        progressCallback({ text: "Downloading AI Engines (one-time)..." });
        const webllm = await import("@mlc-ai/web-llm");
        const { pipeline, env } = await import("@xenova/transformers");
        
        // Configure Transformers.js to load models locally if available
        env.allowLocalModels = true;
        env.localModelPath = '/models/';
        env.allowRemoteModels = true;

        // Use Phi-3 Mini since it's smaller and hyper-efficient
        const modelId = "Phi-3-mini-4k-instruct-q4f16_1-MLC";
        
        // Point to the local directory if the user downloaded it via download_models.py
        const appConfig = {
            model_list: [
                {
                    model_id: modelId,
                    model_lib_url: webllm.modelLibURLPrefix + webllm.modelVersion + "/Phi3-mini-4k-instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
                    model_url: `http://localhost:8080/models/${modelId}/`
                }
            ]
        };

        this.webLlmEngine = new webllm.MLCEngine();
        this.webLlmEngine.setInitProgressCallback(progressCallback);
        
        try {
            // Try loading from local HTTP Server first
            await this.webLlmEngine.reload(modelId, appConfig);
        } catch (e) {
            console.warn("Local model not found on localhost:8080. Falling back to browser cache/HuggingFace...");
            await this.webLlmEngine.reload(modelId); // Fallback to standard WebLLM cache
        }
        
        // Initialize RAG embedder
        progressCallback({ text: "Initializing Local RAG Embeddings..." });
        this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        progressCallback({ text: "Ready!" });
    }

    async loadConcept(conceptId) {
        try {
            const res = await fetch(`content/concepts/${conceptId}.json`);
            this.concept = await res.json();
            
            // Build a RICH system prompt from the concept pack
            const analogies = this.concept.indian_analogies?.join(', ') || '';
            const misconceptions = this.concept.misconceptions?.map(m => 
                `- Students often think: "${m.belief}". Probe: "${m.probe}"`
            ).join('\n') || '';
            const questionFlow = this.concept.question_flow?.map(q => q.q).join(' → ') || '';

            this.systemPrompt = `You are Sakha — NOT a teacher. You are a classmate who figured this out first.
You speak in Hinglish (Hindi + English mix, warm and casual).
You NEVER give the answer. You ask questions. You wait. You guide.
You say things like: "Socho ek baar...", "Arre yaar!", "Dekh —", "Interesting — lekin..."

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
            
            this.history = [{ role: "system", content: this.systemPrompt }];
            return this.concept;
        } catch (e) {
            console.error("Failed to load concept", e);
            throw e;
        }
    }

    async sendMessage(userMessage) {
        // ... append image if needed (Base64 URL) ...
        this.history.push({ role: "user", content: userMessage });

        if (this.isOffline) {
            if (!this.webLlmEngine) throw new Error("Offline Engine not initialized");
            const reply = await this.webLlmEngine.chat.completions.create({
                messages: this.history,
                response_format: { type: "json_object" }
            });
            const contentString = reply.choices[0].message.content;
            this.history.push({ role: "assistant", content: contentString });
            return JSON.parse(contentString);
        } else {
            const requestBody = {
                model_name: "llama-3.3-70b-versatile",
                messages: this.history,
                temperature: 0.7
            };

            // Use the Serverless Proxy (e.g., Cloudflare Worker)
            // By default pointing to local worker dev server (wrangler dev), or deployed URL
            const proxyUrl = window.PROXY_URL || "http://localhost:8787";

            const res = await fetch(proxyUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!res.ok) {
                throw new Error("Proxy API request failed: " + res.statusText);
            }

            const data = await res.json();
            const contentString = data.choices[0].message.content;

            this.history.push({ role: "assistant", content: contentString });
            return JSON.parse(contentString);
        }
    }
}
