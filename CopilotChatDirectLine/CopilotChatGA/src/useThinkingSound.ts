/**
 * Custom hook for playing a subtle "thinking" sound while the agent is processing.
 * Uses Web Audio API to generate a soft ping/pulse sound - no external files needed.
 *
 * The sound is a gentle sine wave with a quick fade, similar to a sonar ping.
 */

import React from 'react';

declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

export interface ThinkingSoundOptions {
    enabled: boolean;
    interval?: number;      // Ping interval in ms (default: 2000)
    frequency?: number;     // Sound frequency in Hz (default: 523.25 - C5 note)
    volume?: number;        // Volume 0-1 (default: 0.12)
}

export function useThinkingSound(
    isThinking: boolean,
    options: ThinkingSoundOptions
): { playPing: () => void } {
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    const {
        enabled,
        interval = 2000,        // Ping every 2 seconds
        frequency = 523.25,     // C5 note - pleasant, not too low
        volume = 0.12           // Subtle volume
    } = options;

    // Play a single ping sound
    const playPing = React.useCallback(() => {
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio API not supported');
                return;
            }
        }

        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const now = ctx.currentTime;

        // Create oscillator for the main tone
        const oscillator = ctx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now);

        // Create gain node for volume envelope
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        // Quick attack, longer decay (sonar-like)
        gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);  // 20ms attack
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);  // 400ms decay

        // Connect and play
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.5);

        // Optional: Add a second harmonic for richer sound
        const oscillator2 = ctx.createOscillator();
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(frequency * 1.5, now);  // Perfect fifth

        const gainNode2 = ctx.createGain();
        gainNode2.gain.setValueAtTime(0, now);
        gainNode2.gain.linearRampToValueAtTime(volume * 0.3, now + 0.02);
        gainNode2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        oscillator2.connect(gainNode2);
        gainNode2.connect(ctx.destination);
        oscillator2.start(now);
        oscillator2.stop(now + 0.4);
    }, [frequency, volume]);

    // Start/stop the thinking sound loop
    React.useEffect(() => {
        if (isThinking && enabled) {
            console.log('🔔 Starting thinking sound...');
            // Play immediately
            playPing();
            // Then repeat at interval
            intervalRef.current = setInterval(() => {
                playPing();
            }, interval);
        } else {
            // Stop the interval
            if (intervalRef.current) {
                console.log('🔕 Stopping thinking sound');
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isThinking, enabled, interval, playPing]);

    // Cleanup audio context on unmount
    React.useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    return { playPing };
}
