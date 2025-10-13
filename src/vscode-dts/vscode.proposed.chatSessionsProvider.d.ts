/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// version: 2

declare module 'vscode' {
	/**
	 * Represents the status of a chat session.
	 */
	export enum ChatSessionStatus {
		/**
		 * The chat session failed to complete.
		 */
		Failed = 0,

		/**
		 * The chat session completed successfully.
		 */
		Completed = 1,

		/**
		 * The chat session is currently in progress.
		 */
		InProgress = 2
	}

	/**
	 * Provides a list of information about chat sessions.
	 */
	export interface ChatSessionItemProvider {
		/**
		 * Event that the provider can fire to signal that chat sessions have changed.
		 */
		readonly onDidChangeChatSessionItems: Event<void>;

		/**
		 * Event that the provider can fire to signal that the current (original) chat session should be replaced with a new (modified) chat session.
		 * The UI can use this information to gracefully migrate the user to the new session.
		 */
		readonly onDidCommitChatSessionItem: Event<{ original: ChatSessionItem /** untitled */; modified: ChatSessionItem /** newly created */ }>;

		/**
		 * DEPRECATED: Will be removed!
		 * Creates a new chat session.
		 *
		 * @param options Options for the new session including an optional initial prompt and history
		 * @param token A cancellation token
		 * @returns Metadata for the chat session
		 */
		provideNewChatSessionItem?(options: {
			/**
			 * The chat request that initiated the session creation
			 */
			readonly request: ChatRequest;

			/**
			 * Additional metadata to use for session creation
			 */
			metadata?: any;
		}, token: CancellationToken): ProviderResult<ChatSessionItem>;

		/**
		 * Provides a list of chat sessions.
		 */
		// TODO: Do we need a flag to try auth if needed?
		provideChatSessionItems(token: CancellationToken): ProviderResult<ChatSessionItem[]>;
	}

	export interface ChatSessionItem {
		/**
		 * Unique identifier for the chat session.
		 */
		id: string;

		/**
		 * Human readable name of the session shown in the UI
		 */
		label: string;

		/**
		 * An icon for the participant shown in UI.
		 */
		iconPath?: IconPath;

		/**
		 * An optional description that provides additional context about the chat session.
		 */
		description?: string | MarkdownString;

		/**
		 * An optional status indicating the current state of the session.
		 */
		status?: ChatSessionStatus;

		/**
		 * The tooltip text when you hover over this item.
		 */
		tooltip?: string | MarkdownString;

		/**
		 * The times at which session started and ended
		 */
		timing?: {
			/**
			 * Session start timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
			 */
			startTime: number;
			/**
			 * Session end timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
			 */
			endTime?: number;
		};

		/**
		 * Statistics about the chat session.
		 */
		statistics?: {
			/**
			 * Number of insertions made during the session.
			 */
			insertions: number;

			/**
			 * Number of deletions made during the session.
			 */
			deletions: number;
		};
	}

	export interface ChatSession {
		/**
		 * The full history of the session
		 *
		 * This should not include any currently active responses
		 */
		// TODO: Are these the right types to use?
		// TODO: link request + response to encourage correct usage?
		readonly history: ReadonlyArray<ChatRequestTurn | ChatResponseTurn2>;

		/**
		 * Callback invoked by the editor for a currently running response. This allows the session to push items for the
		 * current response and stream these in as them come in. The current response will be considered complete once the
		 * callback resolved.
		 *
		 * If not provided, the chat session is assumed to not currently be running.
		 */
		readonly activeResponseCallback?: (stream: ChatResponseStream, token: CancellationToken) => Thenable<void>;

		/**
		 * Handles new request for the session.
		 *
		 * If not set, then the session will be considered read-only and no requests can be made.
		 */
		// TODO: Should we introduce our own type for `ChatRequestHandler` since not all field apply to chat sessions?
		// TODO: Revisit this to align with code.
		readonly requestHandler: ChatRequestHandler | undefined;
	}

	export interface ChatSessionContentProvider {
		/**
		 * Resolves a chat session into a full `ChatSession` object.
		 *
		 * @param sessionId The id of the chat session to open.
		 * @param token A cancellation token that can be used to cancel the operation.
		 */
		provideChatSessionContent(sessionId: string, token: CancellationToken): Thenable<ChatSession> | ChatSession;

		/**
		 * Optional callback invoked when the user changes the selected mode for a specific session.
		 * Only called for sessions where {@link ChatSessionCapabilities.modes} was provided.
		 *
		 * Extensions can use this to adjust behavior based on the user's mode selection.
		 *
		 * @param sessionId The ID of the session for which the mode changed
		 * @param modeId The ID of the newly selected mode
		 * @param token A cancellation token
		 */
		provideHandleModeSelectionChange?(sessionId: string, modeId: string, token: CancellationToken): void;

		/**
		 * Optional callback invoked when the user changes the selected model for a specific session.
		 * Only called for sessions where {@link ChatSessionCapabilities.models} was provided.
		 *
		 * Extensions can use this to adjust behavior based on the user's model selection.
		 *
		 * @param sessionId The ID of the session for which the model changed
		 * @param modelId The ID of the newly selected model
		 * @param token A cancellation token
		 */
		provideHandleModelSelectionChange?(sessionId: string, modelId: string, token: CancellationToken): void;
	}

	export namespace chat {
		/**
		 * Registers a new {@link ChatSessionItemProvider chat session item provider}.
		 *
		 * To use this, also make sure to also add `chatSessions` contribution in the `package.json`.
		 *
		 * @param chatSessionType The type of chat session the provider is for.
		 * @param provider The provider to register.
		 *
		 * @returns A disposable that unregisters the provider when disposed.
		 */
		export function registerChatSessionItemProvider(chatSessionType: string, provider: ChatSessionItemProvider): Disposable;

		/**
		 * Registers a new {@link ChatSessionContentProvider chat session content provider}.
		 *
		 * @param chatSessionType A unique identifier for the chat session type. This is used to differentiate between different chat session providers.
		 * @param provider The provider to register.
		 *
		 * @returns A disposable that unregisters the provider when disposed.
		 */
		export function registerChatSessionContentProvider(chatSessionType: string, provider: ChatSessionContentProvider, chatParticipant: ChatParticipant, capabilities?: ChatSessionCapabilities): Disposable;
	}

	export interface ChatContext {
		readonly chatSessionContext?: ChatSessionContext;
		readonly chatSummary?: {
			readonly prompt?: string;
			readonly history?: string;
		};
	}

	export interface ChatSessionContext {
		readonly chatSessionItem: ChatSessionItem; // Maps to URI of chat session editor (could be 'untitled-1', etc..)
		readonly isUntitled: boolean;
	}

	export interface ChatSessionCapabilities {
		/**
		 * Whether sessions can be interrupted and resumed without side-effects.
		 */
		supportsInterruptions?: boolean;

		/**
		 * Contributed chat modes available to this session type. When this array is defined and non-empty,
		 * the chat mode picker UI will be shown. Omit (or provide an empty array) to hide the mode picker.
		 * The first element is used if no {@link defaultModeId} is provided or doesn't match any entry.
		 */
		modes?: { id: string; label: string; description?: string }[];

		/**
		 * Identifier of the mode that should be preselected initially. Must correspond to an `id` in {@link modes}.
		 * Ignored if it does not match any contributed mode.
		 */
		defaultModeId?: string;

		/**
		 * Contributed models available to this session type. When this array is defined and non-empty,
		 * the chat model picker UI will be shown. Omit (or provide an empty array) to hide the model picker.
		 * The first element is used if no {@link defaultModelId} is provided or doesn't match any entry.
		 */
		models?: { id: string; label: string; description?: string; category?: string }[];

		/**
		 * Identifier of the model that should be preselected initially. Must correspond to an `id` in {@link models}.
		 * Ignored if it does not match any contributed model.
		 */
		defaultModelId?: string;
	}

	export interface ChatSessionShowOptions {
		/**
		 * The editor view column to show the chat session in.
		 *
		 * If not provided, the chat session will be shown in the chat panel instead.
		 */
		readonly viewColumn?: ViewColumn;
	}

	export namespace window {
		/**
		 * Shows a chat session in the panel or editor.
		 */
		export function showChatSession(chatSessionType: string, sessionId: string, options: ChatSessionShowOptions): Thenable<void>;
	}
}
