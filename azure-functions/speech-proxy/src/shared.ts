/**
 * Speech Proxy - Shared utilities for CORS and authentication.
 *
 * Uses DefaultAzureCredential for managed identity auth to Azure Cognitive Services.
 * Same pattern as narrator.py and the translation service (translationservicesbw).
 */

import { DefaultAzureCredential } from "@azure/identity";

// Singleton credential — DefaultAzureCredential tries managed identity first,
// then falls back to Azure CLI, environment variables, etc.
// Eagerly created so the credential provider chain is resolved at startup.
const credential = new DefaultAzureCredential();

// Token cache to avoid fetching a new Entra ID token on every request
let cachedToken: { token: string; expiry: number } | null = null;

/**
 * Get a Bearer token for Azure Cognitive Services using managed identity.
 * Tokens are cached and refreshed 5 minutes before expiry.
 */
export async function getCognitiveServicesToken(): Promise<string> {
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
getCognitiveServicesToken().catch(() => { /* swallow — will retry on first request */ });

// CORS helpers (same pattern as vision-proxy)
export function corsHeaders(): Record<string, string> {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key"
    };
}

export function jsonResponse(status: number, body: object) {
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
export function validateApiKey(providedKey: string | null): ReturnType<typeof jsonResponse> | null {
    const expectedKey = process.env.FUNCTION_API_KEY;

    if (!expectedKey) {
        return jsonResponse(500, { error: "Server misconfigured: missing FUNCTION_API_KEY" });
    }

    if (providedKey !== expectedKey) {
        return jsonResponse(401, { error: "Unauthorized: invalid or missing x-api-key" });
    }

    return null; // valid
}
