/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { ExtHostRemoteCodingAgentsShape, IRemoteCodingAgentStatusUpdateDto, MainContext } from './extHost.protocol.js';
import type * as vscode from 'vscode';

export interface IExtHostRemoteCodingAgents extends ExtHostRemoteCodingAgentsShape {
	registerStatusProvider(provider: vscode.RemoteCodingAgentStatusProvider): vscode.Disposable;
}
export const IExtHostRemoteCodingAgents = createDecorator<IExtHostRemoteCodingAgents>('IExtHostRemoteCodingAgents');

export class ExtHostRemoteCodingAgents extends Disposable implements IExtHostRemoteCodingAgents {
	declare _serviceBrand: undefined;

	private readonly _proxy = this._extHostRpc.getProxy(MainContext.MainThreadRemoteCodingAgents);
	private readonly _statusProviders = new Map<number, { provider: vscode.RemoteCodingAgentStatusProvider; disposable: DisposableStore }>();
	private _nextHandle = 0;

	constructor(
		@IExtHostRpcService private readonly _extHostRpc: IExtHostRpcService,
	) {
		super();
	}

	registerStatusProvider(provider: vscode.RemoteCodingAgentStatusProvider): vscode.Disposable {
		const handle = this._nextHandle++;
		const disposable = new DisposableStore();

		this._statusProviders.set(handle, { provider, disposable });

		// Listen to provider events and forward to main thread
		disposable.add(provider.onDidUpdateStatus((update: vscode.RemoteCodingAgentStatusUpdate) => {
			console.log('ExtHostRemoteCodingAgents: Received update from extension:', update);

			const dto: IRemoteCodingAgentStatusUpdateDto = {
				agentId: update.agentId,
				jobId: update.jobId,
				timestamp: update.timestamp,
				command: update.command,
				data: {
					filesChanged: update.data.filesChanged?.map((fc: any) => ({
						uri: fc.uri,
						changeType: fc.type,
						preview: fc.preview
					})),
					messages: update.data.messages?.map((msg: any) => ({
						messageType: msg.type,
						content: msg.content,
						timestamp: msg.timestamp
					})),
					logs: update.data.logs,
					links: update.data.links?.map((link: any) => ({
						uri: link.uri,
						label: link.label,
						tooltip: link.tooltip
					})),
					icon: update.data.icon ? {
						id: update.data.icon.id,
						color: update.data.icon.color?.id
					} : undefined
				}
			};

			console.log('ExtHostRemoteCodingAgents: Converted to DTO:', dto);
			this._proxy.$onDidUpdateStatus(dto);
		}));

		this._proxy.$registerStatusProvider(handle);

		return {
			dispose: () => {
				this._statusProviders.delete(handle);
				disposable.dispose();
				this._proxy.$unregisterStatusProvider(handle);
			}
		};
	}

}
