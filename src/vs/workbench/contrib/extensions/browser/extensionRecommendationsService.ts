/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IExtensionManagementService, IExtensionGalleryService, InstallOperation, InstallExtensionResult } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IExtensionRecommendationsService, ExtensionRecommendationReason, IExtensionIgnoredRecommendationsService } from '../../../services/extensionRecommendations/common/extensionRecommendations.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { shuffle } from '../../../../base/common/arrays.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { LifecyclePhase, ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { ExeBasedRecommendations } from './exeBasedRecommendations.js';
import { WorkspaceRecommendations } from './workspaceRecommendations.js';
import { FileBasedRecommendations } from './fileBasedRecommendations.js';
import { KeymapRecommendations } from './keymapRecommendations.js';
import { LanguageRecommendations } from './languageRecommendations.js';
import { ExtensionRecommendation } from './extensionRecommendations.js';
import { ConfigBasedRecommendations } from './configBasedRecommendations.js';
import { IExtensionRecommendationNotificationService } from '../../../../platform/extensionRecommendations/common/extensionRecommendations.js';
import { CancelablePromise, timeout } from '../../../../base/common/async.js';
import { URI } from '../../../../base/common/uri.js';
import { WebRecommendations } from './webRecommendations.js';
import { IExtensionsWorkbenchService } from '../common/extensions.js';
import { areSameExtensions } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { RemoteRecommendations } from './remoteRecommendations.js';
import { IRemoteExtensionsScannerService } from '../../../../platform/remote/common/remoteExtensionsScanner.js';
import { IUserDataInitializationService } from '../../../services/userData/browser/userDataInit.js';
import { isString } from '../../../../base/common/types.js';

export class ExtensionRecommendationsService extends Disposable implements IExtensionRecommendationsService {

	declare readonly _serviceBrand: undefined;

	// Recommendations
	private readonly fileBasedRecommendations: FileBasedRecommendations;
	private readonly workspaceRecommendations: WorkspaceRecommendations;
	private readonly configBasedRecommendations: ConfigBasedRecommendations;
	private readonly exeBasedRecommendations: ExeBasedRecommendations;
	private readonly keymapRecommendations: KeymapRecommendations;
	private readonly webRecommendations: WebRecommendations;
	private readonly languageRecommendations: LanguageRecommendations;
	private readonly remoteRecommendations: RemoteRecommendations;

	public readonly activationPromise: Promise<void>;
	private sessionSeed: number;

	private _onDidChangeRecommendations = this._register(new Emitter<void>());
	readonly onDidChangeRecommendations = this._onDidChangeRecommendations.event;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IExtensionGalleryService private readonly galleryService: IExtensionGalleryService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IExtensionIgnoredRecommendationsService private readonly extensionRecommendationsManagementService: IExtensionIgnoredRecommendationsService,
		@IExtensionRecommendationNotificationService private readonly extensionRecommendationNotificationService: IExtensionRecommendationNotificationService,
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IRemoteExtensionsScannerService private readonly remoteExtensionsScannerService: IRemoteExtensionsScannerService,
		@IUserDataInitializationService private readonly userDataInitializationService: IUserDataInitializationService,
	) {
		super();

		this.workspaceRecommendations = this._register(instantiationService.createInstance(WorkspaceRecommendations));
		this.fileBasedRecommendations = this._register(instantiationService.createInstance(FileBasedRecommendations));
		this.configBasedRecommendations = this._register(instantiationService.createInstance(ConfigBasedRecommendations));
		this.exeBasedRecommendations = this._register(instantiationService.createInstance(ExeBasedRecommendations));
		this.keymapRecommendations = this._register(instantiationService.createInstance(KeymapRecommendations));
		this.webRecommendations = this._register(instantiationService.createInstance(WebRecommendations));
		this.languageRecommendations = this._register(instantiationService.createInstance(LanguageRecommendations));
		this.remoteRecommendations = this._register(instantiationService.createInstance(RemoteRecommendations));

		if (!this.isEnabled()) {
			this.sessionSeed = 0;
			this.activationPromise = Promise.resolve();
			return;
		}

		this.sessionSeed = +new Date();

		// Activation
		this.activationPromise = this.activate();

		this._register(this.extensionManagementService.onDidInstallExtensions(e => this.onDidInstallExtensions(e)));
	}

	private async activate(): Promise<void> {

		// await this.remoteExtensionsScannerService.whenExtensionsReady()
		// 	.then(() => {
		// 		console.log('fulfilled');
		// 	}).catch(() => {
		// 		console.log('rejected.  This is expected.');

		// 		// Proof of concept: Install an extension from here
		// 		this.extensionManagementService.installFromGallery({
		// 			type: "gallery",
		// 			identifier: {
		// 				id: "github.copilot",
		// 				uuid: "23c4aeee-f844-43cd-b53e-1113e483f1a6",
		// 			},
		// 			name: "copilot",
		// 			version: "1.259.1335",
		// 			displayName: "GitHub Copilot",
		// 			publisherId: "7c1c19cd-78eb-4dfb-8999-99caf7679002",
		// 			publisher: "GitHub",
		// 			publisherDisplayName: "GitHub",
		// 			publisherDomain: {
		// 				link: "https://github.com",
		// 				verified: true,
		// 			},
		// 			description: "Your AI pair programmer",
		// 			installCount: 26803564,
		// 			rating: 3.604609966278076,
		// 			ratingCount: 1128,
		// 			categories: [
		// 				"Programming Languages",
		// 				"Machine Learning",
		// 				"AI",
		// 				"Chat",
		// 			],
		// 			tags: [
		// 				"ai",
		// 				"autocomplete",
		// 				"c#",
		// 				"c++",
		// 				"code-referencing",
		// 				"codex",
		// 				"co-pilot",
		// 				"documentation",
		// 				"go",
		// 				"golang",
		// 				"intellisense",
		// 				"java",
		// 				"javascript",
		// 				"keybindings",
		// 				"kotlin",
		// 				"openai",
		// 				"php",
		// 				"pilot",
		// 				"python",
		// 				"refactor",
		// 				"ruby",
		// 				"snippets",
		// 				"typescript",
		// 			],
		// 			releaseDate: 1624976777880,
		// 			lastUpdated: 1737735084443,
		// 			allTargetPlatforms: [
		// 				TargetPlatform.UNDEFINED,
		// 			],
		// 			assets: {
		// 				manifest: {
		// 					uri: "https://github.gallerycdn.vsassets.io/extensions/github/copilot/1.259.1335/1737734880548/Microsoft.VisualStudio.Code.Manifest",
		// 					fallbackUri: "https://github.gallery.vsassets.io/_apis/public/gallery/publisher/GitHub/extension/copilot/1.259.1335/assetbyname/Microsoft.VisualStudio.Code.Manifest",
		// 				},
		// 				readme: {
		// 					uri: "https://github.gallerycdn.vsassets.io/extensions/github/copilot/1.259.1335/1737734880548/Microsoft.VisualStudio.Services.Content.Details",
		// 					fallbackUri: "https://github.gallery.vsassets.io/_apis/public/gallery/publisher/GitHub/extension/copilot/1.259.1335/assetbyname/Microsoft.VisualStudio.Services.Content.Details",
		// 				},
		// 				changelog: null,
		// 				license: {
		// 					uri: "https://github.gallerycdn.vsassets.io/extensions/github/copilot/1.259.1335/1737734880548/Microsoft.VisualStudio.Services.Content.License",
		// 					fallbackUri: "https://github.gallery.vsassets.io/_apis/public/gallery/publisher/GitHub/extension/copilot/1.259.1335/assetbyname/Microsoft.VisualStudio.Services.Content.License",
		// 				},
		// 				repository: null,
		// 				download: {
		// 					uri: "https://github.gallery.vsassets.io/_apis/public/gallery/publisher/GitHub/extension/copilot/1.259.1335/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage?redirect=true",
		// 					fallbackUri: "https://github.gallery.vsassets.io/_apis/public/gallery/publisher/GitHub/extension/copilot/1.259.1335/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage",
		// 				},
		// 				icon: {
		// 					uri: "https://github.gallerycdn.vsassets.io/extensions/github/copilot/1.259.1335/1737734880548/Microsoft.VisualStudio.Services.Icons.Default",
		// 					fallbackUri: "https://github.gallery.vsassets.io/_apis/public/gallery/publisher/GitHub/extension/copilot/1.259.1335/assetbyname/Microsoft.VisualStudio.Services.Icons.Default",
		// 				},
		// 				signature: {
		// 					uri: "https://github.gallerycdn.vsassets.io/extensions/github/copilot/1.259.1335/1737734880548/Microsoft.VisualStudio.Services.VsixSignature",
		// 					fallbackUri: "https://github.gallery.vsassets.io/_apis/public/gallery/publisher/GitHub/extension/copilot/1.259.1335/assetbyname/Microsoft.VisualStudio.Services.VsixSignature",
		// 				},
		// 				coreTranslations: [
		// 				],
		// 			},
		// 			properties: {
		// 				dependencies: [
		// 				],
		// 				extensionPack: [
		// 					"github.copilot-chat",
		// 				],
		// 				engine: "^1.96.0",
		// 				enabledApiProposals: [
		// 					"inlineCompletionsAdditions",
		// 				],
		// 				localizedLanguages: [
		// 				],
		// 				targetPlatform: TargetPlatform.UNDEFINED,
		// 				isPreReleaseVersion: true,
		// 				executesCode: true,
		// 			},
		// 			hasPreReleaseVersion: true,
		// 			hasReleaseVersion: true,
		// 			preview: false,
		// 			isSigned: true,
		// 			queryContext: {
		// 				"X-Market-Search-Activity-Id": "e8559844-e8e3-4e63-bea9-845bd554735a",
		// 			},
		// 			supportLink: "https://github.com/community/community/discussions/categories/copilot",
		// 			telemetryData: {
		// 				index: 0,
		// 				querySource: "searchText",
		// 				queryActivityId: "e8559844-e8e3-4e63-bea9-845bd554735a",
		// 			},
		// 		});
		// 	});

		try {
			await Promise.allSettled([
				this.remoteExtensionsScannerService.whenExtensionsReady(),
				this.userDataInitializationService.whenInitializationFinished(),
				this.lifecycleService.when(LifecyclePhase.Restored)]);
		} catch (error) { /* ignore */
			console.log('JOSPICER: In a strange place (catch of recommendations::activate()');
		}

		// activate all recommendations
		await Promise.all([
			this.workspaceRecommendations.activate(),
			this.configBasedRecommendations.activate(),
			this.fileBasedRecommendations.activate(),
			this.keymapRecommendations.activate(),
			this.languageRecommendations.activate(),
			this.webRecommendations.activate(),
			this.remoteRecommendations.activate()
		]);

		this._register(Event.any(this.workspaceRecommendations.onDidChangeRecommendations, this.configBasedRecommendations.onDidChangeRecommendations, this.extensionRecommendationsManagementService.onDidChangeIgnoredRecommendations)(() => this._onDidChangeRecommendations.fire()));

		this.promptWorkspaceRecommendations();
	}

	private isEnabled(): boolean {
		return this.galleryService.isEnabled() && !this.environmentService.isExtensionDevelopment;
	}

	private async activateProactiveRecommendations(): Promise<void> {
		await Promise.all([this.exeBasedRecommendations.activate(), this.configBasedRecommendations.activate()]);
	}

	getAllRecommendationsWithReason(): { [id: string]: { reasonId: ExtensionRecommendationReason; reasonText: string } } {
		/* Activate proactive recommendations */
		this.activateProactiveRecommendations();

		const output: { [id: string]: { reasonId: ExtensionRecommendationReason; reasonText: string } } = Object.create(null);

		const allRecommendations = [
			...this.configBasedRecommendations.recommendations,
			...this.exeBasedRecommendations.recommendations,
			...this.fileBasedRecommendations.recommendations,
			...this.workspaceRecommendations.recommendations,
			...this.keymapRecommendations.recommendations,
			...this.languageRecommendations.recommendations,
			...this.webRecommendations.recommendations,
		];

		for (const { extension, reason } of allRecommendations) {
			if (isString(extension) && this.isExtensionAllowedToBeRecommended(extension)) {
				output[extension.toLowerCase()] = reason;
			}
		}

		return output;
	}

	async getConfigBasedRecommendations(): Promise<{ important: string[]; others: string[] }> {
		await this.configBasedRecommendations.activate();
		return {
			important: this.toExtensionIds(this.configBasedRecommendations.importantRecommendations),
			others: this.toExtensionIds(this.configBasedRecommendations.otherRecommendations)
		};
	}

	async getOtherRecommendations(): Promise<string[]> {
		await this.activationPromise;
		await this.activateProactiveRecommendations();

		const recommendations = [
			...this.configBasedRecommendations.otherRecommendations,
			...this.exeBasedRecommendations.otherRecommendations,
			...this.webRecommendations.recommendations
		];

		const extensionIds = this.toExtensionIds(recommendations);
		shuffle(extensionIds, this.sessionSeed);
		return extensionIds;
	}

	async getImportantRecommendations(): Promise<string[]> {
		await this.activateProactiveRecommendations();

		const recommendations = [
			...this.fileBasedRecommendations.importantRecommendations,
			...this.configBasedRecommendations.importantRecommendations,
			...this.exeBasedRecommendations.importantRecommendations,
		];

		const extensionIds = this.toExtensionIds(recommendations);
		shuffle(extensionIds, this.sessionSeed);
		return extensionIds;
	}

	getKeymapRecommendations(): string[] {
		return this.toExtensionIds(this.keymapRecommendations.recommendations);
	}

	getLanguageRecommendations(): string[] {
		return this.toExtensionIds(this.languageRecommendations.recommendations);
	}

	getRemoteRecommendations(): string[] {
		return this.toExtensionIds(this.remoteRecommendations.recommendations);
	}

	async getWorkspaceRecommendations(): Promise<Array<string | URI>> {
		if (!this.isEnabled()) {
			return [];
		}
		await this.workspaceRecommendations.activate();
		const result: Array<string | URI> = [];
		for (const { extension } of this.workspaceRecommendations.recommendations) {
			if (isString(extension)) {
				if (!result.includes(extension.toLowerCase()) && this.isExtensionAllowedToBeRecommended(extension)) {
					result.push(extension.toLowerCase());
				}
			} else {
				result.push(extension);
			}
		}
		return result;
	}

	async getExeBasedRecommendations(exe?: string): Promise<{ important: string[]; others: string[] }> {
		await this.exeBasedRecommendations.activate();
		const { important, others } = exe ? this.exeBasedRecommendations.getRecommendations(exe)
			: { important: this.exeBasedRecommendations.importantRecommendations, others: this.exeBasedRecommendations.otherRecommendations };
		return { important: this.toExtensionIds(important), others: this.toExtensionIds(others) };
	}

	getFileBasedRecommendations(): string[] {
		return this.toExtensionIds(this.fileBasedRecommendations.recommendations);
	}

	private onDidInstallExtensions(results: readonly InstallExtensionResult[]): void {
		for (const e of results) {
			if (e.source && !URI.isUri(e.source) && e.operation === InstallOperation.Install) {
				const extRecommendations = this.getAllRecommendationsWithReason() || {};
				const recommendationReason = extRecommendations[e.source.identifier.id.toLowerCase()];
				if (recommendationReason) {
					/* __GDPR__
						"extensionGallery:install:recommendations" : {
							"owner": "sandy081",
							"recommendationReason": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
							"${include}": [
								"${GalleryExtensionTelemetryData}"
							]
						}
					*/
					this.telemetryService.publicLog('extensionGallery:install:recommendations', { ...e.source.telemetryData, recommendationReason: recommendationReason.reasonId });
				}
			}
		}
	}

	private toExtensionIds(recommendations: ReadonlyArray<ExtensionRecommendation>): string[] {
		const extensionIds: string[] = [];
		for (const { extension } of recommendations) {
			if (isString(extension) && this.isExtensionAllowedToBeRecommended(extension) && !extensionIds.includes(extension.toLowerCase())) {
				extensionIds.push(extension.toLowerCase());
			}
		}
		return extensionIds;
	}

	private isExtensionAllowedToBeRecommended(extensionId: string): boolean {
		return !this.extensionRecommendationsManagementService.ignoredRecommendations.includes(extensionId.toLowerCase());
	}

	private async promptWorkspaceRecommendations(): Promise<void> {
		const installed = await this.extensionsWorkbenchService.queryLocal();
		const allowedRecommendations = [
			...this.workspaceRecommendations.recommendations,
			...this.configBasedRecommendations.importantRecommendations.filter(
				recommendation => !recommendation.whenNotInstalled || recommendation.whenNotInstalled.every(id => installed.every(local => !areSameExtensions(local.identifier, { id }))))
		]
			.map(({ extension }) => extension)
			.filter(extension => !isString(extension) || this.isExtensionAllowedToBeRecommended(extension));

		if (allowedRecommendations.length) {
			await this._registerP(timeout(5000));
			await this.extensionRecommendationNotificationService.promptWorkspaceRecommendations(allowedRecommendations);
		}
	}

	private _registerP<T>(o: CancelablePromise<T>): CancelablePromise<T> {
		this._register(toDisposable(() => o.cancel()));
		return o;
	}
}
