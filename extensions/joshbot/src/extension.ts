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
		vscode.commands.registerCommand('joshbot.startCodingTask', (): vscode.RemoteCodingAgentCommandResult => {
			outputChannel?.appendLine('Starting coding task...');

			const jobId = getJobName();
			const { title, description } = getRandomTask();

			// Start queueing status updates for this job
			queueStatusUpdatesForJob(jobId, title);
			return {
				title,
				jobId,
				description
			};
		})
	);
}

function getJobName(): string {
	const getRandomWord = () => {
		const words = ['frog', 'blue', 'green', 'red', 'yellow', 'purple', 'orange', 'cat', 'dog', 'fish', 'bird', 'tree', 'flower', 'sky', 'cloud', 'mountain', 'river'];
		return words[Math.floor(Math.random() * words.length)];
	};
	return `${getRandomWord()}-${getRandomWord()}-${getRandomWord()}`;
}

function getRandomTask(): { title: string; description: string } {
	const tasks = [
		{ title: 'Implement feature X', description: 'Add feature X to the application.' },
		{ title: 'Fix bug Y', description: 'Resolve the issue with bug Y in the codebase.' },
		{ title: 'Refactor module Z', description: 'Improve the structure of module Z for better maintainability.' },
		{ title: 'Write tests for A', description: 'Create unit tests for component A to ensure reliability.' },
		{ title: 'Update documentation', description: 'Revise the documentation to reflect recent changes.' },
		{ title: 'Optimize performance', description: 'Enhance the performance of the application by optimizing critical paths.' },
		{ title: 'Add new configuration option', description: 'Implement a new configuration option for users to customize behavior.' },
		{ title: 'Integrate third-party library', description: 'Add and configure a third-party library to extend functionality.' }
	];
	return tasks[Math.floor(Math.random() * tasks.length)];
}

export function deactivate(): void {
	outputChannel?.appendLine('JoshBot extension deactivated');
	statusEmitter?.dispose();
	outputChannel?.dispose();
}
function queueStatusUpdatesForJob(jobId: string, title: string) {
	if (!statusEmitter) {
		outputChannel?.appendLine('ERROR: Status emitter is not initialized');
		console.error('ERROR: Status emitter is not initialized');
		return;
	}

	const getContentForProgressLevel = (progress: number): string => {
		if (progress < 0.2) {
			return 'Sifting through the codebase...';
		} else if (progress < 0.4) {
			return 'Analyzing requirements...';
		} else if (progress < 0.6) {
			return 'Drafting initial implementation...';
		} else if (progress < 0.8) {
			return 'Testing and refining code...';
		} else if (progress < 1.0) {
			return 'Finalizing implementation...';
		} else {
			return 'Finished!';
		}
	};

	const update = (jobId: string, title: string, progress: number) => {
		const statusUpdate: vscode.RemoteCodingAgentStatusUpdate = {
			agentId: 'joshbot',
			jobId,
			timestamp: Date.now(),
			data: {
				messages: [{
					type: vscode.RemoteCodingAgentMessageType.Response,
					content: getContentForProgressLevel(progress),
					timestamp: Date.now()
				}],
				// filesChanged: progress > 0.5 ? [{
				// 	uri: vscode.Uri.parse(`file:///path/to/changed/file-${jobId}.js`),
				// 	type: vscode.RemoteCodingAgentFileChangeType.Modified,
				// 	preview: 'function doSomething() { /* implementation */ }'
				// }] : [],
				icon: new vscode.ThemeIcon('check'),
			}
		};
		statusEmitter?.fire(statusUpdate);
		outputChannel?.appendLine(`Status update for job ${jobId}: ${title} - ${progress * 100}% complete`);
	};

	const TOTAL = 5;
	let currentStep = 0;

	const intervalId = setInterval(() => {
		currentStep++;
		update(jobId, title, currentStep / TOTAL);

		if (currentStep >= TOTAL) {
			clearInterval(intervalId);
		}
	}, 5000); // Update every 5 seconds

}
