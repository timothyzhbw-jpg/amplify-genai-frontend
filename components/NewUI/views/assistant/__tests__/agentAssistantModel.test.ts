import { describe, expect, it } from 'vitest';
import type { Prompt } from '@/types/prompt';
import { AGENT_OPS_LANGUAGE_VERSION, isAgentAssistant, withCurrentOpsLanguageOption } from '../agentAssistantModel';

describe('withCurrentOpsLanguageOption', () => {
    const base = { v1: 'Standard', custom: 'Custom' };

    it('adds Agent when the value being saved is v4 but the options lack it', () => {
        expect(withCurrentOpsLanguageOption(base, 'v4')).toEqual({ v1: 'Standard', custom: 'Custom', v4: 'Agent' });
    });

    it('leaves the options alone otherwise', () => {
        const withAgent = { ...base, v4: 'Agent' };
        expect(withCurrentOpsLanguageOption(withAgent, 'v4')).toBe(withAgent);
        expect(withCurrentOpsLanguageOption(base, 'v1')).toBe(base);
        expect(withCurrentOpsLanguageOption(base, 'custom')).toBe(base);
    });
});

const assistantPrompt = (definitionData: Record<string, unknown> | undefined): Prompt => ({
    id: 'p1',
    name: 'Example',
    description: '',
    content: '',
    folderId: null,
    type: 'root_prompt',
    data: { assistant: { definition: { assistantId: 'astp/1', data: definitionData } } },
});

describe('isAgentAssistant', () => {
    it('is true for an assistant saved with the Agent ops language', () => {
        expect(isAgentAssistant(assistantPrompt({ opsLanguageVersion: AGENT_OPS_LANGUAGE_VERSION }))).toBe(true);
    });

    it('is false for Standard and Custom assistants', () => {
        expect(isAgentAssistant(assistantPrompt({ opsLanguageVersion: 'v1' }))).toBe(false);
        expect(isAgentAssistant(assistantPrompt({ opsLanguageVersion: 'custom' }))).toBe(false);
    });

    it('does not treat a workflow template without v4 as an agent (the backend would not either)', () => {
        expect(isAgentAssistant(assistantPrompt({ workflowTemplateId: 'wf-1', baseWorkflowTemplateId: 'wf-0' }))).toBe(false);
    });

    it('is false when the prompt has no assistant definition data', () => {
        expect(isAgentAssistant(assistantPrompt(undefined))).toBe(false);
        expect(isAgentAssistant({ ...assistantPrompt(undefined), data: undefined })).toBe(false);
        expect(isAgentAssistant(null)).toBe(false);
        expect(isAgentAssistant(undefined)).toBe(false);
    });
});
