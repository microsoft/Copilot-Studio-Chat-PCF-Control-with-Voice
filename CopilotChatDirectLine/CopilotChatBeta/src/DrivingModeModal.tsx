/**
 * DrivingModeModal - Full-screen modal for hands-free voice interaction
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

export interface DrivingModeModalProps {
    isListening: boolean;
    isPlaying: boolean;
    isSending: boolean;
    isWaitingForResponse: boolean;
    transcribedText: string;
    userInput: string;
    botResponse: string;
    onMicClick: () => void;
    onStopClick: () => void;
    onClose: () => void;
    onNewConversation: () => void;
    modalTitle?: string;
}

const DrivingModeModal: React.FC<DrivingModeModalProps> = ({
    isListening,
    isPlaying,
    isSending,
    isWaitingForResponse,
    transcribedText,
    userInput,
    botResponse,
    onMicClick,
    onStopClick,
    onClose,
    onNewConversation,
    modalTitle
}) => {
    const getStatusText = (): string => {
        if (isPlaying) {
            return 'Playing response - Tap to stop';
        }
        if (isSending) {
            return 'Sending...';
        }
        if (isWaitingForResponse) {
            return 'Copilot is responding... (mic paused)';
        }
        if (isListening) {
            return 'Listening... speak now';
        }
        return 'Tap mic to start listening';
    };

    const getMicColor = (): string => {
        if (isPlaying) {
            return '#d13438';  // Red - playing
        }
        if (isListening) {
            return '#107c10';  // Green - listening
        }
        if (isWaitingForResponse) {
            return '#0078d4';  // Blue - waiting for bot
        }
        if (isSending) {
            return '#8a8886';  // Gray - processing
        }
        return '#0078d4';  // Blue - idle/starting
    };

    const getMicIcon = (): string => {
        if (isPlaying) {
            return '⏹';  // Stop icon
        }
        return '🎤';  // Microphone icon
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                backdropFilter: 'blur(4px)',
                padding: '20px'
            }}
        >
            <div
                style={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    padding: '20px 16px',
                    maxWidth: '340px',
                    width: 'calc(100% - 32px)',
                    boxSizing: 'border-box',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    maxHeight: 'calc(100vh - 60px)',
                    overflowX: 'hidden',
                    overflowY: 'auto'
                }}
            >
                {/* Header */}
                <div style={{ textAlign: 'center' }}>
                    <h2
                        style={{
                            margin: 0,
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#323130',
                            marginBottom: '2px'
                        }}
                    >
                        {modalTitle || 'Copilot Assistant'}
                    </h2>
                    <div
                        style={{
                            fontSize: '11px',
                            color: isListening ? '#107c10' : '#0078d4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                        }}
                    >
                        <span>
                            {isListening ? '🎙️' : isPlaying ? '🔊' : '🚗'}
                        </span>
                        <span>
                            {isListening ? 'Listening...' : isPlaying ? 'Speaking...' : 'Always-On Voice'}
                        </span>
                    </div>
                </div>

                {/* Main Mic Button */}
                <button
                    onClick={isPlaying ? onStopClick : onMicClick}
                    disabled={isSending}
                    style={{
                        width: '120px',
                        height: '120px',
                        minWidth: '120px',
                        minHeight: '120px',
                        flexShrink: 0,
                        borderRadius: '50%',
                        border: 'none',
                        backgroundColor: getMicColor(),
                        color: '#fff',
                        fontSize: '48px',
                        cursor: isSending ? 'not-allowed' : 'pointer',
                        boxShadow: isListening || isPlaying
                            ? '0 0 0 6px rgba(209, 52, 56, 0.2), 0 0 0 12px rgba(209, 52, 56, 0.1)'
                            : '0 4px 16px rgba(0,120,212,0.3)',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: isListening ? 'scale(1.05)' : 'scale(1)',
                        animation: isListening ? 'pulse 2s infinite' : 'none',
                        aspectRatio: '1 / 1'
                    }}
                    title={getStatusText()}
                >
                    {getMicIcon()}
                </button>

                {/* Status Text */}
                <div
                    style={{
                        textAlign: 'center',
                        minHeight: '24px',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontSize: '12px',
                            color: '#605e5c',
                            fontWeight: '500'
                        }}
                    >
                        {getStatusText()}
                    </p>
                </div>

                {/* User Input Display */}
                {(transcribedText || userInput) && (
                    <div
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            backgroundColor: '#e1dfdd',
                            borderRadius: '8px',
                            minHeight: '32px',
                            maxHeight: '80px',
                            overflowY: 'auto',
                            boxSizing: 'border-box',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            flexShrink: 1
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontSize: '10px',
                                color: '#605e5c',
                                marginBottom: '2px',
                                fontWeight: '600'
                            }}
                        >
                            You said:
                        </p>
                        <p
                            style={{
                                margin: 0,
                                fontSize: '12px',
                                color: '#323130',
                                fontStyle: isListening ? 'italic' : 'normal',
                                opacity: isListening ? 0.7 : 1,
                                lineHeight: '1.3'
                            }}
                        >
                            {transcribedText || userInput}
                        </p>
                    </div>
                )}

                {/* Bot Response Display */}
                {botResponse && (
                    <div
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            backgroundColor: '#0078d4',
                            borderRadius: '8px',
                            minHeight: '32px',
                            maxHeight: '100px',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            boxSizing: 'border-box',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            flexShrink: 1
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontSize: '10px',
                                color: 'rgba(255,255,255,0.8)',
                                marginBottom: '2px',
                                fontWeight: '600'
                            }}
                        >
                            Copilot:
                        </p>
                        <p
                            style={{
                                margin: 0,
                                fontSize: '12px',
                                color: '#fff',
                                lineHeight: '1.3'
                            }}
                        >
                            {botResponse}
                        </p>
                    </div>
                )}

                {/* Pulse animation keyframes */}
                <style>
                    {`
                    @keyframes pulse {
                        0%, 100% { 
                            box-shadow: 0 0 0 6px rgba(209, 52, 56, 0.2), 0 0 0 12px rgba(209, 52, 56, 0.1);
                        }
                        50% { 
                            box-shadow: 0 0 0 10px rgba(209, 52, 56, 0.3), 0 0 0 20px rgba(209, 52, 56, 0.15);
                        }
                    }
                `}
                </style>

                {/* Action Buttons */}
                <div
                    style={{
                        display: 'flex',
                        gap: '10px',
                        width: '100%',
                        marginTop: '4px',
                        flexShrink: 0
                    }}
                >
                    <button
                        onClick={onNewConversation}
                        style={{
                            flex: 1,
                            padding: '10px 12px',
                            backgroundColor: '#f3f2f1',
                            color: '#323130',
                            border: '1px solid #8a8886',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                        }}
                        title="Start a new conversation"
                    >
                        🔄 New Chat
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '10px 12px',
                            backgroundColor: '#0078d4',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                        }}
                        title="Close driving mode"
                    >
                        ✕ Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DrivingModeModal;
