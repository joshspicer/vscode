/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/**
 * Represents a single prerequisite that must be satisfied before the
 * sessions window is usable.
 */
export interface ISessionsPrerequisite extends IDisposable {
	/** Unique identifier for this prerequisite */
	readonly id: string;
	/** Human-readable label */
	readonly label: string;
	/** Description of what this prerequisite requires */
	readonly description: string;
	/** Whether this prerequisite is currently satisfied */
	readonly isSatisfied: boolean;
	/** Fires when the satisfaction state changes */
	readonly onDidChangeSatisfied: Event<boolean>;
	/** Label for the action button (e.g., "Install", "Sign In") */
	readonly actionLabel: string;
	/** Execute the action to satisfy this prerequisite */
	executeAction(): Promise<void>;
}

export const ISessionsPrerequisiteService = createDecorator<ISessionsPrerequisiteService>('sessionsPrerequisiteService');

export interface ISessionsPrerequisiteService {
	readonly _serviceBrand: undefined;

	/** Whether all prerequisites are satisfied */
	readonly allSatisfied: boolean;

	/** Fires when the overall satisfaction state changes */
	readonly onDidChangeAllSatisfied: Event<boolean>;

	/** Get all registered prerequisites */
	readonly prerequisites: readonly ISessionsPrerequisite[];

	/** Register a new prerequisite */
	registerPrerequisite(prerequisite: ISessionsPrerequisite): IDisposable;
}

export class SessionsPrerequisiteService extends Disposable implements ISessionsPrerequisiteService {
	declare readonly _serviceBrand: undefined;

	private readonly _prerequisites: ISessionsPrerequisite[] = [];
	private readonly _onDidChangeAllSatisfied = this._register(new Emitter<boolean>());
	readonly onDidChangeAllSatisfied: Event<boolean> = this._onDidChangeAllSatisfied.event;

	private _allSatisfied = true;

	get allSatisfied(): boolean {
		return this._allSatisfied;
	}

	get prerequisites(): readonly ISessionsPrerequisite[] {
		return this._prerequisites;
	}

	registerPrerequisite(prerequisite: ISessionsPrerequisite): IDisposable {
		this._prerequisites.push(prerequisite);
		this._updateSatisfied();

		const listener = prerequisite.onDidChangeSatisfied(() => {
			this._updateSatisfied();
		});

		return {
			dispose: () => {
				const idx = this._prerequisites.indexOf(prerequisite);
				if (idx >= 0) {
					this._prerequisites.splice(idx, 1);
				}
				listener.dispose();
				this._updateSatisfied();
			}
		};
	}

	private _updateSatisfied(): void {
		const newValue = this._prerequisites.length === 0 || this._prerequisites.every(p => p.isSatisfied);
		if (newValue !== this._allSatisfied) {
			this._allSatisfied = newValue;
			this._onDidChangeAllSatisfied.fire(newValue);
		}
	}
}
