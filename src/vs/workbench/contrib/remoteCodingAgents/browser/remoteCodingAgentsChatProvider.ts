/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IChatAgentImplementation, IChatAgentRequest, IChatAgentResult, IChatAgentService, IChatAgentData } from '../../chat/common/chatAgents.js';
import { ChatAgentLocation, ChatModeKind } from '../../chat/common/constants.js';
import { IChatProgress } from '../../chat/common/chatService.js';
import { IRemoteCodingAgentsService, IRemoteCodingAgent } from '../common/remoteCodingAgentsService.js';
import { IRemoteCodingAgentsSessionService } from '../common/remoteCodingAgentsSessionService.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';


interface RemoteCodingAgentCommandResult {
	title: string;
	jobId: string;
	description: string;
}

/**
 * Chat provider that creates dynamic chat agents for each registered remote coding agent
 */
export class RemoteCodingAgentsChatProvider extends Disposable {

	private readonly registeredAgents = new Map<string, IDisposable>();

	constructor(
		@IRemoteCodingAgentsService private readonly remoteCodingAgentsService: IRemoteCodingAgentsService,
		@IChatAgentService private readonly chatAgentService: IChatAgentService,
		@ICommandService private readonly commandService: ICommandService,
		@IRemoteCodingAgentsSessionService private readonly sessionService: IRemoteCodingAgentsSessionService
	) {
		super();
		console.log('RemoteCodingAgentsChatProvider: Initializing...');
		this.setupAgentRegistration();
		console.log('RemoteCodingAgentsChatProvider: Initialization complete');
	}

	private setupAgentRegistration(): void {
		// Register existing agents
		const existingAgents = this.remoteCodingAgentsService.getRegisteredAgents();
		for (const agent of existingAgents) {
			this.registerDynamicChatAgent(agent);
		}

		// Listen for new agents being registered
		this._register(this.remoteCodingAgentsService.onDidRegisterAgent(agent => {
			this.registerDynamicChatAgent(agent);
		}));
	}

	private registerDynamicChatAgent(remoteCodingAgent: IRemoteCodingAgent): void {
		const agentId = remoteCodingAgent.id;

		// Don't register twice
		if (this.registeredAgents.has(agentId)) {
			console.log(`RemoteCodingAgentsChatProvider: Agent ${agentId} already registered`);
			return;
		}

		console.log(`RemoteCodingAgentsChatProvider: Registering dynamic chat agent: ${agentId}`);

		const agentData: IChatAgentData = {
			id: agentId,
			name: agentId,
			fullName: remoteCodingAgent.displayName,
			description: remoteCodingAgent.description || localize('remoteCodingAgent.defaultDescription', 'Remote coding agent: {0}', remoteCodingAgent.displayName),
			isDefault: false,
			isCore: false,
			isDynamic: true,
			isCodingAgent: true, // TODO: Once this kind of agent is invoked, it 'morphs' the chat into its own 'coding agent'
			slashCommands: [],
			locations: [ChatAgentLocation.Panel],
			modes: [ChatModeKind.Agent, ChatModeKind.Ask],
			disambiguation: [],

			metadata: {
				themeIcon: Codicon.robot,
			},
			extensionId: nullExtensionDescription.identifier,
			extensionDisplayName: nullExtensionDescription.name,
			extensionPublisherId: nullExtensionDescription.publisher
		};

		const agentImpl = new RemoteCodingAgentChatImplementation(remoteCodingAgent, this.commandService, this.sessionService);
		const disposable = this.chatAgentService.registerDynamicAgent(agentData, agentImpl);

		this.registeredAgents.set(agentId, disposable);
		this._register(disposable);

		console.log(`RemoteCodingAgentsChatProvider: Successfully registered dynamic chat agent: ${agentId}`);
	}

	override dispose(): void {
		super.dispose();
		this.registeredAgents.clear();
	}
}

/**
 * Implementation for individual remote coding agent chat functionality
 */
class RemoteCodingAgentChatImplementation extends Disposable implements IChatAgentImplementation {

	constructor(
		private readonly remoteCodingAgent: IRemoteCodingAgent,
		@ICommandService private readonly commandService: ICommandService,
		@IRemoteCodingAgentsSessionService private readonly sessionService: IRemoteCodingAgentsSessionService
	) {
		super();
	}

	async invoke(request: IChatAgentRequest, progress: (progress: IChatProgress[]) => void, history: any[], token: CancellationToken): Promise<IChatAgentResult> {
		const message = request.message.trim();
		// const command = request.command;

		try {
			return this.handleGeneralQuery(message, progress, token);
		} catch (error) {
			progress([{
				kind: 'markdownContent',
				content: new MarkdownString(localize('remoteCodingAgent.error', 'Error: {0}', error instanceof Error ? error.message : String(error)))
			}]);
			return { errorDetails: { message: String(error) } };
		}
	}

	private async handleGeneralQuery(message: string, progress: (progress: IChatProgress[]) => void, token: CancellationToken): Promise<IChatAgentResult> {
		const { displayName, command } = this.remoteCodingAgent;
		progress([{
			kind: 'markdownContent',
			content: new MarkdownString(localize('remoteCodingAgent.welcome', 'I am **{0}**, a remote coding agent at your service.', displayName))
		}]);

		// TODO: Queue job on remote
		const result: RemoteCodingAgentCommandResult | undefined = await this.commandService.executeCommand(
			command,
			message,
		);

		if (!result) {
			return { errorDetails: { message: localize('remoteCodingAgent.noResultError', 'No result returned from command `{0}`.', command) } };
		}

		const { title, description, jobId } = result;

		progress([{
			kind: 'codingAgentSessionBegun',
			agentDisplayName: displayName,
			agentId: this.remoteCodingAgent.id,
			jobId,
			title,
			description,
			//command: this.remoteCodingAgent.command
		}]);

		// Register this session for streaming and keep the response open
		this.sessionService.registerActiveSession(this.remoteCodingAgent.id, jobId, progress);

		// Return a promise that doesn't resolve immediately - this keeps the chat response open
		return new Promise<IChatAgentResult>((resolve) => {
			// Set up a timeout to eventually complete the response
			const timeout = setTimeout(() => {
				this.sessionService.unregisterActiveSession(this.remoteCodingAgent.id, jobId);
				resolve({});
			}, 60000); // 60 second timeout

			// Handle cancellation
			if (token.isCancellationRequested) {
				clearTimeout(timeout);
				this.sessionService.unregisterActiveSession(this.remoteCodingAgent.id, jobId);
				resolve({});
				return;
			}

			token.onCancellationRequested(() => {
				clearTimeout(timeout);
				this.sessionService.unregisterActiveSession(this.remoteCodingAgent.id, jobId);
				resolve({});
			});
		});
	}
}
