/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../base/browser/dom.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { MarkdownRenderer } from '../../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js';
import { localize } from '../../../../../nls.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { IChatProgressRenderableResponseContent } from '../../common/chatModel.js';
import { ICodingAgentHasBegun } from '../../common/chatService.js';
import { IChatContentPart, IChatContentPartRenderContext } from './chatContentParts.js';
import { ChatWorkingSetWidget, IWorkingSetEntry } from '../chatWorkingSetWidget.js';
import { IRemoteCodingAgentsSessionService } from '../../../remoteCodingAgents/common/remoteCodingAgentsSessionService.js';
import './media/chatCodingAgent.css';
import './media/chatConfirmationWidget.css';

export class ChatCodingAgentContentPart extends Disposable implements IChatContentPart {
	public readonly domNode: HTMLElement;

	private readonly _onDidChangeHeight = this._register(new Emitter<void>());
	public readonly onDidChangeHeight = this._onDidChangeHeight.event;

	private workingSetWidget: ChatWorkingSetWidget | undefined;
	private workingSetContainer: HTMLElement | undefined;

	constructor(
		private readonly session: ICodingAgentHasBegun,
		renderer: MarkdownRenderer,
		context: IChatContentPartRenderContext,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IRemoteCodingAgentsSessionService private readonly sessionService: IRemoteCodingAgentsSessionService
	) {
		super();

		// Create a box style container similar to IChatElicitationRequest
		this.domNode = dom.$('.chat-confirmation-widget');

		// Create title element
		const titleElement = dom.$('.chat-confirmation-widget-title');
		this.domNode.appendChild(titleElement);

		// Add robot icon directly to the DOM
		const titleContainer = dom.$('.chat-title-container');
		titleElement.appendChild(titleContainer);

		const robotIcon = dom.$('span.codicon.codicon-robot');
		titleContainer.appendChild(robotIcon);

		// Add a space between icon and text
		titleContainer.appendChild(document.createTextNode(' '));

		// Add the title text
		const titleText = dom.$('span');
		titleText.textContent = localize('codingAgentStarted', 'Coding Agent Session Started');
		titleText.style.fontWeight = 'bold';
		titleContainer.appendChild(titleText);

		// Create message element
		const messageElement = dom.$('.chat-confirmation-widget-message');
		this.domNode.appendChild(messageElement);

		// Create the main content
		const content = new MarkdownString()
			.appendMarkdown(`**${session.title}**`)
			.appendText(`\n\n`)
			.appendText(session.description);

		if (session.command) {
			content.appendText('\n\n').appendMarkdown(`\`${session.command}\``);
		}

		const contentRenderer = this._register(renderer.render(content, {
			asyncRenderCallback: () => {
				this._onDidChangeHeight.fire();
			}
		}));

		messageElement.appendChild(contentRenderer.element);

		// Add working set widget - always create the container even if no files initially
		if (session.agentId && session.jobId) {
			this.workingSetContainer = dom.append(this.domNode, dom.$('.coding-agent-working-set'));
			this.renderWorkingSet(session.agentId, session.jobId);

			// Listen for file changes for this session
			this._register(this.sessionService.onDidUpdateSessionFiles(e => {
				if (e.agentId === session.agentId && e.jobId === session.jobId) {
					console.log(`ChatCodingAgentContentPart: File change event received for ${e.agentId}-${e.jobId}:`, e.files);
					this.updateWorkingSet();
				}
			}));

			// Add debug logging
			console.log(`ChatCodingAgentContentPart: Checking files for session ${session.agentId}-${session.jobId}`);
			const files = this.sessionService.getSessionFiles(session.agentId, session.jobId);
			console.log(`ChatCodingAgentContentPart: Found ${files.length} files:`, files);
		}
	}

	private renderWorkingSet(agentId: string, jobId: string): void {
		const files = this.sessionService.getSessionFiles(agentId, jobId);
		console.log(`renderWorkingSet: Found ${files.length} files for ${agentId}-${jobId}:`, files);

		if (files.length > 0) {
			if (!this.workingSetWidget && this.workingSetContainer) {
				this.workingSetWidget = this._register(this.instantiationService.createInstance(
					ChatWorkingSetWidget,
					this.workingSetContainer,
					{
						menuId: MenuId.ChatEditingWidgetModifiedFilesToolbar,
						sessionId: jobId,
						showFileIcons: true
					}
				));

				// Listen for height changes
				this._register(this.workingSetWidget.onDidChangeHeight(() => {
					this._onDidChangeHeight.fire();
				}));
			}

			if (this.workingSetWidget) {
				const entries: IWorkingSetEntry[] = files.map(uri => ({
					uri,
					kind: 'reference' as const
				}));
				this.workingSetWidget.setEntries(entries);
				this._onDidChangeHeight.fire();
			}
		}
	}

	// Public method to update working set when files change
	updateWorkingSet(): void {
		if (this.session.agentId && this.session.jobId) {
			this.renderWorkingSet(this.session.agentId, this.session.jobId);
		}
	}

	hasSameContent(other: IChatProgressRenderableResponseContent): boolean {
		return other.kind === 'codingAgentSessionBegun' &&
			other.agentId === this.session.agentId &&
			other.jobId === this.session.jobId;
	}

	addDisposable(disposable: IDisposable): void {
		this._register(disposable);
	}
}
