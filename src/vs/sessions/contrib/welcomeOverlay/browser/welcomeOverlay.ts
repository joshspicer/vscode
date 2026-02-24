/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './welcomeOverlay.css';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { $, append } from '../../../../base/browser/dom.js';
import { ISessionsPrerequisite, ISessionsPrerequisiteService } from './sessionsPrerequisiteService.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { ILogService } from '../../../../platform/log/common/log.js';

export class SessionsWelcomeOverlay extends Disposable {

	private readonly _container: HTMLElement;
	private readonly _stepElements = new Map<string, { container: HTMLElement; iconEl: HTMLElement }>();
	private readonly _stepDisposables = this._register(new DisposableStore());
	private _hideTimeout: ReturnType<typeof setTimeout> | undefined;

	constructor(
		parent: HTMLElement,
		@ISessionsPrerequisiteService private readonly prerequisiteService: ISessionsPrerequisiteService,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		this._container = append(parent, $('.sessions-welcome-overlay'));
		this._render();

		this._register(this.prerequisiteService.onDidChangeAllSatisfied(allSatisfied => {
			if (allSatisfied) {
				this._hide();
			}
		}));

		// Check initial state
		if (this.prerequisiteService.allSatisfied) {
			this._hide();
		}
	}

	private _render(): void {
		const content = append(this._container, $('.sessions-welcome-overlay-content'));

		// Header
		const header = append(content, $('.sessions-welcome-overlay-header'));
		const title = append(header, $('h2'));
		title.textContent = localize('welcomeOverlay.title', "Welcome to Sessions");
		const subtitle = append(header, $('p'));
		subtitle.textContent = localize('welcomeOverlay.subtitle', "Complete the following steps to get started.");

		// Steps
		const stepsContainer = append(content, $('.sessions-welcome-overlay-steps'));

		for (const prerequisite of this.prerequisiteService.prerequisites) {
			this._renderStep(stepsContainer, prerequisite);
		}
	}

	private _renderStep(parent: HTMLElement, prerequisite: ISessionsPrerequisite): void {
		const step = append(parent, $('.sessions-welcome-step'));
		if (prerequisite.isSatisfied) {
			step.classList.add('satisfied');
		}

		// Icon
		const iconContainer = append(step, $('.sessions-welcome-step-icon'));
		const iconEl = append(iconContainer, $('span'));
		this._updateStepIcon(iconEl, prerequisite.isSatisfied);

		// Info
		const info = append(step, $('.sessions-welcome-step-info'));
		const label = append(info, $('.sessions-welcome-step-label'));
		label.textContent = prerequisite.label;
		const description = append(info, $('.sessions-welcome-step-description'));
		description.textContent = prerequisite.description;

		// Action button
		const actionContainer = append(step, $('.sessions-welcome-step-action'));
		const button = this._stepDisposables.add(new Button(actionContainer, { ...defaultButtonStyles }));
		button.label = prerequisite.actionLabel;
		this._stepDisposables.add(button.onDidClick(async () => {
			button.enabled = false;
			try {
				await prerequisite.executeAction();
			} catch (err) {
				this.logService.error(`[SessionsWelcomeOverlay] Action failed for ${prerequisite.id}:`, err);
			} finally {
				button.enabled = true;
			}
		}));

		this._stepElements.set(prerequisite.id, { container: step, iconEl });

		// Listen for changes
		this._stepDisposables.add(prerequisite.onDidChangeSatisfied(satisfied => {
			step.classList.toggle('satisfied', satisfied);
			this._updateStepIcon(iconEl, satisfied);
		}));
	}

	private _updateStepIcon(iconEl: HTMLElement, satisfied: boolean): void {
		iconEl.className = '';
		iconEl.classList.add(...ThemeIcon.asClassNameArray(
			satisfied ? Codicon.passFilledInverse : Codicon.circle
		));
	}

	private _hide(): void {
		this._container.classList.add('hidden');
		this._hideTimeout = setTimeout(() => {
			this._container.remove();
			this._hideTimeout = undefined;
		}, 300); // matches CSS transition duration
	}

	override dispose(): void {
		if (this._hideTimeout !== undefined) {
			clearTimeout(this._hideTimeout);
			this._hideTimeout = undefined;
		}
		super.dispose();
	}
}
