/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/remoteCodingAgents.css';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IRemoteCodingAgentsService, REMOTE_CODING_AGENTS_CONTAINER_ID, REMOTE_CODING_AGENTS_TITLE, REMOTE_CODING_AGENTS_VIEW_ICON } from '../common/remoteCodingAgents.js';
import { RemoteCodingAgentsService } from './remoteCodingAgentsService.js';
import { IViewContainersRegistry, ViewContainerLocation, Extensions as ViewExtensions } from '../../../common/views.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { RemoteCodingAgentsViews } from './remoteCodingAgentsViews.js';

class RemoteCodingAgentsContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.registerViews();
	}

	private registerViews() {
		const container = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer(
			{
				id: REMOTE_CODING_AGENTS_CONTAINER_ID,
				title: REMOTE_CODING_AGENTS_TITLE,
				ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [REMOTE_CODING_AGENTS_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
				icon: REMOTE_CODING_AGENTS_VIEW_ICON,
				hideIfEmpty: false
			}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true }
		);
		this._register(this.instantiationService.createInstance(RemoteCodingAgentsViews, container));
	}
}

registerSingleton(IRemoteCodingAgentsService, RemoteCodingAgentsService, InstantiationType.Delayed);
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(RemoteCodingAgentsContribution, LifecyclePhase.Restored);
