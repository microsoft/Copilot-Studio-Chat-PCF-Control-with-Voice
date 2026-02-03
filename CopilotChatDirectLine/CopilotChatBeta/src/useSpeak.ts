/**
 * useSpeak hook - Text-to-speech functionality supporting Azure Speech and OpenAI TTS
 */

import React from 'react';

declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

// Voice profile configuration
export interface VoiceProfile {
    provider: 'azure' | 'openai';
    voice: string;
    style?: string;
    description: string;
}

// Available voice profiles
export interface AvailableVoice {
    id: string;
    description: string;
    provider: 'azure' | 'openai';
}

// Voice profile mapping - combines Azure Speech and OpenAI voices
export const VOICE_PROFILES: Record<string, VoiceProfile> = {
    // Azure Speech voices
    'azure-jenny-friendly': {
        provider: 'azure',
        voice: 'en-US-JennyNeural',
        style: 'friendly',
        description: 'Jenny - Friendly'
    },
    'azure-jenny-chat': {
        provider: 'azure',
        voice: 'en-US-JennyNeural',
        style: 'chat',
        description: 'Jenny - Chat'
    },
    'azure-jenny-customerservice': {
        provider: 'azure',
        voice: 'en-US-JennyNeural',
        style: 'customerservice',
        description: 'Jenny - Customer Service'
    },
    'azure-aria-empathetic': {
        provider: 'azure',
        voice: 'en-US-AriaNeural',
        style: 'empathetic',
        description: 'Aria - Empathetic'
    },
    'azure-aria-chat': {
        provider: 'azure',
        voice: 'en-US-AriaNeural',
        style: 'chat',
        description: 'Aria - Chat'
    },
    'azure-guy-friendly': {
        provider: 'azure',
        voice: 'en-US-GuyNeural',
        style: 'friendly',
        description: 'Guy - Friendly'
    },
    'azure-davis-chat': {
        provider: 'azure',
        voice: 'en-US-DavisNeural',
        style: 'chat',
        description: 'Davis - Chat'
    },
    'azure-sara-friendly': {
        provider: 'azure',
        voice: 'en-US-SaraNeural',
        style: 'friendly',
        description: 'Sara - Friendly'
    },
    'azure-sara-chat': {
        provider: 'azure',
        voice: 'en-US-SaraNeural',
        style: 'chat',
        description: 'Sara - Chat'
    },
    // OpenAI GPT-4o voices (more natural/conversational)
    'openai-alloy': {
        provider: 'openai',
        voice: 'alloy',
        description: 'Alloy - Neutral, balanced'
    },
    'openai-echo': {
        provider: 'openai',
        voice: 'echo',
        description: 'Echo - Warm, conversational'
    },
    'openai-shimmer': {
        provider: 'openai',
        voice: 'shimmer',
        description: 'Shimmer - Clear, expressive'
    },
    'openai-nova': {
        provider: 'openai',
        voice: 'nova',
        description: 'Nova - Warm, engaging'
    },
    'openai-onyx': {
        provider: 'openai',
        voice: 'onyx',
        description: 'Onyx - Deep, authoritative'
    },
    'openai-fable': {
        provider: 'openai',
        voice: 'fable',
        description: 'Fable - Expressive, storytelling'
    }
};

// Legacy voice profile mapping for backward compatibility
const LEGACY_VOICE_MAP: Record<string, string> = {
    'jenny-friendly': 'azure-jenny-friendly',
    'jenny-customerservice': 'azure-jenny-customerservice',
    'aria-customerservice': 'azure-aria-empathetic',
    'aria-empathetic': 'azure-aria-empathetic',
    'guy-friendly': 'azure-guy-friendly',
    'davis-chat': 'azure-davis-chat',
    'sara-friendly': 'azure-sara-friendly'
};

// Get available voices based on configured providers
export function getAvailableVoices(hasAzureSpeech: boolean, hasOpenAI: boolean): AvailableVoice[] {
    const voices: AvailableVoice[] = [];

    Object.entries(VOICE_PROFILES).forEach(([id, config]) => {
        if (config.provider === 'azure' && hasAzureSpeech) {
            voices.push({ id, description: config.description, provider: 'azure' });
        } else if (config.provider === 'openai' && hasOpenAI) {
            voices.push({ id, description: config.description, provider: 'openai' });
        }
    });

    return voices;
}

// Detect if running on mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Token cache to avoid repeated token fetches (for Azure Speech)
let cachedToken: { token: string; expiry: number } | null = null;

/**
 * Fetch an authorization token from Azure Speech Service.
 */
async function getAzureAuthToken(speechKey: string, speechRegion: string): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiry) {
        console.log('🔑 Using cached Azure Speech auth token');
        return cachedToken.token;
    }

    console.log('🔑 Fetching new Azure Speech auth token...');
    const tokenUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': speechKey,
            'Content-Length': '0'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token fetch failed: ${response.status} - ${errorText}`);
    }

    const token = await response.text();
    cachedToken = { token, expiry: Date.now() + 9 * 60 * 1000 };
    console.log('✅ Azure Speech auth token obtained');
    return token;
}

/**
 * Play audio using HTML Audio element (most reliable on mobile)
 * This approach starts playing as soon as enough data is buffered.
 */
async function playAudioFromResponse(
    response: Response,
    audioRef: React.MutableRefObject<HTMLAudioElement | null>
): Promise<void> {
    console.log('🎵 Starting audio playback...');
    const startTime = performance.now();

    // Get audio data as blob
    const audioBlob = await response.blob();
    const downloadTime = performance.now();
    console.log(`📥 Audio downloaded in ${(downloadTime - startTime).toFixed(0)}ms (${(audioBlob.size / 1024).toFixed(1)}KB)`);

    // Create blob URL
    const audioUrl = URL.createObjectURL(audioBlob);

    return new Promise((resolve, reject) => {
        // Create new audio element for each playback (cleaner on mobile)
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        // Set up event handlers BEFORE setting src
        audio.onended = () => {
            console.log(`✅ Audio playback complete (total: ${(performance.now() - startTime).toFixed(0)}ms)`);
            URL.revokeObjectURL(audioUrl); // Clean up
            audioRef.current = null;
            resolve();
        };

        audio.onerror = (e) => {
            console.error('❌ Audio playback error:', e);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            reject(new Error('Audio playback failed'));
        };

        audio.oncanplaythrough = () => {
            console.log(`🔊 Playback starting in ${(performance.now() - startTime).toFixed(0)}ms`);
        };

        // Start playback
        audio.play().catch(err => {
            console.error('❌ Play failed:', err);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            reject(err);
        });
    });
}

export interface UseSpeakOptions {
    speechKey?: string;
    speechRegion?: string;
    openAIEndpoint?: string;
    openAIKey?: string;
    openAIDeployment?: string;
    voiceProfile?: string;
    audioUnlocked?: boolean;
}

export interface UseSpeakReturn {
    speak: (text: string) => Promise<void>;
    stop: () => void;
    pause: () => void;
    resume: () => void;
}

export function useSpeak(options: UseSpeakOptions = {}): UseSpeakReturn {
    const {
        speechKey,
        speechRegion,
        openAIEndpoint,
        openAIKey,
        openAIDeployment = 'tts',
        voiceProfile = 'azure-jenny-friendly',
        audioUnlocked = false
    } = options;

    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const voiceProfileRef = React.useRef(voiceProfile);
    voiceProfileRef.current = voiceProfile;

    const speak = React.useCallback(async (text: string): Promise<void> => {
        let currentVoiceProfile = voiceProfileRef.current;

        // Handle legacy voice profile names
        if (LEGACY_VOICE_MAP[currentVoiceProfile]) {
            currentVoiceProfile = LEGACY_VOICE_MAP[currentVoiceProfile];
        }

        const voiceConfig = VOICE_PROFILES[currentVoiceProfile];
        const hasAzureSpeech = !!(speechKey && speechRegion);
        const hasOpenAI = !!(openAIEndpoint && openAIKey);

        console.log('🎤 SPEAK - voice:', currentVoiceProfile, 'provider:', voiceConfig?.provider, 'azure:', hasAzureSpeech, 'openai:', hasOpenAI);

        if (isMobile && !audioUnlocked && (hasAzureSpeech || hasOpenAI)) {
            console.log('⚠️ Audio not unlocked on mobile');
            return;
        }

        if (voiceConfig) {
            try {
                // Use OpenAI TTS with streaming for lower latency
                if (voiceConfig.provider === 'openai' && hasOpenAI) {
                    console.log(`🎤 OpenAI TTS (streaming): ${voiceConfig.voice}`);
                    const baseUrl = openAIEndpoint!.replace(/\/$/, '');
                    const url = `${baseUrl}/openai/deployments/${openAIDeployment}/audio/speech?api-version=2024-02-15-preview`;

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'api-key': openAIKey!,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: openAIDeployment,
                            input: text,
                            voice: voiceConfig.voice,
                            response_format: 'mp3',  // mp3 works well with Web Audio API
                            speed: 1.0
                        })
                    });

                    if (!response.ok) throw new Error(`OpenAI TTS error: ${response.status}`);

                    // Play audio (simple HTML Audio approach - reliable on mobile)
                    return playAudioFromResponse(response, audioRef);
                }

                // Use Azure Speech (also with streaming)
                if (voiceConfig.provider === 'azure' && hasAzureSpeech) {
                    console.log(`🎤 Azure Speech (streaming): ${voiceConfig.voice} (${voiceConfig.style})`);

                    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="${voiceConfig.voice}"><mstts:express-as style="${voiceConfig.style || 'chat'}" styledegree="1.5"><prosody rate="1.1" pitch="0%">${text}</prosody></mstts:express-as></voice></speak>`;

                    const authToken = await getAzureAuthToken(speechKey!, speechRegion!);

                    const response = await fetch(
                        `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/ssml+xml',
                                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
                            },
                            body: ssml
                        }
                    );

                    if (!response.ok) throw new Error(`Azure Speech error: ${response.status}`);
                    return playAudioFromResponse(response, audioRef);
                }

                // Fallback scenarios
                if (voiceConfig.provider === 'openai' && !hasOpenAI && hasAzureSpeech) {
                    console.log('⚠️ OpenAI not configured, using Azure fallback');
                    const fallback = VOICE_PROFILES['azure-jenny-chat'];
                    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="${fallback.voice}"><mstts:express-as style="${fallback.style}" styledegree="1.5"><prosody rate="1.1" pitch="0%">${text}</prosody></mstts:express-as></voice></speak>`;
                    const authToken = await getAzureAuthToken(speechKey!, speechRegion!);
                    const response = await fetch(
                        `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/ssml+xml',
                                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
                            },
                            body: ssml
                        }
                    );
                    if (!response.ok) throw new Error(`Azure Speech error: ${response.status}`);
                    return playAudioFromResponse(response, audioRef);
                }

                if (voiceConfig.provider === 'azure' && !hasAzureSpeech && hasOpenAI) {
                    console.log('⚠️ Azure not configured, using OpenAI fallback');
                    const baseUrl = openAIEndpoint!.replace(/\/$/, '');
                    const url = `${baseUrl}/openai/deployments/${openAIDeployment}/audio/speech?api-version=2024-02-15-preview`;
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'api-key': openAIKey!,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: openAIDeployment,
                            input: text,
                            voice: 'echo',
                            response_format: 'mp3',
                            speed: 1.0
                        })
                    });
                    if (!response.ok) throw new Error(`OpenAI TTS error: ${response.status}`);
                    return playAudioFromResponse(response, audioRef);
                }
            } catch (error) {
                console.error('❌ TTS failed:', error);
            }
        }

        // Browser fallback
        console.log('🔊 Using browser voice fallback');
        if (!window.speechSynthesis) return;

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.1;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Natural') || v.name.includes('Neural'))
            || voices.find(v => v.lang.startsWith('en-US'));
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
    }, [speechKey, speechRegion, openAIEndpoint, openAIKey, openAIDeployment, audioUnlocked]);

    const stop = React.useCallback(() => {
        // Stop HTML Audio element
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        window.speechSynthesis?.cancel();
    }, []);

    const pause = React.useCallback(() => {
        if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
    }, []);

    const resume = React.useCallback(() => {
        if (audioRef.current?.paused) audioRef.current.play().catch(() => {});
    }, []);

    return { speak, stop, pause, resume };
}
