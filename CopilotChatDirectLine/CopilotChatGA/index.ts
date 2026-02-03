/**
 * CopilotChatBeta - PCF Control Entry Point
 */

import { createRoot, Root } from 'react-dom/client';
import Control, { ControlProps } from './src/Control';
import React from 'react';

// PCF Context interface
interface IOutputs {
    Version?: string;
}

interface Mode {
    trackContainerResize: (track: boolean) => void;
}

interface Context<T> {
    mode: Mode;
    parameters: T;
}

export class CopilotStudioChatGA {
    private _container: HTMLDivElement | undefined;
    private _rootControl: Root | undefined;
    private _notifyOutputChanged: (() => void) | undefined;
    private _transcript: string = "";
    private _isRender: boolean = false;

    /**
     * Empty constructor.
     */
    constructor() {
        // Empty
    }

    /**
     * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
     * Data-set values are not initialized here, use updateView.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
     * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
     * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
     */
    init(
        context: Context<ControlProps>,
        notifyOutputChanged: () => void,
        state: unknown,
        container: HTMLDivElement
    ): void {
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;

        // Set container to fill available space (supports flexible height in canvas apps)
        this._container.style.width = '100%';
        this._container.style.height = '100%';
        this._container.style.display = 'flex';
        this._container.style.flexDirection = 'column';
        this._container.style.overflow = 'hidden';

        // Request full container dimensions from the framework
        context.mode.trackContainerResize(true);
    }

    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */
    updateView(context: Context<ControlProps>): void {
        if (!this._isRender) {
            this.renderControl(context);
        } else {
            const props = {
                callback: (transcript: string) => {
                    this._transcript = transcript;
                    this._notifyOutputChanged!();
                },
                context: context,
                ...context.parameters
            };
            this._rootControl!.render(React.createElement(Control, props));
        }
    }

    private renderControl(context: Context<ControlProps>): void {
        this._isRender = true;
        this._rootControl = createRoot(this._container!);

        const props = {
            callback: (transcript: string) => {
                this._transcript = transcript;
                this._notifyOutputChanged!();
            },
            context: context,
            ...context.parameters
        };

        this._rootControl.render(React.createElement(Control, props));
    }

    /**
     * It is called by the framework prior to a control receiving new data.
     * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
     */
    getOutputs(): IOutputs {
        return {
            Version: "1.2.8"
        };
    }

    /**
     * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
     * i.e. cancelling any pending remote calls, removing listeners, etc.
     */
    destroy(): void {
        // Add code to cleanup control if necessary
    }
}
