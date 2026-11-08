import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AGENTCORE_CATALOG_ENDPOINT,
    classifyCatalogResponse,
    getAgentCoreCatalog,
    loadAgentCoreCatalog,
    peekAgentCoreCatalog,
    resetAgentCoreCatalogCache,
} from '../agentCoreCatalogLoader';

const ARN = 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/alpha-AbCdE12345';

const response = (status: number, body: unknown, { json = true } = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    json: json ? async () => body : async () => { throw new SyntaxError('Unexpected token <'); },
});

describe('classifyCatalogResponse', () => {
    it('returns the validated agents on success', async () => {
        const result = await classifyCatalogResponse(response(200, { configured: true, agents: [{ runtimeArn: ARN }, { bad: 1 }] }));
        expect(result.error).toBeNull();
        expect(result.agents.map((a) => a.runtimeId)).toEqual(['alpha-AbCdE12345']);
    });

    it('treats a missing catalog (empty list) as no error', async () => {
        expect(await classifyCatalogResponse(response(200, { configured: false, agents: [] }))).toEqual({ agents: [], error: null });
    });

    it('shows nothing and no error when signed out', async () => {
        expect(await classifyCatalogResponse(response(401, { error: 'Unauthorized' }))).toEqual({ agents: [], error: null });
    });

    it('passes on the route’s reason for a failure', async () => {
        const result = await classifyCatalogResponse(response(500, { error: 'config/agentcore-agents.local.json is not valid JSON' }));
        expect(result.error).toBe('Could not load AgentCore agents: config/agentcore-agents.local.json is not valid JSON');
    });

    it('falls back to the status code when the error body is not JSON or has no reason', async () => {
        expect((await classifyCatalogResponse(response(502, null, { json: false }))).error)
            .toBe('Could not load AgentCore agents: HTTP 502');
        expect((await classifyCatalogResponse(response(500, { error: '   ' }))).error)
            .toBe('Could not load AgentCore agents: HTTP 500');
    });

    it('caps an over-long reason', async () => {
        const result = await classifyCatalogResponse(response(500, { error: 'x'.repeat(5000) }));
        expect(result.error!.length).toBe('Could not load AgentCore agents: '.length + 200);
    });

    it('reports a success response that is not JSON', async () => {
        const result = await classifyCatalogResponse(response(200, null, { json: false }));
        expect(result).toEqual({ agents: [], error: 'Could not load AgentCore agents: the response was not valid JSON.' });
    });
});

describe('loadAgentCoreCatalog', () => {
    it('asks the catalog route for JSON', async () => {
        const fetchImpl = vi.fn(async () => response(200, { agents: [] }) as unknown as Response);
        await loadAgentCoreCatalog(fetchImpl as unknown as typeof fetch);
        expect(fetchImpl).toHaveBeenCalledWith(AGENTCORE_CATALOG_ENDPOINT, expect.objectContaining({
            headers: { Accept: 'application/json' },
        }));
    });

    it('turns a network failure into an error instead of throwing', async () => {
        const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        expect(await loadAgentCoreCatalog(fetchImpl as unknown as typeof fetch))
            .toEqual({ agents: [], error: 'Could not load AgentCore agents.' });
    });

    it('gives up after the timeout, so the tab never waits forever', async () => {
        const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));
        const result = await loadAgentCoreCatalog(fetchImpl as unknown as typeof fetch, 5);
        expect(result).toEqual({ agents: [], error: 'Could not load AgentCore agents: the request timed out.' });
    });
});

describe('getAgentCoreCatalog (one request per page load)', () => {
    beforeEach(() => resetAgentCoreCatalogCache());
    afterEach(() => resetAgentCoreCatalogCache());

    it('shares one load between concurrent callers and serves later callers from memory', async () => {
        const load = vi.fn(async () => ({ agents: [], error: null }));
        await Promise.all([getAgentCoreCatalog(load), getAgentCoreCatalog(load)]);
        await getAgentCoreCatalog(load);
        expect(load).toHaveBeenCalledTimes(1);
        expect(peekAgentCoreCatalog()).toEqual({ agents: [], error: null });
    });

    it('does not keep a failed load, so the next visit retries', async () => {
        const load = vi.fn()
            .mockResolvedValueOnce({ agents: [], error: 'Could not load AgentCore agents.' })
            .mockResolvedValueOnce({ agents: [], error: null });
        expect((await getAgentCoreCatalog(load)).error).not.toBeNull();
        expect(peekAgentCoreCatalog()).toBeNull();
        expect((await getAgentCoreCatalog(load)).error).toBeNull();
        expect(load).toHaveBeenCalledTimes(2);
    });
});
