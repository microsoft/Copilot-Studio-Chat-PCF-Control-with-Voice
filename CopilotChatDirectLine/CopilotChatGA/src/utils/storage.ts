/**
 * Storage utility for persisting chat state and settings
 */

// Storage keys for localStorage
const STORAGE_KEYS = {
    SETTINGS: 'copilot_chat_settings',
    MESSAGES: 'copilot_chat_messages',
    CONVERSATION: 'copilot_chat_conversation'
};

// Settings interface
export interface ChatSettings {
    isMuted: boolean;
    voiceProfile: string;
    audioUnlocked: boolean;
    thinkingSoundEnabled: boolean;
}

// Stored message interface (with serialized dates)
export interface StoredMessage {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: string;
    speakText?: string;
    adaptiveCard?: unknown;
    isSignInCard?: boolean;
    signInUrl?: string;
}

// Conversation state interface
export interface ConversationState {
    conversationId: string;
    watermark: string | null;
    savedAt: number;
}

// Default settings
const DEFAULT_SETTINGS: ChatSettings = {
    isMuted: false,
    voiceProfile: 'openai-echo', // Default to OpenAI Echo - Warm, conversational
    audioUnlocked: false,
    thinkingSoundEnabled: true // Default to ON
};

// Conversation expiration time (30 minutes) - DirectLine tokens typically last longer,
// but bot context may expire sooner
const CONVERSATION_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: ChatSettings): void {
    try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        console.log('💾 Settings saved:', settings);
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

/**
 * Load settings from localStorage
 */
export function loadSettings(): ChatSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (stored) {
            const settings = JSON.parse(stored) as Partial<ChatSettings>;
            console.log('📂 Settings loaded:', settings);
            return { ...DEFAULT_SETTINGS, ...settings };
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    return DEFAULT_SETTINGS;
}

/**
 * Save messages to localStorage
 */
export function saveMessages(messages: StoredMessage[]): void {
    try {
        // Only keep last 100 messages to avoid storage limits
        const messagesToSave = messages.slice(-100);
        localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messagesToSave));
        console.log('💾 Messages saved:', messagesToSave.length, 'messages');
    } catch (error) {
        console.error('Failed to save messages:', error);
    }
}

/**
 * Load messages from localStorage
 */
export function loadMessages(): StoredMessage[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
        if (stored) {
            const messages = JSON.parse(stored) as StoredMessage[];
            console.log('📂 Messages loaded:', messages.length, 'messages');
            return messages;
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
    return [];
}

/**
 * Clear saved messages (e.g., when starting new chat)
 */
export function clearMessages(): void {
    try {
        localStorage.removeItem(STORAGE_KEYS.MESSAGES);
        console.log('🗑️ Messages cleared');
    } catch (error) {
        console.error('Failed to clear messages:', error);
    }
}

/**
 * Save conversation state for reconnection
 */
export function saveConversationState(conversationId: string, watermark: string | null): void {
    try {
        const state: ConversationState = {
            conversationId,
            watermark,
            savedAt: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.CONVERSATION, JSON.stringify(state));
        console.log('💾 Conversation state saved:', conversationId);
    } catch (error) {
        console.error('Failed to save conversation state:', error);
    }
}

/**
 * Load conversation state if still valid (not expired)
 */
export function loadConversationState(): ConversationState | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATION);
        if (stored) {
            const state = JSON.parse(stored) as ConversationState;
            // Check if conversation is still valid (not expired)
            const age = Date.now() - state.savedAt;
            if (age < CONVERSATION_EXPIRY_MS) {
                console.log('📂 Conversation state loaded:', state.conversationId, `(${Math.round(age / 1000 / 60)} minutes old)`);
                return state;
            } else {
                console.log('⏰ Conversation expired, clearing state');
                clearConversationState();
            }
        }
    } catch (error) {
        console.error('Failed to load conversation state:', error);
    }
    return null;
}

/**
 * Clear conversation state (e.g., when starting new chat or on error)
 */
export function clearConversationState(): void {
    try {
        localStorage.removeItem(STORAGE_KEYS.CONVERSATION);
        console.log('🗑️ Conversation state cleared');
    } catch (error) {
        console.error('Failed to clear conversation state:', error);
    }
}

/**
 * Clear all stored data (full reset)
 */
export function clearAllStorage(): void {
    clearMessages();
    clearConversationState();
    // Note: Not clearing settings - user would need to explicitly reset those
    console.log('🗑️ All chat storage cleared (settings preserved)');
}
