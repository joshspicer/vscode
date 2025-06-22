/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

interface JoshBotJob {
	id: string;
	name: string;
	status: 'created' | 'in-progress' | 'ready-for-review' | 'completed' | 'failed';
	agentId: string;
	prompt: string;
	createdAt: Date;
	updatedAt: Date;
	result?: string;
	error?: string;
}

class JoshBotAgent {
	private jobs: Map<string, JoshBotJob> = new Map();
	private jobCounter = 0;

	constructor(private context: vscode.ExtensionContext) { }

	async createJob(prompt: string): Promise<JoshBotJob> {
		const jobId = `joshbot-job-${++this.jobCounter}`;
		const job: JoshBotJob = {
			id: jobId,
			name: `JoshBot Task ${this.jobCounter}`,
			status: 'created',
			agentId: 'joshbot',
			prompt: prompt,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		this.jobs.set(jobId, job);

		// Show a notification that the job was created
		vscode.window.showInformationMessage(`JoshBot job created: ${job.name}`);

		// Simulate async work - automatically start the job after a short delay
		setTimeout(() => {
			this.startJob(jobId);
		}, 1000);

		return job;
	}

	async getJobStatus(jobId: string): Promise<JoshBotJob | undefined> {
		return this.jobs.get(jobId);
	}

	async getAllJobs(): Promise<JoshBotJob[]> {
		return Array.from(this.jobs.values());
	}

	async operateJob(jobId: string, operation: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			throw new Error(`Job ${jobId} not found`);
		}

		vscode.window.showInformationMessage(`JoshBot: Performing operation '${operation}' on job ${job.name}`);

		switch (operation) {
			case 'start':
				await this.startJob(jobId);
				break;
			case 'ready-for-review':
				await this.markReadyForReview(jobId);
				break;
			case 'approve':
				await this.approveJob(jobId);
				break;
			case 'reject':
				await this.rejectJob(jobId);
				break;
			case 'cancel':
				await this.cancelJob(jobId);
				break;
			default:
				throw new Error(`Unknown operation: ${operation}`);
		}
	}

	private async startJob(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			return;
		}

		job.status = 'in-progress';
		job.updatedAt = new Date();

		vscode.window.showInformationMessage(`JoshBot: Started working on ${job.name}`);

		// Simulate AI processing work
		setTimeout(async () => {
			await this.completeJob(jobId);
		}, 3000 + Math.random() * 5000); // 3-8 seconds
	}

	private async completeJob(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job || job.status !== 'in-progress') {
			return;
		}

		// Simulate AI generating code/content
		const results = [
			'Generated a React component with TypeScript',
			'Created a Python script for data processing',
			'Implemented a REST API endpoint',
			'Added unit tests for the existing functionality',
			'Refactored code to improve performance',
			'Fixed security vulnerabilities in dependencies'
		];

		job.status = 'ready-for-review';
		job.updatedAt = new Date();
		job.result = results[Math.floor(Math.random() * results.length)];

		vscode.window.showInformationMessage(`JoshBot: Completed ${job.name} - ${job.result}`);
	}

	private async markReadyForReview(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			return;
		}

		job.status = 'ready-for-review';
		job.updatedAt = new Date();
		vscode.window.showInformationMessage(`JoshBot: ${job.name} is ready for review`);
	}

	private async approveJob(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			return;
		}

		job.status = 'completed';
		job.updatedAt = new Date();
		vscode.window.showInformationMessage(`JoshBot: Approved ${job.name} - Task completed!`);
	}

	private async rejectJob(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			return;
		}

		job.status = 'created';
		job.updatedAt = new Date();
		vscode.window.showWarningMessage(`JoshBot: Rejected ${job.name} - Needs more work`);
	}

	private async cancelJob(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			return;
		}

		job.status = 'failed';
		job.updatedAt = new Date();
		job.error = 'Job cancelled by user';
		vscode.window.showWarningMessage(`JoshBot: Cancelled ${job.name}`);
	}
}

let joshBotAgent: JoshBotAgent;

export function activate(context: vscode.ExtensionContext) {
	console.log('JoshBot extension is now active!');

	joshBotAgent = new JoshBotAgent(context);

	// Register command to create a new job
	const createJobCommand = vscode.commands.registerCommand('joshbot.createJob', async (args?: { prompt: string }) => {
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
				vscode.window.showInformationMessage(`[MOCK] Created job: ${job.name}`);
				return job; // Return the job for the caller
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to create job: ${error}`);
			}
		}
	});

	// Register command to get job status
	const getJobStatusCommand = vscode.commands.registerCommand('joshbot.getJobStatus', async (jobId?: string) => {
		if (jobId) {
			// Get specific job status
			const job = await joshBotAgent.getJobStatus(jobId);
			if (job) {
				return job;
			} else {
				throw new Error(`Job ${jobId} not found`);
			}
		} else {
			// Return all jobs for the remote coding agents service
			const jobs = await joshBotAgent.getAllJobs();
			return jobs;
		}
	});

	// Register command to show all jobs in UI
	const showAllJobsCommand = vscode.commands.registerCommand('joshbot.showAllJobs', async () => {
		const jobs = await joshBotAgent.getAllJobs();
		if (jobs.length === 0) {
			vscode.window.showInformationMessage('No JoshBot jobs found');
			return;
		}

		const jobItems = jobs.map(job => ({
			label: job.name,
			description: job.status,
			detail: job.prompt,
			job: job
		}));

		const selected = await vscode.window.showQuickPick(jobItems, {
			placeHolder: 'Select a job to view details'
		});

		if (selected) {
			const job = selected.job;
			const statusMessage = `Job: ${job.name}\nStatus: ${job.status}\nPrompt: ${job.prompt}\nCreated: ${job.createdAt.toLocaleString()}`;
			if (job.result) {
				vscode.window.showInformationMessage(`${statusMessage}\nResult: ${job.result}`);
			} else {
				vscode.window.showInformationMessage(statusMessage);
			}
		}
	});

	// Register command to operate on a job
	const operateJobCommand = vscode.commands.registerCommand('joshbot.operateJob', async (jobId: string, operation: string) => {
		try {
			await joshBotAgent.operateJob(jobId, operation);
		} catch (error) {
			vscode.window.showErrorMessage(`Operation failed: ${error}`);
			throw error;
		}
	});

	// Register command to handle job clicks from the kanban view
	const jobClickedCommand = vscode.commands.registerCommand('remoteCodingAgents.jobClicked', async (args: any) => {
		const { jobId, agentId, job } = args;

		if (agentId !== 'joshbot') {
			return; // Not our job
		}

		// Show job details and available actions
		const actions = [];

		switch (job.status) {
			case 'created':
				actions.push('Start Job', 'Cancel Job');
				break;
			case 'in-progress':
				actions.push('Cancel Job');
				break;
			case 'ready-for-review':
				actions.push('Approve', 'Reject', 'View Details');
				break;
			case 'completed':
			case 'failed':
				actions.push('View Details');
				break;
		}

		const selectedAction = await vscode.window.showQuickPick(actions, {
			placeHolder: `What would you like to do with ${job.name}?`
		});

		if (selectedAction) {
			switch (selectedAction) {
				case 'Start Job':
					await joshBotAgent.operateJob(jobId, 'start');
					break;
				case 'Cancel Job':
					await joshBotAgent.operateJob(jobId, 'cancel');
					break;
				case 'Approve':
					await joshBotAgent.operateJob(jobId, 'approve');
					break;
				case 'Reject':
					await joshBotAgent.operateJob(jobId, 'reject');
					break;
				case 'View Details': {
					const detailsMessage = `Job: ${job.name}\nStatus: ${job.status}\nAgent: ${job.agentId}\nPrompt: ${job.prompt}\nCreated: ${new Date(job.createdAt).toLocaleString()}\nLast Updated: ${new Date(job.updatedAt).toLocaleString()}`;
					if (job.result) {
						vscode.window.showInformationMessage(`${detailsMessage}\nResult: ${job.result}`);
					} else if (job.error) {
						vscode.window.showErrorMessage(`${detailsMessage}\nError: ${job.error}`);
					} else {
						vscode.window.showInformationMessage(detailsMessage);
					}
					break;
				}
			}
		}
	});

	// Add commands to subscriptions
	context.subscriptions.push(createJobCommand);
	context.subscriptions.push(showAllJobsCommand);
	context.subscriptions.push(getJobStatusCommand);
	context.subscriptions.push(operateJobCommand);
	context.subscriptions.push(jobClickedCommand);

	// Create some sample jobs for demonstration
	setTimeout(async () => {
		await joshBotAgent.createJob('Create a TypeScript interface for user data');
		await joshBotAgent.createJob('Generate unit tests for the auth module');
		await joshBotAgent.createJob('Optimize database queries for better performance');

		// Randomly between 1-60 seconds, move to in-proress and then ready-for-review (if already in-progress)
		const jobs = await joshBotAgent.getAllJobs();
		for (const job of jobs) {
			if (job.status === 'created') {
				setTimeout(async () => {
					await joshBotAgent.operateJob(job.id, 'start');
					if (Math.random() < 0.5) { // 50% chance to mark as ready for review
						await joshBotAgent.operateJob(job.id, 'ready-for-review');
					}
				}, Math.random() * 60000); // Random delay up to 60 seconds
			}
		}
	}, 5000); // Start creating jobs after 5 seconds
}

export function deactivate() {
	console.log('JoshBot extension is now deactivated. Good night and sweet dreams.');
}
