/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @ts-nocheck
// allow-any-unicode

import * as vscode from 'vscode';

// Internal VS Code data structures (what we actually receive from tree view commands)
interface IRemoteCodingAgentStatusData {
	filesChanged?: {
		uri: string;
		changeType: 'created' | 'modified' | 'deleted';
		preview?: string;
	}[];
	messages?: {
		messageType: 'request' | 'response';
		content: string;
		timestamp: number;
	}[];
	logs?: {
		level: 'info' | 'warn' | 'error';
		message: string;
		timestamp: number;
	}[];
	links?: {
		uri: string;
		label: string;
		tooltip?: string;
	}[];
	icon?: {
		id: string;
		color?: string;
	};
}

interface IRemoteCodingAgentStatusUpdate {
	agentId: string;
	jobId?: string;
	timestamp: number;
	data: IRemoteCodingAgentStatusData;
	command?: string;
}

let statusEmitter: vscode.EventEmitter<vscode.RemoteCodingAgentStatusUpdate> | undefined;
let statusProvider: vscode.RemoteCodingAgentStatusProvider | undefined;
let currentJobId: string | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;

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

	// Register the status provider - wrap in setTimeout to avoid startup issues
	setTimeout(() => {
		try {
			if (statusProvider) {
				const providerDisposable = vscode.remoteCodingAgents.registerStatusProvider(statusProvider);
				context.subscriptions.push(providerDisposable);
				outputChannel?.appendLine('Status provider registered successfully');
			}
		} catch (error) {
			outputChannel?.appendLine(`Error registering status provider: ${error}`);
			vscode.window.showErrorMessage(`JoshBot: Failed to register status provider. Make sure the remoteCodingAgents API is enabled.`);
		}
	}, 1000);

	// Create status bar item
	statusBarItem = vscode.window.createStatusBarItem('joshbot.status', vscode.StatusBarAlignment.Left, 100);
	statusBarItem.name = 'JoshBot Status';
	statusBarItem.text = '$(robot) JoshBot: Ready';
	statusBarItem.tooltip = 'JoshBot Remote Coding Agent Status';
	statusBarItem.command = 'joshbot.startCodingTask';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('joshbot.startCodingTask', () => startCodingTask())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('joshbot.showJobDetails', (agentId: string, jobId?: string, statusUpdate?: IRemoteCodingAgentStatusUpdate) =>
			showJobDetailsWebview(context, agentId, jobId, statusUpdate))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('joshbot.simulateFileModification', () => simulateFileModification())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('joshbot.simulateError', () => simulateError())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('joshbot.simulateLongRunningTask', () => simulateLongRunningTask())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('joshbot.clearStatus', () => clearStatus())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('joshbot.showOutput', () => outputChannel?.show())
	);

	// Show welcome message
	vscode.window.showInformationMessage(
		'JoshBot is ready! Use the command palette to test Remote Coding Agents API functionality.',
		'Start Coding Task'
	).then((selection: string | undefined) => {
		if (selection === 'Start Coding Task') {
			vscode.commands.executeCommand('joshbot.startCodingTask');
		}
	});
}

export function deactivate(): void {
	outputChannel?.appendLine('JoshBot extension deactivated');
	statusEmitter?.dispose();
	statusBarItem?.dispose();
	outputChannel?.dispose();
}

function getAgentId(): string {
	return vscode.workspace.getConfiguration('joshbot').get<string>('agentId') || 'joshbot-agent';
}

function getSimulateDelay(): number {
	return vscode.workspace.getConfiguration('joshbot').get<number>('simulateDelay') || 2000;
}

function generateJobId(): string {
	return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function reportStatus(data: vscode.RemoteCodingAgentStatusData): void {
	if (!statusEmitter) {
		outputChannel?.appendLine('Error: Status emitter not initialized');
		return;
	}

	const update: vscode.RemoteCodingAgentStatusUpdate = {
		agentId: getAgentId(),
		jobId: currentJobId,
		timestamp: Date.now(),
		data,
		command: 'joshbot.showJobDetails'
	};

	statusEmitter.fire(update);
	outputChannel?.appendLine(`Status update fired: ${JSON.stringify(update, null, 2)}`);
	console.log('JoshBot status update:', update);
}

function updateStatusBar(text: string): void {
	if (statusBarItem) {
		statusBarItem.text = `$(robot) JoshBot: ${text}`;
	}
}

async function startCodingTask(): Promise<void> {
	currentJobId = generateJobId();
	updateStatusBar('Starting task...');

	// Report task started
	reportStatus({
		logs: [{
			level: vscode.RemoteCodingAgentLogLevel.Info,
			message: `JoshBot starting new coding task: ${currentJobId}`,
			timestamp: Date.now()
		}],
		icon: new vscode.ThemeIcon('loading~spin')
	});

	await sleep(getSimulateDelay() * 1.5);

	// Report analyzing workspace
	updateStatusBar('Analyzing workspace...');
	reportStatus({
		logs: [{
			level: vscode.RemoteCodingAgentLogLevel.Info,
			message: 'Analyzing workspace structure and files',
			timestamp: Date.now()
		}],
		messages: [{
			type: vscode.RemoteCodingAgentMessageType.Request,
			content: 'Please analyze the current workspace and suggest improvements',
			timestamp: Date.now()
		}],
		icon: new vscode.ThemeIcon('search')
	});

	await sleep(getSimulateDelay() * 2.5);

	// Report file modifications using simple file URIs
	updateStatusBar('Modifying files...');
	reportStatus({
		filesChanged: [
			{
				uri: vscode.Uri.file('/tmp/example.txt'),
				type: vscode.RemoteCodingAgentFileChangeType.Modified,
				preview: 'Added error handling and logging'
			},
			{
				uri: vscode.Uri.file('/tmp/readme.md'),
				type: vscode.RemoteCodingAgentFileChangeType.Modified,
				preview: 'Updated documentation with new features'
			}
		],
		logs: [{
			level: vscode.RemoteCodingAgentLogLevel.Info,
			message: 'Modified 2 files to improve error handling',
			timestamp: Date.now()
		}],
		icon: new vscode.ThemeIcon('edit')
	});

	await sleep(getSimulateDelay() * 1.5);

	// Report completion
	updateStatusBar('Task completed');
	reportStatus({
		logs: [{
			level: vscode.RemoteCodingAgentLogLevel.Info,
			message: 'Coding task completed successfully',
			timestamp: Date.now()
		}],
		messages: [{
			type: vscode.RemoteCodingAgentMessageType.Response,
			content: 'I have successfully analyzed your workspace and implemented improvements including better error handling and updated documentation.',
			timestamp: Date.now()
		}],
		links: [{
			uri: vscode.Uri.parse('https://github.com/microsoft/vscode'),
			label: 'View Workspace',
			tooltip: 'Open the modified workspace to see changes'
		}],
		icon: new vscode.ThemeIcon('check')
	});

	setTimeout(() => {
		updateStatusBar('Ready');
	}, getSimulateDelay() * 2);
}

async function simulateFileModification(): Promise<void> {
	if (!currentJobId) {
		currentJobId = generateJobId();
	}

	updateStatusBar('Modifying files...');

	const files = [
		'/tmp/package.json',
		'/tmp/index.ts',
		'/tmp/utils.ts',
		'/tmp/unit.test.ts',
		'/tmp/api.md'
	];

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const uri = vscode.Uri.file(file);

		reportStatus({
			filesChanged: [{
				uri,
				type: Math.random() > 0.7 ? vscode.RemoteCodingAgentFileChangeType.Created : vscode.RemoteCodingAgentFileChangeType.Modified,
				preview: `Updated ${file} with new functionality`
			}],
			logs: [{
				level: vscode.RemoteCodingAgentLogLevel.Info,
				message: `Processing file ${i + 1}/${files.length}: ${file}`,
				timestamp: Date.now()
			}]
		});

		await sleep(getSimulateDelay() / 2);
	}

	updateStatusBar('Files modified');
	setTimeout(() => updateStatusBar('Ready'), getSimulateDelay() * 2);
}

async function simulateError(): Promise<void> {
	if (!currentJobId) {
		currentJobId = generateJobId();
	}

	updateStatusBar('Error occurred');

	reportStatus({
		logs: [
			{
				level: vscode.RemoteCodingAgentLogLevel.Error,
				message: 'Failed to connect to remote server',
				timestamp: Date.now()
			},
			{
				level: vscode.RemoteCodingAgentLogLevel.Warn,
				message: 'Retrying with fallback configuration...',
				timestamp: Date.now()
			}
		],
		messages: [{
			type: vscode.RemoteCodingAgentMessageType.Response,
			content: 'I encountered an error while processing your request. Let me try a different approach.',
			timestamp: Date.now()
		}],
		icon: new vscode.ThemeIcon('error')
	});

	await sleep(getSimulateDelay() * 2);

	reportStatus({
		logs: [{
			level: vscode.RemoteCodingAgentLogLevel.Info,
			message: 'Successfully recovered from error using fallback method',
			timestamp: Date.now()
		}],
		messages: [{
			type: vscode.RemoteCodingAgentMessageType.Response,
			content: 'Error resolved! I was able to complete the task using an alternative approach.',
			timestamp: Date.now()
		}],
		icon: new vscode.ThemeIcon('check')
	});

	setTimeout(() => updateStatusBar('Ready'), getSimulateDelay());
}

async function simulateLongRunningTask(): Promise<void> {
	currentJobId = generateJobId();
	updateStatusBar('Starting long task...');

	const steps = [
		'Initializing environment',
		'Downloading dependencies',
		'Compiling source code',
		'Running tests',
		'Generating documentation',
		'Packaging application',
		'Uploading to repository'
	];

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		updateStatusBar(`${step}...`);

		reportStatus({
			logs: [{
				level: vscode.RemoteCodingAgentLogLevel.Info,
				message: `Step ${i + 1}/${steps.length}: ${step}`,
				timestamp: Date.now()
			}],
			messages: [{
				type: vscode.RemoteCodingAgentMessageType.Response,
				content: `Currently working on: ${step}`,
				timestamp: Date.now()
			}]
		});

		// Simulate some file operations during the task
		if (i % 2 === 0) {
			const uri = vscode.Uri.file(`/tmp/temp-${i}.log`);

			reportStatus({
				filesChanged: [{
					uri,
					type: vscode.RemoteCodingAgentFileChangeType.Created,
					preview: `Log file for step: ${step}`
				}]
			});
		}

		await sleep(getSimulateDelay() * 2);
	}

	updateStatusBar('Long task completed');
	reportStatus({
		logs: [{
			level: vscode.RemoteCodingAgentLogLevel.Info,
			message: 'Long running task completed successfully',
			timestamp: Date.now()
		}],
		messages: [{
			type: vscode.RemoteCodingAgentMessageType.Response,
			content: 'The long running task has been completed successfully. All steps were executed without errors.',
			timestamp: Date.now()
		}],
		links: [{
			uri: vscode.Uri.parse('https://github.com/microsoft/vscode'),
			label: 'View Results',
			tooltip: 'See the results of the long running task'
		}]
	});

	setTimeout(() => updateStatusBar('Ready'), getSimulateDelay());
}

function clearStatus(): void {
	currentJobId = undefined;
	updateStatusBar('Ready');

	reportStatus({
		logs: [{
			level: vscode.RemoteCodingAgentLogLevel.Info,
			message: 'Status cleared',
			timestamp: Date.now()
		}]
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function showJobDetailsWebview(_context: vscode.ExtensionContext, agentId: string, jobId?: string, statusUpdate?: IRemoteCodingAgentStatusUpdate): void {
	// Create and show webview panel
	const panel = vscode.window.createWebviewPanel(
		'joshbotJobDetails',
		`JoshBot Job Details: ${jobId || 'Unknown'}`,
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	// Generate webview content
	panel.webview.html = getWebviewContent(agentId, jobId, statusUpdate);

	outputChannel?.appendLine(`Opened webview for job: ${jobId}`);
}

function getWebviewContent(agentId: string, jobId?: string, statusUpdate?: IRemoteCodingAgentStatusUpdate): string {
	const data = statusUpdate?.data;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>JoshBot Job Details</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			padding: 20px;
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
		.header {
			border-bottom: 1px solid var(--vscode-panel-border);
			padding-bottom: 15px;
			margin-bottom: 20px;
		}
		.section {
			margin-bottom: 20px;
		}
		.section h3 {
			color: var(--vscode-textPreformat-foreground);
			border-bottom: 1px solid var(--vscode-panel-border);
			padding-bottom: 5px;
		}
		.item {
			background-color: var(--vscode-editor-inactiveSelectionBackground);
			padding: 10px;
			margin: 5px 0;
			border-radius: 3px;
		}
		.timestamp {
			color: var(--vscode-descriptionForeground);
			font-size: 0.9em;
		}
		.level-error { color: var(--vscode-errorForeground); }
		.level-warn { color: var(--vscode-warningForeground); }
		.level-info { color: var(--vscode-infoForeground); }
		.message-request { border-left: 3px solid var(--vscode-textLink-foreground); }
		.message-response { border-left: 3px solid var(--vscode-textPreformat-foreground); }
		.file-created { color: var(--vscode-gitDecoration-addedResourceForeground); }
		.file-modified { color: var(--vscode-gitDecoration-modifiedResourceForeground); }
		.file-deleted { color: var(--vscode-gitDecoration-deletedResourceForeground); }
	</style>
</head>
<body>
	<div class="header">
		<h1>JoshBot Job Summary</h1>
		<p><strong>Agent:</strong> ${agentId}</p>
		<p><strong>Job ID:</strong> ${jobId || 'N/A'}</p>
		<p><strong>Timestamp:</strong> ${statusUpdate ? new Date(statusUpdate.timestamp).toLocaleString() : 'Unknown'}</p>
	</div>

	${data?.filesChanged && data.filesChanged.length > 0 ? `
	<div class="section">
		<h3>Files Changed (${data.filesChanged.length})</h3>
		${data.filesChanged.map((file: { uri: string; changeType: string; preview?: string }) => `
			<div class="item">
				<div class="file-${file.changeType}"><strong>${file.changeType.toUpperCase()}:</strong> ${file.uri}</div>
				${file.preview ? `<div><em>${file.preview}</em></div>` : ''}
			</div>
		`).join('')}
	</div>
	` : ''}

	${data?.messages && data.messages.length > 0 ? `
	<div class="section">
		<h3>Messages (${data.messages.length})</h3>
		${data.messages.map((msg: { messageType: string; content: string; timestamp: number }) => `
			<div class="item message-${msg.messageType}">
				<div><strong>${msg.messageType.toUpperCase()}:</strong> ${msg.content}</div>
				<div class="timestamp">${new Date(msg.timestamp).toLocaleString()}</div>
			</div>
		`).join('')}
	</div>
	` : ''}

	${data?.logs && data.logs.length > 0 ? `
	<div class="section">
		<h3>Logs (${data.logs.length})</h3>
		${data.logs.map((log: { level: string; message: string; timestamp: number }) => `
			<div class="item">
				<div class="level-${log.level}"><strong>${log.level.toUpperCase()}:</strong> ${log.message}</div>
				<div class="timestamp">${new Date(log.timestamp).toLocaleString()}</div>
			</div>
		`).join('')}
	</div>
	` : ''}

	${data?.links && data.links.length > 0 ? `
	<div class="section">
		<h3>Links (${data.links.length})</h3>
		${data.links.map((link: { uri: string; label: string; tooltip?: string }) => `
			<div class="item">
				<a href="${link.uri}" title="${link.tooltip || ''}">${link.label}</a>
			</div>
		`).join('')}
	</div>
	` : ''}

	${!data || (!data.filesChanged?.length && !data.messages?.length && !data.logs?.length && !data.links?.length) ?
			'<div class="section"><p><em>No detailed information available for this job.</em></p></div>' : ''
		}
</body>
</html>`;
}
