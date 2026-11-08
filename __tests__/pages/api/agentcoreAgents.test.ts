import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mocks = vi.hoisted(() => ({
    getServerAccessToken: vi.fn(),
    readFile: vi.fn(),
}));

vi.mock('@/utils/server/accessToken', () => ({ getServerAccessToken: mocks.getServerAccessToken }));
vi.mock('fs', () => ({ promises: { readFile: mocks.readFile }, default: { promises: { readFile: mocks.readFile } } }));

import handler from '@/pages/api/agentcore/agents';

const ARN = 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/alpha-AbCdE12345';

const makeRes = () => {
    const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
    res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
    res.json = vi.fn((body: unknown) => { res.body = body; return res; });
    res.setHeader = vi.fn((name: string, value: string) => { res.headers[name] = value; return res; });
    return res as NextApiResponse & { statusCode: number; body: any; headers: Record<string, string> };
};

const call = async (method = 'GET') => {
    const res = makeRes();
    await handler({ method } as NextApiRequest, res);
    return res;
};

describe('GET /api/agentcore/agents', () => {
    beforeEach(() => {
        mocks.getServerAccessToken.mockReset().mockResolvedValue('token');
        mocks.readFile.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('rejects other methods without reading anything', async () => {
        const res = await call('POST');
        expect(res.statusCode).toBe(405);
        expect(res.headers.Allow).toBe('GET');
        expect(mocks.readFile).not.toHaveBeenCalled();
    });

    it('requires a signed-in user before reading the catalog', async () => {
        mocks.getServerAccessToken.mockResolvedValue(null);
        const res = await call();
        expect(res.statusCode).toBe(401);
        expect(mocks.readFile).not.toHaveBeenCalled();
    });

    it('never reads the catalog in a production build, even if the file exists', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        try {
            mocks.readFile.mockResolvedValue(JSON.stringify({ agents: [{ runtimeArn: ARN }] }));
            const res = await call();
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ configured: false, agents: [] });
            expect(mocks.readFile).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it('returns an empty, unconfigured list when the local catalog does not exist', async () => {
        mocks.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
        const res = await call();
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ configured: false, agents: [] });
    });

    it('returns only validated display fields from the catalog, uncached', async () => {
        mocks.readFile.mockResolvedValue(JSON.stringify({
            agents: [
                { runtimeArn: ARN, name: 'alpha', environmentVariables: { TOKEN: 'secret' } },
                { runtimeArn: 'not-an-arn' },
            ],
        }));
        const res = await call();
        expect(res.statusCode).toBe(200);
        expect(res.headers['Cache-Control']).toBe('no-store');
        expect(res.body.configured).toBe(true);
        expect(res.body.agents).toEqual([
            { runtimeId: 'alpha-AbCdE12345', name: 'alpha', runtimeArn: ARN, region: 'us-east-1' },
        ]);
        expect(JSON.stringify(res.body)).not.toContain('secret');
    });

    it('reads the catalog from config/agentcore-agents.local.json', async () => {
        mocks.readFile.mockResolvedValue('[]');
        await call();
        expect(String(mocks.readFile.mock.calls[0][0])).toMatch(/config[\\/]agentcore-agents\.local\.json$/);
    });

    it('reports a malformed catalog as a server error that names the file', async () => {
        mocks.readFile.mockResolvedValue('{ not json');
        const res = await call();
        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('config/agentcore-agents.local.json is not valid JSON');
    });

    it('reports an unreadable catalog as a server error without leaking the path', async () => {
        mocks.readFile.mockRejectedValue(Object.assign(new Error('EACCES: /secret/path'), { code: 'EACCES' }));
        const res = await call();
        expect(res.statusCode).toBe(500);
        expect(JSON.stringify(res.body)).not.toContain('/secret/path');
    });
});
