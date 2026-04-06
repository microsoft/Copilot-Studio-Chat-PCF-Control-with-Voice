/**
 * Direct Line attachment interface
 */
export interface DirectLineAttachment {
    contentType: string;
    contentUrl: string;
    name: string;
}

/**
 * User context for authenticated users
 */
export interface AuthenticatedUserContext {
    id: string;
    name?: string;
    aadToken?: string;  // Entra ID access token for bot validation
}

/**
 * Direct Line activity interface
 */
export interface Activity {
    id?: string;
    type: string;
    from: { id: string; name?: string };
    text?: string;
    timestamp?: string;
    attachments?: Array<{
        contentType: string;
        content?: {
            buttons?: Array<{ value: string }>;
            body?: Array<{ text?: string }>;
            speak?: string;
        };
    }>;
    membersAdded?: Array<{ id: string }>;
    channelData?: {
        silentGreeting?: boolean;
        // Entra auth token for bot to validate user identity
        aadToken?: string;
        // User info
        userInfo?: {
            id: string;
            name?: string;
            email?: string;
        };
    };
}

/**
 * State change callback type
 */
type StateChangeCallback = (conversationId: string, watermark: string | null) => void;

/**
 * Service for communicating with Copilot via Direct Line
 */
export class CopilotChatService {
    private secret: string;
    private baseUrl: string;
    private conversationId: string | null = null;
    private watermark: string | null = null;
    private onStateChange: StateChangeCallback | null = null;
    private userContext: AuthenticatedUserContext | null = null;

    constructor(secret: string, endpoint?: string, userContext?: AuthenticatedUserContext) {
        this.secret = secret;
        this.baseUrl = endpoint || 'https://directline.botframework.com/v3/directline';
        this.userContext = userContext || null;
        
        if (userContext) {
            console.log('🔐 CopilotChatService initialized with authenticated user:', userContext.id);
        }
    }

    /**
     * Set or update the authenticated user context
     */
    setUserContext(context: AuthenticatedUserContext): void {
        this.userContext = context;
        console.log('🔐 User context updated:', context.id);
    }

    /**
     * Get the user ID (authenticated or anonymous)
     */
    private getUserId(): string {
        return this.userContext?.id || 'user';
    }

    /**
     * Get the user name if available
     */
    private getUserName(): string | undefined {
        return this.userContext?.name;
    }

    /**
     * Build channelData including auth token if available
     */
    private buildChannelData(additionalData?: Record<string, unknown>): Record<string, unknown> | undefined {
        const channelData: Record<string, unknown> = { ...additionalData };
        
        // Include Entra token for bot to validate user identity
        if (this.userContext?.aadToken) {
            channelData.aadToken = this.userContext.aadToken;
            channelData.userInfo = {
                id: this.userContext.id,
                name: this.userContext.name
            };
        }
        
        // Only return if we have data
        return Object.keys(channelData).length > 0 ? channelData : undefined;
    }

    /**
     * Set callback for conversation state changes (for persistence)
     */
    setStateChangeCallback(callback: StateChangeCallback): void {
        this.onStateChange = callback;
    }

    /**
     * Get current conversation ID
     */
    getConversationId(): string | null {
        return this.conversationId;
    }

    /**
     * Get current watermark
     */
    getWatermark(): string | null {
        return this.watermark;
    }

    /**
     * Try to reconnect to an existing conversation
     * Returns true if reconnection successful, false if we need to start fresh
     */
    async reconnectConversation(conversationId: string, watermark: string | null): Promise<boolean> {
        console.log('🔄 Attempting to reconnect to conversation:', conversationId);
        try {
            // Try to get messages from the existing conversation
            const url = watermark
                ? `${this.baseUrl}/conversations/${conversationId}/activities?watermark=${watermark}`
                : `${this.baseUrl}/conversations/${conversationId}/activities`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.secret}`
                }
            });

            if (response.ok) {
                // Conversation is still valid
                this.conversationId = conversationId;
                this.watermark = watermark;
                console.log('✅ Reconnected to existing conversation successfully');
                return true;
            } else if (response.status === 403 || response.status === 404) {
                // Conversation expired or not found
                console.log('⚠️ Conversation expired or not found, will start new');
                return false;
            } else {
                console.error('❌ Reconnection failed:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('❌ Reconnection error:', error);
            return false;
        }
    }

    /**
     * Start a new conversation
     */
    async startConversation(): Promise<string> {
        const response = await fetch(`${this.baseUrl}/conversations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.secret}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to start conversation: ${response.statusText}`);
        }

        const data = await response.json() as { conversationId: string };
        this.conversationId = data.conversationId;

        // If we have an authenticated user with Entra token, proactively send it
        // This enables SSO before the bot even asks for authentication
        if (this.userContext?.aadToken) {
            await this.sendProactiveAuth();
        }

        // Notify about new conversation state
        if (this.onStateChange) {
            this.onStateChange(this.conversationId, this.watermark);
        }

        return this.conversationId;
    }

    /**
     * Proactively send authentication info to the bot
     * This prevents the bot from showing OAuth prompts
     */
    private async sendProactiveAuth(): Promise<void> {
        if (!this.conversationId || !this.userContext?.aadToken) {
            return;
        }

        console.log('🔐 Sending proactive authentication to bot...');

        // Send an event activity with user authentication info
        // This tells Copilot Studio that the user is already authenticated
        const authActivity = {
            type: 'event',
            name: 'tokens/response',
            from: { id: this.getUserId(), name: this.getUserName() },
            value: {
                token: this.userContext.aadToken
            },
            channelData: {
                aadToken: this.userContext.aadToken,
                userInfo: {
                    id: this.userContext.id,
                    name: this.userContext.name
                }
            }
        };

        try {
            const response = await fetch(
                `${this.baseUrl}/conversations/${this.conversationId}/activities`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.secret}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(authActivity)
                }
            );

            if (response.ok) {
                console.log('✅ Proactive auth sent successfully');
            } else {
                const errorText = await response.text();
                console.warn('⚠️ Proactive auth response:', response.status, errorText);
                // Not a fatal error - we'll still handle OAuthCards reactively
            }
        } catch (error) {
            console.warn('⚠️ Proactive auth failed:', error);
            // Not a fatal error - we'll still handle OAuthCards reactively
        }
    }

    /**
     * Send a text message
     */
    async sendMessage(text: string): Promise<void> {
        if (!this.conversationId) {
            throw new Error('Conversation not started');
        }

        const activity: Activity = {
            type: 'message',
            from: { id: this.getUserId(), name: this.getUserName() },
            text: text,
            channelData: this.buildChannelData()
        };

        const response = await fetch(
            `${this.baseUrl}/conversations/${this.conversationId}/activities`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.secret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(activity)
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`);
        }
    }

    /**
     * Send a message with attachments (images, documents)
     */
    async sendMessageWithAttachments(text: string, attachments: DirectLineAttachment[]): Promise<void> {
        if (!this.conversationId) {
            throw new Error('Conversation not started');
        }

        console.log(`📎 Sending message with ${attachments.length} attachment(s)`);

        const activity = {
            type: 'message',
            from: { id: this.getUserId(), name: this.getUserName() },
            text: text || `Attached ${attachments.length} file(s)`,
            attachments: attachments.map(a => ({
                contentType: a.contentType,
                contentUrl: a.contentUrl,
                name: a.name
            })),
            channelData: this.buildChannelData()
        };

        console.log('📤 Activity payload:', {
            type: activity.type,
            text: activity.text,
            attachmentCount: activity.attachments?.length,
            attachmentNames: activity.attachments?.map(a => a.name)
        });

        const response = await fetch(
            `${this.baseUrl}/conversations/${this.conversationId}/activities`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.secret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(activity)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Failed to send message with attachments:', response.status, errorText);
            throw new Error(`Failed to send message with attachments: ${response.statusText}`);
        }

        console.log('✅ Message with attachments sent successfully');
    }

    /**
     * Trigger conversation start - sends conversationUpdate to wake bot
     */
    async triggerConversationStart(): Promise<void> {
        if (!this.conversationId) {
            throw new Error('Conversation not started');
        }

        // Try conversationUpdate first (standard pattern)
        console.log('🤖 Attempt 1: Sending conversationUpdate to wake bot...');
        const conversationUpdateActivity: Activity = {
            type: 'conversationUpdate',
            from: { id: 'user' },
            membersAdded: [{ id: 'user' }]
        };

        try {
            const response = await fetch(
                `${this.baseUrl}/conversations/${this.conversationId}/activities`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.secret}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(conversationUpdateActivity)
                }
            );

            if (response.ok) {
                console.log('✅ ConversationUpdate sent - waiting 2 seconds for bot response...');
                // Wait 2 seconds to see if bot responds
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Check if we got any messages
                const checkResponse = await fetch(
                    `${this.baseUrl}/conversations/${this.conversationId}/activities`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.secret}`
                        }
                    }
                );

                if (checkResponse.ok) {
                    const data = await checkResponse.json() as { activities?: Activity[] };
                    const botMessages = data.activities?.filter(
                        a => a.from.id !== 'user' && a.type === 'message'
                    ) || [];
                    if (botMessages.length > 0) {
                        console.log('✅ Bot responded to conversationUpdate!');
                        return;
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ ConversationUpdate failed or no response:', error);
        }

        // Fallback: Send hidden "Hi" message
        console.log('🔄 Attempt 2: Sending hidden greeting message...');
        const hiddenMessageActivity: Activity = {
            type: 'message',
            from: { id: 'user' },
            text: 'Hi',
            channelData: { silentGreeting: true }
        };

        const fallbackResponse = await fetch(
            `${this.baseUrl}/conversations/${this.conversationId}/activities`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.secret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(hiddenMessageActivity)
            }
        );

        if (!fallbackResponse.ok) {
            const errorText = await fallbackResponse.text();
            console.error('❌ Hidden greeting message failed:', fallbackResponse.status, errorText);
            throw new Error(`Failed to send greeting: ${fallbackResponse.statusText}`);
        }

        console.log('✅ Hidden greeting message sent - bot should respond shortly');
    }

    /**
     * Get messages from the conversation
     */
    async getMessages(): Promise<Activity[]> {
        if (!this.conversationId) {
            throw new Error('Conversation not started');
        }

        const url = this.watermark
            ? `${this.baseUrl}/conversations/${this.conversationId}/activities?watermark=${this.watermark}`
            : `${this.baseUrl}/conversations/${this.conversationId}/activities`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.secret}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to get messages: ${response.statusText}`);
        }

        const data = await response.json() as { activities: Activity[]; watermark: string };

        console.log('📨 Direct Line Response:', {
            oldWatermark: this.watermark,
            newWatermark: data.watermark,
            activityCount: data.activities.length,
            conversationId: this.conversationId
        });

        this.watermark = data.watermark;

        // Notify about watermark change for persistence
        if (this.onStateChange && this.conversationId) {
            this.onStateChange(this.conversationId, this.watermark);
        }

        // Check for OAuthCard and handle SSO token exchange
        await this.handleOAuthCards(data.activities);

        console.log('All activities from Direct Line:', data.activities);
        console.log('Activity details:', data.activities.map(a => ({
            id: a.id,
            type: a.type,
            from: a.from.id,
            text: a.text,
            attachments: a.attachments?.map(att => att.contentType)
        })));

        // Filter to only bot messages (not from user, and type is message)
        // Also filter out silent greeting messages and OAuthCard prompts (we handle those automatically)
        const filtered = data.activities.filter(activity => {
            // Skip user messages
            if (activity.from.id === 'user') {
                return false;
            }
            // Skip non-message types
            if (activity.type !== 'message') {
                return false;
            }
            // Skip silent greeting trigger messages (shouldn't appear but filter just in case)
            if (activity.channelData?.silentGreeting) {
                console.log('🤫 Filtering out silent greeting message');
                return false;
            }
            // Skip OAuthCard messages if we have a token (we're handling auth automatically)
            if (this.userContext?.aadToken && this.hasOAuthCard(activity)) {
                console.log('🔐 Filtering out OAuthCard (handled via SSO)');
                return false;
            }
            return true;
        });

        console.log('Filtered bot messages:', filtered.length);
        console.log('Filtered details:', filtered.map(a => ({
            id: a.id,
            text: a.text,
            hasAttachments: !!a.attachments && a.attachments.length > 0
        })));

        return filtered;
    }

    /**
     * Check if an activity contains an OAuthCard
     */
    private hasOAuthCard(activity: Activity): boolean {
        return activity.attachments?.some(
            att => att.contentType === 'application/vnd.microsoft.card.oauth'
        ) || false;
    }

    /**
     * Handle OAuthCard sign-in prompts by automatically sending our token
     * This enables SSO - the bot won't show a sign-in prompt to the user
     */
    private async handleOAuthCards(activities: Activity[]): Promise<void> {
        if (!this.userContext?.aadToken) {
            // No token available, let the bot show its sign-in card
            console.log('🔐 No Entra token available for SSO');
            return;
        }

        for (const activity of activities) {
            if (activity.type !== 'message' || !activity.attachments) continue;

            for (const attachment of activity.attachments) {
                if (attachment.contentType === 'application/vnd.microsoft.card.oauth') {
                    console.log('🔐 OAuthCard detected! Full content:', JSON.stringify(attachment.content, null, 2));
                    
                    // Extract connection name from the OAuthCard - may be in different locations
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const oauthCard = attachment.content as any;
                    const connectionName = oauthCard?.connectionName || 
                                          oauthCard?.name ||
                                          oauthCard?.buttons?.[0]?.value?.split('|')?.[0] ||
                                          'default';  // Fallback for Copilot Studio

                    console.log('🔐 Using connectionName:', connectionName);
                    await this.sendTokenExchange(connectionName, activity.id);
                }
            }
        }
    }

    /**
     * Send a token exchange invoke to provide our Entra token to the bot
     * This completes the SSO flow - bot receives our token without prompting user
     */
    private async sendTokenExchange(connectionName: string, replyToId?: string): Promise<void> {
        if (!this.conversationId || !this.userContext?.aadToken) {
            return;
        }

        console.log('🔐 Sending token exchange invoke for connection:', connectionName);

        const invokeActivity = {
            type: 'invoke',
            name: 'signin/tokenExchange',
            from: { id: this.getUserId(), name: this.getUserName() },
            value: {
                id: `token-exchange-${Date.now()}`,
                connectionName: connectionName,
                token: this.userContext.aadToken
            },
            replyToId: replyToId
        };

        try {
            const response = await fetch(
                `${this.baseUrl}/conversations/${this.conversationId}/activities`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.secret}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(invokeActivity)
                }
            );

            if (response.ok) {
                console.log('✅ Token exchange sent successfully - SSO complete');
            } else {
                const errorText = await response.text();
                console.warn('⚠️ Token exchange failed:', response.status, errorText);
            }
        } catch (error) {
            console.error('❌ Token exchange error:', error);
        }
    }
}
