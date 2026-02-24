/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkbenchLayoutService } from '../../../../workbench/services/layout/browser/layoutService.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { ISessionsPrerequisiteService, SessionsPrerequisiteService } from './sessionsPrerequisiteService.js';
import { CopilotChatPrerequisite } from './copilotChatPrerequisite.js';
import { GitHubAuthPrerequisite } from './githubAuthPrerequisite.js';
import { SessionsWelcomeOverlay } from './welcomeOverlay.js';

// Register service
registerSingleton(ISessionsPrerequisiteService, SessionsPrerequisiteService, InstantiationType.Eager);

class SessionsWelcomeOverlayContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'sessions.welcomeOverlay';

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ISessionsPrerequisiteService private readonly prerequisiteService: ISessionsPrerequisiteService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();

		// Register prerequisites
		const copilotPrereq = this.instantiationService.createInstance(CopilotChatPrerequisite);
		this._register(copilotPrereq);
		this._register(this.prerequisiteService.registerPrerequisite(copilotPrereq));

		const authPrereq = this.instantiationService.createInstance(GitHubAuthPrerequisite);
		this._register(authPrereq);
		this._register(this.prerequisiteService.registerPrerequisite(authPrereq));

		// Always create the overlay — it will auto-hide once all prerequisites are satisfied.
		// Prerequisites check asynchronously, so the initial state may be stale.
		const container = this.layoutService.getContainer(mainWindow);
		this._register(this.instantiationService.createInstance(SessionsWelcomeOverlay, container));
	}
}

registerWorkbenchContribution2(
	SessionsWelcomeOverlayContribution.ID,
	SessionsWelcomeOverlayContribution,
	WorkbenchPhase.AfterRestored
);
