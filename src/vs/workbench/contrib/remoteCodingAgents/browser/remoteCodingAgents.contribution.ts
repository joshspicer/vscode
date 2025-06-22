/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/remoteCodingAgents.css';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from '../../../common/contributions.js';
import { isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IRemoteCodingAgent, IRemoteCodingAgentsService, REMOTE_CODING_AGENTS_CONTAINER_ID, REMOTE_CODING_AGENTS_TITLE, REMOTE_CODING_AGENTS_VIEW_ICON } from '../common/remoteCodingAgents.js';
import { RemoteCodingAgentsService } from './remoteCodingAgentsService.js';
import { IViewContainersRegistry, ViewContainerLocation, Extensions as ViewExtensions } from '../../../common/views.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { RemoteCodingAgentsViews } from './remoteCodingAgentsViews.js';

interface IRemoteCodingAgentCommand {
	id: string;
	createCommand: string;
	statusCommand?: string;
	operateCommand?: string;
	displayName: string;
	description?: string;
	when?: string;
}

class RemoteCodingAgentsContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IRemoteCodingAgentsService private readonly remoteCodingAgentsService: IRemoteCodingAgentsService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.registerViews();
		this.registerContributedRemoteCodingAgents();
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

	private registerContributedRemoteCodingAgents() {
		extensionPoint.setHandler(extensions => {
			for (const ext of extensions) {
				if (!isProposedApiEnabled(ext.description, 'remoteCodingAgents')) {
					continue;
				}
				if (!Array.isArray(ext.value)) {
					continue;
				}
				for (const contribution of ext.value) {
					const command = MenuRegistry.getCommand(contribution.createCommand);
					if (!command) {
						continue;
					}
					const agent: IRemoteCodingAgent = {
						id: contribution.id,
						displayName: contribution.displayName,
						description: contribution.description,
						createCommand: contribution.createCommand,
						statusCommand: contribution.statusCommand,
						operateCommand: contribution.operateCommand,
					};
					this.remoteCodingAgentsService.registerAgent(agent);
				}
			}

		});
	}
}

registerSingleton(IRemoteCodingAgentsService, RemoteCodingAgentsService, InstantiationType.Delayed);
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(RemoteCodingAgentsContribution, LifecyclePhase.Restored);


const extensionPoint = ExtensionsRegistry.registerExtensionPoint<IRemoteCodingAgentCommand[]>({
	extensionPoint: 'remoteCodingAgents',
	jsonSchema: {
		description: localize('remoteCodingAgentsExtPoint', 'Contributes remote coding agent integrations to the chat widget.'),
		type: 'array',
		items: {
			type: 'object',
			properties: {
				id: {
					description: localize('remoteCodingAgentsExtPoint.id', 'Identifier of the remote coding agent.'),
					type: 'string'
				},
				createCommand: {
					description: localize('remoteCodingAgentsExtPoint.createCommand', 'Command id used to create a new remote job.'),
					type: 'string'
				},
				statusCommand: {
					description: localize('remoteCodingAgentsExtPoint.statusCommand', 'Command id used to fetch job status.'),
					type: 'string'
				},
				operateCommand: {
					description: localize('remoteCodingAgentsExtPoint.operateCommand', 'Command id used to operate on a job.'),
					type: 'string'
				},
				displayName: {
					description: localize('remoteCodingAgentsExtPoint.displayName', 'A user-friendly name for this item which is used for display in menus.'),
					type: 'string'
				},
				description: {
					description: localize('remoteCodingAgentsExtPoint.description', 'Description of the remote agent for use in menus and tooltips.'),
					type: 'string'
				},
				when: {
					description: localize('remoteCodingAgentsExtPoint.when', 'Condition which must be true to show this item.'),
					type: 'string'
				},
			},
			required: ['id', 'createCommand', 'displayName'],
		}
	}
});
