/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { IDisposable, dispose } from '../../../../base/common/lifecycle.js';
import { IStatusbarEntry, IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IRemoteCodingAgentsService, RemoteCodingAgentJobStatus } from '../common/remoteCodingAgents.js';

export class RemoteCodingAgentsStatusContribution implements IWorkbenchContribution {

	private toDispose: IDisposable[] = [];
	private entryAccessor: IStatusbarEntryAccessor | undefined;
	private activeJobCount = 0;
	private inProgressJobCount = 0;
	private readyForReviewCount = 0;

	constructor(
		@IStatusbarService private readonly statusBarService: IStatusbarService,
		@IRemoteCodingAgentsService private readonly remoteCodingAgentsService: IRemoteCodingAgentsService
	) {
		this.updateStatusBar();

		// Listen for job changes and update the status bar
		this.toDispose.push(this.remoteCodingAgentsService.onJobsChanged(() => {
			this.updateStatusBar();
		}));
	}

	private async updateStatusBar(): Promise<void> {
		try {
			this.activeJobCount = await this.remoteCodingAgentsService.getActiveJobCount();
			this.inProgressJobCount = await this.remoteCodingAgentsService.getJobCountByStatus(RemoteCodingAgentJobStatus.InProgress);
			this.readyForReviewCount = await this.remoteCodingAgentsService.getJobCountByStatus(RemoteCodingAgentJobStatus.ReadyForReview);

			// Always show the status bar
			if (!this.entryAccessor) {
				this.entryAccessor = this.statusBarService.addEntry(this.entry, 'status.remoteCodingAgents', StatusbarAlignment.LEFT, 35 /* Higher than debug, lower than scm */);
			} else {
				this.entryAccessor.update(this.entry);
			}
		} catch (error) {
			console.error('Error updating remote coding agents status bar:', error);
		}
	}

	private get entry(): IStatusbarEntry {
		let text: string;
		let tooltip: string;

		if (this.inProgressJobCount > 0) {
			// Show active tasks when in progress
			text = this.activeJobCount === 1
				? nls.localize('remoteCodingAgentsStatus.active.singular', "{0} agent task active", this.activeJobCount)
				: nls.localize('remoteCodingAgentsStatus.active.plural', "{0} agent tasks active", this.activeJobCount);
			tooltip = nls.localize('remoteCodingAgentsTooltip.active', "{0}", text);
		} else if (this.readyForReviewCount > 0) {
			// Show ready for review when no in progress tasks
			text = this.readyForReviewCount === 1
				? nls.localize('remoteCodingAgentsStatus.review.singular', "{0} agent task pending your review", this.readyForReviewCount)
				: nls.localize('remoteCodingAgentsStatus.review.plural', "{0} agent tasks pending your review", this.readyForReviewCount);
			tooltip = nls.localize('remoteCodingAgentsTooltip.review', "{0}", text);
		} else {
			// Show total active tasks when nothing specific
			text = this.activeJobCount === 1
				? nls.localize('remoteCodingAgentsStatus.singular', "{0} agent task", this.activeJobCount)
				: nls.localize('remoteCodingAgentsStatus.plural', "{0} agent tasks", this.activeJobCount);
			tooltip = nls.localize('remoteCodingAgentsTooltip', "{0}", text);
		}

		// Show spinner and cloud icon when jobs are in progress
		const prefixIcon = '$(cloud)';
		const postfixIcon = this.inProgressJobCount > 0 ? '$(loading~spin)' : '';
		const displayCount = this.inProgressJobCount > 0 ? this.activeJobCount : (this.readyForReviewCount > 0 ? this.readyForReviewCount : this.activeJobCount);

		return {
			name: nls.localize('status.remoteCodingAgents', "Remote Coding Agents"),
			text: `${prefixIcon} ${displayCount} ${postfixIcon}`,
			ariaLabel: text,
			tooltip,
			command: 'workbench.views.remoteCodingAgents.data.focus'
		};
	}

	dispose(): void {
		this.entryAccessor?.dispose();
		dispose(this.toDispose);
	}
}
