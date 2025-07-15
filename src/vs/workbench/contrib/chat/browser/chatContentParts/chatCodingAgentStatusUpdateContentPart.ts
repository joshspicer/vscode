/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../base/browser/dom.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { MarkdownRenderer } from '../../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js';
import { IChatProgressRenderableResponseContent } from '../../common/chatModel.js';
import { ICodingAgentStatusUpdate } from '../../common/chatService.js';
import { IChatContentPart, IChatContentPartRenderContext } from './chatContentParts.js';

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

		// Create minimal content
		let content = '';

		if (statusUpdate.data.filesChanged?.length) {
			const fileCount = statusUpdate.data.filesChanged.length;
			content += `Modified ${fileCount} file${fileCount > 1 ? 's' : ''}\n`;
		}

		if (statusUpdate.data.logs?.length) {
			const latestLog = statusUpdate.data.logs[statusUpdate.data.logs.length - 1];
			const level = latestLog.level.toUpperCase();
			content += `[${level}] ${latestLog.message}\n`;
		}

		if (!content.trim()) {
			content = `Agent working...`;
		}

		const result = this._register(renderer.render(new MarkdownString(content.trim()), {
			asyncRenderCallback: () => {
				this._onDidChangeHeight.fire();
			}
		}));

		this.domNode.appendChild(result.element);
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
