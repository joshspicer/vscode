/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';

export interface IRemoteCodingAgentJob {
	id: string;
	name: string;
	status: string;
	agentId: string;
	prompt: string;
}

export interface IRemoteCodingAgent {
	id: string;
	displayName: string;
	description?: string;
	createCommand: string;
	statusCommand?: string;
	operateCommand?: string;
}

export const REMOTE_CODING_AGENTS_TITLE = localize2('remote coding jobs', 'Remote Coding Jobs');
export const REMOTE_CODING_AGENTS_CONTAINER_ID = 'workbench.view.remoteCodingAgents';
export const REMOTE_CODING_AGENTS_VIEW_ID = 'workbench.views.remoteCodingAgents.data';
export const REMOTE_CODING_AGENTS_VIEW_ICON = registerIcon('remote-coding-agents-view-icon', Codicon.cloudUpload, localize('remoteCodingAgentsViewIcon', 'View icon of the remote coding agents view.'));

// Command IDs that extensions can implement
export const REMOTE_CODING_AGENTS_JOB_CLICKED_COMMAND = 'remoteCodingAgents.jobClicked';

export const IRemoteCodingAgentsService = createDecorator<IRemoteCodingAgentsService>('remoteCodingAgentsService');
export interface IRemoteCodingAgentsService {
	_serviceBrand: undefined;

	registerAgent(agent: IRemoteCodingAgent): IDisposable;
	getAgents(): IRemoteCodingAgent[];

	createJob(input: string, agentId: string): Promise<IRemoteCodingAgentJob | undefined>;
	getJobs(): Promise<IRemoteCodingAgentJob[]>;
	operateJob(agentId: string, jobId: string, operation: string): Promise<void>;
}
