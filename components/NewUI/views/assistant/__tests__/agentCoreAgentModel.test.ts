import { describe, expect, it } from 'vitest';
import {
    agentCoreConsoleUrl,
    describeAgentCoreAuth,
    filterAgentCoreAgents,
    parseAgentCoreAgents,
    runtimeNameFromId,
} from '../agentCoreAgentModel';

const ARN = 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/alpha_agent-AbCdE12345';
const ARN_B = 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/beta-ZyXwV98765';

describe('parseAgentCoreAgents', () => {
    it('reads { agents: [...] } and a bare array alike', () => {
        expect(parseAgentCoreAgents({ agents: [{ runtimeArn: ARN }] })).toHaveLength(1);
        expect(parseAgentCoreAgents([{ runtimeArn: ARN }])).toHaveLength(1);
    });

    it('returns an empty list for anything that is not a list of agents', () => {
        for (const raw of [null, undefined, 'x', 42, {}, { agents: 'no' }]) {
            expect(parseAgentCoreAgents(raw)).toEqual([]);
        }
    });

    it('derives region, runtime id and name from the ARN', () => {
        const [agent] = parseAgentCoreAgents([{ runtimeArn: ARN }]);
        expect(agent).toEqual({
            runtimeId: 'alpha_agent-AbCdE12345',
            name: 'alpha_agent',
            runtimeArn: ARN,
            region: 'us-east-1',
        });
    });

    it('keeps the display fields and normalises their case', () => {
        const [agent] = parseAgentCoreAgents([{
            runtimeArn: ARN,
            name: '  Alpha  ',
            description: 'Does things',
            status: 'active',
            version: 3,
            authType: 'jwt',
            protocol: 'http',
            networkMode: 'public',
            idleTimeoutMinutes: 15,
            maxLifetimeHours: 8,
            createdAt: '2026-01-01T09:00:00-06:00',
            updatedAt: '2026-01-02T10:30:00-06:00',
        }]);
        expect(agent).toMatchObject({
            name: 'Alpha',
            description: 'Does things',
            status: 'ACTIVE',
            version: 3,
            authType: 'JWT',
            protocol: 'HTTP',
            networkMode: 'PUBLIC',
            idleTimeoutMinutes: 15,
            maxLifetimeHours: 8,
            createdAt: '2026-01-01T09:00:00-06:00',
            updatedAt: '2026-01-02T10:30:00-06:00',
        });
    });

    it('drops fields it does not show, and invalid optional values', () => {
        const [agent] = parseAgentCoreAgents([{
            runtimeArn: ARN,
            environmentVariables: { SECRET: 'x' },
            roleName: 'some-role',
            authType: 'OAUTH',
            version: -1,
            idleTimeoutMinutes: 'soon',
            createdAt: 'not a date',
            description: '   ',
        }]) as unknown as Record<string, unknown>[];
        expect(Object.keys(agent).sort()).toEqual(['name', 'region', 'runtimeArn', 'runtimeId']);
    });

    it('rejects entries without a valid AgentCore runtime ARN', () => {
        expect(parseAgentCoreAgents([
            { name: 'no arn' },
            { runtimeArn: 'arn:aws:lambda:us-east-1:123456789012:function:f' },
            { runtimeArn: 'arn:aws:bedrock-agentcore:us-east-1:123:runtime/x-AbCdE12345' },
            { runtimeArn: `${ARN}/extra` },
            'not an object',
            [ARN],
        ])).toEqual([]);
    });

    it('rejects an entry whose runtimeId disagrees with its ARN', () => {
        expect(parseAgentCoreAgents([{ runtimeArn: ARN, runtimeId: 'other-AbCdE12345' }])).toEqual([]);
        expect(parseAgentCoreAgents([{ runtimeArn: ARN, runtimeId: 'alpha_agent-AbCdE12345' }])).toHaveLength(1);
    });

    it('keeps the first entry per ARN and sorts by name', () => {
        const agents = parseAgentCoreAgents([
            { runtimeArn: ARN_B, name: 'zulu' },
            { runtimeArn: ARN, name: 'alpha' },
            { runtimeArn: ARN, name: 'duplicate' },
        ]);
        expect(agents.map((a) => a.name)).toEqual(['alpha', 'zulu']);
    });

    it('caps long text', () => {
        const [agent] = parseAgentCoreAgents([{ runtimeArn: ARN, description: 'x'.repeat(2000) }]);
        expect(agent.description).toHaveLength(500);
    });
});

describe('runtimeNameFromId', () => {
    it('strips AgentCore’s generated 10-character suffix only', () => {
        expect(runtimeNameFromId('example_agent-AbCdE12345')).toBe('example_agent');
        expect(runtimeNameFromId('plain_name')).toBe('plain_name');
        expect(runtimeNameFromId('name-short')).toBe('name-short');
    });
});

describe('filterAgentCoreAgents', () => {
    const agents = parseAgentCoreAgents([
        { runtimeArn: ARN, name: 'Alpha', description: 'Voice demo' },
        { runtimeArn: ARN_B, name: 'Beta' },
    ]);

    it('keeps everything for an empty or blank query', () => {
        expect(filterAgentCoreAgents(agents, '')).toHaveLength(2);
        expect(filterAgentCoreAgents(agents, '   ')).toHaveLength(2);
    });

    it('matches name, runtime id and description, ignoring case', () => {
        expect(filterAgentCoreAgents(agents, 'BETA').map((a) => a.name)).toEqual(['Beta']);
        expect(filterAgentCoreAgents(agents, 'zyxwv').map((a) => a.name)).toEqual(['Beta']);
        expect(filterAgentCoreAgents(agents, 'voice').map((a) => a.name)).toEqual(['Alpha']);
        expect(filterAgentCoreAgents(agents, 'nothing')).toEqual([]);
    });
});

describe('agentCoreConsoleUrl', () => {
    it('links to the runtime page in its own region', () => {
        expect(agentCoreConsoleUrl({ region: 'us-west-2', runtimeId: 'beta-ZyXwV98765' })).toBe(
            'https://us-west-2.console.aws.amazon.com/bedrock-agentcore/agents/beta-ZyXwV98765?region=us-west-2'
        );
    });
});

describe('describeAgentCoreAuth', () => {
    it('names both auth types and nothing else', () => {
        expect(describeAgentCoreAuth('JWT')).toBe('Sign-in token (JWT)');
        expect(describeAgentCoreAuth('IAM')).toBe('AWS IAM');
        expect(describeAgentCoreAuth(undefined)).toBeUndefined();
    });
});
