/**
 * Authentication utilities for Direct Line
 */

/**
 * Get a Direct Line token from the secret.
 * In production, you might want to exchange the secret for a token on the server.
 * @param secret - The Direct Line secret
 * @returns The token (in this implementation, returns the secret directly)
 */
export async function getDirectLineToken(secret: string): Promise<string> {
    // For Direct Line, we simply return the secret
    // In production, you might want to exchange the secret for a token on the server
    return secret;
}
