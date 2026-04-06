"use strict";
/**
 * Azure Speech TTS Proxy — Azure Function HTTP Trigger
 *
 * Proxies SSML text-to-speech requests to Azure Speech Service.
 * Uses managed identity (DefaultAzureCredential) — no API keys needed.
 * Same auth pattern as narrator.py and the translation service.
 *
 * Request:
 *   POST /api/azure-tts
 *   Headers: Content-Type: application/ssml+xml, x-api-key: {FUNCTION_API_KEY}
 *   Body: SSML string (same format the client already builds)
 *
 * Response:
 *   200: audio/mpeg (raw MP3 audio)
 *   4xx/5xx: { error: string }
 *
 * Environment Variables:
 *   AZURE_SPEECH_REGION — Azure region (default: eastus)
 *   AZURE_SPEECH_RESOURCE_NAME — Resource name for Entra ID endpoint (optional)
 *   FUNCTION_API_KEY — API key for validating client requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const shared_1 = require("../shared");
async function azureTtsHandler(request, context) {
    context.log("Azure TTS proxy: received request");
    // CORS preflight
    if (request.method === "OPTIONS") {
        return { status: 204, headers: (0, shared_1.corsHeaders)() };
    }
    // Validate API key
    const apiKeyError = (0, shared_1.validateApiKey)(request.headers.get("x-api-key"));
    if (apiKeyError)
        return apiKeyError;
    // Read SSML body
    const ssml = await request.text();
    if (!ssml || !ssml.includes("<speak")) {
        return (0, shared_1.jsonResponse)(400, { error: "Request body must be valid SSML" });
    }
    // Get config
    const region = process.env.AZURE_SPEECH_REGION || "eastus";
    const resourceName = process.env.AZURE_SPEECH_RESOURCE_NAME;
    // Build endpoint — use resource-specific endpoint if name is provided,
    // otherwise use the regional endpoint
    const endpoint = resourceName
        ? `https://${resourceName}.cognitiveservices.azure.com/tts/cognitiveservices/v1`
        : `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    try {
        // Get Entra ID token via managed identity (DefaultAzureCredential)
        const token = await (0, shared_1.getCognitiveServicesToken)();
        context.log(`Calling Azure Speech TTS: ${endpoint}`);
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"
            },
            body: ssml
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            context.error(`Azure Speech error (${response.status}): ${errorText}`);
            return (0, shared_1.jsonResponse)(502, { error: `Azure Speech returned ${response.status}: ${errorText}` });
        }
        // Stream audio directly to client — no buffering
        context.log("Azure TTS: streaming response to client");
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
        context.error(`Azure TTS proxy error: ${message}`);
        return (0, shared_1.jsonResponse)(502, { error: `Failed to reach Azure Speech: ${message}` });
    }
}
functions_1.app.http("azure-tts", {
    methods: ["POST", "OPTIONS"],
    authLevel: "anonymous",
    handler: azureTtsHandler
});
//# sourceMappingURL=azureTts.js.map