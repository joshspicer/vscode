/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, toDisposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { ContextKeyExpr, IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ChatContextKeys } from '../../chat/common/chatContextKeys.js';

export interface IRemoteCodingAgent {
	id: string;
	command: string;
	displayName: string;
	description?: string;
	followUpRegex?: string;
	when?: string;
}

export interface IRemoteCodingAgentStatusData {
	filesChanged?: {
		uri: string;
		changeType: 'created' | 'modified' | 'deleted';
		preview?: string;
	}[];
	messages?: {
		messageType: 'request' | 'response';
		content: string;
		timestamp: number;
	}[];
	logs?: {
		level: 'info' | 'warn' | 'error';
		message: string;
		timestamp: number;
	}[];
	links?: {
		uri: string;
		label: string;
		tooltip?: string;
	}[];
	/**
	 * Optional icon to display for this agent's current state.
	 * If not provided, VS Code will choose an appropriate icon based on the status.
	 */
	icon?: {
		id: string;
		color?: string;
	};
}

export interface IRemoteCodingAgentStatusUpdate {
	agentId: string;
	jobId?: string;
	timestamp: number;
	data: IRemoteCodingAgentStatusData;
	/**
	 * Optional command to execute when this status item is clicked in the tree view.
	 */
	command?: string;
}

export interface IRemoteCodingAgentStatusProvider {
	onDidUpdateStatus: Event<IRemoteCodingAgentStatusUpdate>;
}

export interface IRemoteCodingAgentsService {
	readonly _serviceBrand: undefined;
	getRegisteredAgents(): IRemoteCodingAgent[];
	getAvailableAgents(): IRemoteCodingAgent[];
	registerAgent(agent: IRemoteCodingAgent): void;
	onDidUpdateStatus: Event<IRemoteCodingAgentStatusUpdate>;
	registerStatusProvider(provider: IRemoteCodingAgentStatusProvider): IDisposable;
	reportStatus(update: IRemoteCodingAgentStatusUpdate): void;
	getCurrentStatusUpdates(): IRemoteCodingAgentStatusUpdate[];
}

export const IRemoteCodingAgentsService = createDecorator<IRemoteCodingAgentsService>('remoteCodingAgentsService');

export class RemoteCodingAgentsService extends Disposable implements IRemoteCodingAgentsService {
	readonly _serviceBrand: undefined;
	private readonly _ctxHasRemoteCodingAgent: IContextKey<boolean>;
	private readonly agents: IRemoteCodingAgent[] = [];
	private readonly contextKeys = new Set<string>();
	private readonly statusProviders = new Set<IRemoteCodingAgentStatusProvider>();
	private readonly _onDidUpdateStatus = this._register(new Emitter<IRemoteCodingAgentStatusUpdate>());
	readonly onDidUpdateStatus = this._onDidUpdateStatus.event;

	// Keep track of recent status updates so views can get current state
	private readonly recentStatusUpdates = new Map<string, IRemoteCodingAgentStatusUpdate>();

	constructor(
		@IContextKeyService private readonly contextKeyService: IContextKeyService
	) {
		super();
		this._ctxHasRemoteCodingAgent = ChatContextKeys.hasRemoteCodingAgent.bindTo(this.contextKeyService);

		// Listen for context changes and re-evaluate agent availability
		this._register(Event.filter(contextKeyService.onDidChangeContext, e => e.affectsSome(this.contextKeys))(() => {
			this.updateContextKeys();
		}));
	}

	getRegisteredAgents(): IRemoteCodingAgent[] {
		return [...this.agents];
	}

	getAvailableAgents(): IRemoteCodingAgent[] {
		return this.agents.filter(agent => this.isAgentAvailable(agent));
	}

	registerAgent(agent: IRemoteCodingAgent): void {
		// Check if agent already exists
		const existingIndex = this.agents.findIndex(a => a.id === agent.id);
		if (existingIndex >= 0) {
			// Update existing agent
			this.agents[existingIndex] = agent;
		} else {
			// Add new agent
			this.agents.push(agent);
		}

		// Track context keys from the when condition
		if (agent.when) {
			const whenExpr = ContextKeyExpr.deserialize(agent.when);
			if (whenExpr) {
				for (const key of whenExpr.keys()) {
					this.contextKeys.add(key);
				}
			}
		}

		this.updateContextKeys();
	}

	private isAgentAvailable(agent: IRemoteCodingAgent): boolean {
		if (!agent.when) {
			return true;
		}

		const whenExpr = ContextKeyExpr.deserialize(agent.when);
		return !whenExpr || this.contextKeyService.contextMatchesRules(whenExpr);
	}

	private updateContextKeys(): void {
		const hasAvailableAgent = this.getAvailableAgents().length > 0;
		this._ctxHasRemoteCodingAgent.set(hasAvailableAgent);
	}

	registerStatusProvider(provider: IRemoteCodingAgentStatusProvider): IDisposable {
		this.statusProviders.add(provider);
		const disposable = this._register(provider.onDidUpdateStatus(update => {
			this._onDidUpdateStatus.fire(update);
		}));

		return toDisposable(() => {
			this.statusProviders.delete(provider);
			disposable.dispose();
		});
	}

	reportStatus(update: IRemoteCodingAgentStatusUpdate): void {
		console.log('RemoteCodingAgentsService: reportStatus called with:', update);

		// Store the update for late-joining views
		const key = `${update.agentId}-${update.jobId || 'default'}`;
		this.recentStatusUpdates.set(key, update);

		this._onDidUpdateStatus.fire(update);
		console.log('RemoteCodingAgentsService: Event fired to', this._onDidUpdateStatus.event);
	}

	// New method to get current status updates for views that join late
	getCurrentStatusUpdates(): IRemoteCodingAgentStatusUpdate[] {
		return Array.from(this.recentStatusUpdates.values());
	}
}

registerSingleton(IRemoteCodingAgentsService, RemoteCodingAgentsService, InstantiationType.Delayed);
