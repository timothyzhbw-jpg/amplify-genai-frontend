import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AgentCoreAgentsSection } from '../AgentCoreAgentsSection';
import { parseAgentCoreAgents } from '../agentCoreAgentModel';

const agents = parseAgentCoreAgents([
    {
        runtimeArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/alpha-AbCdE12345',
        name: 'alpha',
        description: 'Runs tasks',
        status: 'ACTIVE',
        version: 3,
        authType: 'JWT',
    },
    {
        runtimeArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/beta-ZyXwV98765',
        name: 'beta',
        status: 'UPDATING',
    },
]);

const render = (shown = agents, total = agents.length) =>
    renderToStaticMarkup(<AgentCoreAgentsSection agents={shown} total={total} />);

describe('AgentCoreAgentsSection', () => {
    it('shows the heading with the catalog size and one row per agent', () => {
        const html = render();
        expect(html).toContain('AgentCore agents');
        expect(html).toContain('>2<');
        expect(html).toContain('alpha');
        expect(html).toContain('beta');
    });

    it('shows status, auth type and version on the collapsed row', () => {
        const html = render();
        expect(html).toContain('Active');
        expect(html).toContain('Updating');
        expect(html).toContain('JWT');
        expect(html).toContain('v3');
    });

    it('labels an agent without a description instead of leaving a blank line', () => {
        expect(render()).toContain('No description');
    });

    it('starts collapsed: no details, no console link, rows announce they can expand', () => {
        const html = render();
        expect(html).toContain('aria-expanded="false"');
        expect(html).not.toContain('Runtime ARN');
        expect(html).not.toContain('Open in AWS console');
    });

    it('explains an empty search instead of rendering an empty list', () => {
        const html = render([], 2);
        expect(html).toContain('No AgentCore agents match your search');
        expect(html).toContain('>2<');
    });
});
