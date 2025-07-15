/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { MenuWorkbenchButtonBar } from '../../../../platform/actions/browser/buttonbar.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { CollapsibleListPool, IChatCollapsibleListItem } from './chatContentParts/chatReferencesContentPart.js';
import { URI } from '../../../../base/common/uri.js';
import { IEditorService, ACTIVE_GROUP, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { localize } from '../../../../nls.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IDisposableReference } from './chatContentParts/chatCollections.js';
import { ChatEditingShowChangesAction, ViewPreviousEditsAction } from './chatEditing/chatEditingActions.js';
import { addDisposableListener } from '../../../../base/browser/dom.js';
import { ScrollbarVisibility } from '../../../../base/common/scrollable.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { basename } from '../../../../base/common/path.js';

export interface IWorkingSetEntry {
	uri: URI;
	state?: number; // Optional state for sorting
	kind: 'reference';
}

export interface IChatWorkingSetWidgetOptions {
	menuId?: MenuId;
	telemetrySource?: string;
	sessionId?: string;
	showFileIcons?: boolean;
}

export class ChatWorkingSetWidget extends Disposable {
	private readonly _onDidChangeHeight = this._register(new Emitter<void>());
	readonly onDidChangeHeight: Event<void> = this._onDidChangeHeight.event;

	private readonly _onDidFocus = this._register(new Emitter<void>());
	readonly onDidFocus: Event<void> = this._onDidFocus.event;

	private readonly container: HTMLElement;
	private readonly actionsDisposables = this._register(new DisposableStore());
	private readonly listDisposables = this._register(new DisposableStore());
	private chatEditListPool: CollapsibleListPool;
	private chatEditList: IDisposableReference<WorkbenchList<IChatCollapsibleListItem>> | undefined;

	private _entries: IWorkingSetEntry[] = [];

	constructor(
		parentContainer: HTMLElement,
		private readonly options: IChatWorkingSetWidgetOptions,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorService private readonly editorService: IEditorService
	) {
		super();

		this.container = dom.append(parentContainer, dom.$('.chat-working-set-widget'));
		if (options.showFileIcons !== false) {
			this.container.classList.add('show-file-icons');
		}

		this.chatEditListPool = this._register(this.instantiationService.createInstance(
			CollapsibleListPool,
			Event.None,
			options.menuId || MenuId.ChatEditingWidgetModifiedFilesToolbar,
			{ verticalScrollMode: ScrollbarVisibility.Visible }
		));

		this.render();
	}

	private render(): void {
		dom.clearNode(this.container);
		this.listDisposables.clear();

		if (!this._entries.length) {
			return;
		}

		// Overview section
		const overviewRegion = dom.append(this.container, dom.$('.chat-editing-session-overview'));
		const overviewTitle = dom.append(overviewRegion, dom.$('.working-set-title'));
		const overviewFileCount = dom.append(overviewTitle, dom.$('span.working-set-count'));

		overviewFileCount.textContent = this._entries.length === 1
			? localize('workingSet.oneFile', '1 file changed')
			: localize('workingSet.manyFiles', '{0} files changed', this._entries.length);

		overviewTitle.ariaLabel = overviewFileCount.textContent;
		overviewTitle.tabIndex = 0;

		// Actions
		if (this.options.menuId) {
			this.actionsDisposables.clear();
			const actionsContainer = dom.append(overviewRegion, dom.$('.chat-editing-session-actions'));

			this.actionsDisposables.add(this.instantiationService.createInstance(MenuWorkbenchButtonBar, actionsContainer, this.options.menuId, {
				telemetrySource: this.options.telemetrySource,
				menuOptions: {
					arg: { sessionId: this.options.sessionId },
				},
				buttonConfigProvider: (action) => {
					if (action.id === ChatEditingShowChangesAction.ID || action.id === ViewPreviousEditsAction.Id) {
						return { showIcon: true, showLabel: false, isSecondary: true };
					}
					return undefined;
				}
			}));
		}

		// File list
		const workingSetContainer = dom.append(this.container, dom.$('.chat-editing-session-list'));
		if (!this.chatEditList) {
			this.chatEditList = this.listDisposables.add(this.chatEditListPool.get());
			const list = this.chatEditList.object;

			this.listDisposables.add(list.onDidFocus(() => {
				this._onDidFocus.fire();
			}));

			this.listDisposables.add(list.onDidOpen(async (e) => {
				if (e.element?.kind === 'reference' && URI.isUri(e.element.reference)) {
					await this.editorService.openEditor({
						resource: e.element.reference,
						options: e.editorOptions
					}, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
				}
			}));

			this.listDisposables.add(addDisposableListener(list.getHTMLElement(), 'click', e => {
				this._onDidFocus.fire();
			}, true));

			dom.append(workingSetContainer, list.getHTMLElement());
		}

		// Convert entries to list items
		const listItems: IChatCollapsibleListItem[] = this._entries.map(entry => ({
			reference: entry.uri,
			kind: 'reference' as const,
			iconPath: ThemeIcon.fromId(Codicon.file.id),
			title: basename(entry.uri.path),
			state: entry.state
		}));

		// Layout list
		const maxItemsShown = 6;
		const itemsShown = Math.min(listItems.length, maxItemsShown);
		const height = itemsShown * 22;
		const list = this.chatEditList.object;
		list.layout(height);
		list.getHTMLElement().style.height = `${height}px`;
		list.splice(0, list.length, listItems);

		this._onDidChangeHeight.fire();
	}

	setEntries(entries: IWorkingSetEntry[]): void {
		this._entries = entries.sort((a, b) => {
			if (a.state !== undefined && b.state !== undefined && a.state !== b.state) {
				return a.state - b.state;
			}
			return a.uri.toString().localeCompare(b.uri.toString());
		});
		this.render();
	}

	get entries(): IWorkingSetEntry[] {
		return this._entries;
	}

	get selectedElements(): URI[] {
		const elements = this.chatEditList?.object.getSelectedElements() ?? [];
		return elements
			.filter(e => e.kind === 'reference' && URI.isUri((e as any).reference))
			.map(e => (e as any).reference as URI);
	}

	focus(): void {
		this.chatEditList?.object.domFocus();
	}
}
