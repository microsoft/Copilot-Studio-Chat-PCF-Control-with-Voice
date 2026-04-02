"use strict";
/**
 * Speech Proxy - Shared utilities for CORS and authentication.
 *
 * Uses DefaultAzureCredential for managed identity auth to Azure Cognitive Services.
 * Same pattern as narrator.py and the translation service (translationservicesbw).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCognitiveServicesToken = getCognitiveServicesToken;
exports.corsHeaders = corsHeaders;
exports.jsonResponse = jsonResponse;
exports.validateApiKey = validateApiKey;
const identity_1 = require("@azure/identity");
// Singleton credential — DefaultAzureCredential tries managed identity first,
// then falls back to Azure CLI, environment variables, etc.
// Eagerly created so the credential provider chain is resolved at startup.
const credential = new identity_1.DefaultAzureCredential();
// Token cache to avoid fetching a new Entra ID token on every request
let cachedToken = null;
/**
 * Get a Bearer token for Azure Cognitive Services using managed identity.
 * Tokens are cached and refreshed 5 minutes before expiry.
 */
async function getCognitiveServicesToken() {
    const now = Date.now();
    if (cachedToken && now < cachedToken.expiry) {
        return cachedToken.token;
    }
    const tokenResponse = await credential.getToken("https://cognitiveservices.azure.com/.default");
    cachedToken = {
        token: tokenResponse.token,
        expiry: tokenResponse.expiresOnTimestamp - 5 * 60 * 1000 // refresh 5 min early
    };
    return cachedToken.token;
}
// Pre-warm: fetch token at startup so the first request doesn't wait
getCognitiveServicesToken().catch(() => { });
// CORS helpers (same pattern as vision-proxy)
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
/**
 * Validate the function API key from the x-api-key header.
 * Returns null if valid, or an error response if invalid.
 */
function validateApiKey(providedKey) {
    const expectedKey = process.env.FUNCTION_API_KEY;
    if (!expectedKey) {
        return jsonResponse(500, { error: "Server misconfigured: missing FUNCTION_API_KEY" });
    }
    if (providedKey !== expectedKey) {
        return jsonResponse(401, { error: "Unauthorized: invalid or missing x-api-key" });
    }
    return null; // valid
}
//# sourceMappingURL=shared.js.map