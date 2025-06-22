/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { TreeView, TreeViewPane } from '../../../browser/parts/views/treeView.js';
import { Extensions, ITreeItem, ITreeViewDataProvider, ITreeViewDescriptor, IViewsRegistry, TreeItemCollapsibleState, ViewContainer } from '../../../common/views.js';
import { IRemoteCodingAgentJob, IRemoteCodingAgentsService, REMOTE_CODING_AGENTS_VIEW_ID, REMOTE_CODING_AGENTS_TITLE } from '../common/remoteCodingAgents.js';

class RemoteCodingAgentsDataProvider implements ITreeViewDataProvider {
	constructor(@IRemoteCodingAgentsService private readonly service: IRemoteCodingAgentsService) { }

	async getChildren(): Promise<ITreeItem[]> {
		const jobs = await this.service.getJobs();
		return jobs.map(job => this.getTreeItem(job));
	}

	getTreeItem(job: IRemoteCodingAgentJob): ITreeItem {
		return {
			handle: `${job.agentId}-${job.id}`,
			label: { label: `${job.name} (${job.status})` },
			collapsibleState: TreeItemCollapsibleState.None
		};
	}
}

export class RemoteCodingAgentsViews extends Disposable {
	constructor(container: ViewContainer, @IInstantiationService private readonly instantiationService: IInstantiationService) {
		super();
		this.registerViews(container);
	}

	private registerViews(container: ViewContainer): void {
		const viewId = REMOTE_CODING_AGENTS_VIEW_ID;
		const treeView = this.instantiationService.createInstance(TreeView, viewId, localize('remoteCodingAgentsViewName', 'Remote Coding Jobs'));
		treeView.showCollapseAllAction = false;
		treeView.showRefreshAction = true;
		treeView.dataProvider = this.instantiationService.createInstance(RemoteCodingAgentsDataProvider);

		const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);
		const descriptor: ITreeViewDescriptor = {
			id: viewId,
			name: REMOTE_CODING_AGENTS_TITLE,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: false,
			treeView,
			collapsed: false,
			hideByDefault: false,
			order: 100
		};
		viewsRegistry.registerViews([descriptor], container);
	}
}
