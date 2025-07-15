/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatProgress, ICodingAgentStatusUpdate } from '../../../contrib/chat/common/chatService.js';
import { IRemoteCodingAgentStatusUpdate, IRemoteCodingAgentsService } from './remoteCodingAgentsService.js';
import { URI } from '../../../../base/common/uri.js';
import { ThemeColor } from '../../../../base/common/themables.js';

export const IRemoteCodingAgentsSessionService = createDecorator<IRemoteCodingAgentsSessionService>('remoteCodingAgentsSessionService');

export interface IRemoteCodingAgentsSessionService {
	readonly _serviceBrand: undefined;
	registerActiveSession(agentId: string, jobId: string, progress: (progress: IChatProgress[]) => void): IDisposable;
	streamProgressToSession(agentId: string, jobId: string, progress: IChatProgress): void;
}

interface IActiveSession {
	progress: (progress: IChatProgress[]) => void;
	isActive: boolean;
}

export class RemoteCodingAgentsSessionService extends Disposable implements IRemoteCodingAgentsSessionService {
	_serviceBrand: undefined;

	private readonly activeSessions = new Map<string, IActiveSession>();

	constructor(
		@IRemoteCodingAgentsService private readonly remoteCodingAgentsService: IRemoteCodingAgentsService
	) {
		super();

		// Listen for status updates from the remote coding agents service
		this._register(this.remoteCodingAgentsService.onDidUpdateStatus((statusUpdate: IRemoteCodingAgentStatusUpdate) => {
			this.handleStatusUpdate(statusUpdate);
		}));
	}

	registerActiveSession(agentId: string, jobId: string, progress: (progress: IChatProgress[]) => void): IDisposable {
		const sessionKey = this.getSessionKey(agentId, jobId);

		const session: IActiveSession = {
			progress,
			isActive: true
		};

		this.activeSessions.set(sessionKey, session);

		// Return a disposable that will clean up the session
		return toDisposable(() => {
			const existingSession = this.activeSessions.get(sessionKey);
			if (existingSession) {
				existingSession.isActive = false;
				// Keep the session for a short time to handle any final updates
				setTimeout(() => {
					if (this.activeSessions.get(sessionKey) === existingSession) {
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
				session.progress([progress]);
			} catch (error) {
				// Session might have been disposed, remove it
				console.error(`Failed to stream progress to session ${sessionKey}:`, error);
				this.activeSessions.delete(sessionKey);
			}
		}
	}

	private handleStatusUpdate(statusUpdate: IRemoteCodingAgentStatusUpdate): void {
		const sessionKey = this.getSessionKey(statusUpdate.agentId, statusUpdate.jobId || '');
		const session = this.activeSessions.get(sessionKey);

		if (session && session.isActive) {
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
}
