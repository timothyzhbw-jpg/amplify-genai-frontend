import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { getServerAccessToken } from '@/utils/server/accessToken';
import { parseAgentCoreAgents } from '@/components/NewUI/views/assistant/agentCoreAgentModel';

/**
 * Read-only catalog of AWS Bedrock AgentCore runtimes for the Agents tab — a local development aid.
 *
 * The data comes from a git-ignored file (`config/*.local.json`, format in
 * `config/agentcore-agents.example.json`). Three guards keep it off every deployed environment:
 * this route never reads it in a production build, `.dockerignore` keeps it out of image build
 * contexts, and `next.config.js` excludes it from standalone output tracing. Where the file is
 * missing the list is empty and the UI shows nothing. This route never calls AWS; a later backend
 * endpoint can replace the file read.
 */
const CATALOG_FILE = 'config/agentcore-agents.local.json';
const CATALOG_PATH = path.join(process.cwd(), 'config', 'agentcore-agents.local.json');

const agentCoreAgents = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const accessToken = await getServerAccessToken(req);
    if (!accessToken) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    res.setHeader('Cache-Control', 'no-store');

    if (process.env.NODE_ENV === 'production') {
        return res.status(200).json({ configured: false, agents: [] });
    }

    let contents: string;
    try {
        contents = await fs.readFile(CATALOG_PATH, 'utf8');
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            return res.status(200).json({ configured: false, agents: [] });
        }
        console.error('Could not read the AgentCore catalog:', error?.code ?? error);
        return res.status(500).json({ error: `could not read ${CATALOG_FILE}` });
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(contents);
    } catch {
        return res.status(500).json({ error: `${CATALOG_FILE} is not valid JSON` });
    }

    return res.status(200).json({ configured: true, agents: parseAgentCoreAgents(parsed) });
};

export default agentCoreAgents;
