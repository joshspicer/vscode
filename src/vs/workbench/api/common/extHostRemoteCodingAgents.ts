/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import { Emitter, Event } from '../../../base/common/event.js';
import { IDisposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { ExtHostRemoteCodingAgentsShape, MainContext, MainThreadRemoteCodingAgentsShape, IRemoteCodingAgentJobDto, IRemoteCodingJobsChangeEventDto } from './extHost.protocol.js';
import { IExtHostRpcService } from './extHostRpcService.js';

export interface IExtHostRemoteCodingAgents extends ExtHostRemoteCodingAgents { }
export const IExtHostRemoteCodingAgents = createDecorator<IExtHostRemoteCodingAgents>('IExtHostRemoteCodingAgents');

interface ProviderData {
	provider: vscode.RemoteCodingAgentProvider;
	disposables: DisposableStore;
}

export class ExtHostRemoteCodingAgents implements ExtHostRemoteCodingAgentsShape {

	declare readonly _serviceBrand: undefined;

	private readonly _proxy: MainThreadRemoteCodingAgentsShape;
	private readonly _providers = new Map<string, ProviderData>();
	private readonly _onDidChangeJobs = new Emitter<vscode.RemoteCodingJobsChangeEvent>();

	constructor(@IExtHostRpcService extHostRpc: IExtHostRpcService) {
		this._proxy = extHostRpc.getProxy(MainContext.MainThreadRemoteCodingAgents);
	}

	get onDidChangeJobs(): Event<vscode.RemoteCodingJobsChangeEvent> {
		return this._onDidChangeJobs.event;
	}

	registerRemoteCodingAgentProvider(provider: vscode.RemoteCodingAgentProvider): IDisposable {
		const providerId = provider.id;

		if (this._providers.has(providerId)) {
			throw new Error(`Provider with id '${providerId}' is already registered`);
		}

		const disposables = new DisposableStore();
		const providerData: ProviderData = { provider, disposables };

		// Listen to provider events and forward to main thread
		disposables.add(provider.onDidChangeJobs(event => {
			const eventDto: IRemoteCodingJobsChangeEventDto = {
				added: event.added.map(job => this.convertJobToDto(job)),
				changed: event.changed.map(job => this.convertJobToDto(job)),
				removed: event.removed.map(job => this.convertJobToDto(job))
			};
			this._proxy.$onDidChangeJobs(providerId, eventDto);
			this._onDidChangeJobs.fire(event);
		}));

		this._providers.set(providerId, providerData);
		this._proxy.$registerProvider(providerId, provider.displayName, provider.description);

		return {
			dispose: () => {
				this._providers.delete(providerId);
				disposables.dispose();
				this._proxy.$unregisterProvider(providerId);
			}
		};
	}

	async $provideJobCreation(providerId: string, prompt: string): Promise<IRemoteCodingAgentJobDto | undefined> {
		const providerData = this._providers.get(providerId);
		if (!providerData) {
			throw new Error(`No provider found for id: ${providerId}`);
		}

		try {
			const job = await providerData.provider.provideJobCreation(prompt, {
				isCancellationRequested: false,
				onCancellationRequested: Event.None
			});
			return job ? this.convertJobToDto(job) : undefined;
		} catch (error) {
			console.error(`Error in provideJobCreation for provider ${providerId}:`, error);
			throw error;
		}
	}

	async $provideJobs(providerId: string): Promise<IRemoteCodingAgentJobDto[]> {
		const providerData = this._providers.get(providerId);
		if (!providerData) {
			throw new Error(`No provider found for id: ${providerId}`);
		}

		try {
			const jobs = await providerData.provider.provideJobs({
				isCancellationRequested: false,
				onCancellationRequested: Event.None
			});
			return jobs.map(job => this.convertJobToDto(job));
		} catch (error) {
			console.error(`Error in provideJobs for provider ${providerId}:`, error);
			throw error;
		}
	}

	async $provideJobOperation(providerId: string, jobId: string, operation: string): Promise<void> {
		const providerData = this._providers.get(providerId);
		if (!providerData) {
			throw new Error(`No provider found for id: ${providerId}`);
		}

		try {
			await providerData.provider.provideJobOperation(jobId, operation, {
				isCancellationRequested: false,
				onCancellationRequested: Event.None
			});
		} catch (error) {
			console.error(`Error in provideJobOperation for provider ${providerId}:`, error);
			throw error;
		}
	}

	private convertJobToDto(job: vscode.RemoteCodingAgentJob): IRemoteCodingAgentJobDto {
		return {
			id: job.id,
			name: job.name,
			status: job.status,
			agentId: job.agentId,
			prompt: job.prompt
		};
	}
}
