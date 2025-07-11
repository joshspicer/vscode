/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableMap } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { extHostNamedCustomer, IExtHostContext } from '../../services/extensions/common/extHostCustomers.js';
import { MainThreadRemoteCodingAgentsShape, IRemoteCodingAgentStatusUpdateDto, MainContext } from '../common/extHost.protocol.js';
import { IRemoteCodingAgentsService, IRemoteCodingAgentStatusUpdate } from '../../contrib/remoteCodingAgents/common/remoteCodingAgentsService.js';

interface IProviderData {
	dispose(): void;
}

@extHostNamedCustomer(MainContext.MainThreadRemoteCodingAgents)
export class MainThreadRemoteCodingAgents extends Disposable implements MainThreadRemoteCodingAgentsShape {
	private readonly _providers = this._register(new DisposableMap<number, IProviderData>());

	constructor(
		_extHostContext: IExtHostContext,
		@IRemoteCodingAgentsService private readonly _remoteCodingAgentsService: IRemoteCodingAgentsService,
	) {
		super();
	}

	$registerStatusProvider(handle: number): void {
		const providerData: IProviderData = {
			dispose: () => {
				// Cleanup logic if needed
			}
		};
		this._providers.set(handle, providerData);
	}

	$unregisterStatusProvider(handle: number): void {
		this._providers.deleteAndDispose(handle);
	}

	$onDidUpdateStatus(update: IRemoteCodingAgentStatusUpdateDto): void {
		console.log('MainThreadRemoteCodingAgents: Received update from extension:', update);

		// Convert DTO to internal type
		const statusUpdate: IRemoteCodingAgentStatusUpdate = {
			agentId: update.agentId,
			jobId: update.jobId,
			timestamp: update.timestamp,
			command: update.command,
			data: {
				filesChanged: update.data.filesChanged?.map(fc => ({
					uri: URI.revive(fc.uri).toString(),
					changeType: fc.changeType,
					preview: fc.preview
				})),
				messages: update.data.messages,
				logs: update.data.logs,
				links: update.data.links?.map(link => ({
					uri: URI.revive(link.uri).toString(),
					label: link.label,
					tooltip: link.tooltip
				})),
				icon: update.data.icon
			}
		};

		console.log('MainThreadRemoteCodingAgents: Converted to internal type:', statusUpdate);

		// Report to service
		this._remoteCodingAgentsService.reportStatus(statusUpdate);
	}
}
