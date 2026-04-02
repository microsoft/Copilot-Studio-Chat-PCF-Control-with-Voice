/**
 * EntraAuthService - Handles Microsoft Entra ID authentication for Copilot Studio
 * 
 * This service implements the OAuth 2.0 Authorization Code flow with PKCE for 
 * authentication with Microsoft Entra ID. PKCE (Proof Key for Code Exchange) is
 * required for SPAs and provides enhanced security for mobile and web apps.
 * 
 * Mobile Support:
 * - Uses popup/redirect flow (no third-party cookies required)
 * - PKCE works on iOS Safari, Android Chrome, and all modern browsers
 * - Tokens persisted to localStorage for session continuity
 */

export interface EntraAuthConfig {
    clientId: string;
    tenantId: string;
    scope: string;
    botId: string;
    redirectUri?: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    id_token?: string;
    refresh_token?: string;  // Provided when offline_access scope is requested
}

export interface DirectLineTokenResponse {
    conversationId?: string;
    token: string;
    expires_in: number;
}

// Storage keys for token persistence
const STORAGE_KEY_ACCESS_TOKEN = 'entra_access_token';
const STORAGE_KEY_REFRESH_TOKEN = 'entra_refresh_token';
const STORAGE_KEY_TOKEN_EXPIRY = 'entra_token_expiry';
const STORAGE_KEY_USER_INFO = 'entra_user_info';
const STORAGE_KEY_CODE_VERIFIER = 'entra_code_verifier';

// In-memory PKCE storage (survives storage blocking but not page reload)
const pkceMemoryStore: Map<string, string> = new Map();

/**
 * Store PKCE code verifier with multiple fallback mechanisms
 * This handles browser tracking prevention that blocks localStorage/sessionStorage
 */
function storePkceVerifier(state: string, verifier: string): void {
    console.log('🔐 PKCE: Storing code verifier for state:', state.substring(0, 8) + '...');
    
    // 1. In-memory store (always works, but doesn't survive page reload)
    pkceMemoryStore.set(state, verifier);
    pkceMemoryStore.set('latest', verifier); // Also store as 'latest' for fallback
    
    // 2. window.name (survives navigation, not blocked by tracking prevention)
    try {
        const windowData = { pkce_verifier: verifier, pkce_state: state };
        window.name = JSON.stringify(windowData);
        console.log('🔐 PKCE: Stored in window.name');
    } catch (e) {
        console.warn('🔐 PKCE: window.name storage failed:', e);
    }
    
    // 3. localStorage (may be blocked by tracking prevention)
    try {
        localStorage.setItem(STORAGE_KEY_CODE_VERIFIER, verifier);
        localStorage.setItem(STORAGE_KEY_CODE_VERIFIER + '_state', state);
        console.log('🔐 PKCE: Stored in localStorage');
    } catch (e) {
        console.warn('🔐 PKCE: localStorage storage failed (tracking prevention?):', e);
    }
    
    // 4. sessionStorage (may also be blocked)
    try {
        sessionStorage.setItem(STORAGE_KEY_CODE_VERIFIER, verifier);
        sessionStorage.setItem(STORAGE_KEY_CODE_VERIFIER + '_state', state);
        console.log('🔐 PKCE: Stored in sessionStorage');
    } catch (e) {
        console.warn('🔐 PKCE: sessionStorage storage failed:', e);
    }
}

/**
 * Retrieve PKCE code verifier from any available storage
 */
function retrievePkceVerifier(state?: string): string | null {
    console.log('🔐 PKCE: Retrieving code verifier', state ? 'for state: ' + state.substring(0, 8) + '...' : '');
    
    // 1. Try in-memory store first (most reliable if same page context)
    if (state && pkceMemoryStore.has(state)) {
        console.log('🔐 PKCE: Found in memory store (by state)');
        return pkceMemoryStore.get(state)!;
    }
    if (pkceMemoryStore.has('latest')) {
        console.log('🔐 PKCE: Found in memory store (latest)');
        return pkceMemoryStore.get('latest')!;
    }
    
    // 2. Try window.name (survives navigation)
    try {
        if (window.name) {
            const windowData = JSON.parse(window.name);
            if (windowData.pkce_verifier) {
                // Optionally verify state matches
                if (!state || windowData.pkce_state === state) {
                    console.log('🔐 PKCE: Found in window.name');
                    return windowData.pkce_verifier;
                }
            }
        }
    } catch (e) {
        // window.name wasn't our JSON data
    }
    
    // 3. Try localStorage
    try {
        const verifier = localStorage.getItem(STORAGE_KEY_CODE_VERIFIER);
        if (verifier) {
            console.log('🔐 PKCE: Found in localStorage');
            return verifier;
        }
    } catch (e) {
        console.warn('🔐 PKCE: localStorage access blocked');
    }
    
    // 4. Try sessionStorage
    try {
        const verifier = sessionStorage.getItem(STORAGE_KEY_CODE_VERIFIER);
        if (verifier) {
            console.log('🔐 PKCE: Found in sessionStorage');
            return verifier;
        }
    } catch (e) {
        console.warn('🔐 PKCE: sessionStorage access blocked');
    }
    
    console.warn('🔐 PKCE: No code verifier found in any storage!');
    return null;
}

/**
 * Clear PKCE verifier from all storage locations
 */
function clearPkceVerifier(): void {
    pkceMemoryStore.clear();
    try { window.name = ''; } catch (e) { /* ignore */ }
    try { localStorage.removeItem(STORAGE_KEY_CODE_VERIFIER); localStorage.removeItem(STORAGE_KEY_CODE_VERIFIER + '_state'); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(STORAGE_KEY_CODE_VERIFIER); sessionStorage.removeItem(STORAGE_KEY_CODE_VERIFIER + '_state'); } catch (e) { /* ignore */ }
}

/**
 * Generate a cryptographically random code verifier for PKCE
 */
function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
}

/**
 * Generate code challenge from code verifier using SHA-256
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encode (no padding, URL-safe characters)
 */
function base64UrlEncode(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Service for Microsoft Entra ID authentication
 */
export class EntraAuthService {
    private config: EntraAuthConfig;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiry: Date | null = null;

    constructor(config: EntraAuthConfig) {
        this.config = config;
        // Load persisted tokens on initialization
        this.loadPersistedTokens();
    }

    /**
     * Load tokens from localStorage if they exist
     */
    private loadPersistedTokens(): void {
        try {
            const savedAccessToken = localStorage.getItem(STORAGE_KEY_ACCESS_TOKEN);
            const savedRefreshToken = localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN);
            const savedExpiry = localStorage.getItem(STORAGE_KEY_TOKEN_EXPIRY);

            if (savedAccessToken && savedExpiry) {
                this.accessToken = savedAccessToken;
                this.tokenExpiry = new Date(savedExpiry);
                console.log('🔐 Loaded persisted access token, expires:', this.tokenExpiry);
            }

            if (savedRefreshToken) {
                this.refreshToken = savedRefreshToken;
                console.log('🔐 Loaded persisted refresh token');
            }
        } catch (err) {
            console.warn('Failed to load persisted tokens:', err);
        }
    }

    /**
     * Save tokens to localStorage for session persistence
     */
    private persistTokens(): void {
        try {
            if (this.accessToken) {
                localStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, this.accessToken);
            }
            if (this.refreshToken) {
                localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, this.refreshToken);
            }
            if (this.tokenExpiry) {
                localStorage.setItem(STORAGE_KEY_TOKEN_EXPIRY, this.tokenExpiry.toISOString());
            }
            console.log('🔐 Tokens persisted to localStorage');
        } catch (err) {
            console.warn('Failed to persist tokens:', err);
        }
    }

    /**
     * Clear persisted tokens (for logout)
     */
    clearPersistedTokens(): void {
        localStorage.removeItem(STORAGE_KEY_ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEY_TOKEN_EXPIRY);
        localStorage.removeItem(STORAGE_KEY_USER_INFO);
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        console.log('🔐 Cleared persisted tokens');
    }

    /**
     * Get the authorization URL for OAuth redirect flow with PKCE
     * @param state - CSRF protection state parameter
     * @param codeChallenge - PKCE code challenge (S256 hashed)
     */
    getAuthorizationUrl(state: string, codeChallenge?: string): string {
        const scopeString = this.getScopeString();
        console.log('🔐 Auth scopes:', scopeString);
        console.log('🔐 PKCE enabled:', !!codeChallenge);
        
        // Use response_mode=fragment for Power Platform environments
        // Fragment (#code=...) is NOT sent to the server and NOT processed by PA routing,
        // avoiding "RouteNotFound" errors when the redirect URI is a PA player URL
        const isPowerPlatform = typeof window !== 'undefined' && (
            window.location.hostname.includes('.dynamics.com') ||
            window.location.hostname.includes('.powerapps.com') ||
            window.location.hostname.includes('.powerplatform.com') ||
            window.location.hostname.includes('powerplatformusercontent.com')
        );
        const responseMode = isPowerPlatform ? 'fragment' : 'query';
        console.log('🔐 Response mode:', responseMode, isPowerPlatform ? '(Power Platform detected)' : '');
        
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            response_type: 'code',
            redirect_uri: this.config.redirectUri || this.getDefaultRedirectUri(),
            scope: scopeString,
            response_mode: responseMode,
            state: state,
            prompt: 'select_account'
        });

        // Add PKCE parameters (required for SPA/mobile)
        if (codeChallenge) {
            params.append('code_challenge', codeChallenge);
            params.append('code_challenge_method', 'S256');
        }

        const authorityUrl = this.config.tenantId === 'common' || this.config.tenantId === 'organizations'
            ? `https://login.microsoftonline.com/${this.config.tenantId}`
            : `https://login.microsoftonline.com/${this.config.tenantId}`;

        return `${authorityUrl}/oauth2/v2.0/authorize?${params.toString()}`;
    }

    /**
     * Get the default redirect URI based on current location
     */
    private getDefaultRedirectUri(): string {
        if (typeof window === 'undefined') {
            return 'https://token.botframework.com/.auth/web/redirect';
        }
        
        const hostname = window.location.hostname;
        const origin = window.location.origin;
        
        // For local development (localhost), use the current origin
        if (hostname === 'localhost') {
            console.log('🔐 Using localhost redirect URI:', origin + '/');
            return origin + '/';
        }
        
        // For Power Platform environments, use the full current page URL (not just origin)
        // This ensures the redirect lands back on the same page and avoids PA router interference
        if (hostname.includes('.dynamics.com') ||
            hostname.includes('.powerapps.com') ||
            hostname.includes('.powerplatform.com') ||
            hostname.includes('.crm.dynamics.com') ||
            hostname.includes('powerplatformusercontent.com')) {
            // Use origin only - must match registered SPA redirect URI exactly
            console.log('🔐 Using Power Platform redirect URI:', origin);
            return origin;
        }
        
        // Fallback - try to use current origin if it looks like a web app
        if (window.location.protocol === 'https:') {
            console.log('🔐 Using current origin as redirect URI:', origin);
            return origin;
        }
        
        // Final fallback to Bot Framework token redirect  
        console.log('🔐 Using Bot Framework redirect URI');
        return 'https://token.botframework.com/.auth/web/redirect';
    }

    /**
     * Get the scope string for auth requests
     * Filters out api:// scopes that require exposed APIs
     */
    private getScopeString(): string {
        const standardScopes = 'openid profile offline_access';
        if (this.config.scope && 
            !this.config.scope.startsWith('api://') && 
            !this.config.scope.includes('.default')) {
            return `${this.config.scope} ${standardScopes}`;
        }
        return standardScopes;
    }

    /**
     * Exchange authorization code for tokens with PKCE
     * The code_verifier must match the code_challenge used during authorization
     */
    async exchangeCodeForToken(code: string, codeVerifier?: string): Promise<TokenResponse> {
        const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

        // Get state from URL for verifier lookup
        const urlParams = new URLSearchParams(window.location.search);
        const state = urlParams.get('state') || undefined;

        // Try to get code verifier from multiple storage mechanisms
        const verifier = codeVerifier || retrievePkceVerifier(state);
        
        if (!verifier) {
            console.error('🔐 No code verifier found - PKCE will fail');
            throw new Error('PKCE code verifier not found. Please try signing in again.');
        } else {
            console.log('🔐 Using PKCE code verifier for token exchange');
        }

        const params = new URLSearchParams({
            client_id: this.config.clientId,
            scope: this.getScopeString(),
            code: code,
            redirect_uri: this.config.redirectUri || this.getDefaultRedirectUri(),
            grant_type: 'authorization_code'
        });

        // Add code_verifier for PKCE (required for SPA)
        if (verifier) {
            params.append('code_verifier', verifier);
        }

        // Clear stored code verifier after use
        clearPkceVerifier();

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }

        const tokenResponse = await response.json() as TokenResponse;
        this.accessToken = tokenResponse.access_token;
        this.tokenExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000);
        
        // Store refresh token if provided (requires offline_access scope)
        if (tokenResponse.refresh_token) {
            this.refreshToken = tokenResponse.refresh_token;
            console.log('🔐 Refresh token acquired for session persistence');
        }

        // Persist tokens to localStorage
        this.persistTokens();

        return tokenResponse;
    }

    /**
     * Refresh the access token using the stored refresh token
     * Returns true if successful, false if re-authentication is needed
     */
    async refreshAccessToken(): Promise<boolean> {
        if (!this.refreshToken) {
            console.log('🔐 No refresh token available, re-authentication required');
            return false;
        }

        console.log('🔐 Attempting to refresh access token...');

        const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

        const params = new URLSearchParams({
            client_id: this.config.clientId,
            scope: this.getScopeString(),
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token'
        });

        try {
            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            if (!response.ok) {
                const error = await response.text();
                console.warn('🔐 Token refresh failed:', error);
                // Clear invalid tokens
                this.clearPersistedTokens();
                return false;
            }

            const tokenResponse = await response.json() as TokenResponse;
            this.accessToken = tokenResponse.access_token;
            this.tokenExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000);

            // Update refresh token if a new one was issued
            if (tokenResponse.refresh_token) {
                this.refreshToken = tokenResponse.refresh_token;
            }

            // Persist updated tokens
            this.persistTokens();

            console.log('✅ Access token refreshed successfully');
            return true;
        } catch (err) {
            console.error('🔐 Token refresh error:', err);
            return false;
        }
    }

    /**
     * Get Direct Line token for Copilot Studio bot using Entra authentication
     * For Copilot Studio, we use the regional token service with the bot ID
     */
    async getDirectLineToken(accessToken?: string): Promise<string> {
        const token = accessToken || this.accessToken;
        if (!token) {
            throw new Error('No access token available. User must authenticate first.');
        }

        const botId = this.config.botId;
        if (!botId) {
            throw new Error('Bot ID is required for Entra authentication with Copilot Studio');
        }

        console.log('🔐 Getting Direct Line token for Copilot Studio bot:', botId);

        // Try Copilot Studio regional token endpoints
        const regions = ['unitedstates', 'europe', 'asia', 'australia', 'japan', 'india', 'canada', 'brazil', 'france', 'switzerland', 'germany', 'norway', 'korea', 'uae', 'southafrica'];
        
        // First try the global endpoint
        const endpoints = [
            `https://powerva.microsoft.com/api/botmanagement/v1/directline/directlinetoken?botId=${botId}`,
            `https://defaultscus.api.powerva.microsoft.com/api/botmanagement/v1/directline/directlinetoken?botId=${botId}`,
            ...regions.map(r => `https://${r}.api.powerva.microsoft.com/api/botmanagement/v1/directline/directlinetoken?botId=${botId}`)
        ];

        let lastError = '';
        
        for (const endpoint of endpoints) {
            try {
                console.log('🔐 Trying Copilot Studio token endpoint:', endpoint.split('?')[0] + '...');
                
                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.token) {
                        console.log('✅ Copilot Studio Direct Line token acquired');
                        return data.token;
                    }
                    // Some endpoints return the token differently
                    if (data.directlineToken) {
                        console.log('✅ Copilot Studio Direct Line token acquired (directlineToken)');
                        return data.directlineToken;
                    }
                }

                lastError = await response.text();
                console.log('⚠️ Endpoint returned:', response.status, lastError.substring(0, 100));
            } catch (err) {
                lastError = err instanceof Error ? err.message : String(err);
                console.log('⚠️ Endpoint error:', lastError);
            }
        }

        // If Copilot Studio endpoints fail, try using the standard Direct Line endpoint
        // with the Entra token (in case bot is configured for AAD auth)
        console.log('🔐 Trying standard Direct Line endpoint with Bot Framework auth...');
        
        // For Azure Bot Service bots with AAD authentication, we need to:
        // 1. Get a token for the Bot Framework API
        // 2. Use that to generate a Direct Line token
        
        // Try the token exchange approach for Azure Bot Service
        const botServiceEndpoint = `https://directline.botframework.com/v3/directline/tokens/generate`;
        
        try {
            const response = await fetch(botServiceEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user: {
                        id: `entra-user-${Date.now()}`,
                        name: 'Authenticated User'
                    },
                    trustedOrigins: [window.location.origin]
                })
            });

            if (response.ok) {
                const data = await response.json() as DirectLineTokenResponse;
                console.log('✅ Direct Line token acquired via Bot Framework');
                return data.token;
            }
            
            lastError = await response.text();
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
        }

        // All attempts failed
        throw new Error(`Failed to get Direct Line token. Last error: ${lastError}\n\nNote: For Copilot Studio with Entra auth, ensure:\n1. Bot ID is correct\n2. Authentication is configured in Copilot Studio\n3. The Entra app has the required API permissions`);
    }

    /**
     * Check if the current token is valid (not expired)
     */
    isTokenValid(): boolean {
        if (!this.accessToken || !this.tokenExpiry) {
            return false;
        }
        // Add 5 minute buffer before expiry
        return this.tokenExpiry.getTime() - Date.now() > 5 * 60 * 1000;
    }

    /**
     * Check if we have a refresh token for silent renewal
     */
    hasRefreshToken(): boolean {
        return !!this.refreshToken;
    }

    /**
     * Check if we can authenticate without user interaction
     * (either valid token or can refresh)
     */
    canSilentAuth(): boolean {
        return this.isTokenValid() || this.hasRefreshToken();
    }

    /**
     * Try to get a valid access token, refreshing if necessary
     * Returns null if re-authentication is needed
     */
    async getValidAccessToken(): Promise<string | null> {
        // If current token is valid, return it
        if (this.isTokenValid()) {
            return this.accessToken;
        }

        // Try to refresh
        if (this.refreshToken) {
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
                return this.accessToken;
            }
        }

        // No valid token and can't refresh
        return null;
    }

    /**
     * Get the current access token if valid (without refresh attempt)
     */
    getAccessToken(): string | null {
        if (this.isTokenValid()) {
            return this.accessToken;
        }
        return null;
    }

    /**
     * Store token from URL hash (for implicit flow) or query params (for auth code flow)
     * This handles the callback from the OAuth redirect
     */
    handleAuthCallback(): { token?: string; code?: string; error?: string } {
        const hash = window.location.hash.substring(1);
        const query = window.location.search.substring(1);

        // Try hash first (implicit flow)
        if (hash) {
            const hashParams = new URLSearchParams(hash);
            const accessToken = hashParams.get('access_token');
            const error = hashParams.get('error');

            if (error) {
                return { error: hashParams.get('error_description') || error };
            }

            if (accessToken) {
                this.accessToken = accessToken;
                const expiresIn = parseInt(hashParams.get('expires_in') || '3600', 10);
                this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
                
                // Persist the token for session persistence
                this.persistTokens();
                
                // Clean the URL
                window.history.replaceState({}, document.title, window.location.pathname);
                return { token: accessToken };
            }
        }

        // Try query params (auth code flow)
        if (query) {
            const queryParams = new URLSearchParams(query);
            const code = queryParams.get('code');
            const error = queryParams.get('error');

            if (error) {
                return { error: queryParams.get('error_description') || error };
            }

            if (code) {
                // Clean the URL
                window.history.replaceState({}, document.title, window.location.pathname);
                return { code };
            }
        }

        return {};
    }

    /**
     * Initiate authentication by redirecting to Microsoft login with PKCE
     * Works on iOS Safari, Android Chrome, and all modern browsers
     */
    async initiateAuth(): Promise<void> {
        const state = this.generateState();
        try {
            localStorage.setItem('entra_auth_state', state);
        } catch (e) {
            console.warn('🔐 Could not store state in localStorage');
        }
        
        // Generate PKCE code verifier and challenge
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        
        // Store code verifier using multi-fallback storage (handles tracking prevention)
        storePkceVerifier(state, codeVerifier);
        
        const authUrl = this.getAuthorizationUrl(state, codeChallenge);
        window.location.href = authUrl;
    }

    /**
     * Open authentication in a popup window with PKCE
     * Better for mobile with cookie restrictions (iOS Safari, Android Chrome)
     * 
     * Note: This uses a message-based approach for cross-origin communication
     */
    async initiateAuthPopup(): Promise<string> {
        // Generate state first so we can key the verifier by it
        const state = this.generateState();
        
        // Generate PKCE code verifier and challenge BEFORE opening popup
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        
        // Store code verifier using multi-fallback storage (handles tracking prevention)
        storePkceVerifier(state, codeVerifier);

        return new Promise((resolve, reject) => {
            try {
                localStorage.setItem('entra_auth_state', state);
                localStorage.setItem('entra_auth_origin', window.location.origin);
            } catch (e) {
                console.warn('🔐 Could not store state in localStorage (tracking prevention?)');
            }
            
            const redirectUri = this.config.redirectUri || this.getDefaultRedirectUri();
            const authUrl = this.getAuthorizationUrl(state, codeChallenge);
            
            console.log('🔐 Auth configuration:');
            console.log('🔐   Current origin:', window.location.origin);
            console.log('🔐   Redirect URI:', redirectUri);
            console.log('🔐   Auth URL:', authUrl.substring(0, 100) + '...');

            const width = 500;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            console.log('🔐 Opening auth popup...');
            const popup = window.open(
                authUrl,
                'EntraAuth',
                `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=yes`
            );

            if (!popup) {
                console.error('🔐 Popup blocked!');
                reject(new Error('Failed to open authentication popup. Please allow popups and try again.'));
                return;
            }

            console.log('🔐 Popup opened, starting poll...');
            let pollCount = 0;
            const maxPolls = 1500; // 5 minutes at 200ms intervals
            
            console.log('🔐 Polling every 200ms for auth code in popup URL (query or fragment)...');

            // Poll for the popup to return with the code
            const pollInterval = setInterval(() => {
                pollCount++;
                
                try {
                    // Check if popup was closed by user
                    if (popup.closed) {
                        console.log('🔐 Popup was closed');
                        clearInterval(pollInterval);
                        
                        // Check if code was saved (from redirect handling)
                        const savedCode = localStorage.getItem('entra_pending_code');
                        if (savedCode) {
                            console.log('🔐 Found saved code from popup redirect');
                            localStorage.removeItem('entra_pending_code');
                            resolve(savedCode);
                        } else {
                            reject(new Error('Authentication was cancelled or failed'));
                        }
                        return;
                    }

                    // Try to read popup location (will throw if cross-origin)
                    const popupUrl = popup.location.href;
                    
                    // Check if the URL contains an auth code in EITHER query params (?code=)
                    // or hash fragment (#code=). We use response_mode=fragment for Power Platform
                    // to avoid PA router interference, but also check query for fallback.
                    if (popupUrl && (popupUrl.includes('code=') || popupUrl.includes('error='))) {
                        console.log('🔐 Popup URL contains auth response:', popupUrl.substring(0, 150) + '...');
                        
                        const url = new URL(popupUrl);
                        
                        // Try query params first (?code=), then hash fragment (#code=)
                        let code = url.searchParams.get('code');
                        let error = url.searchParams.get('error');
                        let returnedState = url.searchParams.get('state');
                        let errorDesc = url.searchParams.get('error_description');
                        
                        // Check hash fragment if not found in query params
                        if (!code && !error && url.hash) {
                            const hashParams = new URLSearchParams(url.hash.substring(1));
                            code = hashParams.get('code');
                            error = hashParams.get('error');
                            returnedState = hashParams.get('state');
                            errorDesc = hashParams.get('error_description');
                            if (code || error) {
                                console.log('🔐 Found auth response in hash fragment');
                            }
                        }

                        clearInterval(pollInterval);
                        popup.close();

                        if (error) {
                            console.error('🔐 Auth error:', errorDesc || error);
                            reject(new Error(errorDesc || error));
                        } else if (code) {
                            // Validate state
                            const savedState = localStorage.getItem('entra_auth_state');
                            if (returnedState !== savedState) {
                                console.warn('🔐 State mismatch, but proceeding (may be valid)');
                            }
                            console.log('✅ Got authorization code from popup');
                            resolve(code);
                        } else {
                            reject(new Error('No authorization code in redirect'));
                        }
                    }
                } catch (e) {
                    // Cross-origin error - popup is still on login.microsoftonline.com
                    // This is expected, just continue polling
                    if (pollCount % 10 === 0) {
                        console.log('🔐 Still waiting for popup... (poll #' + pollCount + ')');
                    }
                }

                // Timeout check
                if (pollCount >= maxPolls) {
                    console.error('🔐 Popup timeout');
                    clearInterval(pollInterval);
                    if (!popup.closed) {
                        popup.close();
                    }
                    reject(new Error('Authentication timed out'));
                }
            }, 200);
        });
    }

    /**
     * Generate a random state parameter for CSRF protection
     */
    private generateState(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Validate that the returned state matches what we sent
     */
    validateState(returnedState: string): boolean {
        const savedState = localStorage.getItem('entra_auth_state');
        localStorage.removeItem('entra_auth_state');
        return savedState === returnedState;
    }
}

/**
 * Create an EntraAuthService instance from PCF properties
 */
export function createEntraAuthService(
    clientId: string,
    tenantId: string,
    scope: string,
    botId: string
): EntraAuthService {
    return new EntraAuthService({
        clientId,
        tenantId,
        scope,
        botId
    });
}
