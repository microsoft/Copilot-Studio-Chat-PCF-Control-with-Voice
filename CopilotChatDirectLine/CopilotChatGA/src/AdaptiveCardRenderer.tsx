/**
 * AdaptiveCardRenderer - Renders Adaptive Cards in the chat
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { AdaptiveCard, OpenUrlAction, SubmitAction } from 'adaptivecards';
import { HostConfig } from 'adaptivecards';
import { ShowCardActionMode, Orientation, ActionAlignment } from 'adaptivecards';

export interface CardAction {
    type: string;
    data?: any;
    title?: string;
}

export interface AdaptiveCardRendererProps {
    card: any;
    onAction: (action: CardAction) => void;
}

const AdaptiveCardRenderer: React.FC<AdaptiveCardRendererProps> = ({ card, onAction }) => {
    const cardContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!cardContainerRef.current || !card) return;

        try {
            // Create an AdaptiveCard instance
            const adaptiveCard = new AdaptiveCard();

            // Set host config for styling
            adaptiveCard.hostConfig = new HostConfig({
                fontFamily: "Segoe UI, Helvetica Neue, sans-serif",
                spacing: {
                    small: 8,
                    default: 12,
                    medium: 16,
                    large: 20,
                    extraLarge: 24,
                    padding: 12
                },
                separator: {
                    lineThickness: 1,
                    lineColor: "#EEEEEE"
                },
                actions: {
                    buttonSpacing: 8,
                    showCard: {
                        actionMode: ShowCardActionMode.Inline,
                        inlineTopMargin: 8
                    },
                    actionsOrientation: Orientation.Horizontal,
                    actionAlignment: ActionAlignment.Left,
                    maxActions: 10
                },
                containerStyles: {
                    default: {
                        backgroundColor: "#FFFFFF",
                        foregroundColors: {
                            default: {
                                default: "#333333",
                                subtle: "#767676"
                            },
                            accent: {
                                default: "#0078D4",
                                subtle: "#0078D4"
                            }
                        }
                    },
                    emphasis: {
                        backgroundColor: "#F3F2F1",
                        foregroundColors: {
                            default: {
                                default: "#333333",
                                subtle: "#767676"
                            }
                        }
                    }
                }
            });

            // Handle action execution
            adaptiveCard.onExecuteAction = (action) => {
                console.log('🎯 Adaptive Card action executed:', action);

                if (action instanceof OpenUrlAction) {
                    const openUrlAction = action as OpenUrlAction;
                    window.open(openUrlAction.url, '_blank');
                } else if (action instanceof SubmitAction) {
                    const submitAction = action as SubmitAction;
                    onAction({
                        type: 'submit',
                        data: submitAction.data,
                        title: submitAction.title
                    });
                }
            };

            // Parse and render the card
            adaptiveCard.parse(card);
            const renderedCard = adaptiveCard.render();

            if (renderedCard) {
                // Clear previous content
                cardContainerRef.current.innerHTML = '';
                cardContainerRef.current.appendChild(renderedCard);
                console.log('✅ Adaptive Card rendered successfully');
            } else {
                console.error('❌ Failed to render Adaptive Card');
            }
        } catch (error) {
            console.error('❌ Error rendering Adaptive Card:', error);
            if (cardContainerRef.current) {
                cardContainerRef.current.innerHTML = '<div style="color: red;">Error rendering card</div>';
            }
        }
    }, [card, onAction]);

    return (
        <div
            ref={cardContainerRef}
            style={{
                margin: '8px 0',
                maxWidth: '100%'
            }}
        />
    );
};

export default AdaptiveCardRenderer;
