/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IRemoteCodingAgentJob, IRemoteCodingAgentsService, IRemoteCodingAgentProvider, IRemoteCodingJobsChangeEvent, RemoteCodingAgentJobStatus } from '../common/remoteCodingAgents.js';

export class RemoteCodingAgentsService extends Disposable implements IRemoteCodingAgentsService {
	declare _serviceBrand: undefined;

	private _providers: IRemoteCodingAgentProvider[] = [];

	private readonly _onJobsChanged = this._register(new Emitter<IRemoteCodingJobsChangeEvent>());
	readonly onJobsChanged: Event<IRemoteCodingJobsChangeEvent> = this._onJobsChanged.event;

	constructor() {
		super();
	}

	private fireJobsChanged(event: IRemoteCodingJobsChangeEvent): void {
		this._onJobsChanged.fire(event);
	}

	registerProvider(provider: IRemoteCodingAgentProvider): IDisposable {
		this._providers.push(provider);

		// Listen to provider job changes and forward them
		const disposable = provider.onDidChangeJobs(event => {
			this.fireJobsChanged(event);
		});

		return {
			dispose: () => {
				this._providers = this._providers.filter(p => p !== provider);
				disposable.dispose();
			}
		};
	}

	getProviders(): IRemoteCodingAgentProvider[] {
		return [...this._providers];
	}

	async createJob(input: string, agentId: string): Promise<IRemoteCodingAgentJob | undefined> {
		const provider = agentId ? this._providers.find(p => p.id === agentId) : this._providers[0];
		if (!provider) {
			return undefined;
		}

		try {
			return await provider.provideJobCreation(input);
		} catch (error) {
			console.error('Provider createJob error:', error);
			return undefined;
		}
	}

	async getJobs(refresh = true): Promise<IRemoteCodingAgentJob[]> {
		const allJobs: IRemoteCodingAgentJob[] = [];

		// Get jobs from providers
		for (const provider of this._providers) {
			try {
				const jobs = await provider.provideJobs();
				if (Array.isArray(jobs)) {
					allJobs.push(...jobs);
				}
			} catch (e: any) {
				console.warn(`Failed to fetch jobs from provider ${provider.id}: ${e.message}`);
			}
		}

		return allJobs;
	}

	async operateJob(agentId: string, jobId: string, operation: string): Promise<void> {
		const provider = this._providers.find(p => p.id === agentId);
		if (!provider) {
			return;
		}

		try {
			await provider.provideJobOperation(jobId, operation);
		} catch (error) {
			console.error('Provider operateJob error:', error);
		}
	}

	async getAvailableOperations(agentId: string, status: RemoteCodingAgentJobStatus): Promise<string[] | undefined> {
		const provider = this._providers.find(p => p.id === agentId);
		if (!provider) {
			return undefined;
		}

		try {
			return await provider.provideAvailableOperations(status);
		} catch (error) {
			console.error('Provider getAvailableOperations error:', error);
			return undefined;
		}
	}

	async getJobCountByStatus(status: RemoteCodingAgentJobStatus): Promise<number> {
		const jobs = await this.getJobs();
		return jobs.filter(job => job.status === status).length;
	}

	async getActiveJobCount(): Promise<number> {
		const jobs = await this.getJobs();
		return jobs.filter(job =>
			job.status === RemoteCodingAgentJobStatus.InProgress ||
			job.status === RemoteCodingAgentJobStatus.ReadyForReview
		).length;
	}
}
