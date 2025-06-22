/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableMap } from '../../../base/common/lifecycle.js';
import { IRemoteCodingAgentsService, IRemoteCodingAgentProvider, IRemoteCodingAgentJob, IRemoteCodingJobsChangeEvent, RemoteCodingAgentJobStatus } from '../../contrib/remoteCodingAgents/common/remoteCodingAgents.js';
import { extHostNamedCustomer, IExtHostContext } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, ExtHostRemoteCodingAgentsShape, MainThreadRemoteCodingAgentsShape, MainContext, IRemoteCodingAgentJobDto, IRemoteCodingJobsChangeEventDto } from '../common/extHost.protocol.js';
import { Event, Emitter } from '../../../base/common/event.js';

class MainThreadRemoteCodingAgentProvider implements IRemoteCodingAgentProvider {
	private readonly _onDidChangeJobs = new Emitter<IRemoteCodingJobsChangeEvent>();
	readonly onDidChangeJobs: Event<IRemoteCodingJobsChangeEvent> = this._onDidChangeJobs.event;

	constructor(
		private readonly _id: string,
		private readonly _displayName: string,
		private readonly _description: string | undefined,
		private readonly _proxy: ExtHostRemoteCodingAgentsShape
	) { }

	public get id(): string {
		return this._id;
	}

	public get displayName(): string {
		return this._displayName;
	}

	public get description(): string | undefined {
		return this._description;
	}

	public fireDidChangeJobs(event: IRemoteCodingJobsChangeEventDto): void {
		const convertedEvent: IRemoteCodingJobsChangeEvent = {
			added: event.added.map(job => this.convertJobFromDto(job)),
			changed: event.changed.map(job => this.convertJobFromDto(job)),
			removed: event.removed.map(job => this.convertJobFromDto(job))
		};
		this._onDidChangeJobs.fire(convertedEvent);
	}

	async provideJobCreation(prompt: string): Promise<IRemoteCodingAgentJob | undefined> {
		const jobDto = await this._proxy.$provideJobCreation(this._id, prompt);
		return jobDto ? this.convertJobFromDto(jobDto) : undefined;
	}

	async provideJobs(): Promise<IRemoteCodingAgentJob[]> {
		const jobDtos = await this._proxy.$provideJobs(this._id);
		return jobDtos.map(job => this.convertJobFromDto(job));
	}

	async provideJobOperation(jobId: string, operation: string): Promise<void> {
		await this._proxy.$provideJobOperation(this._id, jobId, operation);
	}

	dispose(): void {
		this._onDidChangeJobs.dispose();
	}

	private convertJobFromDto(jobDto: IRemoteCodingAgentJobDto): IRemoteCodingAgentJob {
		return {
			id: jobDto.id,
			name: jobDto.name,
			status: jobDto.status as RemoteCodingAgentJobStatus,
			agentId: jobDto.agentId,
			prompt: jobDto.prompt
		};
	}
}

@extHostNamedCustomer(MainContext.MainThreadRemoteCodingAgents)
export class MainThreadRemoteCodingAgents extends Disposable implements MainThreadRemoteCodingAgentsShape {

	private readonly _proxy: ExtHostRemoteCodingAgentsShape;
	private readonly _providers = new DisposableMap<string, MainThreadRemoteCodingAgentProvider>();

	constructor(
		extHostContext: IExtHostContext,
		@IRemoteCodingAgentsService private readonly _remoteCodingAgentsService: IRemoteCodingAgentsService
	) {
		super();
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostRemoteCodingAgents);
	}

	$registerProvider(providerId: string, displayName: string, description?: string): void {
		if (this._providers.has(providerId)) {
			throw new Error(`Provider with id '${providerId}' is already registered`);
		}

		const provider = new MainThreadRemoteCodingAgentProvider(providerId, displayName, description, this._proxy);
		const disposable = this._remoteCodingAgentsService.registerProvider(provider);

		this._providers.set(providerId, provider);
		this._register(disposable);
	}

	$unregisterProvider(providerId: string): void {
		this._providers.deleteAndDispose(providerId);
	}

	$onDidChangeJobs(providerId: string, event: IRemoteCodingJobsChangeEventDto): void {
		const provider = this._providers.get(providerId);
		if (provider) {
			provider.fireDidChangeJobs(event);
		}
	}

	override dispose(): void {
		this._providers.dispose();
		super.dispose();
	}
}
