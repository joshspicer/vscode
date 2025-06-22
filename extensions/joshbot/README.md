# JoshBot Remote Coding Agent

This is a sample VS Code extension that demonstrates how to implement a remote coding agent that integrates with the VS Code Remote Coding Agents feature.

## Features

- **Job Creation**: Create new coding tasks for JoshBot to work on
- **Job Management**: View, start, approve, reject, and cancel jobs
- **Kanban Integration**: Jobs appear in the Remote Coding Agents kanban view
- **Interactive Cards**: Click on job cards to perform actions
- **Status Tracking**: Track jobs through their lifecycle (created → in-progress → ready-for-review → completed)

## Commands

- `JoshBot: Create JoshBot Job` - Create a new coding task
- `JoshBot: Show All JoshBot Jobs` - View all jobs in a quick pick
- `JoshBot: Get JoshBot Job Status` - Get status of a specific job
- `JoshBot: Operate JoshBot Job` - Perform operations on jobs

## How it Works

1. **Agent Registration**: The extension registers itself as a remote coding agent
2. **Job Creation**: When you create a job, JoshBot simulates AI processing
3. **Status Updates**: Jobs automatically progress through different states
4. **Kanban View**: All jobs appear in the Remote Coding Agents view
5. **Interactions**: Click on job cards to see available actions

## Job Lifecycle

1. **Created** - Job is created and waiting to start
2. **In Progress** - JoshBot is working on the task (simulated)
3. **Ready for Review** - Work is complete and needs review
4. **Completed** - Job approved and finished
5. **Failed** - Job cancelled or rejected

## Sample Jobs

The extension automatically creates sample jobs when activated to demonstrate the functionality.

## Extension Development

This extension demonstrates:

- How to implement the `remoteCodingAgents` contribution point
- Command registration and handling
- Integration with VS Code's command system
- UI interactions with quick picks and notifications
- Lifecycle management of coding tasks

## Commands Implemented

- `joshbot.createJob` - Creates new jobs
- `joshbot.getJobStatus` - Returns job status (used by kanban view)
- `joshbot.operateJob` - Handles job operations
- `remoteCodingAgents.jobClicked` - Handles job card clicks
