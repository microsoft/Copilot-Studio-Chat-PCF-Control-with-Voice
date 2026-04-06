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

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getCognitiveServicesToken, corsHeaders, jsonResponse, validateApiKey } from "../shared";

async function azureTtsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log("Azure TTS proxy: received request");

    // CORS preflight
    if (request.method === "OPTIONS") {
        return { status: 204, headers: corsHeaders() };
    }

    // Validate API key
    const apiKeyError = validateApiKey(request.headers.get("x-api-key"));
    if (apiKeyError) return apiKeyError;

    // Read SSML body
    const ssml = await request.text();
    if (!ssml || !ssml.includes("<speak")) {
        return jsonResponse(400, { error: "Request body must be valid SSML" });
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
        const token = await getCognitiveServicesToken();

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
            return jsonResponse(502, { error: `Azure Speech returned ${response.status}: ${errorText}` });
        }

        // Stream audio directly to client — no buffering
        context.log("Azure TTS: streaming response to client");
        return {
            status: 200,
            headers: {
                "Content-Type": "audio/mpeg",
                ...corsHeaders()
            },
            body: response.body as any
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        context.error(`Azure TTS proxy error: ${message}`);
        return jsonResponse(502, { error: `Failed to reach Azure Speech: ${message}` });
    }
}

app.http("azure-tts", {
    methods: ["POST", "OPTIONS"],
    authLevel: "anonymous",
    handler: azureTtsHandler
});
