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

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getCognitiveServicesToken, corsHeaders, jsonResponse, validateApiKey } from "../shared";

interface OpenAITtsRequest {
    model?: string;
    input: string;
    voice: string;
    response_format?: string;
    speed?: number;
}

async function openaiTtsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log("OpenAI TTS proxy: received request");

    // CORS preflight
    if (request.method === "OPTIONS") {
        return { status: 204, headers: corsHeaders() };
    }

    // Validate API key
    const apiKeyError = validateApiKey(request.headers.get("x-api-key"));
    if (apiKeyError) return apiKeyError;

    // Parse request body
    let body: OpenAITtsRequest;
    try {
        body = await request.json() as OpenAITtsRequest;
    } catch {
        return jsonResponse(400, { error: "Invalid JSON body" });
    }

    if (!body.input || !body.voice) {
        return jsonResponse(400, { error: "Missing required fields: input, voice" });
    }

    // Get config
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "tts";

    if (!endpoint) {
        context.error("AZURE_OPENAI_ENDPOINT not configured");
        return jsonResponse(500, { error: "Server misconfigured: missing AZURE_OPENAI_ENDPOINT" });
    }

    const baseUrl = endpoint.replace(/\/+$/, "");
    const url = `${baseUrl}/openai/deployments/${deployment}/audio/speech?api-version=2024-02-15-preview`;

    try {
        // Get Entra ID token via managed identity (DefaultAzureCredential)
        const token = await getCognitiveServicesToken();

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
            return jsonResponse(502, { error: `Azure OpenAI returned ${response.status}: ${errorText}` });
        }

        // Stream audio directly to client — no buffering
        context.log("OpenAI TTS: streaming response to client");
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
        context.error(`OpenAI TTS proxy error: ${message}`);
        return jsonResponse(502, { error: `Failed to reach Azure OpenAI: ${message}` });
    }
}

app.http("openai-tts", {
    methods: ["POST", "OPTIONS"],
    authLevel: "anonymous",
    handler: openaiTtsHandler
});
