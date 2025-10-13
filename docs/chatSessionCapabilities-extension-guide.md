# Contributed Chat Session Capabilities – Extension Implementation Guide

> Status: Proposed API (`chatSessionsProvider`). Run VS Code with `--enable-proposed-api <your.extension.id>` and add the proposal to `enabledApiProposals`.

## 1. Contribute a Chat Session Type
```jsonc
{
  "enabledApiProposals": ["chatSessionsProvider"],
  "contributes": {
    "chatSessions": [
      {
        "type": "myCompany.session",
        "name": "mysession",
        "displayName": "My Session",
        "description": "Chat with MySession AI",
        "when": "true"
      }
    ]
  }
}
```
`name` becomes the `@agent` handle. `displayName` is shown in menus.

## 2. Register Item & Content Providers
```ts
import * as vscode from 'vscode';

export function activate(ctx: vscode.ExtensionContext) {
  // Optional: session list provider
  const itemProvider = vscode.chat.registerChatSessionItemProvider('myCompany.session', {
    onDidChangeChatSessionItems: new vscode.EventEmitter<void>().event,
    provideChatSessionItems: async token => [{
      id: 'welcome',
      label: 'Welcome Session',
      description: 'Getting started',
      status: vscode.ChatSessionStatus.Completed
    }]
  });
  ctx.subscriptions.push(itemProvider);

  // Content provider + capabilities
  const contentProvider = vscode.chat.registerChatSessionContentProvider(
    'myCompany.session',
    {
      async provideChatSessionContent(sessionId, token) {
        return {
          history: [],
          requestHandler: async (request, progress, history, ct) => {
            progress([{ kind: 'progressMessage', content: { value: 'Working...', isTrusted: false } }]);
            await new Promise(r => setTimeout(r, 300));
            progress([{ kind: 'progressMessage', content: { value: `Reply to: ${request.message}`, isTrusted: false } }]);
          }
        };
      }
    },
    {   // Minimal participant metadata (re‑use a real participant in production)
      id: 'myCompany.session.agent',
      name: 'mysession',
      fullName: 'My Session'
    } as any,
    {
      supportsInterruptions: true,
      modes: [
        { id: 'concise', label: 'Concise', description: 'Short answers' },
        { id: 'detailed', label: 'Detailed', description: 'Thorough answers' }
      ],
      defaultModeId: 'concise',
      models: [
        { id: 'myVendor/small', label: 'Small', description: 'Fast, lightweight' },
        { id: 'myVendor/large', label: 'Large', description: 'Higher quality' }
      ],
      defaultModelId: 'myVendor/small'
    }
  );
  ctx.subscriptions.push(contentProvider);
}
```

## 3. Capability Semantics
| Field | Purpose | UI Behavior |
|-------|---------|-------------|
| `modes[]` | Logical chat modes (not slash commands) | Shows mode picker if non-empty |
| `defaultModeId` | Initial mode (must exist in `modes`) | Falls back to first if invalid |
| `models[]` | Session-specific model choices | Shows model picker if non-empty |
| `defaultModelId` | Initial model (must exist in `models`) | Falls back to first if invalid |
| `supportsInterruptions` | Safe hot interruption | Skips confirm dialog on interrupt |

Empty or omitted arrays hide their respective picker. If both empty, widget may remain locked to the agent.

## 4. Request Handling (Streaming)
Inside `requestHandler(request, progress, history, token)`:
- Call `progress([...chunks])` with `IChatProgress` objects to stream UI updates.
- Respect `token.isCancellationRequested` to abort early.
- Returning resolves the turn; thrown errors are surfaced with an error progress message (UI adds formatting).

## 5. Callbacks for Mode/Model Changes (✅ Implemented)

When users change mode or model selections through the UI pickers, VS Code calls callback methods on your content provider. This allows you to track selections on a per-session basis and adjust your backend behavior accordingly.

**Setting Up Callback Methods:**

```ts
// Track session state
const sessionState = new Map<string, { mode: string; model: string }>();

const contentProvider = vscode.chat.registerChatSessionContentProvider(
  'myCompany.session',
  {
    async provideChatSessionContent(sessionId, token) {
      // Initialize defaults for this session
      sessionState.set(sessionId, {
        mode: 'concise',
        model: 'myVendor/small'
      });
      
      return {
        history: [],
        requestHandler: async (request, progress, history, ct) => {
          const state = sessionState.get(request.sessionId)!;
          progress([{
            kind: 'progressMessage',
            content: { value: `Using mode=${state.mode}, model=${state.model}`, isTrusted: false }
          }]);
          // Call backend with current mode/model
        }
      };
    },
    
    // Optional: Called when user changes mode selection
    provideHandleModeSelectionChange(sessionId, modeId, token) {
      const state = sessionState.get(sessionId);
      if (state) {
        state.mode = modeId;
        console.log(`Session ${sessionId} switched to mode: ${modeId}`);
      }
    },
    
    // Optional: Called when user changes model selection
    provideHandleModelSelectionChange(sessionId, modelId, token) {
      const state = sessionState.get(sessionId);
      if (state) {
        state.model = modelId;
        console.log(`Session ${sessionId} switched to model: ${modelId}`);
        // Optionally: Re-initialize backend connection with new model
      }
    }
  },
  { id: 'myCompany.session.agent', name: 'mysession', fullName: 'My Session' } as any,
  {
    modes: [
      { id: 'concise', label: 'Concise', description: 'Short answers' },
      { id: 'detailed', label: 'Detailed', description: 'Thorough answers' }
    ],
    defaultModeId: 'concise',
    models: [
      { id: 'myVendor/small', label: 'Small', description: 'Fast' },
      { id: 'myVendor/large', label: 'Large', description: 'Higher quality' }
    ],
    defaultModelId: 'myVendor/small'
  }
);
```

**Callback Guarantees:**
- Callbacks fire only for modes/models you contributed (not global language models)
- Callbacks fire per-session (each session ID is independent)
- Callbacks fire immediately after user selection (before next request)
- Use these to adjust backend prompts, model endpoints, or session state

## 6. Model Switching
User changes model via built‑in picker. On next request, read your stored state (you may persist between turns). If your backend requires session re-initialization for a new model, complete the previous turn first, then start a new one.

## 7. Interruptions
- With `supportsInterruptions: true`, user interrupt triggers immediate cancellation (no confirmation). Stop streaming promptly.
- Without it, a confirmation dialog appears. Only call expensive cleanup after confirmation.

## 8. Session Items (Optional)
Implement `provideChatSessionItems` to surface remote or persisted sessions. Implement `provideNewChatSessionItem` if the user can create new server-side sessions (returns metadata only; content is later resolved through the content provider).

## 9. Defaults & Persistence
VS Code persists selected mode/model per view state. Your defaults apply only at first load or when the persisted value is invalid. Keep default IDs stable to avoid user confusion.

## 10. Error / Edge Cases
| Scenario | Recommendation |
|----------|---------------|
| Invalid `defaultModeId`/`defaultModelId` | VS Code silently falls back; log a warning |
| Only models provided | Model picker appears; widget unlocks |
| Only modes provided | Mode picker appears; widget unlocks |
| Neither provided | Widget may remain locked to the agent |
| No progress chunks streamed | Return normally—session still completes |
| Rapid interrupt | Ensure frequent cancellation checks |

## 11. Migration Tips
| Legacy Pattern | New Approach |
|----------------|-------------|
| Slash commands for stable personas | Move common variants to `modes` |
| Custom quick pick for models | Remove; rely on built-in model picker |
| Manual confirm on interrupt | Set `supportsInterruptions: true` if safe |

## 12. Telemetry (Future-Friendly Planning)
Prepare structured events (if/when allowed):
- `modeChanged` (prev, next, isDefault)
- `modelChanged` (prev, next, defaultFlag)
Avoid raw prompt or PII. Hash IDs if policy requires.

## 13. Testing Checklist
- Mode picker visibility toggles with `modes` presence.
- Model picker visibility toggles with `models` presence.
- Defaults applied once; persisted selection restored after reload.
- Interrupt behavior differs by `supportsInterruptions`.
- Switching mode/model updates backend behavior next turn.

## 14. Full Minimal Skeleton (with Callbacks)
```ts
const sessions = new Map<string, { mode: string; model: string }>();

vscode.chat.registerChatSessionContentProvider(
  'myCompany.session',
  {
    async provideChatSessionContent(id) {
      sessions.set(id, { mode: 'concise', model: 'myVendor/small' });
      return {
        history: [],
        requestHandler: async (req, progress, history, token) => {
          const state = sessions.get(req.sessionId)!;
          progress([{
            kind: 'progressMessage',
            content: { value: `Mode=${state.mode} Model=${state.model}`, isTrusted: false }
          }]);
          // ... call backend here
        }
      };
    },
    
    // VS Code calls these when user changes selections
    provideHandleModeSelectionChange(sessionId, modeId, token) {
      const state = sessions.get(sessionId);
      if (state) state.mode = modeId;
    },
    
    provideHandleModelSelectionChange(sessionId, modelId, token) {
      const state = sessions.get(sessionId);
      if (state) state.model = modelId;
    }
  },
  { id: 'myCompany.session.agent', name: 'mysession', fullName: 'My Session' } as any,
  {
    modes: [{ id: 'concise', label: 'Concise' }, { id: 'detailed', label: 'Detailed' }],
    defaultModeId: 'concise',
    models: [{ id: 'myVendor/small', label: 'Small' }, { id: 'myVendor/large', label: 'Large' }],
    defaultModelId: 'myVendor/small',
    supportsInterruptions: true
  }
);
```

## 15. Troubleshooting
| Symptom | Fix |
|---------|-----|
| No pickers | Ensure at least one non-empty `modes` or `models` array. |
| Wrong default applied | Check spelling; must match an entry `id`. |
| Interrupt prompts user | Set `supportsInterruptions: true`. |
| Mode/model lost after reload | Ensure session/editor not discarded prematurely. |

## 16. Future Enhancements (Potential)
- ✅ **Implemented:** Selection change events (`onDidChangeModeSelection`, `onDidChangeModelSelection`)
- Capability for per-session curated model lists separate from global LMs.
- Telemetry hooks & experiment flags.
- Allow dynamic capability update (e.g., add mode mid-session).

---
**Feedback:** Provide issues or PR comments on the proposal thread to influence stabilization.
