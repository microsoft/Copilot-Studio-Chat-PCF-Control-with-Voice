"use strict";
/**
 * Azure OpenAI TTS Proxy — Azure Function HTTP Trigger
 *
 * Proxies text-to-speech requests to Azure OpenAI's audio/speech API.
 * Uses managed identity (DefaultAzureCredential) — no API keys needed.
 * Same auth pattern as narrator.py and the translation service.
 *
 * Request:
 *   POST /api/openai-tts
 *   Headers: Content-Type: application/json, x-api-key: {FUNCTION_API_KEY}
 *   Body: { model: string, input: string, voice: string, response_format?: string, speed?: number }
 *
 * Response:
 *   200: audio/mpeg (raw MP3 audio)
 *   4xx/5xx: { error: string }
 *
 * Environment Variables:
 *   AZURE_OPENAI_ENDPOINT — Azure OpenAI resource endpoint (e.g., https://my-resource.openai.azure.com/)
 *   AZURE_OPENAI_DEPLOYMENT — TTS deployment name (default: tts)
 *   FUNCTION_API_KEY — API key for validating client requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const shared_1 = require("../shared");
async function openaiTtsHandler(request, context) {
    context.log("OpenAI TTS proxy: received request");
    // CORS preflight
    if (request.method === "OPTIONS") {
        return { status: 204, headers: (0, shared_1.corsHeaders)() };
    }
    // Validate API key
    const apiKeyError = (0, shared_1.validateApiKey)(request.headers.get("x-api-key"));
    if (apiKeyError)
        return apiKeyError;
    // Parse request body
    let body;
    try {
        body = await request.json();
    }
    catch {
        return (0, shared_1.jsonResponse)(400, { error: "Invalid JSON body" });
    }
    if (!body.input || !body.voice) {
        return (0, shared_1.jsonResponse)(400, { error: "Missing required fields: input, voice" });
    }
    // Get config
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "tts";
    if (!endpoint) {
        context.error("AZURE_OPENAI_ENDPOINT not configured");
        return (0, shared_1.jsonResponse)(500, { error: "Server misconfigured: missing AZURE_OPENAI_ENDPOINT" });
    }
    const baseUrl = endpoint.replace(/\/+$/, "");
    const url = `${baseUrl}/openai/deployments/${deployment}/audio/speech?api-version=2024-02-15-preview`;
    try {
        // Get Entra ID token via managed identity (DefaultAzureCredential)
        const token = await (0, shared_1.getCognitiveServicesToken)();
        const ttsBody = {
            model: body.model || deployment,
            input: body.input,
            voice: body.voice,
            response_format: body.response_format || "mp3",
            speed: body.speed || 1.0
        };
        context.log(`Calling Azure OpenAI TTS: ${deployment}, voice: ${body.voice}`);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(ttsBody)
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            context.error(`Azure OpenAI TTS error (${response.status}): ${errorText}`);
            return (0, shared_1.jsonResponse)(502, { error: `Azure OpenAI returned ${response.status}: ${errorText}` });
        }
        // Stream audio directly to client — no buffering
        context.log("OpenAI TTS: streaming response to client");
        return {
            status: 200,
            headers: {
                "Content-Type": "audio/mpeg",
                ...(0, shared_1.corsHeaders)()
            },
            body: response.body
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        context.error(`OpenAI TTS proxy error: ${message}`);
        return (0, shared_1.jsonResponse)(502, { error: `Failed to reach Azure OpenAI: ${message}` });
    }
}
functions_1.app.http("openai-tts", {
    methods: ["POST", "OPTIONS"],
    authLevel: "anonymous",
    handler: openaiTtsHandler
});
//# sourceMappingURL=openaiTts.js.map