/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatProgress } from '../../chat/common/chatService.js';

export interface IActiveCodingAgentSession {
	agentId: string;
	jobId: string;
	progressCallback: (progress: IChatProgress[]) => void;
}

export const IRemoteCodingAgentsSessionService = createDecorator<IRemoteCodingAgentsSessionService>('remoteCodingAgentsSessionService');

export interface IRemoteCodingAgentsSessionService {
	_serviceBrand: undefined;

	registerActiveSession(agentId: string, jobId: string, progressCallback: (progress: IChatProgress[]) => void): void;
	unregisterActiveSession(agentId: string, jobId: string): void;
	streamProgressToSession(agentId: string, jobId: string, progress: IChatProgress): void;
}

export class RemoteCodingAgentsSessionService extends Disposable implements IRemoteCodingAgentsSessionService {
	_serviceBrand: undefined;

	private readonly activeSessions = new Map<string, IActiveCodingAgentSession>();

	private getSessionKey(agentId: string, jobId: string): string {
		return `${agentId}::${jobId}`;
	}

	registerActiveSession(agentId: string, jobId: string, progressCallback: (progress: IChatProgress[]) => void): void {
		const key = this.getSessionKey(agentId, jobId);
		this.activeSessions.set(key, { agentId, jobId, progressCallback });
	}

	unregisterActiveSession(agentId: string, jobId: string): void {
		const key = this.getSessionKey(agentId, jobId);
		this.activeSessions.delete(key);
	}

	streamProgressToSession(agentId: string, jobId: string, progress: IChatProgress): void {
		const key = this.getSessionKey(agentId, jobId);
		const session = this.activeSessions.get(key);

		if (session) {
			session.progressCallback([progress]);
		}
	}
}
