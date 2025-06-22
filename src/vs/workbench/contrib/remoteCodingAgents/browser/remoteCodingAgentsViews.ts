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
import { append, $, clearNode } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';

class RemoteCodingAgentsKanbanView extends ViewPane {
	private kanbanContainer: HTMLElement | undefined;
	private columns: Map<string, HTMLElement> = new Map();
	private jobElements: Map<string, HTMLElement> = new Map();

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
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.kanbanContainer = append(container, $('.remote-coding-agents-kanban'));
		this.createKanbanBoard();
		this.refreshJobs();
	}

	private createKanbanBoard(): void {
		if (!this.kanbanContainer) {
			return;
		}

		// Create columns for each status
		const statuses = ['created', 'in-progress', 'ready-for-review'];
		const statusLabels = {
			'created': localize('created', 'Created'),
			'in-progress': localize('inProgress', 'In Progress'),
			'ready-for-review': localize('readyForReview', 'Ready for Review')
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
		if (!this.kanbanContainer) {
			return;
		}

		// Clear existing jobs
		this.columns.forEach(column => clearNode(column));
		this.jobElements.clear();

		// Get jobs from service
		const jobs = await this.remoteCodingAgentsService.getJobs();

		// Group jobs by status
		const jobsByStatus = new Map<string, IRemoteCodingAgentJob[]>();
		jobs.forEach(job => {
			const status = job.status || 'created';
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
	}

	private createJobCard(job: IRemoteCodingAgentJob, container: HTMLElement): void {
		const card = append(container, $('.kanban-job-card'));
		card.setAttribute('data-job-id', job.id);
		card.setAttribute('data-agent-id', job.agentId);

		const header = append(card, $('.kanban-job-header'));
		const title = append(header, $('.kanban-job-title'));
		title.textContent = job.name;

		const agent = append(header, $('.kanban-job-agent'));
		agent.textContent = job.agentId;

		const content = append(card, $('.kanban-job-content'));
		const prompt = append(content, $('.kanban-job-prompt'));
		// Note: assuming jobs have a prompt property, may need to adjust based on actual interface
		const promptText = (job as any).prompt || 'No description available';
		prompt.textContent = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;

		const actions = append(card, $('.kanban-job-actions'));

		// Add status-specific actions
		if (job.status === 'created') {
			const startButton = this._register(new Button(actions, defaultButtonStyles));
			startButton.label = localize('start', 'Start');
			this._register(startButton.onDidClick(() => this.operateJob(job, 'start')));
		} else if (job.status === 'in-progress') {
			const reviewButton = this._register(new Button(actions, defaultButtonStyles));
			reviewButton.label = localize('readyForReview', 'Ready for Review');
			this._register(reviewButton.onDidClick(() => this.operateJob(job, 'ready-for-review')));
		} else if (job.status === 'ready-for-review') {
			const approveButton = this._register(new Button(actions, defaultButtonStyles));
			approveButton.label = localize('approve', 'Approve');
			this._register(approveButton.onDidClick(() => this.operateJob(job, 'approve')));

			const rejectButton = this._register(new Button(actions, defaultButtonStyles));
			rejectButton.label = localize('reject', 'Reject');
			this._register(rejectButton.onDidClick(() => this.operateJob(job, 'reject')));
		}

		this.jobElements.set(job.id, card);
	}

	private updateColumnCount(status: string, count: number): void {
		const column = this.kanbanContainer?.querySelector(`[data-status="${status}"]`);
		const countElement = column?.querySelector('.kanban-column-count');
		if (countElement) {
			countElement.textContent = count.toString();
		}
	}

	private async operateJob(job: IRemoteCodingAgentJob, operation: string): Promise<void> {
		try {
			await this.remoteCodingAgentsService.operateJob(job.agentId, job.id, operation);
			// Refresh the view after operation
			await this.refreshJobs();
		} catch (error) {
			console.error('Failed to operate on job:', error);
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
