/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../base/common/codicons.js';
import { constObservable, IObservable, observableValue } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { IStorageSourceFilter } from '../../common/aiCustomizationWorkspaceService.js';
import { CustomizationHarness, ICustomizationHarnessService, IHarnessDescriptor } from '../../common/customizationHarnessService.js';
import { PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { PromptsStorage } from '../../common/promptSyntax/service/promptsService.js';

/**
 * Default "show everything" filter used in core VS Code.
 */
const DEFAULT_FILTER: IStorageSourceFilter = {
	sources: [PromptsStorage.local, PromptsStorage.user, PromptsStorage.extension, PromptsStorage.plugin],
};

/**
 * VS Code harness descriptor — exposes all storage sources.
 */
const VSCODE_HARNESS: IHarnessDescriptor = {
	id: CustomizationHarness.VSCode,
	label: localize('harness.vscode', "VS Code"),
	icon: ThemeIcon.fromId(Codicon.copilot.id),
	getStorageSourceFilter(_type: PromptsType): IStorageSourceFilter {
		return DEFAULT_FILTER;
	},
};

/**
 * Core implementation of the customization harness service.
 *
 * In standalone VS Code there is only the "VS Code" harness, so the
 * toggle bar is hidden. Sessions overrides this to add CLI/Claude
 * harnesses with restricted storage filters.
 */
class CustomizationHarnessService implements ICustomizationHarnessService {
	declare readonly _serviceBrand: undefined;

	private readonly _activeHarness = observableValue<CustomizationHarness>(this, CustomizationHarness.VSCode);
	readonly activeHarness: IObservable<CustomizationHarness> = this._activeHarness;

	readonly availableHarnesses: IObservable<readonly IHarnessDescriptor[]> = constObservable([VSCODE_HARNESS]);

	setActiveHarness(id: CustomizationHarness): void {
		const harnesses = this.availableHarnesses.get();
		if (harnesses.some(h => h.id === id)) {
			this._activeHarness.set(id, undefined);
		}
	}

	getStorageSourceFilter(type: PromptsType): IStorageSourceFilter {
		const activeId = this._activeHarness.get();
		const descriptor = this.availableHarnesses.get().find(h => h.id === activeId);
		return descriptor?.getStorageSourceFilter(type) ?? DEFAULT_FILTER;
	}
}

registerSingleton(ICustomizationHarnessService, CustomizationHarnessService, InstantiationType.Delayed);
