/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ISessionsPrerequisite } from './sessionsPrerequisiteService.js';
import { IAuthenticationService } from '../../../../workbench/services/authentication/common/authentication.js';
import { localize } from '../../../../nls.js';

const GITHUB_AUTH_PROVIDER_ID = 'github';
const GITHUB_SCOPES = ['user:email'];

export class GitHubAuthPrerequisite extends Disposable implements ISessionsPrerequisite {
	readonly id = 'github-auth';
	readonly label = localize('githubAuth.label', "GitHub Account");
	readonly description = localize('githubAuth.description', "Sign in with your GitHub account to continue.");
	readonly actionLabel = localize('githubAuth.action', "Sign in to GitHub");

	private _isSatisfied = false;
	private readonly _onDidChangeSatisfied = this._register(new Emitter<boolean>());
	readonly onDidChangeSatisfied: Event<boolean> = this._onDidChangeSatisfied.event;

	get isSatisfied(): boolean {
		return this._isSatisfied;
	}

	constructor(
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
	) {
		super();

		this._checkAuthenticated();

		this._register(this.authenticationService.onDidChangeSessions(e => {
			if (e.providerId === GITHUB_AUTH_PROVIDER_ID) {
				this._checkAuthenticated();
			}
		}));

		this._register(this.authenticationService.onDidRegisterAuthenticationProvider(provider => {
			if (provider.id === GITHUB_AUTH_PROVIDER_ID) {
				this._checkAuthenticated();
			}
		}));
	}

	private async _checkAuthenticated(): Promise<void> {
		try {
			if (!this.authenticationService.isAuthenticationProviderRegistered(GITHUB_AUTH_PROVIDER_ID)) {
				this._setSatisfied(false);
				return;
			}
			const sessions = await this.authenticationService.getSessions(GITHUB_AUTH_PROVIDER_ID);
			this._setSatisfied(sessions.length > 0);
		} catch {
			this._setSatisfied(false);
		}
	}

	private _setSatisfied(value: boolean): void {
		if (value !== this._isSatisfied) {
			this._isSatisfied = value;
			this._onDidChangeSatisfied.fire(value);
		}
	}

	async executeAction(): Promise<void> {
		await this.authenticationService.createSession(GITHUB_AUTH_PROVIDER_ID, GITHUB_SCOPES);
	}
}
