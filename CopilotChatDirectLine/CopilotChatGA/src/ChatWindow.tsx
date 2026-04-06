/**
 * ChatWindow - Main chat interface component
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import Markdown from 'react-markdown';
import { useSpeak, getAvailableVoices, VOICE_PROFILES } from './useSpeak';
import { useThinkingSound } from './useThinkingSound';
import { useAttachments, Attachment } from './useAttachments';
import AttachmentPreview from './AttachmentPreview';
import AdaptiveCardRenderer, { CardAction } from './AdaptiveCardRenderer';
import DrivingModeModal from './DrivingModeModal';
import {
    saveSettings,
    loadSettings,
    saveMessages,
    loadMessages,
    clearMessages,
    clearConversationState,
    StoredMessage
} from './utils/storage';
import { CopilotChatService } from './services/CopilotChatService';
import { useDebugLog, DebugPanel } from './useDebugLog';
import {
    SUPPORTED_LANGUAGES,
    getLanguageByCode,
    getDefaultVoice,
    getVoicesForLanguage,
    getLanguagesByRegion,
    detectBrowserLanguage,
    getGreeting,
    isEnglish,
    LanguageConfig,
    VoiceConfig
} from './languages';

// Extend Window for speech recognition
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
        webkitAudioContext: typeof AudioContext;
    }
}

// Message interface
export interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
    speakText?: string;
    adaptiveCard?: any;
    isSignInCard?: boolean;
    signInUrl?: string;
    attachments?: Array<{ name: string; type: string }>;
}

// Convert Message to StoredMessage for localStorage
const toStoredMessage = (msg: Message): StoredMessage => ({
    id: msg.id,
    text: msg.text,
    isUser: msg.isUser,
    timestamp: msg.timestamp.toISOString(),
    speakText: msg.speakText,
    adaptiveCard: msg.adaptiveCard,
    isSignInCard: msg.isSignInCard,
    signInUrl: msg.signInUrl
});

// Convert StoredMessage back to Message
const fromStoredMessage = (stored: StoredMessage): Message => ({
    id: stored.id,
    text: stored.text,
    isUser: stored.isUser,
    timestamp: new Date(stored.timestamp),
    speakText: stored.speakText,
    adaptiveCard: stored.adaptiveCard,
    isSignInCard: stored.isSignInCard,
    signInUrl: stored.signInUrl
});

export interface ChatWindowProps {
    chatService: CopilotChatService;
    speechKey?: string;
    speechRegion?: string;
    openAIEndpoint?: string;
    openAIKey?: string;
    openAIDeployment?: string;
    entraTenantId?: string;
    entraClientId?: string;
    entraClientSecret?: string;
    speechProxyEndpoint?: string;
    speechProxyApiKey?: string;
    isReconnected?: boolean;
    modalTitle?: string;
    enableAttachments?: boolean;
    attachmentIcon?: 'paperclip' | 'camera' | 'document' | 'plus';
    defaultLanguage?: string;  // Admin-configured default language
    enableDebugLog?: boolean;  // Enable debug logging panel
    debugLogEmail?: string;    // Email address for debug logs
}

const ChatWindow: React.FC<ChatWindowProps> = ({
    chatService,
    speechKey,
    speechRegion,
    openAIEndpoint,
    openAIKey,
    openAIDeployment = 'tts',
    entraTenantId,
    entraClientId,
    entraClientSecret,
    speechProxyEndpoint,
    speechProxyApiKey,
    isReconnected = false,
    modalTitle,
    enableAttachments = false,
    attachmentIcon = 'paperclip',
    defaultLanguage,
    enableDebugLog = false,
    debugLogEmail
}) => {
    // Load saved settings on initialization
    const savedSettings = React.useMemo(() => loadSettings(), []);

    // Determine initial language: saved > admin default > browser detection
    const initialLanguage = React.useMemo(() => {
        if (savedSettings.language) return savedSettings.language;
        if (defaultLanguage && getLanguageByCode(defaultLanguage)) return defaultLanguage;
        return detectBrowserLanguage();
    }, [defaultLanguage, savedSettings.language]);

    // Determine initial voice: saved > default for language
    const initialVoiceId = React.useMemo(() => {
        if (savedSettings.voiceId) return savedSettings.voiceId;
        const defaultVoice = getDefaultVoice(initialLanguage);
        return defaultVoice?.id || '';
    }, [initialLanguage, savedSettings.voiceId]);

    // Load saved messages if reconnected
    const savedMessages = React.useMemo(() => {
        if (isReconnected) {
            return loadMessages().map(fromStoredMessage);
        }
        return [];
    }, [isReconnected]);

    const [messages, setMessages] = React.useState<Message[]>(savedMessages);
    const [inputText, setInputText] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [isListening, setIsListening] = React.useState(false);
    const [isMuted, setIsMuted] = React.useState(savedSettings.isMuted);
    const [showSettings, setShowSettings] = React.useState(false);
    const [voiceProfile, setVoiceProfile] = React.useState(savedSettings.voiceProfile);
    const [drivingMode, setDrivingMode] = React.useState(false);
    const [audioUnlocked, setAudioUnlocked] = React.useState(savedSettings.audioUnlocked);
    const [thinkingSoundEnabled, setThinkingSoundEnabled] = React.useState(savedSettings.thinkingSoundEnabled);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isPaused, setIsPaused] = React.useState(false);
    const [showAudioMenu, setShowAudioMenu] = React.useState(false);
    const [showAudioPrompt, setShowAudioPrompt] = React.useState(false);
    const [transcribedText, setTranscribedText] = React.useState('');
    const [lastUserInput, setLastUserInput] = React.useState('');
    const [lastBotResponse, setLastBotResponse] = React.useState('');
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
    
    // Multi-lingual state
    const [selectedLanguage, setSelectedLanguage] = React.useState(initialLanguage);
    const [selectedVoiceId, setSelectedVoiceId] = React.useState(initialVoiceId);

    // Admin Mode state - can be enabled by admin prop OR user toggle in settings
    const [adminModeEnabled, setAdminModeEnabled] = React.useState(
        savedSettings.adminMode || enableDebugLog
    );

    // Debug logging state
    const [showDebugPanel, setShowDebugPanel] = React.useState(false);
    const debugLog = useDebugLog({
        enabled: adminModeEnabled,
        emailAddress: debugLogEmail,
        maxEntries: 500
    });

    const recognitionRef = React.useRef<any>(null);
    const autoSendTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const audioMenuRef = React.useRef<HTMLDivElement>(null);
    const hasGreeted = React.useRef(isReconnected);
    const seenMessageIds = React.useRef(new Set<string>(savedMessages.map(m => m.id)));
    const spokenMessageIds = React.useRef(new Set<string>());
    const isSpeakingRef = React.useRef(false);
    const cancelSpeechRef = React.useRef(false);

    // Detect if running on iOS/mobile
    const isMobile = React.useMemo(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), []);
    const isIOS = React.useMemo(() => /iPhone|iPad|iPod/i.test(navigator.userAgent), []);

    // Check which speech providers are configured
    const hasEntraAuth = !!(entraTenantId && entraClientId && entraClientSecret);
    const hasProxy = !!speechProxyEndpoint;
    const hasAzureSpeech = !!(hasProxy || hasEntraAuth || (speechKey && speechRegion));
    const hasOpenAI = !!(hasProxy || hasEntraAuth || (openAIEndpoint && openAIKey));
    const availableVoices = React.useMemo(
        () => getAvailableVoices(hasAzureSpeech, hasOpenAI),
        [hasAzureSpeech, hasOpenAI]
    );

    const { speak, stop, pause, resume } = useSpeak({
        speechKey,
        speechRegion,
        openAIEndpoint,
        openAIKey,
        openAIDeployment,
        entraTenantId,
        entraClientId,
        entraClientSecret,
        speechProxyEndpoint,
        speechProxyApiKey,
        voiceProfile,
        audioUnlocked,
        language: selectedLanguage,
        voiceId: selectedVoiceId
    });

    // Use a ref for speak to avoid effect re-runs when speak function changes
    const speakRef = React.useRef(speak);
    speakRef.current = speak;

    // Attachment handling
    const {
        attachments,
        isProcessing: isProcessingAttachments,
        addFiles,
        removeAttachment,
        clearAttachments,
        getDirectLineAttachments,
        openFilePicker,
        fileInputRef,
        getAcceptString,
        hasAttachments
    } = useAttachments();

    const [isTyping, setIsTyping] = React.useState(false);

    // Get attachment icon based on setting
    const getAttachmentIconEmoji = (): string => {
        switch (attachmentIcon) {
            case 'camera':
                return '📷';
            case 'document':
                return '📄';
            case 'plus':
                return '➕';
            default:
                return '📎';
        }
    };

    // Play a subtle "thinking" sound while waiting for bot response
    useThinkingSound(isTyping, {
        enabled: thinkingSoundEnabled && !isMuted,
        interval: 2500,
        frequency: 523.25,
        volume: 0.1
    });

    // Save settings when they change
    React.useEffect(() => {
        saveSettings({
            isMuted,
            voiceProfile,
            audioUnlocked,
            thinkingSoundEnabled,
            language: selectedLanguage,
            voiceId: selectedVoiceId,
            adminMode: adminModeEnabled
        });
    }, [isMuted, voiceProfile, audioUnlocked, thinkingSoundEnabled, selectedLanguage, selectedVoiceId, adminModeEnabled]);

    // Save messages when they change
    React.useEffect(() => {
        if (messages.length > 0) {
            saveMessages(messages.map(toStoredMessage));
        }
    }, [messages]);

    // Auto-scroll to bottom
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Show iOS audio prompt on first load if audio is not unlocked and we have speech providers
    React.useEffect(() => {
        const hasSpeechProvider = (speechKey && speechRegion) || (openAIEndpoint && openAIKey);
        if (isMobile && !audioUnlocked && hasSpeechProvider) {
            const timer = setTimeout(() => {
                setShowAudioPrompt(true);
            }, 500);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, []);

    // Force-stop mic when bot starts speaking
    React.useEffect(() => {
        if (drivingMode && isPlaying && recognitionRef.current) {
            console.log('🎤🛑 Driving mode: isPlaying=true, force-stopping mic to prevent interruption');
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Already stopped
            }
            setIsListening(false);
            setTranscribedText('');
            if (autoSendTimerRef.current) {
                clearTimeout(autoSendTimerRef.current);
                autoSendTimerRef.current = null;
            }
        }
    }, [drivingMode, isPlaying]);

    // Auto-start listening when driving mode is enabled and not busy
    React.useEffect(() => {
        if (drivingMode && !isListening && !isPlaying && !isSending && !isTyping && recognitionRef.current) {
            const startTimer = setTimeout(() => {
                if (drivingMode && !isListening && !isPlaying && !isSending && !isTyping) {
                    console.log('🚗 Driving mode: Auto-starting mic...');
                    try {
                        setTranscribedText('');
                        recognitionRef.current!.start();
                        setIsListening(true);
                    } catch (e) {
                        console.log('🚗 Mic already active or unavailable');
                    }
                }
            }, 500);
            return () => clearTimeout(startTimer);
        }
        return undefined;
    }, [drivingMode, isListening, isPlaying, isSending, isTyping]);

    // Trigger Conversation Start on mount
    React.useEffect(() => {
        if (!hasGreeted.current && chatService) {
            hasGreeted.current = true;
            console.log('👋 Auto-greeting enabled - preparing to send conversationUpdate...');
            setTimeout(async () => {
                try {
                    console.log('📤 Sending conversationUpdate activity to wake bot...');
                    await chatService.triggerConversationStart();
                    console.log('✅ ConversationUpdate sent successfully - bot should respond with greeting');
                } catch (error) {
                    console.error('❌ Failed to send conversationUpdate:', error);
                }
            }, 1000);
        }
    }, [chatService]);

    // Poll for new messages
    React.useEffect(() => {
        const pollMessages = async () => {
            try {
                const activities = await chatService.getMessages();
                console.log('🔄 Polling - Received activities:', activities.length, 'activities');

                const newMessages = activities
                    .filter(activity => {
                        const messageId = activity.id || '';
                        if (seenMessageIds.current.has(messageId)) {
                            console.log('Skipping duplicate message:', messageId);
                            return false;
                        }
                        seenMessageIds.current.add(messageId);
                        return true;
                    })
                    .map(activity => {
                        console.log('Processing activity:', {
                            id: activity.id,
                            text: activity.text,
                            attachments: activity.attachments
                        });

                        let messageText = activity.text || '';
                        let signInUrl: string | undefined;
                        let isSignInCard = false;
                        let adaptiveCard: any = null;
                        let speakText = '';

                        if (activity.attachments && activity.attachments.length > 0) {
                            const attachment = activity.attachments[0];
                            console.log('Attachment detected:', attachment.contentType);

                            if (
                                attachment.contentType === 'application/vnd.microsoft.card.oauth' ||
                                attachment.contentType === 'application/vnd.microsoft.card.signin'
                            ) {
                                isSignInCard = true;
                                messageText = 'Authentication required';
                                if (attachment.content?.buttons && attachment.content.buttons.length > 0) {
                                    signInUrl = attachment.content.buttons[0].value;
                                    console.log('OAuth card detected, sign-in URL:', signInUrl);
                                }
                            } else if (
                                attachment.contentType === 'application/vnd.microsoft.card.adaptive' &&
                                attachment.content
                            ) {
                                adaptiveCard = attachment.content;
                                console.log('🎴 Adaptive Card detected:', adaptiveCard);

                                if (adaptiveCard.speak) {
                                    speakText = adaptiveCard.speak;
                                    console.log('🗣️ Using card speak property:', speakText);
                                } else if (adaptiveCard.body && adaptiveCard.body.length > 0) {
                                    speakText = adaptiveCard.body
                                        .map((item: any) => item.text || '')
                                        .filter((text: string) => text)
                                        .join('. ');
                                    console.log('🗣️ Extracted text from card body:', speakText);
                                }

                                if (!messageText && adaptiveCard.body && adaptiveCard.body.length > 0) {
                                    messageText = adaptiveCard.body
                                        .map((item: any) => item.text || '')
                                        .filter((text: string) => text)
                                        .join(' ');
                                }
                            }
                        }

                        console.log('Mapped message:', {
                            id: activity.id,
                            text: messageText,
                            isSignInCard,
                            hasAdaptiveCard: !!adaptiveCard,
                            speakText
                        });

                        return {
                            id: activity.id || Math.random().toString(),
                            text: messageText,
                            isUser: false,
                            timestamp: activity.timestamp ? new Date(activity.timestamp) : new Date(),
                            signInUrl,
                            isSignInCard,
                            adaptiveCard,
                            speakText: speakText || messageText
                        };
                    })
                    .filter(msg => {
                        const hasContent = msg.text || msg.isSignInCard || msg.adaptiveCard;
                        console.log('Filter check:', {
                            id: msg.id,
                            hasContent,
                            text: msg.text,
                            isSignInCard: msg.isSignInCard,
                            hasAdaptiveCard: !!msg.adaptiveCard
                        });
                        return hasContent;
                    });

                if (newMessages.length > 0) {
                    console.log('✅ Adding', newMessages.length, 'new messages to state');
                    setIsTyping(false);
                    setMessages(prev => [...prev, ...newMessages]);

                    const lastBotMsg = newMessages[newMessages.length - 1];
                    if (lastBotMsg && lastBotMsg.speakText) {
                        setLastBotResponse(lastBotMsg.speakText);
                    }

                    console.log('🔊 Voice status - isMuted:', isMuted, 'drivingMode:', drivingMode, 'speechKey:', !!speechKey);
                    const shouldSpeak = !isMuted || drivingMode;

                    if (shouldSpeak) {
                        const unspokenMessages: Message[] = [];
                        for (const msg of newMessages) {
                            if (msg.speakText && !spokenMessageIds.current.has(msg.id)) {
                                spokenMessageIds.current.add(msg.id);
                                unspokenMessages.push(msg);
                            }
                        }

                        if (unspokenMessages.length === 0) {
                            console.log('⏭️ All messages already spoken, skipping');
                            return;
                        }

                        if (isSpeakingRef.current) {
                            console.log('⏭️ Already speaking, skipping duplicate speak call (messages already marked)');
                            return;
                        }

                        isSpeakingRef.current = true;
                        console.log('🔒 Speaking lock acquired');

                        (async () => {
                            try {
                                if (drivingMode && recognitionRef.current) {
                                    console.log('🎤🔇 Driving mode: Stopping mic while bot speaks to prevent interruption');
                                    try {
                                        recognitionRef.current.stop();
                                    } catch (e) {
                                        // Already stopped
                                    }
                                    setIsListening(false);
                                    if (autoSendTimerRef.current) {
                                        clearTimeout(autoSendTimerRef.current);
                                        autoSendTimerRef.current = null;
                                    }
                                }

                                setIsPlaying(true);

                                for (const msg of unspokenMessages) {
                                    if (cancelSpeechRef.current) {
                                        console.log('⏹️ Speech cancelled - stop was pressed');
                                        break;
                                    }
                                    console.log('🗣️ Speaking message:', msg.speakText!.substring(0, 50) + '...');
                                    setLastBotResponse(msg.speakText!);
                                    try {
                                        await speakRef.current(msg.speakText!);
                                    } catch (error) {
                                        console.error('❌ Speech failed:', error);
                                    }
                                }
                            } finally {
                                setIsPlaying(false);
                                isSpeakingRef.current = false;
                                console.log('🔓 Speaking lock released');

                                if (drivingMode && !cancelSpeechRef.current) {
                                    console.log('🚗 Driving mode: Auto-restarting listening after response');
                                    setTimeout(() => {
                                        handleDrivingModeStart();
                                    }, 1000);
                                }
                            }
                        })();
                    } else {
                        console.log('🔇 Voice muted, skipping speak');
                    }
                }
            } catch (error) {
                console.error('Failed to poll messages:', error);
            }
        };

        const interval = setInterval(pollMessages, 3000);
        return () => clearInterval(interval);
    }, [chatService, isMuted, drivingMode]);

    // Initialize speech recognition
    React.useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = drivingMode;
            recognitionRef.current.lang = selectedLanguage; // Use selected language for speech recognition
            recognitionRef.current.maxAlternatives = 1;

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                const isFinal = event.results[0].isFinal;
                const confidence = event.results[0][0].confidence;

                const noiseWords = ['no', 'oh', 'uh', 'um', 'ah', 'huh', 'hmm', 'yeah', 'the', 'a', 'i'];
                const trimmedTranscript = transcript.trim().toLowerCase();
                const isLikelyNoise =
                    noiseWords.includes(trimmedTranscript) ||
                    trimmedTranscript.length < 3 ||
                    (confidence !== undefined && confidence < 0.5);

                if (drivingMode) {
                    if (!isFinal) {
                        if (!isLikelyNoise || transcript.length > 5) {
                            setTranscribedText(transcript);
                        }
                    } else {
                        if (isLikelyNoise) {
                            console.log('🚗 Driving mode: Ignoring likely noise:', transcript, 'confidence:', confidence);
                            setTranscribedText('');
                            return;
                        }

                        console.log('🚗 Driving mode: Final transcript received:', transcript, 'confidence:', confidence);
                        setInputText(transcript);
                        setLastUserInput(transcript);
                        setIsListening(false);
                        setTranscribedText('');

                        if (autoSendTimerRef.current) {
                            clearTimeout(autoSendTimerRef.current);
                        }

                        autoSendTimerRef.current = setTimeout(() => {
                            console.log('🚗 Driving mode: Auto-sending message:', transcript);
                            if (recognitionRef.current) {
                                try {
                                    recognitionRef.current.stop();
                                } catch (e) {
                                    // Already stopped
                                }
                            }
                            setIsListening(false);
                            setIsSending(true);
                            void sendMessage(transcript)
                                .catch(error => {
                                    console.error('❌ Failed to send message:', error);
                                })
                                .finally(() => {
                                    setIsSending(false);
                                    setInputText('');
                                });
                        }, 2000);
                    }
                } else {
                    setInputText(transcript);
                    setIsListening(false);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
                setTranscribedText('');
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
                if (!drivingMode) {
                    setTranscribedText('');
                }
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (autoSendTimerRef.current) {
                clearTimeout(autoSendTimerRef.current);
            }
        };
    }, [drivingMode, selectedLanguage]);  // Re-initialize when language changes

    const sendMessage = async (text: string, withAttachments: boolean = false): Promise<void> => {
        if ((!text.trim() && !withAttachments) || isSending) return;
        if (withAttachments && !hasAttachments) return;

        setLastUserInput(text || 'Sent attachments');
        setTranscribedText('');
        setAttachmentError(null);
        setIsTyping(true);

        const attachmentInfo = withAttachments && hasAttachments
            ? attachments.map(a => ({ name: a.name, type: a.type }))
            : undefined;

        const userMessage: Message = {
            id: Math.random().toString(),
            text: text || `📎 Sent ${attachments.length} file(s)`,
            isUser: true,
            timestamp: new Date(),
            attachments: attachmentInfo
        };

        setMessages(prev => [...prev, userMessage]);
        setIsSending(true);

        try {
            if (withAttachments && hasAttachments) {
                const directLineAttachments = getDirectLineAttachments();
                await chatService.sendMessageWithAttachments(text, directLineAttachments);
                clearAttachments();
            } else {
                await chatService.sendMessage(text);
            }
            setInputText('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const unlockAudio = async (): Promise<void> => {
        try {
            console.log('🔓 Unlocking audio for iOS/Android...');
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
            console.log('✅ Audio unlocked successfully');
            setAudioUnlocked(true);
            setShowAudioPrompt(false);

            const hasSpeech = (speechKey && speechRegion) || (openAIEndpoint && openAIKey);
            if (hasSpeech) {
                console.log('🎤 Testing TTS audio playback...');
                await speak('Voice enabled');
            }
        } catch (error) {
            console.error('❌ Failed to unlock audio:', error);
            setAudioUnlocked(true);
            setShowAudioPrompt(false);
        }
    };

    const handleSendMessage = (): void => {
        if (hasAttachments || inputText.trim()) {
            sendMessage(inputText, hasAttachments);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const result = await addFiles(files);
            if (!result.success && result.error) {
                setAttachmentError(result.error);
                setTimeout(() => setAttachmentError(null), 5000);
            }
        }
        e.target.value = '';
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const toggleListening = (): void => {
        if (!recognitionRef.current) {
            alert('Speech recognition not supported in this browser');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
            setTranscribedText('');
            if (autoSendTimerRef.current) {
                clearTimeout(autoSendTimerRef.current);
            }
        } else {
            setTranscribedText('');
            setLastUserInput('');
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleDrivingModeStart = (): void => {
        if (!recognitionRef.current) {
            alert('Speech recognition not supported in this browser');
            return;
        }
        setTranscribedText('');
        setLastUserInput('');
        recognitionRef.current.start();
        setIsListening(true);
    };

    const handleDrivingModeStop = (): void => {
        console.log('🛑 Driving mode: Stopping current playback (voice will continue for future messages)');
        cancelSpeechRef.current = true;
        stop();
        setIsPlaying(false);
        isSpeakingRef.current = false;
        setTimeout(() => {
            cancelSpeechRef.current = false;
            console.log('🔄 Driving mode: Ready for next voice response');
        }, 100);
        setTimeout(() => {
            handleDrivingModeStart();
        }, 500);
    };

    const handleAudioPlay = (): void => {
        console.log('▶️ Playing - enabling voice output for future messages');
        setIsMuted(false);
        setIsPaused(false);
        cancelSpeechRef.current = false;
        isSpeakingRef.current = false;
        resume();
        setShowAudioMenu(false);
    };

    const handleAudioPause = (): void => {
        console.log('⏸️ Pausing current playback (can resume)');
        setIsPaused(true);
        pause();
        setShowAudioMenu(false);
    };

    const handleAudioStop = (): void => {
        console.log('⏹️ Stopping playback and disabling voice until Play is pressed');
        setIsMuted(true);
        setIsPaused(false);
        cancelSpeechRef.current = true;
        isSpeakingRef.current = false;
        setIsPlaying(false);
        stop();
        setShowAudioMenu(false);
    };

    const toggleAudioMenu = (): void => {
        setShowAudioMenu(!showAudioMenu);
    };

    // Close audio menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (audioMenuRef.current && !audioMenuRef.current.contains(event.target as Node)) {
                setShowAudioMenu(false);
            }
        };

        if (showAudioMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showAudioMenu]);

    const getAudioButtonIcon = (): string => {
        if (isMuted) return '🔇';
        if (isPaused) return '⏸️';
        return '🔊';
    };

    const getAudioButtonColor = (): { bg: string; color: string; border: string } => {
        if (isMuted) return { bg: '#d13438', color: '#fff', border: '#d13438' };
        if (isPaused) return { bg: '#ffc83d', color: '#323130', border: '#ffc83d' };
        return { bg: '#107c10', color: '#fff', border: '#107c10' };
    };

    const handleSignIn = async (signInUrl: string): Promise<void> => {
        console.log('Opening OAuth sign-in window...');
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            signInUrl,
            'OAuth Sign In',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
            console.error('Popup blocked. Please allow popups for this site.');
            return;
        }

        const pollTimer = setInterval(() => {
            if (popup.closed) {
                clearInterval(pollTimer);
                console.log('OAuth popup closed');
            }
        }, 500);
    };

    const handleCardAction = async (action: CardAction): Promise<void> => {
        console.log('🎯 Card action triggered:', action);

        if (action.type === 'submit') {
            const userMessage: Message = {
                id: Math.random().toString(),
                text: action.title || 'Selected action',
                isUser: true,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, userMessage]);
            setIsTyping(true);

            try {
                await chatService.sendMessage(action.title || JSON.stringify(action.data));
                console.log('✅ Card action sent to bot');
            } catch (error) {
                console.error('❌ Failed to send card action:', error);
                setIsTyping(false);
            }
        }
    };

    const handleNewChat = async (): Promise<void> => {
        setMessages([]);
        seenMessageIds.current.clear();
        hasGreeted.current = false;
        setLastUserInput('');
        setLastBotResponse('');
        setTranscribedText('');
        clearMessages();
        clearConversationState();
        setTimeout(async () => {
            try {
                await chatService.triggerConversationStart();
            } catch (error) {
                console.error('Failed to restart conversation:', error);
            }
        }, 500);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
                backgroundColor: '#f3f2f1',
                fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif',
                position: 'relative'
            }}
        >
            {/* Top Bar */}
            <div
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '20px',
                    zIndex: 100,
                    display: 'flex',
                    gap: '8px'
                }}
            >
                <button
                    onClick={handleNewChat}
                    style={{
                        padding: '8px 10px',
                        backgroundColor: '#f3f2f1',
                        color: '#605e5c',
                        border: '1px solid #8a8886',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        minWidth: '38px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    title="New Chat"
                >
                    🔄
                </button>
                <button
                    onClick={() => setDrivingMode(!drivingMode)}
                    style={{
                        padding: '8px 10px',
                        backgroundColor: drivingMode ? '#0078d4' : '#f3f2f1',
                        color: drivingMode ? '#fff' : '#605e5c',
                        border: drivingMode ? '1px solid #0078d4' : '1px solid #8a8886',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        minWidth: '38px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    title={drivingMode ? 'Exit Driving Mode' : 'Enter Driving Mode'}
                >
                    🚗
                </button>
            </div>

            {/* iOS Audio Prompt */}
            {showAudioPrompt && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10001,
                        padding: '20px'
                    }}
                    onClick={() => setShowAudioPrompt(false)}
                >
                    <div
                        style={{
                            backgroundColor: '#fff',
                            borderRadius: '16px',
                            padding: '24px',
                            maxWidth: '320px',
                            width: '100%',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                            textAlign: 'center'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔊</div>
                        <h2
                            style={{
                                margin: '0 0 8px 0',
                                fontSize: '20px',
                                fontWeight: '600',
                                color: '#323130'
                            }}
                        >
                            Enable Voice
                        </h2>
                        <p
                            style={{
                                margin: '0 0 20px 0',
                                fontSize: '14px',
                                color: '#605e5c',
                                lineHeight: '1.5'
                            }}
                        >
                            {isIOS
                                ? 'iOS requires a tap to enable voice responses. Tap below to hear your Copilot assistant.'
                                : 'Tap below to enable voice responses from your Copilot assistant.'}
                        </p>
                        <button
                            onClick={unlockAudio}
                            style={{
                                width: '100%',
                                padding: '14px 24px',
                                backgroundColor: '#107c10',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            🔓 Enable Voice Output
                        </button>
                        <button
                            onClick={() => setShowAudioPrompt(false)}
                            style={{
                                marginTop: '12px',
                                padding: '10px',
                                backgroundColor: 'transparent',
                                color: '#605e5c',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px',
                                width: '100%'
                            }}
                        >
                            Maybe later
                        </button>
                    </div>
                </div>
            )}

            {/* Driving Mode Modal */}
            {drivingMode && (
                <DrivingModeModal
                    isListening={isListening}
                    isPlaying={isPlaying}
                    isSending={isSending}
                    isWaitingForResponse={isTyping}
                    transcribedText={transcribedText}
                    userInput={lastUserInput}
                    botResponse={lastBotResponse}
                    onMicClick={handleDrivingModeStart}
                    onStopClick={handleDrivingModeStop}
                    onClose={() => setDrivingMode(false)}
                    modalTitle={modalTitle}
                    onNewConversation={handleNewChat}
                />
            )}

            {/* Messages Area */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    paddingBottom: '100px'
                }}
            >
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        style={{
                            alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
                            backgroundColor: msg.isUser ? '#0078d4' : '#fff',
                            color: msg.isUser ? '#fff' : '#323130',
                            padding: '12px 16px',
                            borderRadius: msg.isUser ? '12px 12px 0 12px' : '12px 12px 12px 0',
                            maxWidth: '75%',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            wordWrap: 'break-word',
                            fontSize: '14px',
                            lineHeight: '1.5'
                        }}
                    >
                        <Markdown>{msg.text}</Markdown>
                        {msg.adaptiveCard && (
                            <AdaptiveCardRenderer
                                card={msg.adaptiveCard}
                                onAction={handleCardAction}
                            />
                        )}
                        {msg.isSignInCard && msg.signInUrl && (
                            <button
                                onClick={() => handleSignIn(msg.signInUrl!)}
                                style={{
                                    marginTop: '8px',
                                    padding: '8px 16px',
                                    backgroundColor: '#0078d4',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    display: 'block',
                                    width: '100%'
                                }}
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                    <div
                        style={{
                            alignSelf: 'flex-start',
                            backgroundColor: '#fff',
                            color: '#323130',
                            padding: '12px 16px',
                            borderRadius: '12px 12px 12px 0',
                            maxWidth: '75%',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <style>
                            {`
                            @keyframes typingDot {
                                0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
                                30% { opacity: 1; transform: translateY(-8px); }
                            }
                        `}
                        </style>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <div
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: '#0078d4',
                                    animation: 'typingDot 1.4s infinite',
                                    animationDelay: '0s'
                                }}
                            />
                            <div
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: '#0078d4',
                                    animation: 'typingDot 1.4s infinite',
                                    animationDelay: '0.2s'
                                }}
                            />
                            <div
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: '#0078d4',
                                    animation: 'typingDot 1.4s infinite',
                                    animationDelay: '0.4s'
                                }}
                            />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Attachment Preview */}
            {enableAttachments && (hasAttachments || isProcessingAttachments) && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: 0,
                        right: 0,
                        zIndex: 10
                    }}
                >
                    <AttachmentPreview
                        attachments={attachments}
                        onRemove={removeAttachment}
                        isProcessing={isProcessingAttachments}
                    />
                </div>
            )}

            {/* Attachment Error */}
            {attachmentError && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: hasAttachments ? '180px' : '80px',
                        left: '20px',
                        right: '20px',
                        backgroundColor: '#fde7e9',
                        border: '1px solid #d13438',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        color: '#a80000',
                        zIndex: 11
                    }}
                >
                    ⚠️ {attachmentError}
                </div>
            )}

            {/* Input Bar */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '16px 20px',
                    backgroundColor: '#fff',
                    borderTop: '1px solid #edebe9',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
                }}
            >
                {/* Mic Button */}
                <button
                    onClick={toggleListening}
                    disabled={isSending}
                    style={{
                        padding: '10px 12px',
                        backgroundColor: isListening ? '#c7e0f4' : '#f3f2f1',
                        color: isListening ? '#0078d4' : '#605e5c',
                        border: isListening ? '2px solid #0078d4' : '1px solid #8a8886',
                        borderRadius: '4px',
                        cursor: isSending ? 'not-allowed' : 'pointer',
                        fontSize: '18px',
                        minWidth: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title={isListening ? 'Listening...' : 'Voice input'}
                >
                    🎤
                </button>

                {/* Audio Control */}
                <div ref={audioMenuRef} style={{ position: 'relative' }}>
                    <button
                        onClick={toggleAudioMenu}
                        style={{
                            padding: '10px 12px',
                            backgroundColor: getAudioButtonColor().bg,
                            color: getAudioButtonColor().color,
                            border: `1px solid ${getAudioButtonColor().border}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '18px',
                            minWidth: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }}
                        title="Audio controls"
                    >
                        {getAudioButtonIcon()}
                    </button>
                    {showAudioMenu && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '50px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: '#fff',
                                borderRadius: '8px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                                border: '1px solid #edebe9',
                                overflow: 'hidden',
                                zIndex: 1000,
                                minWidth: '120px'
                            }}
                        >
                            {(isMuted || isPaused) && (
                                <button
                                    onClick={handleAudioPlay}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        backgroundColor: '#fff',
                                        border: 'none',
                                        borderBottom: '1px solid #edebe9',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        color: '#107c10'
                                    }}
                                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f3f2f1')}
                                    onMouseOut={e => (e.currentTarget.style.backgroundColor = '#fff')}
                                >
                                    ▶️ Play
                                </button>
                            )}
                            {!isMuted && !isPaused && (
                                <button
                                    onClick={handleAudioPause}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        backgroundColor: '#fff',
                                        border: 'none',
                                        borderBottom: '1px solid #edebe9',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        color: '#8a6d3b'
                                    }}
                                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f3f2f1')}
                                    onMouseOut={e => (e.currentTarget.style.backgroundColor = '#fff')}
                                >
                                    ⏸️ Pause
                                </button>
                            )}
                            {!isMuted && (
                                <button
                                    onClick={handleAudioStop}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        backgroundColor: '#fff',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        color: '#d13438'
                                    }}
                                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f3f2f1')}
                                    onMouseOut={e => (e.currentTarget.style.backgroundColor = '#fff')}
                                >
                                    ⏹️ Stop
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Settings Button */}
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    style={{
                        padding: '10px 12px',
                        backgroundColor: showSettings ? '#0078d4' : '#f3f2f1',
                        color: showSettings ? '#fff' : '#605e5c',
                        border: showSettings ? '1px solid #0078d4' : '1px solid #8a8886',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        minWidth: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Settings"
                >
                    ⚙️
                </button>

                {/* Debug Log Button - only shown when debug is enabled */}
                {adminModeEnabled && (
                    <button
                        onClick={() => setShowDebugPanel(true)}
                        style={{
                            padding: '10px 12px',
                            backgroundColor: '#f3f2f1',
                            color: '#605e5c',
                            border: '1px solid #8a8886',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '18px',
                            minWidth: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}
                        title="Debug Logs"
                    >
                        🐛
                        {debugLog.logs.length > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-5px',
                                backgroundColor: '#d13438',
                                color: '#fff',
                                borderRadius: '10px',
                                padding: '2px 6px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                minWidth: '18px',
                                textAlign: 'center'
                            }}>
                                {debugLog.logs.length > 99 ? '99+' : debugLog.logs.length}
                            </span>
                        )}
                    </button>
                )}

                {/* Attachment Button */}
                {enableAttachments && (
                    <>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept={getAcceptString()}
                            multiple
                            style={{ display: 'none' }}
                            capture="environment"
                        />
                        <button
                            onClick={openFilePicker}
                            disabled={isSending || isProcessingAttachments}
                            style={{
                                padding: '10px 12px',
                                backgroundColor: hasAttachments ? '#0078d4' : '#f3f2f1',
                                color: hasAttachments ? '#fff' : '#605e5c',
                                border: hasAttachments ? '1px solid #0078d4' : '1px solid #8a8886',
                                borderRadius: '4px',
                                cursor: isSending || isProcessingAttachments ? 'not-allowed' : 'pointer',
                                fontSize: '18px',
                                minWidth: '44px',
                                height: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}
                            title={hasAttachments ? `${attachments.length} file(s) attached` : 'Attach file or photo'}
                        >
                            {isProcessingAttachments ? '⏳' : getAttachmentIconEmoji()}
                            {hasAttachments && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: '-4px',
                                        right: '-4px',
                                        backgroundColor: '#d13438',
                                        color: '#fff',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        borderRadius: '50%',
                                        width: '16px',
                                        height: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {attachments.length}
                                </span>
                            )}
                        </button>
                    </>
                )}

                {/* Text Input */}
                <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={hasAttachments ? 'Add a message (optional)...' : 'Type a message...'}
                    disabled={isSending}
                    style={{
                        flex: 1,
                        padding: '12px',
                        border: '1px solid #8a8886',
                        borderRadius: '4px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: '#fff'
                    }}
                />

                {/* Send Button */}
                <button
                    onClick={handleSendMessage}
                    disabled={isSending || (!inputText.trim() && !hasAttachments)}
                    style={{
                        padding: '10px 12px',
                        backgroundColor:
                            isSending || (!inputText.trim() && !hasAttachments) ? '#c8c6c4' : '#0078d4',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isSending || !inputText.trim() ? 'not-allowed' : 'pointer',
                        fontSize: '18px',
                        minWidth: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title={isSending ? 'Sending...' : 'Send message'}
                >
                    {isSending ? (
                        '⏳'
                    ) : (
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M2.5 10L17.5 2.5L10 17.5L8.75 10.625L2.5 10Z"
                                fill="currentColor"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '70px',
                        left: 0,
                        right: 0,
                        backgroundColor: '#fff',
                        borderTop: '1px solid #e1dfdd',
                        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
                        padding: '20px',
                        zIndex: 1000,
                        maxHeight: '400px',
                        overflowY: 'auto'
                    }}
                >
                    <div style={{ marginBottom: '20px' }}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '16px'
                            }}
                        >
                            <h3
                                style={{
                                    margin: 0,
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: '#323130'
                                }}
                            >
                                Settings
                            </h3>
                            <span
                                style={{
                                    fontSize: '12px',
                                    color: '#605e5c',
                                    fontWeight: '400'
                                }}
                            >
                                v2.0.6 Beta
                            </span>
                        </div>

                        {/* Language Selection */}
                        <div style={{ marginBottom: '20px' }}>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#323130'
                                }}
                            >
                                🌍 Language
                            </label>
                            <select
                                value={selectedLanguage}
                                onChange={e => {
                                    const newLang = e.target.value;
                                    setSelectedLanguage(newLang);
                                    // Auto-select default voice for new language
                                    const defaultVoice = getDefaultVoice(newLang);
                                    if (defaultVoice) {
                                        setSelectedVoiceId(defaultVoice.id);
                                    }
                                    // Reset voice profile to Azure if switching to non-English
                                    if (!isEnglish(newLang)) {
                                        setVoiceProfile('azure-jenny-friendly');
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    fontSize: '14px',
                                    border: '1px solid #8a8886',
                                    borderRadius: '4px',
                                    backgroundColor: '#fff'
                                }}
                            >
                                {Object.entries(getLanguagesByRegion()).map(([region, languages]) => (
                                    <optgroup key={region} label={region}>
                                        {languages.map(lang => (
                                            <option key={lang.code} value={lang.code}>
                                                {lang.flag} {lang.name} ({lang.nativeName})
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            <div
                                style={{
                                    fontSize: '11px',
                                    color: '#605e5c',
                                    marginTop: '6px'
                                }}
                            >
                                Used for speech recognition and text-to-speech
                            </div>
                        </div>

                        {/* Voice Selection */}
                        <div style={{ marginBottom: '20px' }}>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#323130'
                                }}
                            >
                                🎤 Voice
                            </label>
                            {!hasAzureSpeech && !hasOpenAI ? (
                                <div
                                    style={{
                                        padding: '12px',
                                        backgroundColor: '#fff4ce',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        color: '#8a6d3b'
                                    }}
                                >
                                    ⚠️ No voice services configured. Contact your admin to enable Azure Speech.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {/* For non-English, show Azure voices for that language */}
                                    {!isEnglish(selectedLanguage) ? (
                                        <select
                                            value={selectedVoiceId}
                                            onChange={e => setSelectedVoiceId(e.target.value)}
                                            style={{
                                                flex: 1,
                                                padding: '10px',
                                                fontSize: '14px',
                                                border: '1px solid #8a8886',
                                                borderRadius: '4px',
                                                backgroundColor: '#fff'
                                            }}
                                            disabled={!hasAzureSpeech}
                                        >
                                            {getVoicesForLanguage(selectedLanguage).map(voice => (
                                                <option key={voice.id} value={voice.id}>
                                                    {voice.displayName} ({voice.gender === 'female' ? '♀' : '♂'})
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        /* For English, show both OpenAI and Azure options */
                                        <select
                                            value={voiceProfile}
                                            onChange={e => {
                                                setVoiceProfile(e.target.value);
                                                // Also update voiceId for Azure voices
                                                const profile = VOICE_PROFILES[e.target.value];
                                                if (profile?.provider === 'azure') {
                                                    setSelectedVoiceId(profile.voice);
                                                }
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '10px',
                                                fontSize: '14px',
                                                border: '1px solid #8a8886',
                                                borderRadius: '4px',
                                                backgroundColor: '#fff'
                                            }}
                                        >
                                            {hasOpenAI && (
                                                <optgroup label="🤖 OpenAI (Natural)">
                                                    {availableVoices
                                                        .filter(v => v.provider === 'openai')
                                                        .map(v => (
                                                            <option key={v.id} value={v.id}>
                                                                {v.description}
                                                            </option>
                                                        ))}
                                                </optgroup>
                                            )}
                                            {hasAzureSpeech && (
                                                <optgroup label="🔊 Azure Speech">
                                                    {availableVoices
                                                        .filter(v => v.provider === 'azure')
                                                        .map(v => (
                                                            <option key={v.id} value={v.id}>
                                                                {v.description}
                                                            </option>
                                                        ))}
                                                </optgroup>
                                            )}
                                        </select>
                                    )}
                                    <button
                                        onClick={async () => {
                                            if (!audioUnlocked) {
                                                await unlockAudio();
                                            }
                                            // Use language-appropriate greeting
                                            speak(getGreeting(selectedLanguage));
                                        }}
                                        style={{
                                            padding: '10px 16px',
                                            backgroundColor: '#0078d4',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                        title="Preview this voice"
                                    >
                                        🔊 Preview
                                    </button>
                                </div>
                            )}
                            <div
                                style={{
                                    fontSize: '11px',
                                    color: '#605e5c',
                                    marginTop: '6px'
                                }}
                            >
                                {!isEnglish(selectedLanguage) 
                                    ? '🔊 Azure Speech (recommended for non-English)'
                                    : isEnglish(selectedLanguage) && VOICE_PROFILES[voiceProfile]?.provider === 'openai'
                                        ? '🤖 OpenAI TTS'
                                        : '🔊 Azure Speech'}
                            </div>
                        </div>

                        {/* Audio Unlock Button */}
                        {!audioUnlocked && (
                            <div style={{ marginBottom: '20px' }}>
                                <button
                                    onClick={unlockAudio}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        backgroundColor: '#107c10',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                    title="Required for audio on iOS/Android"
                                >
                                    🔓 Enable Voice Output
                                </button>
                                <div
                                    style={{
                                        fontSize: '12px',
                                        color: '#605e5c',
                                        marginTop: '8px',
                                        textAlign: 'center'
                                    }}
                                >
                                    Tap to enable voice output on mobile devices
                                </div>
                            </div>
                        )}

                        {audioUnlocked && (
                            <div
                                style={{
                                    marginBottom: '20px',
                                    padding: '12px',
                                    backgroundColor: '#f3f2f1',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    color: '#107c10'
                                }}
                            >
                                ✅ Voice output enabled
                            </div>
                        )}

                        {/* Auto-Speak Toggle */}
                        <div style={{ marginBottom: '20px' }}>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={!isMuted}
                                    onChange={() => setIsMuted(!isMuted)}
                                    style={{
                                        marginRight: '8px',
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer'
                                    }}
                                />
                                <span style={{ fontWeight: '600', color: '#323130' }}>
                                    🔊 Auto-Speak Responses
                                </span>
                            </label>
                            <p
                                style={{
                                    margin: '4px 0 0 26px',
                                    fontSize: '12px',
                                    color: '#605e5c'
                                }}
                            >
                                Automatically read bot responses aloud
                            </p>
                        </div>

                        {/* Thinking Sound Toggle */}
                        <div style={{ marginBottom: '20px' }}>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={thinkingSoundEnabled}
                                    onChange={() => setThinkingSoundEnabled(!thinkingSoundEnabled)}
                                    style={{
                                        marginRight: '8px',
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer'
                                    }}
                                />
                                <span style={{ fontWeight: '600', color: '#323130' }}>🔔 Thinking Sound</span>
                            </label>
                            <p
                                style={{
                                    margin: '4px 0 0 26px',
                                    fontSize: '12px',
                                    color: '#605e5c'
                                }}
                            >
                                Play a subtle ping while waiting for response
                            </p>
                        </div>

                        {/* Driving Mode Toggle */}
                        <div style={{ marginBottom: '10px' }}>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={drivingMode}
                                    onChange={() => setDrivingMode(!drivingMode)}
                                    style={{
                                        marginRight: '8px',
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer'
                                    }}
                                />
                                <span style={{ fontWeight: '600', color: '#323130' }}>🚗 Driving Mode</span>
                            </label>
                            <p
                                style={{
                                    margin: '4px 0 0 26px',
                                    fontSize: '12px',
                                    color: '#605e5c'
                                }}
                            >
                                Always-on voice - mic auto-activates when not playing
                            </p>
                        </div>

                        {/* Admin Mode Toggle */}
                        <div style={{ marginBottom: '10px' }}>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={adminModeEnabled}
                                    onChange={() => setAdminModeEnabled(!adminModeEnabled)}
                                    style={{
                                        marginRight: '8px',
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer'
                                    }}
                                />
                                <span style={{ fontWeight: '600', color: '#323130' }}>🛠️ Admin Mode</span>
                            </label>
                            <p
                                style={{
                                    margin: '4px 0 0 26px',
                                    fontSize: '12px',
                                    color: '#605e5c'
                                }}
                            >
                                Enable debug logging panel for troubleshooting
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Debug Panel */}
            {showDebugPanel && adminModeEnabled && (
                <DebugPanel
                    logs={debugLog.logs}
                    onClose={() => setShowDebugPanel(false)}
                    onClear={debugLog.clearLogs}
                    onEmail={debugLog.emailLogs}
                    onExport={debugLog.exportLogs}
                    emailAddress={debugLogEmail}
                />
            )}
        </div>
    );
};

export default ChatWindow;
