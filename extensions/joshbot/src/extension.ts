/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface IRemoteCodingAgentJob {
	id: string;
	name: string;
	status: 'inprogress' | 'readyforreview' | 'completed';
	agentId: string;
	prompt: string;
}

class JoshBotAgent {
	private jobs: Map<string, IRemoteCodingAgentJob> = new Map();
	private jobCounter = 0;

	constructor() {
	}

	async createJob(prompt: string): Promise<IRemoteCodingAgentJob> {
		const jobId = `joshbot-job-${++this.jobCounter}`;
		const job: IRemoteCodingAgentJob = {
			id: jobId,
			name: `JoshBot Task ${this.jobCounter}`,
			status: 'inprogress',
			agentId: 'joshbot',
			prompt,
		};

		this.jobs.set(jobId, job);

		setTimeout(() => {
			job.status = 'readyforreview';
		}, 5000 + Math.random() * 5000); // Simulate AI processing work (5-10 seconds)

		return job;
	}

	async getJobStatus(jobId: string): Promise<IRemoteCodingAgentJob | undefined> {
		return this.jobs.get(jobId);
	}

	async getAllJobs(): Promise<IRemoteCodingAgentJob[]> {
		return Array.from(this.jobs.values());
	}

	async operateJob(jobId: string, operation: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			throw new Error(`Job ${jobId} not found`);
		}
		switch (operation) {
			case 'approve':
				if (job.status === 'readyforreview') {
					job.status = 'completed';
				}
				break;
			case 'reject':
				if (job.status === 'readyforreview') {
					job.status = 'inprogress';
					job.prompt = '(trying again) ' + job.prompt;
				}
				break;
			case 'cancel':
				this.jobs.delete(jobId);
				break;
			default:
				vscode.window.showErrorMessage(`Unknown operation: ${operation}`);
		}
	}
}

let joshBotAgent: JoshBotAgent;

export function activate(context: vscode.ExtensionContext) {
	console.log('JoshBot extension is now active!');

	joshBotAgent = new JoshBotAgent();

	// Register command to create a new job
	const createJobCommand = vscode.commands.registerCommand('joshbot.createJob', async (args?: { prompt: string }): Promise<IRemoteCodingAgentJob | undefined> => {
		let prompt: string | undefined;

		if (args && args.prompt) {
			// Use the provided prompt from the caller
			prompt = args.prompt;
		} else {
			// Fall back to input box if no arguments provided
			prompt = await vscode.window.showInputBox({
				prompt: 'Expected a \'prompt\' in args.  Please enter a prompt for the JoshBot to solve',
			});
		}

		if (prompt) {
			try {
				const job = await joshBotAgent.createJob(prompt);
				return job; // Return the job for the caller
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to create job: ${error}`);
			}
		}
		return;
	});

	// Register command to get job status
	const getJobStatusCommand = vscode.commands.registerCommand('joshbot.getJobs', async () => {
		return await joshBotAgent.getAllJobs();
	});

	// Register command to handle job clicks from the kanban view
	const operateJobCommand = vscode.commands.registerCommand('joshbot.operateJob', async (args: any) => {
		const { jobId, agentId, job } = args;

		if (agentId !== 'joshbot') {
			return; // Not our job
		}

		// Show job details and available actions
		const actions = [];

		switch (job.status) {
			case 'inprogress':
				actions.push('Cancel Job');
				break;
			case 'readyforreview':
				actions.push('Approve', 'Reject');
				break;
		}

		const selectedAction = await vscode.window.showQuickPick(actions, {
			placeHolder: `What would you like to do with ${job.name}?`
		});

		if (selectedAction) {
			switch (selectedAction) {
				case 'Cancel Job':
					await joshBotAgent.operateJob(jobId, 'cancel');
					break;
				case 'Approve':
					await joshBotAgent.operateJob(jobId, 'approve');
					break;
				case 'Reject':
					await joshBotAgent.operateJob(jobId, 'reject');
					break;
			}
		}
	});

	// Add commands to subscriptions
	context.subscriptions.push(createJobCommand);
	context.subscriptions.push(getJobStatusCommand);
	context.subscriptions.push(operateJobCommand);

	// // Create some sample jobs for demonstration
	// setTimeout(async () => {
	// 	await joshBotAgent.createJob('Create a TypeScript interface for user data');
	// 	await joshBotAgent.createJob('Generate unit tests for the auth module');
	// 	await joshBotAgent.createJob('Optimize database queries for better performance');

	// 	// Randomly between 1-60 seconds, move to readyforreview (50% of jobs)
	// 	const jobs = await joshBotAgent.getAllJobs();
	// 	for (const job of jobs) {
	// 		if (job.status === 'inprogress') {
	// 			setTimeout(async () => {
	// 				if (Math.random() < 0.5) { // 50% chance to mark as ready for review
	// 					job.status = 'readyforreview';
	// 				}
	// 			}, Math.random() * 60000); // Random delay up to 60 seconds
	// 		}
	// 	}
	// }, 5000); // Start creating jobs after 5 seconds
}

export function deactivate() {
	console.log('JoshBot extension is now deactivated. Good night and sweet dreams.');
}
