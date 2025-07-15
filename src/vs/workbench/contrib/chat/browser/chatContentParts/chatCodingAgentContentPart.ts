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

		this.domNode = dom.$('.coding-agent-session');
		this.domNode.classList.add('chat-coding-agent-session');

		// Create the content
		const content = new MarkdownString()
			.appendText('')
			.appendMarkdown(`**${localize('codingAgentStarted', 'Session Started')}:** ${session.title}`)
			.appendText('\n')
			.appendText(session.description);

		if (session.command) {
			content.appendText('\n').appendMarkdown(`\`${session.command}\``);
		}

		const result = this._register(renderer.render(content, {
			asyncRenderCallback: () => {
				this._onDidChangeHeight.fire();
			}
		}));

		this.domNode.appendChild(result.element);
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
