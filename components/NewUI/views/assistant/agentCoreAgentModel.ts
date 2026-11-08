/**
 * AWS Bedrock AgentCore runtimes shown read-only in the Agents tab.
 *
 * The catalog is a local, git-ignored JSON file (`config/agentcore-agents.local.json`) served by
 * `pages/api/agentcore/agents.ts`; it is never part of the repo, so every other checkout and every
 * deployed environment shows nothing. Both the route and the client run entries through
 * `parseAgentCoreAgents`, which keeps only the display fields below and drops anything malformed.
 * No React imports.
 */

export type AgentCoreAuthType = 'JWT' | 'IAM';

export interface AgentCoreAgent {
    /** Runtime id, e.g. `my_agent-AbC123xYz0`; always equals the last segment of `runtimeArn`. */
    runtimeId: string;
    name: string;
    runtimeArn: string;
    /** Parsed from `runtimeArn`. */
    region: string;
    description?: string;
    /** Upper-cased, e.g. `ACTIVE`. */
    status?: string;
    version?: number;
    /** How callers authenticate: a sign-in token (JWT) or AWS IAM credentials. */
    authType?: AgentCoreAuthType;
    /** e.g. `HTTP`. */
    protocol?: string;
    /** e.g. `PUBLIC` (no VPC). */
    networkMode?: string;
    idleTimeoutMinutes?: number;
    maxLifetimeHours?: number;
    /** ISO 8601 with offset. */
    createdAt?: string;
    updatedAt?: string;
}

const RUNTIME_ARN = /^arn:aws:bedrock-agentcore:([a-z0-9-]+):(\d{12}):runtime\/([A-Za-z0-9_-]+)$/;
/** AgentCore appends `-` plus a 10-character id to the runtime name. */
const RUNTIME_ID_SUFFIX = /-[A-Za-z0-9]{10}$/;
const MAX_TEXT = 500;

const text = (value: unknown, max = MAX_TEXT): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : undefined;
};

const positiveNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

const isoDate = (value: unknown): string | undefined => {
    const s = text(value, 64);
    return s && !Number.isNaN(Date.parse(s)) ? s : undefined;
};

const authType = (value: unknown): AgentCoreAuthType | undefined => {
    const s = text(value, 16)?.toUpperCase();
    return s === 'JWT' || s === 'IAM' ? s : undefined;
};

/** The runtime name without AgentCore's generated suffix (`my_agent-AbC123xYz0` → `my_agent`). */
export const runtimeNameFromId = (runtimeId: string): string => runtimeId.replace(RUNTIME_ID_SUFFIX, '');

const parseOne = (raw: unknown): AgentCoreAgent | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const runtimeArn = text(r.runtimeArn, 256);
    const match = runtimeArn ? RUNTIME_ARN.exec(runtimeArn) : null;
    if (!runtimeArn || !match) return null;
    const [, region, , arnRuntimeId] = match;
    const declaredId = text(r.runtimeId, 128);
    // A runtimeId that disagrees with its ARN would link the console to a different agent.
    if (declaredId && declaredId !== arnRuntimeId) return null;

    const agent: AgentCoreAgent = {
        runtimeId: arnRuntimeId,
        name: text(r.name, 128) ?? runtimeNameFromId(arnRuntimeId),
        runtimeArn,
        region,
    };
    const optional: Partial<AgentCoreAgent> = {
        description: text(r.description),
        status: text(r.status, 32)?.toUpperCase(),
        version: positiveNumber(r.version),
        authType: authType(r.authType),
        protocol: text(r.protocol, 32)?.toUpperCase(),
        networkMode: text(r.networkMode, 32)?.toUpperCase(),
        idleTimeoutMinutes: positiveNumber(r.idleTimeoutMinutes),
        maxLifetimeHours: positiveNumber(r.maxLifetimeHours),
        createdAt: isoDate(r.createdAt),
        updatedAt: isoDate(r.updatedAt),
    };
    for (const [key, value] of Object.entries(optional)) {
        if (value !== undefined) (agent as unknown as Record<string, unknown>)[key] = value;
    }
    return agent;
};

/**
 * Accepts either `{ agents: [...] }` or a bare array. Keeps the first entry per ARN and sorts by
 * name, so the list is stable however the file is ordered.
 */
export const parseAgentCoreAgents = (raw: unknown): AgentCoreAgent[] => {
    const list: unknown[] = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as { agents?: unknown }).agents)
            ? (raw as { agents: unknown[] }).agents
            : [];
    const seen = new Set<string>();
    const agents: AgentCoreAgent[] = [];
    for (const entry of list) {
        const agent = parseOne(entry);
        if (!agent || seen.has(agent.runtimeArn)) continue;
        seen.add(agent.runtimeArn);
        agents.push(agent);
    }
    return agents.sort((a, b) => a.name.localeCompare(b.name));
};

/** Case-insensitive match on name, runtime id and description; an empty query keeps everything. */
export const filterAgentCoreAgents = (agents: AgentCoreAgent[], query: string): AgentCoreAgent[] => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.runtimeId.toLowerCase().includes(q) ||
        (a.description?.toLowerCase().includes(q) ?? false)
    );
};

/** The runtime's page in the AWS console (the viewer still needs their own AWS sign-in). */
export const agentCoreConsoleUrl = (agent: Pick<AgentCoreAgent, 'region' | 'runtimeId'>): string =>
    `https://${agent.region}.console.aws.amazon.com/bedrock-agentcore/agents/${encodeURIComponent(agent.runtimeId)}?region=${agent.region}`;

export const describeAgentCoreAuth = (type: AgentCoreAuthType | undefined): string | undefined =>
    type === 'JWT' ? 'Sign-in token (JWT)' : type === 'IAM' ? 'AWS IAM' : undefined;
