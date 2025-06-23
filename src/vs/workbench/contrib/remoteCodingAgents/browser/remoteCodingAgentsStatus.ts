/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { IDisposable, dispose } from '../../../../base/common/lifecycle.js';
import { IStatusbarEntry, IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IRemoteCodingAgentsService } from '../common/remoteCodingAgents.js';

export class RemoteCodingAgentsStatusContribution implements IWorkbenchContribution {

	private toDispose: IDisposable[] = [];
	private entryAccessor: IStatusbarEntryAccessor | undefined;
	private activeJobCount = 0;

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

			if (this.activeJobCount > 0) {
				if (!this.entryAccessor) {
					this.entryAccessor = this.statusBarService.addEntry(this.entry, 'status.remoteCodingAgents', StatusbarAlignment.LEFT, 35 /* Higher than debug, lower than scm */);
				} else {
					this.entryAccessor.update(this.entry);
				}
			} else {
				// Hide the status bar item when no active jobs
				if (this.entryAccessor) {
					this.entryAccessor.dispose();
					this.entryAccessor = undefined;
				}
			}
		} catch (error) {
			console.error('Error updating remote coding agents status bar:', error);
		}
	}

	private get entry(): IStatusbarEntry {
		const text = this.activeJobCount === 1
			? nls.localize('remoteCodingAgentsStatus.singular', "{0} agent task", this.activeJobCount)
			: nls.localize('remoteCodingAgentsStatus.plural', "{0} agent tasks", this.activeJobCount);

		return {
			name: nls.localize('status.remoteCodingAgents', "Remote Coding Agents"),
			text: '$(robot) ' + this.activeJobCount,
			ariaLabel: text,
			tooltip: nls.localize('remoteCodingAgentsTooltip', "{0} active - Click to open Agents view", text),
			command: 'workbench.views.remoteCodingAgents.data.focus'
		};
	}

	dispose(): void {
		this.entryAccessor?.dispose();
		dispose(this.toDispose);
	}
}
