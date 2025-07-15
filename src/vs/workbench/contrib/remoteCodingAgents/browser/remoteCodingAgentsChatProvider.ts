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
				isSticky: true,
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
		const chatSessionId = request.sessionId;
		// const command = request.command;
		try {
			return this.handleGeneralQuery(message, progress, token, chatSessionId);
		} catch (error) {
			progress([{
				kind: 'markdownContent',
				content: new MarkdownString(localize('remoteCodingAgent.error', 'Error: {0}', error instanceof Error ? error.message : String(error)))
			}]);
			return { errorDetails: { message: String(error) } };
		}
	}

	private async handleGeneralQuery(message: string, progress: (progress: IChatProgress[]) => void, token: CancellationToken, chatSessionId: string): Promise<IChatAgentResult> {
		const { displayName, command } = this.remoteCodingAgent;
		progress([{
			kind: 'markdownContent',
			content: new MarkdownString(localize('remoteCodingAgent.welcome', 'I am **{0}**, a coding agent at your service.', displayName))
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

		// Register this session for streaming updates
		// The session service will handle streaming updates even after this method returns
		const sessionDisposable = this.sessionService.registerActiveSession(this.remoteCodingAgent.id, jobId, chatSessionId, progress);

		// Clean up the session when the token is cancelled
		token.onCancellationRequested(() => {
			sessionDisposable.dispose();
		});

		const key = `${this.remoteCodingAgent.id}-${jobId}`;

		// TODO: With the above TODO done, remove this
		return new Promise<IChatAgentResult>((resolve) => {
			// For now, we'll use a timeout. In a real implementation, you'd
			// listen for a job completion event from your remote service.
			const timeoutHandle = setTimeout(() => {
				sessionDisposable.dispose();
				resolve({
					metadata: {
						remoteCodingAgentSessionId: key,
						completed: true
					}
				});
			}, 5 * 60 * 1000); // 5 minutes

			// Handle cancellation
			token.onCancellationRequested(() => {
				clearTimeout(timeoutHandle);
				sessionDisposable.dispose();
				resolve({
					metadata: {
						remoteCodingAgentSessionId: key,
						cancelled: true
					}
				});
			});
		});


	}
}
