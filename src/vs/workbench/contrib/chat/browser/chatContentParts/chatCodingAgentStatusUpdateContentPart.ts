/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../base/browser/dom.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { MarkdownRenderer } from '../../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js';
import { IChatProgressRenderableResponseContent } from '../../common/chatModel.js';
import { ICodingAgentStatusUpdate } from '../../common/chatService.js';
import { IChatContentPart, IChatContentPartRenderContext } from './chatContentParts.js';
import './media/chatCodingAgent.css';

export class ChatCodingAgentStatusUpdateContentPart extends Disposable implements IChatContentPart {
	public readonly domNode: HTMLElement;

	private readonly _onDidChangeHeight = this._register(new Emitter<void>());
	public readonly onDidChangeHeight = this._onDidChangeHeight.event;

	constructor(
		private readonly statusUpdate: ICodingAgentStatusUpdate,
		renderer: MarkdownRenderer,
		context: IChatContentPartRenderContext,
	) {
		super();

		this.domNode = dom.$('.coding-agent-status-update');
		this.domNode.classList.add('chat-coding-agent-status');

		// Add the spinner icon directly in the DOM
		const container = dom.$('.chat-coding-agent-status-container');
		this.domNode.appendChild(container);

		const icon = dom.$('span.codicon.codicon-sync.codicon-modifier-spin');
		container.appendChild(icon);

		let messageText = 'Still working...';
		// TODO: grabbing response
		const m = statusUpdate.data.messages?.[0];
		if (m?.type === 'response') {
			messageText = m.content;
		}

		// Add a small space between the icon and text
		container.appendChild(document.createTextNode(' '));

		// Add the text
		const messageSpan = dom.$('span');
		messageSpan.textContent = messageText;
		container.appendChild(messageSpan);
	}

	hasSameContent(other: IChatProgressRenderableResponseContent): boolean {
		return other.kind === 'codingAgentStatusUpdate' &&
			other.agentId === this.statusUpdate.agentId &&
			other.jobId === this.statusUpdate.jobId;
	}

	addDisposable(disposable: IDisposable): void {
		this._register(disposable);
	}
}
