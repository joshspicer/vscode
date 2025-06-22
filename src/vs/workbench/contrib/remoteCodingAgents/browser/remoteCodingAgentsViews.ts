/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewDescriptor, IViewsRegistry, Extensions, ViewContainer, IViewDescriptorService } from '../../../common/views.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IRemoteCodingAgentJob, IRemoteCodingAgentsService, REMOTE_CODING_AGENTS_VIEW_ID, REMOTE_CODING_AGENTS_TITLE } from '../common/remoteCodingAgents.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { append, $, clearNode, addDisposableListener } from '../../../../base/browser/dom.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';

class RemoteCodingAgentsKanbanView extends ViewPane {
	private kanbanContainer: HTMLElement | undefined;
	private columns: Map<string, HTMLElement> = new Map();
	private jobElements: Map<string, HTMLElement> = new Map();
	private isRefreshing: boolean = false;

	constructor(
		options: IViewletViewOptions,
		@IRemoteCodingAgentsService private readonly remoteCodingAgentsService: IRemoteCodingAgentsService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		// Listen for job changes and refresh UI automatically
		this._register(this.remoteCodingAgentsService.onJobsChanged(() => {
			this.refreshJobsFromCache();
		}));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const viewContainer = append(container, $('.remote-coding-agents-view'));
		this.kanbanContainer = append(viewContainer, $('.remote-coding-agents-kanban'));
		this.createKanbanBoard();
		this.refreshJobs();
	}

	private createKanbanBoard(): void {
		if (!this.kanbanContainer) {
			return;
		}

		// Create columns for each status
		const statuses = ['inprogress', 'readyforreview', 'completed'];
		const statusLabels = {
			'inprogress': localize('inProgress', 'In Progress'),
			'readyforreview': localize('readyForReview', 'Ready for Review'),
			'completed': localize('completed', 'Completed')
		};

		statuses.forEach(status => {
			const column = append(this.kanbanContainer!, $('.kanban-column'));
			column.setAttribute('data-status', status);

			const header = append(column, $('.kanban-column-header'));
			const title = append(header, $('.kanban-column-title'));
			title.textContent = statusLabels[status as keyof typeof statusLabels];

			const count = append(header, $('.kanban-column-count'));
			count.textContent = '0';

			const jobsContainer = append(column, $('.kanban-column-jobs'));
			this.columns.set(status, jobsContainer);
		});
	}
	private async refreshJobs(): Promise<void> {
		if (!this.kanbanContainer || this.isRefreshing) {
			return;
		}

		this.isRefreshing = true;
		try {
			// Clear existing jobs
			this.columns.forEach(column => clearNode(column));
			this.jobElements.clear();

			// Get jobs from service with refresh=true for manual refresh
			const jobs = await this.remoteCodingAgentsService.getJobs(true);

			// Group jobs by status
			const jobsByStatus = new Map<string, IRemoteCodingAgentJob[]>();
			jobs.forEach(job => {
				const status = job.status || 'inprogress';
				if (!jobsByStatus.has(status)) {
					jobsByStatus.set(status, []);
				}
				jobsByStatus.get(status)!.push(job);
			});

			// Render jobs in columns
			jobsByStatus.forEach((statusJobs, status) => {
				const column = this.columns.get(status);
				if (column) {
					statusJobs.forEach(job => this.createJobCard(job, column));
					this.updateColumnCount(status, statusJobs.length);
				}
			});
		} finally {
			this.isRefreshing = false;
		}
	}

	private async refreshJobsFromCache(): Promise<void> {
		if (!this.kanbanContainer || this.isRefreshing) {
			return;
		}

		this.isRefreshing = true;
		try {
			// Clear existing jobs
			this.columns.forEach(column => clearNode(column));
			this.jobElements.clear();

			// Get jobs from cache (no refresh)
			const jobs = await this.remoteCodingAgentsService.getJobs(false);

			// Group jobs by status
			const jobsByStatus = new Map<string, IRemoteCodingAgentJob[]>();
			jobs.forEach(job => {
				const status = job.status || 'inprogress';
				if (!jobsByStatus.has(status)) {
					jobsByStatus.set(status, []);
				}
				jobsByStatus.get(status)!.push(job);
			});

			// Render jobs in columns
			jobsByStatus.forEach((statusJobs, status) => {
				const column = this.columns.get(status);
				if (column) {
					statusJobs.forEach(job => this.createJobCard(job, column));
					this.updateColumnCount(status, statusJobs.length);
				}
			});
		} finally {
			this.isRefreshing = false;
		}
	}

	private createJobCard(job: IRemoteCodingAgentJob, container: HTMLElement): void {
		const card = append(container, $('.kanban-job-card'));
		card.setAttribute('data-job-id', job.id);
		card.setAttribute('data-agent-id', job.agentId);
		card.setAttribute('role', 'button');
		card.setAttribute('tabindex', '0');
		card.style.cursor = 'pointer';

		const header = append(card, $('.kanban-job-header'));
		const title = append(header, $('.kanban-job-title'));
		title.textContent = job.name;

		const agent = append(header, $('.kanban-job-agent'));
		agent.textContent = job.agentId;

		const content = append(card, $('.kanban-job-content'));
		const prompt = append(content, $('.kanban-job-prompt'));
		const promptText = job.prompt || 'No description available';
		prompt.textContent = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;

		// Make the entire card clickable
		this._register(addDisposableListener(card, 'click', () => this.onJobCardClick(job)));
		this._register(addDisposableListener(card, 'keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				this.onJobCardClick(job);
			}
		}));

		this.jobElements.set(job.id, card);
	}

	private async onJobCardClick(job: IRemoteCodingAgentJob): Promise<void> {
		// Find the provider for this job
		const provider = this.remoteCodingAgentsService.getProviders().find(p => p.id === job.agentId);
		if (!provider) {
			console.warn(`No provider found for agent ${job.agentId}`);
			return;
		}

		// Show job operation options
		const actions: string[] = [];
		switch (job.status) {
			case 'inprogress':
				actions.push('Cancel');
				break;
			case 'readyforreview':
				actions.push('Approve', 'Reject');
				break;
		}

		if (actions.length === 0) {
			return;
		}

		const quickInputService = this.instantiationService.invokeFunction(accessor => accessor.get(IQuickInputService));
		const selectedAction = await quickInputService.pick(actions.map(action => ({ label: action })), {
			placeHolder: `What would you like to do with ${job.name}?`
		});

		if (!selectedAction) {
			return;
		}

		// Convert UI action to operation
		let operation: string;
		switch (selectedAction.label) {
			case 'Cancel':
				operation = 'cancel';
				break;
			case 'Approve':
				operation = 'approve';
				break;
			case 'Reject':
				operation = 'reject';
				break;
			default:
				return;
		}

		// Execute the operation through the service
		try {
			await this.remoteCodingAgentsService.operateJob(job.agentId, job.id, operation);
		} catch (error) {
			console.error(`Failed to execute operation ${operation} on job ${job.id}:`, error);
		}
	}

	private updateColumnCount(status: string, count: number): void {
		const column = this.kanbanContainer?.querySelector(`[data-status="${status}"]`);
		const countElement = column?.querySelector('.kanban-column-count');
		if (countElement) {
			countElement.textContent = count.toString();
		}
	}

	override shouldShowWelcome(): boolean {
		return false;
	}
}

export class RemoteCodingAgentsViews extends Disposable {
	constructor(container: ViewContainer, @IInstantiationService _instantiationService: IInstantiationService) {
		super();
		this.registerViews(container);
	}

	private registerViews(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);
		const descriptor: IViewDescriptor = {
			id: REMOTE_CODING_AGENTS_VIEW_ID,
			name: REMOTE_CODING_AGENTS_TITLE,
			ctorDescriptor: new SyncDescriptor(RemoteCodingAgentsKanbanView),
			canToggleVisibility: true,
			canMoveView: false,
			collapsed: false,
			hideByDefault: false,
			order: 100
		};
		viewsRegistry.registerViews([descriptor], container);
	}
}
