/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ISessionsPrerequisite } from './sessionsPrerequisiteService.js';
import { IExtensionManagementService, IExtensionGalleryService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { localize } from '../../../../nls.js';

const COPILOT_CHAT_EXTENSION_ID = 'github.copilot-chat';

export class CopilotChatPrerequisite extends Disposable implements ISessionsPrerequisite {
	readonly id = 'copilot-chat-extension';
	readonly label = localize('copilotChat.label', "GitHub Copilot Chat");
	readonly description = localize('copilotChat.description', "Install the GitHub Copilot Chat extension to get started.");
	readonly actionLabel = localize('copilotChat.action', "Install Copilot Chat");

	private _isSatisfied = false;
	private readonly _onDidChangeSatisfied = this._register(new Emitter<boolean>());
	readonly onDidChangeSatisfied: Event<boolean> = this._onDidChangeSatisfied.event;

	get isSatisfied(): boolean {
		return this._isSatisfied;
	}

	constructor(
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IExtensionGalleryService private readonly extensionGalleryService: IExtensionGalleryService,
		@IProductService private readonly productService: IProductService,
	) {
		super();

		this._checkInstalled();

		this._register(this.extensionManagementService.onDidInstallExtensions(results => {
			for (const result of results) {
				if (result.identifier.id.toLowerCase() === COPILOT_CHAT_EXTENSION_ID && !result.error) {
					this._setSatisfied(true);
				}
			}
		}));

		this._register(this.extensionManagementService.onDidUninstallExtension(e => {
			if (e.identifier.id.toLowerCase() === COPILOT_CHAT_EXTENSION_ID && !e.error) {
				this._setSatisfied(false);
			}
		}));
	}

	private async _checkInstalled(): Promise<void> {
		const installed = await this.extensionManagementService.getInstalled();
		const hasCopilotChat = installed.some(
			ext => ext.identifier.id.toLowerCase() === COPILOT_CHAT_EXTENSION_ID
		);
		this._setSatisfied(hasCopilotChat);
	}

	private _setSatisfied(value: boolean): void {
		if (value !== this._isSatisfied) {
			this._isSatisfied = value;
			this._onDidChangeSatisfied.fire(value);
		}
	}

	async executeAction(): Promise<void> {
		const isInsiders = this.productService.quality === 'insider';
		const extensions = await this.extensionGalleryService.getExtensions(
			[{ id: COPILOT_CHAT_EXTENSION_ID, preRelease: isInsiders }],
			CancellationToken.None
		);

		if (extensions.length > 0) {
			await this.extensionManagementService.installFromGallery(extensions[0], {
				installPreReleaseVersion: isInsiders,
				preRelease: isInsiders,
			});
		}
	}
}
