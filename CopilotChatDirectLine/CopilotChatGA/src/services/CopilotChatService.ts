/**
 * Direct Line attachment interface
 */
export interface DirectLineAttachment {
    contentType: string;
    contentUrl: string;
    name: string;
}

/**
 * Direct Line activity interface
 */
export interface Activity {
    id?: string;
    type: string;
    from: { id: string };
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

    constructor(secret: string, endpoint?: string) {
        this.secret = secret;
        this.baseUrl = endpoint || 'https://directline.botframework.com/v3/directline';
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

        // Notify about new conversation state
        if (this.onStateChange) {
            this.onStateChange(this.conversationId, this.watermark);
        }

        return this.conversationId;
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
            from: { id: 'user' },
            text: text
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
            from: { id: 'user' },
            text: text || `Attached ${attachments.length} file(s)`,
            attachments: attachments.map(a => ({
                contentType: a.contentType,
                contentUrl: a.contentUrl,
                name: a.name
            }))
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

        console.log('All activities from Direct Line:', data.activities);
        console.log('Activity details:', data.activities.map(a => ({
            id: a.id,
            type: a.type,
            from: a.from.id,
            text: a.text,
            attachments: a.attachments?.map(att => att.contentType)
        })));

        // Filter to only bot messages (not from user, and type is message)
        // Also filter out silent greeting messages
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
}
