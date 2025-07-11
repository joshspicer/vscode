/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @joshspicer

declare module 'vscode' {
	export enum RemoteCodingAgentFileChangeType {
		Created = 'created',
		Modified = 'modified',
		Deleted = 'deleted'
	}

	export enum RemoteCodingAgentMessageType {
		Request = 'request',
		Response = 'response'
	}

	export enum RemoteCodingAgentLogLevel {
		Info = 'info',
		Warn = 'warn',
		Error = 'error'
	}

	export interface RemoteCodingAgentStatusData {
		filesChanged?: {
			uri: Uri;
			type: RemoteCodingAgentFileChangeType;
			preview?: string;
		}[];
		messages?: {
			type: RemoteCodingAgentMessageType;
			content: string;
			timestamp: number;
		}[];
		logs?: {
			level: RemoteCodingAgentLogLevel;
			message: string;
			timestamp: number;
		}[];
		links?: {
			uri: Uri;
			label: string;
			tooltip?: string;
		}[];
		/**
		 * Optional icon to display for this agent's current state.
		 * If not provided, the editor will choose an appropriate icon based on the status.
		 */
		icon?: ThemeIcon;
	}

	export interface RemoteCodingAgentStatusUpdate {
		agentId: string;
		jobId?: string;
		timestamp: number;
		data: RemoteCodingAgentStatusData;
		/**
		 * Optional command to execute when this status item is clicked in the tree view.
		 * The command will be called with standardized arguments: (agentId, jobId?, statusUpdate)
		 */
		command?: string;
	}

	export interface RemoteCodingAgentStatusProvider {
		// eslint-disable-next-line local/vscode-dts-event-naming
		onDidUpdateStatus: Event<RemoteCodingAgentStatusUpdate>;
	}

	export namespace remoteCodingAgents {
		export function registerStatusProvider(provider: RemoteCodingAgentStatusProvider): Disposable;
	}
}
