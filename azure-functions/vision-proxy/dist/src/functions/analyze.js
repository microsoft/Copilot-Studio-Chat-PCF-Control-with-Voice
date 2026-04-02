"use strict";
/**
 * Vision Proxy - Azure Function HTTP Trigger
 *
 * Proxies image analysis requests to Azure OpenAI Vision API (GPT-4o with vision).
 * Keeps the Azure OpenAI API key server-side for security.
 *
 * Used by the CopilotVisionChat PCF control in "proxy" mode.
 *
 * Request:
 *   POST /api/analyze
 *   Headers: Content-Type: application/json, x-api-key: {FUNCTION_API_KEY}
 *   Body: {
 *     system_prompt: string,
 *     user_prompt: string,
 *     image_base64: string,   // with or without data URI prefix
 *     detail?: "high" | "low" | "auto",
 *     max_tokens?: number
 *   }
 *
 * Response:
 *   200: { analysis: string }
 *   4xx/5xx: { analysis: "", error: string }
 */
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
async function analyzeHandler(request, context) {
    context.log("Vision proxy: received request");
    // --- CORS preflight ---
    if (request.method === "OPTIONS") {
        return {
            status: 204,
            headers: corsHeaders()
        };
    }
    // --- Validate API key ---
    const expectedKey = process.env.FUNCTION_API_KEY;
    const providedKey = request.headers.get("x-api-key");
    if (!expectedKey) {
        context.error("FUNCTION_API_KEY not configured");
        return jsonResponse(500, { analysis: "", error: "Server misconfigured: missing FUNCTION_API_KEY" });
    }
    if (providedKey !== expectedKey) {
        return jsonResponse(401, { analysis: "", error: "Unauthorized: invalid or missing x-api-key" });
    }
    // --- Parse request body ---
    let body;
    try {
        body = await request.json();
    }
    catch {
        return jsonResponse(400, { analysis: "", error: "Invalid JSON body" });
    }
    if (!body.system_prompt || !body.image_base64) {
        return jsonResponse(400, { analysis: "", error: "Missing required fields: system_prompt, image_base64" });
    }
    // --- Build Azure OpenAI request ---
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o";
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
    if (!endpoint || !apiKey) {
        context.error("Azure OpenAI not configured");
        return jsonResponse(500, { analysis: "", error: "Server misconfigured: missing Azure OpenAI settings" });
    }
    // Ensure image has data URI prefix
    let imageDataUrl = body.image_base64;
    if (!imageDataUrl.startsWith("data:")) {
        imageDataUrl = `data:image/jpeg;base64,${imageDataUrl}`;
    }
    const url = `${endpoint.replace(/\/+$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    const chatBody = {
        messages: [
            {
                role: "system",
                content: body.system_prompt
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: body.user_prompt || "Analyze this image."
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: imageDataUrl,
                            detail: body.detail || "high"
                        }
                    }
                ]
            }
        ],
        max_tokens: body.max_tokens || 1500
    };
    // --- Call Azure OpenAI ---
    try {
        context.log(`Calling Azure OpenAI: ${deployment}`);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": apiKey
            },
            body: JSON.stringify(chatBody)
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            context.error(`Azure OpenAI error (${response.status}): ${errorText}`);
            return jsonResponse(502, {
                analysis: "",
                error: `Azure OpenAI returned ${response.status}: ${errorText}`
            });
        }
        const result = await response.json();
        if (result.error) {
            return jsonResponse(502, {
                analysis: "",
                error: `Azure OpenAI error: ${result.error.message || result.error.code || "Unknown"}`
            });
        }
        const content = result.choices?.[0]?.message?.content;
        if (!content) {
            return jsonResponse(502, {
                analysis: "",
                error: "Azure OpenAI returned no content"
            });
        }
        context.log(`Analysis complete (${content.length} chars)`);
        return jsonResponse(200, { analysis: content });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        context.error(`Fetch error: ${message}`);
        return jsonResponse(502, {
            analysis: "",
            error: `Failed to reach Azure OpenAI: ${message}`
        });
    }
}
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key"
    };
}
function jsonResponse(status, body) {
    return {
        status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders()
        },
        body: JSON.stringify(body)
    };
}
functions_1.app.http("analyze", {
    methods: ["POST", "OPTIONS"],
    authLevel: "anonymous",
    handler: analyzeHandler
});
//# sourceMappingURL=analyze.js.map