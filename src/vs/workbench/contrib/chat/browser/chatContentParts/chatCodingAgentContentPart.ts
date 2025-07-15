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
import { IChatProgressRenderableResponseContent } from '../../common/chatModel.js';
import { ICodingAgentHasBegun } from '../../common/chatService.js';
import { IChatContentPart, IChatContentPartRenderContext } from './chatContentParts.js';
import './media/chatCodingAgent.css';
import './media/chatConfirmationWidget.css';

export class ChatCodingAgentContentPart extends Disposable implements IChatContentPart {
	public readonly domNode: HTMLElement;

	private readonly _onDidChangeHeight = this._register(new Emitter<void>());
	public readonly onDidChangeHeight = this._onDidChangeHeight.event;

	constructor(
		private readonly session: ICodingAgentHasBegun,
		renderer: MarkdownRenderer,
		context: IChatContentPartRenderContext,
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
