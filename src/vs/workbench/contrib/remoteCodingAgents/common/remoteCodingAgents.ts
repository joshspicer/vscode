/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';

export enum RemoteCodingAgentJobStatus {
	InProgress = 'inprogress',
	ReadyForReview = 'readyforreview',
	Completed = 'completed'
}

export interface IRemoteCodingAgentJob {
	id: string;
	name: string;
	status: RemoteCodingAgentJobStatus;
	agentId: string;
	prompt: string;
	metadata?: {
		git?: {
			additions: number;
			deletions: number;
		};
	};
}


export interface IRemoteCodingJobsChangeEvent {
	added: IRemoteCodingAgentJob[];
	changed: IRemoteCodingAgentJob[];
	removed: IRemoteCodingAgentJob[];
}

export interface IRemoteCodingAgentProvider {
	readonly id: string;
	readonly displayName: string;
	readonly description?: string;
	readonly codicon: string;
	readonly onDidChangeJobs: Event<IRemoteCodingJobsChangeEvent>;
	provideJobCreation(prompt: string): Promise<IRemoteCodingAgentJob | undefined>;
	provideJobs(): Promise<IRemoteCodingAgentJob[]>;
	provideJobOperation(jobId: string, operation: string): Promise<void>;
	provideAvailableOperations(status: RemoteCodingAgentJobStatus): Promise<string[] | undefined>;
}

export const REMOTE_CODING_AGENTS_TITLE = localize2('remote coding jobs', 'Agents');
export const REMOTE_CODING_AGENTS_CONTAINER_ID = 'workbench.view.remoteCodingAgents';
export const REMOTE_CODING_AGENTS_VIEW_ID = 'workbench.views.remoteCodingAgents.data';
export const REMOTE_CODING_AGENTS_LIST_VIEW_ID = 'workbench.views.remoteCodingAgents.list';
export const REMOTE_CODING_AGENTS_VIEW_ICON = registerIcon('remote-coding-agents-view-icon', Codicon.cloudUpload, localize('remoteCodingAgentsViewIcon', 'View icon of the remote coding agents view.'));

export const IRemoteCodingAgentsService = createDecorator<IRemoteCodingAgentsService>('remoteCodingAgentsService');
export interface IRemoteCodingAgentsService {
	_serviceBrand: undefined;

	readonly onJobsChanged: Event<IRemoteCodingJobsChangeEvent>;

	registerProvider(provider: IRemoteCodingAgentProvider): IDisposable;
	getProviders(): IRemoteCodingAgentProvider[];

	createJob(input: string, agentId: string): Promise<IRemoteCodingAgentJob | undefined>;
	getJobs(refresh?: boolean): Promise<IRemoteCodingAgentJob[]>;
	operateJob(agentId: string, jobId: string, operation: string): Promise<void>;
	getAvailableOperations(agentId: string, status: RemoteCodingAgentJobStatus): Promise<string[] | undefined>;

	getJobCountByStatus(status: RemoteCodingAgentJobStatus): Promise<number>;
	getActiveJobCount(): Promise<number>; // InProgress + ReadyForReview
}
