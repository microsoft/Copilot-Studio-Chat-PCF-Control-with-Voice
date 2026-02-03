/**
 * Control - Main entry point component for the PCF control
 */

import React from 'react';
import { getDirectLineToken } from './utils/auth';
import { CopilotChatService } from './services/CopilotChatService';
import ChatWindow from './ChatWindow';
import {
    saveConversationState,
    loadConversationState,
    clearConversationState
} from './utils/storage';

// PCF Property interface
interface PropertyValue<T> {
    raw: T;
}

export interface ControlProps {
    DirectLineSecret?: PropertyValue<string>;
    DirectLineEndpoint?: PropertyValue<string>;
    SpeechKey?: PropertyValue<string>;
    SpeechRegion?: PropertyValue<string>;
    OpenAIEndpoint?: PropertyValue<string>;
    OpenAIKey?: PropertyValue<string>;
    OpenAIDeployment?: PropertyValue<string>;
    ModalTitle?: PropertyValue<string>;
    EnableAttachments?: PropertyValue<boolean>;
    AttachmentIcon?: PropertyValue<string>;
}

const ChatDirectLineControl: React.FC<ControlProps> = (props) => {
    const [chatService, setChatService] = React.useState<CopilotChatService | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isInitializing, setIsInitializing] = React.useState(true);
    const [isReconnected, setIsReconnected] = React.useState(false);

    React.useEffect(() => {
        const initializeChat = async (): Promise<void> => {
            console.log('=== CONTROL INITIALIZING ===');
            console.log('DirectLineSecret:', props.DirectLineSecret ? 'Present' : 'Missing');
            console.log('DirectLineEndpoint:', props.DirectLineEndpoint?.raw || 'Using default');
            console.log('SpeechKey:', props.SpeechKey ? 'Present' : 'Missing (will use browser voices)');
            console.log('SpeechRegion:', props.SpeechRegion?.raw || 'Not configured');

            try {
                const secret = props.DirectLineSecret?.raw;
                if (!secret) {
                    console.error('Direct Line secret is missing!');
                    setError('Direct Line secret is required');
                    setIsInitializing(false);
                    return;
                }

                console.log('Getting Direct Line token...');
                const token = await getDirectLineToken(secret);
                console.log('Token received:', token.substring(0, 20) + '...');

                const endpoint = props.DirectLineEndpoint?.raw || undefined;
                console.log('Creating CopilotChatService with endpoint:', endpoint || 'default');

                const service = new CopilotChatService(token, endpoint);

                // Set up state change callback for persistence
                service.setStateChangeCallback((conversationId, watermark) => {
                    saveConversationState(conversationId, watermark);
                });

                // Try to reconnect to existing conversation
                const savedState = loadConversationState();
                let reconnected = false;

                if (savedState) {
                    console.log('🔄 Found saved conversation, attempting reconnection...');
                    reconnected = await service.reconnectConversation(
                        savedState.conversationId,
                        savedState.watermark
                    );
                    if (!reconnected) {
                        console.log('⚠️ Reconnection failed, clearing saved state');
                        clearConversationState();
                    }
                }

                if (!reconnected) {
                    console.log('Starting new conversation...');
                    await service.startConversation();
                    console.log('Conversation started successfully');
                } else {
                    console.log('✅ Reconnected to existing conversation');
                }

                setIsReconnected(reconnected);
                setChatService(service);
                setIsInitializing(false);
                console.log('=== CONTROL READY ===');
            } catch (err) {
                console.error('Failed to initialize chat:', err);
                setError(err instanceof Error ? err.message : 'Failed to initialize chat');
                setIsInitializing(false);
            }
        };

        initializeChat();
    }, [props.DirectLineSecret, props.DirectLineEndpoint]);

    if (isInitializing) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                Initializing chat...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px', color: 'red' }}>
                Error: {error}
            </div>
        );
    }

    if (!chatService) {
        return (
            <div style={{ padding: '20px' }}>
                Chat service not available
            </div>
        );
    }

    return (
        <ChatWindow
            chatService={chatService}
            speechKey={props.SpeechKey?.raw || undefined}
            speechRegion={props.SpeechRegion?.raw || undefined}
            openAIEndpoint={props.OpenAIEndpoint?.raw || undefined}
            openAIKey={props.OpenAIKey?.raw || undefined}
            openAIDeployment={props.OpenAIDeployment?.raw || 'tts'}
            isReconnected={isReconnected}
            modalTitle={props.ModalTitle?.raw || undefined}
            enableAttachments={props.EnableAttachments?.raw === true}
            attachmentIcon={(props.AttachmentIcon?.raw as 'paperclip' | 'camera' | 'document' | 'plus') || 'paperclip'}
        />
    );
};

export default ChatDirectLineControl;
