import type { Prompt } from '@/types/prompt';

/**
 * The `opsLanguageVersion` an Agent assistant is saved with (`types/op.ts` → `opLanguageOptionsMap`
 * labels it "Agent", behind `featureFlags.agentAssistantType`). The editor also forces it whenever a
 * workflow template is selected.
 */
export const AGENT_OPS_LANGUAGE_VERSION = 'v4';

/**
 * Whether an assistant prompt is an agent. The backend runs an assistant through the agent loop
 * exactly when `definition.data.opsLanguageVersion === 'v4'` (amplify-lambda-js
 * `userDefinedAssistants.js`), so that field is the only test — a stored `workflowTemplateId`
 * without it does not take the agent path. No React imports.
 */
export const isAgentAssistant = (prompt: Prompt | null | undefined): boolean =>
    prompt?.data?.assistant?.definition?.data?.opsLanguageVersion === AGENT_OPS_LANGUAGE_VERSION;

/**
 * The Assistant Type options to render, always including the value about to be saved. Without
 * this, an assistant on 'v4' (a "New Agent" preset, or an existing agent edited while
 * `featureFlags.agentAssistantType` is off or still loading) shows the first option, "Standard",
 * while the save still writes 'v4'.
 */
export const withCurrentOpsLanguageOption = (
    options: Record<string, string>,
    current: string,
): Record<string, string> =>
    current === AGENT_OPS_LANGUAGE_VERSION && !(current in options)
        ? { ...options, [AGENT_OPS_LANGUAGE_VERSION]: 'Agent' }
        : options;
