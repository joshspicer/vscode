/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IRemoteCodingAgent, IRemoteCodingAgentJob, IRemoteCodingAgentsService } from '../common/remoteCodingAgents.js';

export class RemoteCodingAgentsService extends Disposable implements IRemoteCodingAgentsService {
	declare _serviceBrand: undefined;

	private _agents: IRemoteCodingAgent[] = [];
	private _jobs: IRemoteCodingAgentJob[] = [];

	private readonly _onJobsChanged = this._register(new Emitter<void>());
	readonly onJobsChanged: Event<void> = this._onJobsChanged.event;

	constructor(@ICommandService private readonly commandService: ICommandService) {
		super();
	}

	private fireJobsChanged(): void {
		this._onJobsChanged.fire();
	}

	registerAgent(agent: IRemoteCodingAgent): IDisposable {
		this._agents.push(agent);
		return { dispose: () => { this._agents = this._agents.filter(a => a !== agent); } };
	}

	getAgents(): IRemoteCodingAgent[] {
		return [...this._agents];
	}

	async createJob(input: string, agentId: string): Promise<IRemoteCodingAgentJob | undefined> {
		console.log('Available agents:', this._agents);
		console.log('createJob called with input:', input, 'agentId:', agentId);
		const agent = agentId ? this._agents.find(a => a.id === agentId) : this._agents[0];
		if (!agent) {
			console.log('No agent found');
			return undefined;
		}
		console.log('Using agent:', agent);
		const result = await this.commandService.executeCommand<IRemoteCodingAgentJob | undefined>(agent.createCommand, input);
		if (result) {
			this._jobs.push(result);
			this.fireJobsChanged();
		}
		console.log('createJob result:', result);
		return result;
	}

	async getJobs(refresh = true): Promise<IRemoteCodingAgentJob[]> {
		if (!refresh) {
			return [...this._jobs];
		}

		const previousJobsCount = this._jobs.length;
		const previousJobs = this._jobs.map(j => ({ id: j.id, status: j.status }));

		for (const agent of this._agents) {
			if (agent.statusCommand) {
				try {
					const jobs = await this.commandService.executeCommand<IRemoteCodingAgentJob[]>(agent.statusCommand);
					if (Array.isArray(jobs)) {
						for (const job of jobs) {
							job.agentId = agent.id;
							const existing = this._jobs.find(j => j.id === job.id && j.agentId === agent.id);
							if (existing) {
								existing.status = job.status;
							} else {
								this._jobs.push(job);
							}
						}
					}
				} catch {
					// ignore
				}
			}
		}

		// Check if jobs changed
		const currentJobs = this._jobs.map(j => ({ id: j.id, status: j.status }));
		const jobsChanged = this._jobs.length !== previousJobsCount ||
			JSON.stringify(previousJobs) !== JSON.stringify(currentJobs);

		if (jobsChanged) {
			this.fireJobsChanged();
		}

		return [...this._jobs];
	}

	async operateJob(agentId: string, jobId: string, operation: string): Promise<void> {
		const agent = this._agents.find(a => a.id === agentId);
		if (!agent || !agent.operateCommand) {
			return;
		}
		await this.commandService.executeCommand(agent.operateCommand, jobId, operation);
		this.fireJobsChanged();
	}
}
