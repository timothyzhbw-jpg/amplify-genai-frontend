/**
 * AgentCoreAgentsSection — the read-only "AgentCore agents" group in the Agents tab.
 *
 * Lists AWS Bedrock AgentCore runtimes from the local catalog (`useAgentCoreAgents`). Each row
 * expands in place (no modal — NEW_UI_GUIDE §5 rule 2) to its runtime details and a link to the
 * AWS console. Nothing here invokes an agent.
 */
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { IconChevronRight, IconCloudComputing, IconCopy, IconExternalLink } from '@tabler/icons-react';
import { Badge } from '@/components/NewUI/shared/Badge';
import { InfoTooltip } from '@/components/NewUI/shared/InfoTooltip';
import {
    AgentCoreAgent,
    agentCoreConsoleUrl,
    describeAgentCoreAuth,
} from './agentCoreAgentModel';

const SECTION_INFO =
    'Agents hosted on AWS Bedrock AgentCore. This list is read-only. It comes from the local file ' +
    'config/agentcore-agents.local.json and only appears when the app runs in development mode from ' +
    'a checkout that has that file; reload the page after editing it. Chatting with these agents ' +
    'from here is not available yet.';

const formatDate = (iso: string | undefined): string | undefined => {
    if (!iso) return undefined;
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? undefined
        : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const titleCase = (value: string): string => value.charAt(0) + value.slice(1).toLowerCase();

const StatusPill: React.FC<{ status: string }> = ({ status }) =>
    status === 'ACTIVE' ? (
        <span
            className="inline-flex items-center rounded px-[6px] py-[2px] text-[11px] font-medium leading-none"
            style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-fg)' }}
        >
            Active
        </span>
    ) : (
        <Badge>{titleCase(status)}</Badge>
    );

const copyArn = (arn: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        toast.error('Copying is not available in this browser.');
        return;
    }
    navigator.clipboard
        .writeText(arn)
        .then(() => toast.success('Runtime ARN copied'))
        .catch(() => toast.error('Could not copy the runtime ARN.'));
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <>
        <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
        <dd className="m-0 min-w-0 break-words" style={{ color: 'var(--text-secondary)' }}>{children}</dd>
    </>
);

const AgentCoreAgentRow: React.FC<{ agent: AgentCoreAgent }> = ({ agent }) => {
    const [open, setOpen] = useState(false);
    const panelId = `agentcore-agent-${agent.runtimeId}`;
    const auth = describeAgentCoreAuth(agent.authType);
    const created = formatDate(agent.createdAt);
    const updated = formatDate(agent.updatedAt);

    return (
        <li className="rounded-[8px]" style={{ backgroundColor: open ? 'var(--bg-hover)' : undefined }}>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left transition-colors duration-100 hover:bg-[--bg-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            >
                <span
                    className="flex items-center justify-center w-8 h-8 rounded-[8px] flex-shrink-0"
                    style={{ backgroundColor: 'var(--bg-active)', color: 'var(--text-secondary)' }}
                    aria-hidden="true"
                >
                    <IconCloudComputing size={16} />
                </span>
                <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {agent.name}
                    </span>
                    <span className="block text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {agent.description ?? 'No description'}
                    </span>
                </span>
                <span className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    {agent.status && <StatusPill status={agent.status} />}
                    {agent.authType && <Badge>{agent.authType}</Badge>}
                    {agent.version !== undefined && <Badge>v{agent.version}</Badge>}
                </span>
                <IconChevronRight
                    size={15}
                    aria-hidden="true"
                    className={`flex-shrink-0 motion-safe:transition-transform ${open ? 'rotate-90' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                />
            </button>

            {open && (
                <div id={panelId} className="px-3 pb-3 sm:pl-14">
                    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[12.5px]">
                        {agent.status && <DetailRow label="Status"><StatusPill status={agent.status} /></DetailRow>}
                        <DetailRow label="Runtime ID">{agent.runtimeId}</DetailRow>
                        <DetailRow label="Runtime ARN">
                            <span className="inline-flex items-start gap-1.5 min-w-0">
                                <code className="font-mono text-[12px] break-all">{agent.runtimeArn}</code>
                                <button
                                    type="button"
                                    onClick={() => copyArn(agent.runtimeArn)}
                                    aria-label={`Copy runtime ARN of ${agent.name}`}
                                    title="Copy runtime ARN"
                                    className="flex items-center justify-center w-6 h-6 rounded-[6px] flex-shrink-0 transition-colors hover:bg-[--bg-active] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <IconCopy size={13} />
                                </button>
                            </span>
                        </DetailRow>
                        <DetailRow label="Region">{agent.region}</DetailRow>
                        {agent.version !== undefined && <DetailRow label="Version">{agent.version}</DetailRow>}
                        {agent.protocol && <DetailRow label="Protocol">{agent.protocol}</DetailRow>}
                        {auth && <DetailRow label="Callers sign in with">{auth}</DetailRow>}
                        {agent.networkMode && <DetailRow label="Network">{titleCase(agent.networkMode)}</DetailRow>}
                        {agent.idleTimeoutMinutes !== undefined && (
                            <DetailRow label="Idle session timeout">{agent.idleTimeoutMinutes} min</DetailRow>
                        )}
                        {agent.maxLifetimeHours !== undefined && (
                            <DetailRow label="Max session length">{agent.maxLifetimeHours} h</DetailRow>
                        )}
                        {created && <DetailRow label="Created">{created}</DetailRow>}
                        {updated && <DetailRow label="Last updated">{updated}</DetailRow>}
                    </dl>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                        <a
                            href={agentCoreConsoleUrl(agent)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[12.5px] font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg-hover]"
                            style={{ color: 'var(--accent-fg)', backgroundColor: 'var(--accent)' }}
                        >
                            <IconExternalLink size={14} aria-hidden="true" />
                            Open in AWS console
                        </a>
                        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                            Read-only. Chatting with this agent from here is not available yet.
                        </span>
                    </div>
                </div>
            )}
        </li>
    );
};

export interface AgentCoreAgentsSectionProps {
    /** Agents to show, already narrowed by the tab's search. */
    agents: AgentCoreAgent[];
    /** Size of the whole catalog, for the heading count and the "no match" message. */
    total: number;
}

export const AgentCoreAgentsSection: React.FC<AgentCoreAgentsSectionProps> = ({ agents, total }) => (
    <section aria-labelledby="agentcore-agents-heading">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1.5">
            <h3
                id="agentcore-agents-heading"
                className="m-0 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
            >
                AgentCore agents
            </h3>
            <span
                className="text-[11px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
            >
                {total}
            </span>
            <InfoTooltip ariaLabel="About AgentCore agents" maxWidth={340} text={SECTION_INFO} />
        </div>
        {agents.length === 0 ? (
            <p className="px-3 py-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                No AgentCore agents match your search
            </p>
        ) : (
            <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
                {agents.map((agent) => (
                    <AgentCoreAgentRow key={agent.runtimeArn} agent={agent} />
                ))}
            </ul>
        )}
    </section>
);

export default AgentCoreAgentsSection;
