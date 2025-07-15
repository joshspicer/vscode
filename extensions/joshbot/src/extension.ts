/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;
let statusEmitter: vscode.EventEmitter<vscode.RemoteCodingAgentStatusUpdate> | undefined;
let statusProvider: vscode.RemoteCodingAgentStatusProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
	console.log('JoshBot extension is now active!');

	// Create output channel for debugging
	outputChannel = vscode.window.createOutputChannel('JoshBot');
	context.subscriptions.push(outputChannel);
	outputChannel.appendLine('JoshBot extension activated');

	// Create status emitter and provider
	statusEmitter = new vscode.EventEmitter<vscode.RemoteCodingAgentStatusUpdate>();
	statusProvider = {
		onDidUpdateStatus: statusEmitter.event
	};

	// Register the status provider
	try {
		const providerDisposable = vscode.remoteCodingAgents.registerStatusProvider(statusProvider);
		context.subscriptions.push(providerDisposable);
		outputChannel?.appendLine('Remote coding agent status provider registered successfully');
	} catch (error) {
		outputChannel?.appendLine(`Error registering status provider: ${error}`);
		vscode.window.showErrorMessage(`JoshBot: Failed to register status provider. Error: ${error}`);
	}

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('joshbot.startCodingTask', () => {
			outputChannel?.appendLine('Starting coding task...');

			// Send a status update
			if (statusEmitter) {
				const update: vscode.RemoteCodingAgentStatusUpdate = {
					agentId: 'joshbot',
					timestamp: Date.now(),
					data: {
						logs: [{
							level: vscode.RemoteCodingAgentLogLevel.Info,
							message: 'Started Task',
							timestamp: Date.now()
						}],
						icon: new vscode.ThemeIcon('robot')
					}
				};
				statusEmitter.fire(update);
				outputChannel?.appendLine(`Fired status update: ${JSON.stringify(update, null, 2)}`);
			}
		})
	);
}

export function deactivate(): void {
	outputChannel?.appendLine('JoshBot extension deactivated');
	statusEmitter?.dispose();
	outputChannel?.dispose();
}
