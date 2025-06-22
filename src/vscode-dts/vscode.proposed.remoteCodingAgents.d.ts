/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	/**
	 * Represents a remote coding agent job.
	 */
	export interface RemoteCodingAgentJob {
		/**
		 * Unique identifier for the job.
		 */
		readonly id: string;

		/**
		 * Human-readable name for the job.
		 */
		readonly name: string;

		/**
		 * Current status of the job.
		 */
		status: string;

		/**
		 * The agent that created this job.
		 */
		readonly agentId: string;

		/**
		 * The original prompt or request that created this job.
		 */
		prompt: string;
	}

	/**
	 * Describes what kind of change occurred to remote coding agent jobs.
	 */
	export enum RemoteCodingJobChangeKind {
		Added = 1,
		Changed = 2,
		Removed = 3
	}

	/**
	 * An event describing a change in remote coding agent jobs.
	 */
	export interface RemoteCodingJobsChangeEvent {
		/**
		 * The jobs that were added.
		 */
		readonly added: readonly RemoteCodingAgentJob[];

		/**
		 * The jobs that were changed.
		 */
		readonly changed: readonly RemoteCodingAgentJob[];

		/**
		 * The jobs that were removed.
		 */
		readonly removed: readonly RemoteCodingAgentJob[];
	}

	/**
	 * A remote coding agent provider manages remote coding jobs for a specific service or platform.
	 */
	export interface RemoteCodingAgentProvider {
		/**
		 * Unique identifier for this provider.
		 */
		readonly id: string;

		/**
		 * Human-readable display name for this provider.
		 */
		readonly displayName: string;

		/**
		 * Optional description of what this provider does.
		 */
		readonly description?: string;

		/**
		 * An event to signal that jobs have changed.
		 */
		readonly onDidChangeJobs: Event<RemoteCodingJobsChangeEvent>;

		/**
		 * Create a new remote coding job.
		 * @param prompt The prompt or request for the job.
		 * @param token A cancellation token.
		 * @returns The created job or undefined if creation failed.
		 */
		provideJobCreation(prompt: string, token: CancellationToken): Thenable<RemoteCodingAgentJob | undefined>;

		/**
		 * Get all jobs managed by this provider.
		 * @param token A cancellation token.
		 * @returns All current jobs.
		 */
		provideJobs(token: CancellationToken): Thenable<RemoteCodingAgentJob[]>;

		/**
		 * Perform an operation on a job.
		 * @param jobId The ID of the job to operate on.
		 * @param operation The operation to perform (e.g., 'approve', 'reject', 'cancel').
		 * @param token A cancellation token.
		 */
		provideJobOperation(jobId: string, operation: string, token: CancellationToken): Thenable<void>;
	}

	export namespace remoteCodingAgents {
		/**
		 * Register a remote coding agent provider.
		 * @param provider The provider to register.
		 * @returns A disposable that can be used to unregister the provider.
		 */
		export function registerRemoteCodingAgentProvider(provider: RemoteCodingAgentProvider): Disposable;

		/**
		 * An event that is fired when remote coding agent jobs change across all providers.
		 */
		export const onDidChangeJobs: Event<RemoteCodingJobsChangeEvent>;
	}
}
