/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatProgress, ICodingAgentStatusUpdate, IChatService } from '../../../contrib/chat/common/chatService.js';
import { IRemoteCodingAgentStatusUpdate, IRemoteCodingAgentsService } from './remoteCodingAgentsService.js';
import { URI } from '../../../../base/common/uri.js';
import { ThemeColor } from '../../../../base/common/themables.js';

export const IRemoteCodingAgentsSessionService = createDecorator<IRemoteCodingAgentsSessionService>('remoteCodingAgentsSessionService');

export interface IRemoteCodingAgentsSessionService {
	readonly _serviceBrand: undefined;
	registerActiveSession(agentId: string, jobId: string, chatSessionId: string, progress: (progress: IChatProgress[]) => void): IDisposable;
	streamProgressToSession(agentId: string, jobId: string, progress: IChatProgress): void;
	getSessionFiles(agentId: string, jobId: string): URI[];
	onDidUpdateSessionFiles: Event<{ agentId: string; jobId: string; files: URI[] }>;

	// New methods for cross-session capabilities
	getAllActiveSessions(): { agentId: string; jobId: string; chatSessionId: string }[];
	streamToAnySession(chatSessionId: string, progress: IChatProgress): void;
	getSessionByChatId(chatSessionId: string): { agentId: string; jobId: string } | undefined;

	// Methods for chat widget integration
	isCodingAgentSession(chatSessionId: string): boolean;
	getCodingAgentForSession(chatSessionId: string): string | undefined;
}

interface IActiveSession {
	chatSessionId: string;
	progress: (progress: IChatProgress[]) => void;
	isActive: boolean;
	files: Map<string, { uri: URI; changeType: 'created' | 'modified' | 'deleted' }>;
}

export class RemoteCodingAgentsSessionService extends Disposable implements IRemoteCodingAgentsSessionService {
	_serviceBrand: undefined;

	private readonly activeSessions = new Map<string, IActiveSession>();
	private readonly _onDidUpdateSessionFiles = this._register(new Emitter<{ agentId: string; jobId: string; files: URI[] }>());
	readonly onDidUpdateSessionFiles = this._onDidUpdateSessionFiles.event;

	constructor(
		@IRemoteCodingAgentsService private readonly remoteCodingAgentsService: IRemoteCodingAgentsService,
		@IChatService private readonly chatService: IChatService
	) {
		super();

		console.log('RemoteCodingAgentsSessionService: Initializing...');

		// Listen for status updates from the remote coding agents service
		this._register(this.remoteCodingAgentsService.onDidUpdateStatus((statusUpdate: IRemoteCodingAgentStatusUpdate) => {
			this.handleStatusUpdate(statusUpdate);
		}));

		console.log('RemoteCodingAgentsSessionService: Initialization complete');
	}

	registerActiveSession(agentId: string, jobId: string, chatSessionId: string, progress: (progress: IChatProgress[]) => void): IDisposable {
		const sessionKey = this.getSessionKey(agentId, jobId);
		console.log(`RemoteCodingAgentsSessionService: Registering session ${sessionKey} with chatSessionId: ${chatSessionId}`);

		const session: IActiveSession = {
			chatSessionId,
			progress,
			isActive: true,
			files: new Map()
		};

		this.activeSessions.set(sessionKey, session);
		console.log(`RemoteCodingAgentsSessionService: Session ${sessionKey} registered. Total sessions: ${this.activeSessions.size}`);

		// Return a disposable that will clean up the session
		return toDisposable(() => {
			const existingSession = this.activeSessions.get(sessionKey);
			if (existingSession) {
				console.log(`RemoteCodingAgentsSessionService: Deactivating session ${sessionKey}`);
				existingSession.isActive = false;
				// Keep the session for a short time to handle any final updates
				setTimeout(() => {
					if (this.activeSessions.get(sessionKey) === existingSession) {
						console.log(`RemoteCodingAgentsSessionService: Removing session ${sessionKey}`);
						this.activeSessions.delete(sessionKey);
					}
				}, 5000); // 5 second grace period
			}
		});
	}

	streamProgressToSession(agentId: string, jobId: string, progress: IChatProgress): void {
		const sessionKey = this.getSessionKey(agentId, jobId);
		const session = this.activeSessions.get(sessionKey);

		if (session && session.isActive) {
			try {
				// Stream directly to the chat model - this is the primary method now
				this.streamToAnySession(session.chatSessionId, progress);
			} catch (error) {
				// Session might have been disposed, remove it
				console.error(`Failed to stream progress to session ${sessionKey}:`, error);
				this.activeSessions.delete(sessionKey);
			}
		}
	}

	getSessionFiles(agentId: string, jobId: string): URI[] {
		const sessionKey = this.getSessionKey(agentId, jobId);
		const session = this.activeSessions.get(sessionKey);
		if (!session) {
			return [];
		}
		return Array.from(session.files.values())
			.filter(f => f.changeType !== 'deleted')
			.map(f => f.uri);
	}

	private handleStatusUpdate(statusUpdate: IRemoteCodingAgentStatusUpdate): void {
		console.log(`RemoteCodingAgentsSessionService: Received status update for ${statusUpdate.agentId}-${statusUpdate.jobId}:`, statusUpdate);
		const sessionKey = this.getSessionKey(statusUpdate.agentId, statusUpdate.jobId || '');
		const session = this.activeSessions.get(sessionKey);

		if (session && session.isActive) {
			console.log(`RemoteCodingAgentsSessionService: Processing status update for active session ${sessionKey}`);
			// Track file changes
			let filesChanged = false;
			if (statusUpdate.data.filesChanged) {
				console.log(`RemoteCodingAgentsSessionService: Found ${statusUpdate.data.filesChanged.length} file changes`);
				for (const file of statusUpdate.data.filesChanged) {
					const uri = URI.parse(file.uri);
					if (file.changeType === 'deleted') {
						session.files.delete(uri.toString());
					} else {
						session.files.set(uri.toString(), {
							uri,
							changeType: file.changeType
						});
					}
					filesChanged = true;
				}
			}

			// Emit event if files changed
			if (filesChanged) {
				const files = this.getSessionFiles(statusUpdate.agentId, statusUpdate.jobId || '');
				console.log(`RemoteCodingAgentsSessionService: Files changed for ${statusUpdate.agentId}-${statusUpdate.jobId}:`, files);
				this._onDidUpdateSessionFiles.fire({
					agentId: statusUpdate.agentId,
					jobId: statusUpdate.jobId || '',
					files
				});
			}

			// Convert to chat progress format
			const chatProgress: ICodingAgentStatusUpdate = {
				kind: 'codingAgentStatusUpdate',
				agentId: statusUpdate.agentId,
				jobId: statusUpdate.jobId || '',
				timestamp: statusUpdate.timestamp,
				data: {
					filesChanged: statusUpdate.data.filesChanged?.map(f => ({
						uri: URI.parse(f.uri),
						type: f.changeType,
						preview: f.preview
					})),
					messages: statusUpdate.data.messages?.map(m => ({
						type: m.messageType,
						content: m.content,
						timestamp: m.timestamp
					})),
					logs: statusUpdate.data.logs,
					links: statusUpdate.data.links?.map(l => ({
						uri: URI.parse(l.uri),
						label: l.label,
						tooltip: l.tooltip
					})),
					icon: statusUpdate.data.icon ? {
						id: statusUpdate.data.icon.id,
						color: statusUpdate.data.icon.color ? ThemeColor.isThemeColor(statusUpdate.data.icon.color) ? statusUpdate.data.icon.color : { id: statusUpdate.data.icon.color } : undefined
					} : undefined
				}
			};

			// Stream to chat
			this.streamProgressToSession(statusUpdate.agentId, statusUpdate.jobId || '', chatProgress);
		}
	}

	private getSessionKey(agentId: string, jobId: string): string {
		return `${agentId}-${jobId}`;
	}

	// NEW METHOD: Stream to any chat session by ID
	streamToAnySession(chatSessionId: string, progress: IChatProgress): void {
		const chatModel = this.chatService.getSession(chatSessionId);
		if (chatModel) {
			// Get the last request to attach progress to
			const requests = chatModel.getRequests();
			const lastRequest = requests[requests.length - 1];

			if (lastRequest) {
				console.log(`RemoteCodingAgentsSessionService: Streaming progress to chat session ${chatSessionId}`);
				chatModel.acceptResponseProgress(lastRequest, progress, false);
			} else {
				console.warn(`RemoteCodingAgentsSessionService: No requests found in chat session ${chatSessionId}`);
			}
		} else {
			console.warn(`RemoteCodingAgentsSessionService: Chat session ${chatSessionId} not found`);
		}
	}

	// NEW METHOD: Get all active sessions
	getAllActiveSessions(): { agentId: string; jobId: string; chatSessionId: string }[] {
		return Array.from(this.activeSessions.entries()).map(([key, session]) => {
			const [agentId, jobId] = key.split('-');
			return { agentId, jobId, chatSessionId: session.chatSessionId };
		});
	}

	// NEW METHOD: Find session by chat ID
	getSessionByChatId(chatSessionId: string): { agentId: string; jobId: string } | undefined {
		for (const [key, session] of this.activeSessions.entries()) {
			if (session.chatSessionId === chatSessionId) {
				const [agentId, jobId] = key.split('-');
				return { agentId, jobId };
			}
		}
		return undefined;
	}

	// NEW METHOD: Check if a chat session ID corresponds to a coding agent session
	isCodingAgentSession(chatSessionId: string): boolean {
		return Array.from(this.activeSessions.values()).some(session =>
			session.chatSessionId === chatSessionId
		);
	}

	// NEW METHOD: Get the coding agent ID for a specific chat session
	getCodingAgentForSession(chatSessionId: string): string | undefined {
		for (const [key, session] of this.activeSessions.entries()) {
			if (session.chatSessionId === chatSessionId) {
				const [agentId] = key.split('-');
				return agentId;
			}
		}
		return undefined;
	}
}
