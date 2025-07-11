/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { IViewsRegistry, Extensions as ViewExtensions, IViewContainersRegistry, ViewContainerLocation, ITreeViewDataProvider, ITreeItem, TreeItemCollapsibleState, ITreeViewDescriptor } from '../../../common/views.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { TreeView, TreeViewPane } from '../../../browser/parts/views/treeView.js';
import { IRemoteCodingAgentsService, IRemoteCodingAgentStatusUpdate } from '../common/remoteCodingAgentsService.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';

interface IRemoteCodingAgentStatusItem {
	id: string;
	agentId: string;
	jobId?: string;
	timestamp: number;
	status: string;
	filesChanged: number;
	messages: number;
	logs: number;
	links: number;
	lastUpdate: IRemoteCodingAgentStatusUpdate;
	contributedIcon?: { id: string; color?: string };
	command?: string;
}

class RemoteCodingAgentsDataProvider extends Disposable implements ITreeViewDataProvider {
	private readonly _onDidChangeEmpty = this._register(new Emitter<void>());
	readonly onDidChangeEmpty = this._onDidChangeEmpty.event;

	private statusItems: IRemoteCodingAgentStatusItem[] = [];
	private treeView: TreeView | undefined;

	get isTreeEmpty(): boolean {
		return this.statusItems.length === 0;
	}

	setTreeView(treeView: TreeView): void {
		this.treeView = treeView;
	}

	constructor(
		@IRemoteCodingAgentsService private readonly remoteCodingAgentsService: IRemoteCodingAgentsService
	) {
		super();

		console.log('RemoteCodingAgentsDataProvider: Constructor called');
		console.log('RemoteCodingAgentsDataProvider: Service available:', !!this.remoteCodingAgentsService);

		// Register for future status updates
		this._register(this.remoteCodingAgentsService.onDidUpdateStatus(update => {
			console.log('RemoteCodingAgentsDataProvider: Service event received:', update);
			this.updateStatus(update);
		}));

		// Get any existing status updates that happened before this view was created
		const currentUpdates = this.remoteCodingAgentsService.getCurrentStatusUpdates();
		console.log('RemoteCodingAgentsDataProvider: Current status updates:', currentUpdates);
		for (const update of currentUpdates) {
			this.updateStatus(update);
		}
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {
		console.log('RemoteCodingAgentsDataProvider: getChildren called, element:', element);

		if (!element) {
			// Return root items (agent status items)
			const items = this.statusItems.map(item => this.statusItemToTreeItem(item));
			console.log('RemoteCodingAgentsDataProvider: Returning root items:', items);
			return items;
		}

		// For now, no child items
		return [];
	}

	async getTreeItem(element: ITreeItem): Promise<ITreeItem> {
		return element;
	}

	private updateStatus(update: IRemoteCodingAgentStatusUpdate): void {
		console.log('RemoteCodingAgentsDataProvider: Received status update:', update);

		const id = `${update.agentId}-${update.jobId || 'default'}`;
		const existingIndex = this.statusItems.findIndex(item => item.id === id);

		const statusItem: IRemoteCodingAgentStatusItem = {
			id,
			agentId: update.agentId,
			jobId: update.jobId,
			timestamp: update.timestamp,
			status: this.getStatusFromUpdate(update),
			filesChanged: update.data.filesChanged?.length || 0,
			messages: update.data.messages?.length || 0,
			logs: update.data.logs?.length || 0,
			links: update.data.links?.length || 0,
			lastUpdate: update,
			contributedIcon: update.data.icon,
			command: update.command
		};

		console.log('RemoteCodingAgentsDataProvider: Processed status item:', statusItem);

		if (existingIndex >= 0) {
			this.statusItems[existingIndex] = statusItem;
		} else {
			this.statusItems.push(statusItem);
		}

		// Sort by timestamp, newest first
		this.statusItems.sort((a, b) => b.timestamp - a.timestamp);

		console.log('RemoteCodingAgentsDataProvider: Current status items:', this.statusItems);

		// Notify tree view to refresh
		console.log('RemoteCodingAgentsDataProvider: Triggering tree refresh');
		this._onDidChangeEmpty.fire();

		// Directly refresh the tree view
		if (this.treeView) {
			console.log('RemoteCodingAgentsDataProvider: Calling treeView.refresh()');
			this.treeView.refresh();
		}
	}

	private getStatusFromUpdate(update: IRemoteCodingAgentStatusUpdate): string {
		if (update.data.logs?.some(log => log.level === 'error')) {
			return 'error';
		}
		if (update.data.logs?.some(log => log.level === 'warn')) {
			return 'warning';
		}
		if (update.data.filesChanged?.length || update.data.messages?.length) {
			return 'active';
		}
		return 'idle';
	}

	private statusItemToTreeItem(item: IRemoteCodingAgentStatusItem): ITreeItem {
		// Use contributed icon if available, otherwise fall back to status-based icon
		const themeIcon = item.contributedIcon ?
			this.createThemeIconFromContributed(item.contributedIcon) :
			this.getStatusIconClass(item.status);

		// Build description
		const parts = [];
		if (item.filesChanged > 0) {
			parts.push(`${item.filesChanged} files`);
		}
		if (item.messages > 0) {
			parts.push(`${item.messages} messages`);
		}
		if (item.logs > 0) {
			parts.push(`${item.logs} logs`);
		}

		const statusText = parts.length > 0 ? parts.join(', ') : 'No activity';
		const timeText = new Date(item.timestamp).toLocaleTimeString();
		const description = `${statusText} • ${timeText}`;

		const treeItem: ITreeItem = {
			handle: item.id,
			collapsibleState: TreeItemCollapsibleState.None,
			label: {
				label: `${item.agentId}${item.jobId ? ` (${item.jobId})` : ''}`
			},
			description,
			themeIcon: themeIcon,
			contextValue: 'remoteCodingAgent'
		};

		// Set command if available
		if (item.command) {
			treeItem.command = {
				id: item.command,
				title: 'View Details',
				arguments: [item.agentId, item.jobId, item.lastUpdate]
			};
		}

		return treeItem;
	}

	private createThemeIconFromContributed(contributedIcon: { id: string; color?: string }): ThemeIcon {
		// Try to create ThemeIcon from the contributed icon ID
		try {
			// First try to get a known Codicon by name
			const codicon = this.getCodiconByName(contributedIcon.id);
			if (codicon) {
				// If color is provided, create a ThemeIcon object with color
				if (contributedIcon.color) {
					return {
						id: codicon.id,
						color: { id: contributedIcon.color }
					};
				}
				return codicon;
			}

			// Fallback to creating from string with color if provided
			if (contributedIcon.color) {
				return {
					id: contributedIcon.id,
					color: { id: contributedIcon.color }
				};
			}

			// Try to create from string
			const fromString = ThemeIcon.fromString(contributedIcon.id);
			return fromString || Codicon.circle;
		} catch (error) {
			// If all else fails, use a default icon
			console.warn(`Failed to create ThemeIcon from contributed icon: ${contributedIcon.id}`, error);
			return Codicon.circle;
		}
	}

	private getCodiconByName(iconName: string): ThemeIcon | undefined {
		// Map common icon names to Codicons
		const iconMap: { [key: string]: ThemeIcon } = {
			'loading~spin': Codicon.loading,
			'search': Codicon.search,
			'edit': Codicon.edit,
			'check': Codicon.check,
			'error': Codicon.error,
			'warning': Codicon.warning,
			'info': Codicon.info,
			'play': Codicon.play,
			'circle': Codicon.circle,
			'gear': Codicon.gear,
			'sync': Codicon.sync,
			'refresh': Codicon.refresh,
			'stop': Codicon.stop,
			'debug': Codicon.debug,
			'file': Codicon.file,
			'folder': Codicon.folder,
			'terminal': Codicon.terminal,
			'extensions': Codicon.extensions,
			'settings': Codicon.settings,
			'loading': Codicon.loading
		};

		return iconMap[iconName];
	}

	private getStatusIconClass(status: string): ThemeIcon {
		switch (status) {
			case 'active': return Codicon.play;
			case 'error': return Codicon.error;
			case 'warning': return Codicon.warning;
			case 'idle': return Codicon.circle;
			default: return Codicon.circle;
		}
	}
}

export class RemoteCodingAgentsViews extends Disposable {
	private dataProvider: RemoteCodingAgentsDataProvider;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.dataProvider = this.instantiationService.createInstance(RemoteCodingAgentsDataProvider);
		this.registerViews();
	}

	private registerViews(): void {
		const viewId = 'remoteCodingAgents.statusView';

		// Create TreeView with the data provider
		const treeView = this.instantiationService.createInstance(TreeView, viewId, localize2('remoteCodingAgentsStatus', 'Coding Agents').value);
		treeView.showCollapseAllAction = false;
		treeView.showRefreshAction = true;

		// Set the data provider - this is key!
		treeView.dataProvider = this.dataProvider;

		// Give the data provider a reference to the tree view for auto-refresh
		this.dataProvider.setTreeView(treeView);

		console.log('RemoteCodingAgentsViews: TreeView created with data provider:', !!treeView.dataProvider);

		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const viewDescriptor: ITreeViewDescriptor = {
			id: viewId,
			name: localize2('remoteCodingAgentsStatus', 'Coding Agents'),
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			canToggleVisibility: true,
			canMoveView: true,
			treeView,
			collapsed: false,
			order: 1,
			hideByDefault: false
		};

		// Register the view in the Panel location since it's working there
		const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);
		const panelContainers = viewContainerRegistry.getViewContainers(ViewContainerLocation.Panel);

		// Find an appropriate container - look for the terminal container as a good default
		let container = panelContainers.find(c => c.id === 'terminal');
		if (!container) {
			// Fallback to the first panel container
			container = panelContainers[0];
		}

		if (container) {
			viewsRegistry.registerViews([viewDescriptor], container);
			console.log('RemoteCodingAgentsViews: Tree view registered successfully in container:', container.id);
		} else {
			console.error('RemoteCodingAgentsViews: Could not find any panel container');
		}

		viewsRegistry.registerViewWelcomeContent(viewId, {
			content: localize('noRemoteCodingAgents', 'No remote coding agents are currently active.\n\nTo test the Remote Coding Agents API, install and activate an extension that uses it, such as the JoshBot extension.')
		});
	}
}

// The view container is registered elsewhere (likely in the main VS Code views)
// so we don't need to register our own container here

// Create views using the export to be instantiated later
export function createRemoteCodingAgentsViews(instantiationService: IInstantiationService): RemoteCodingAgentsViews {
	const views = instantiationService.createInstance(RemoteCodingAgentsViews);
	console.log('RemoteCodingAgentsView: Views created successfully', views);
	return views;
}

console.log('RemoteCodingAgentsView: Views registration completed');
