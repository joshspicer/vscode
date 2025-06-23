/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewDescriptor, IViewsRegistry, Extensions, ViewContainer, IViewDescriptorService, IViewBadge } from '../../../common/views.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IRemoteCodingAgentJob, IRemoteCodingAgentsService, REMOTE_CODING_AGENTS_VIEW_ID, REMOTE_CODING_AGENTS_LIST_VIEW_ID, RemoteCodingAgentJobStatus } from '../common/remoteCodingAgents.js';
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
import { IActivityService, NumberBadge } from '../../../services/activity/common/activity.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';

class RemoteCodingAgentsKanbanView extends ViewPane {
	private kanbanContainer: HTMLElement | undefined;
	private columns: Map<string, HTMLElement> = new Map();
	private jobElements: Map<string, HTMLElement> = new Map();
	private isRefreshing: boolean = false;
	private _badge: IViewBadge | undefined;
	private _badgeDisposable: IDisposable | undefined;

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
		@IHoverService hoverService: IHoverService,
		@IActivityService private readonly activityService: IActivityService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		// Listen for job changes and refresh UI automatically
		this._register(this.remoteCodingAgentsService.onJobsChanged(() => {
			this.refreshJobsFromCache();
			this.updateTitleCount();
		}));
	}

	private async updateTitleCount(): Promise<void> {
		try {
			const activeCount = await this.remoteCodingAgentsService.getActiveJobCount();
			if (activeCount > 0) {
				const badge: IViewBadge = {
					value: activeCount,
					tooltip: activeCount === 1
						? localize('remoteCodingAgentsCount.singular', "{0} active task", activeCount)
						: localize('remoteCodingAgentsCount.plural', "{0} active tasks", activeCount)
				};
				this.setBadge(badge);
			} else {
				this.setBadge(undefined);
			}
		} catch (error) {
			console.error('Error updating title count:', error);
		}
	}

	private setBadge(badge: IViewBadge | undefined): void {
		if (this._badge?.value === badge?.value && this._badge?.tooltip === badge?.tooltip) {
			return;
		}

		// Dispose previous badge
		this._badgeDisposable?.dispose();
		this._badgeDisposable = undefined;

		this._badge = badge;
		if (badge) {
			this._badgeDisposable = this.activityService.showViewActivity(this.id, {
				badge: new NumberBadge(badge.value, () => badge.tooltip),
			});
		}
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const viewContainer = append(container, $('.remote-coding-agents-view'));
		this.kanbanContainer = append(viewContainer, $('.remote-coding-agents-kanban'));
		this.createKanbanBoard();
		this.refreshJobs();
		this.updateTitleCount();
	}

	private createKanbanBoard(): void {
		if (!this.kanbanContainer) {
			return;
		}

		// Create columns for each status
		const statuses = [RemoteCodingAgentJobStatus.InProgress, RemoteCodingAgentJobStatus.ReadyForReview, RemoteCodingAgentJobStatus.Completed];
		const statusLabels = {
			[RemoteCodingAgentJobStatus.InProgress]: localize('inProgress', 'In Progress'),
			[RemoteCodingAgentJobStatus.ReadyForReview]: localize('readyForReview', 'Ready for Review'),
			[RemoteCodingAgentJobStatus.Completed]: localize('completed', 'Completed')
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
			const jobsByStatus = new Map<RemoteCodingAgentJobStatus, IRemoteCodingAgentJob[]>();
			jobs.forEach(job => {
				const status = job.status || RemoteCodingAgentJobStatus.InProgress;
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
			const jobsByStatus = new Map<RemoteCodingAgentJobStatus, IRemoteCodingAgentJob[]>();
			jobs.forEach(job => {
				const status = job.status || RemoteCodingAgentJobStatus.InProgress;
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

		const agentInfo = append(header, $('.kanban-job-agent'));

		// Get the provider to access its codicon
		const provider = this.remoteCodingAgentsService.getProviders().find(p => p.id === job.agentId);
		if (provider) {
			// Create icon element and text content separately
			const iconElement = renderIcon(Codicon[provider.codicon as keyof typeof Codicon] || Codicon.robot);
			agentInfo.appendChild(iconElement);

			// Add a space and the display name
			const textNode = document.createTextNode(` ${provider.displayName}`);
			agentInfo.appendChild(textNode);
		} else {
			// Fallback if provider not found
			agentInfo.textContent = job.agentId;
		}

		const content = append(card, $('.kanban-job-content'));
		const prompt = append(content, $('.kanban-job-prompt'));
		const promptText = job.prompt || 'No description available';
		prompt.textContent = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;

		// Add git metadata if available
		if (job.metadata?.git) {
			const gitInfo = append(content, $('.kanban-job-git-info'));

			// Create additions info
			if (job.metadata.git.additions > 0) {
				const additionsSpan = append(gitInfo, $('.git-additions'));
				additionsSpan.textContent = `+${job.metadata.git.additions}`;
			}

			// Create deletions info
			if (job.metadata.git.deletions > 0) {
				const deletionsSpan = append(gitInfo, $('.git-deletions'));
				deletionsSpan.textContent = `-${job.metadata.git.deletions}`;
			}
		}

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

		// Get available operations from the provider
		const operations = await this.remoteCodingAgentsService.getAvailableOperations(job.agentId, job.status);

		if (!operations || operations.length === 0) {
			return;
		}

		let selectedOperation: string;

		if (operations.length === 1) {
			// If there's only one operation, execute it directly
			selectedOperation = operations[0];
		} else {
			// If there are multiple operations, show a quick pick
			const quickInputService = this.instantiationService.invokeFunction(accessor => accessor.get(IQuickInputService));
			const selectedAction = await quickInputService.pick(operations.map(operation => ({ label: operation })), {
				placeHolder: `What would you like to do with ${job.name}?`
			});

			if (!selectedAction) {
				return;
			}

			selectedOperation = selectedAction.label;
		}

		// Execute the operation through the service
		try {
			await this.remoteCodingAgentsService.operateJob(job.agentId, job.id, selectedOperation);
		} catch (error) {
			console.error(`Failed to execute operation ${selectedOperation} on job ${job.id}:`, error);
		}
	}

	private updateColumnCount(status: string, count: number): void {
		const column = this.kanbanContainer?.querySelector(`[data-status="${status}"]`);
		const countElement = column?.querySelector('.kanban-column-count');
		if (countElement) {
			countElement.textContent = count.toString();
		}
	}

	override dispose(): void {
		this._badgeDisposable?.dispose();
		super.dispose();
	}

	override shouldShowWelcome(): boolean {
		return false;
	}
}

class RemoteCodingAgentsListView extends ViewPane {
	private treeContainer: HTMLElement | undefined;

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

		this._register(this.remoteCodingAgentsService.onJobsChanged(() => {
			this.refresh();
		}));
	}

	protected override renderBody(container: HTMLElement): void {
		this.treeContainer = append(container, $('.remote-coding-agents-tree'));
		this.refresh();
	}

	private async refresh(): Promise<void> {
		if (!this.treeContainer) {
			return;
		}

		// Clear existing content
		clearNode(this.treeContainer);

		try {
			const jobs = await this.remoteCodingAgentsService.getJobs();
			const providers = this.remoteCodingAgentsService.getProviders();

			// Create a simple list of job items
			jobs.forEach(job => {
				const provider = providers.find(p => p.id === job.agentId);
				const jobElement = this.createJobElement(job, provider);
				this.treeContainer!.appendChild(jobElement);
			});

		} catch (error) {
			console.error('Error refreshing remote coding agents list:', error);
		}
	}

	private createJobElement(job: IRemoteCodingAgentJob, provider?: { id: string; displayName: string; codicon: string }): HTMLElement {
		const element = document.createElement('div');
		element.className = 'tree-job-item';
		element.setAttribute('role', 'treeitem');
		element.setAttribute('tabindex', '0');

		// Job content (removed status icon)
		const content = append(element, $('.job-content'));

		// Title and status
		const header = append(content, $('.job-header'));
		const title = append(header, $('.job-title'));
		title.textContent = job.name;

		const status = append(header, $('.job-status'));
		status.textContent = this.formatJobStatus(job.status);
		status.className = `job-status status-${job.status.toLowerCase()}`;

		// Description
		const description = append(content, $('.job-description'));
		const promptText = job.prompt || 'No description available';
		description.textContent = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;

		// Footer with agent and git info
		const footer = append(content, $('.job-footer'));

		// Agent info
		const agent = append(footer, $('.job-agent'));
		if (provider) {
			const providerIcon = renderIcon(Codicon[provider.codicon as keyof typeof Codicon] || Codicon.robot);
			agent.appendChild(providerIcon);
			const agentText = document.createTextNode(` ${provider.displayName}`);
			agent.appendChild(agentText);
		} else {
			agent.textContent = job.agentId;
		}

		// Git info
		if (job.metadata?.git) {
			const gitInfo = append(footer, $('.job-git-info'));
			if (job.metadata.git.additions > 0 || job.metadata.git.deletions > 0) {
				gitInfo.textContent = `+${job.metadata.git.additions || 0} -${job.metadata.git.deletions || 0}`;
			}
		}

		// Make clickable
		this._register(addDisposableListener(element, 'click', () => this.onJobClick(job)));
		this._register(addDisposableListener(element, 'keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				this.onJobClick(job);
			}
		}));

		return element;
	}

	private formatJobStatus(status: RemoteCodingAgentJobStatus): string {
		switch (status) {
			case RemoteCodingAgentJobStatus.InProgress:
				return 'In Progress';
			case RemoteCodingAgentJobStatus.ReadyForReview:
				return 'Ready for Review';
			case RemoteCodingAgentJobStatus.Completed:
				return 'Completed';
			default:
				return status;
		}
	}

	private async onJobClick(job: IRemoteCodingAgentJob): Promise<void> {
		// Find the provider for this job
		const provider = this.remoteCodingAgentsService.getProviders().find(p => p.id === job.agentId);
		if (!provider) {
			console.warn(`No provider found for agent ${job.agentId}`);
			return;
		}

		// Get available operations from the provider
		try {
			const operations = await provider.provideAvailableOperations(job.status);
			if (!operations || operations.length === 0) {
				return;
			}

			// For now, just log the operations. In a real implementation, you'd show a context menu or quick pick
			console.log(`Available operations for ${job.name}:`, operations);
		} catch (error) {
			console.error('Error getting operations for job:', error);
		}
	}

	override dispose(): void {
		super.dispose();
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

		// Register kanban view
		const kanbanDescriptor: IViewDescriptor = {
			id: REMOTE_CODING_AGENTS_VIEW_ID,
			name: { value: 'Kanban', original: 'Kanban' },
			ctorDescriptor: new SyncDescriptor(RemoteCodingAgentsKanbanView),
			canToggleVisibility: true,
			canMoveView: false,
			collapsed: false,
			hideByDefault: false,
			order: 100
		};

		// Register list view
		const listDescriptor: IViewDescriptor = {
			id: REMOTE_CODING_AGENTS_LIST_VIEW_ID,
			name: { value: 'List', original: 'List' },
			ctorDescriptor: new SyncDescriptor(RemoteCodingAgentsListView),
			canToggleVisibility: true,
			canMoveView: false,
			collapsed: true,
			hideByDefault: false,
			order: 200
		};

		viewsRegistry.registerViews([kanbanDescriptor, listDescriptor], container);
	}
}
