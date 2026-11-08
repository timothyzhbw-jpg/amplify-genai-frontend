import { useEffect, useState } from 'react';
import type { AgentCoreAgent } from './agentCoreAgentModel';
import { getAgentCoreCatalog, peekAgentCoreCatalog } from './agentCoreCatalogLoader';

export interface AgentCoreAgentsState {
    agents: AgentCoreAgent[];
    loading: boolean;
    /** Set when the catalog exists but could not be loaded; a missing catalog is not an error. */
    error: string | null;
}

/**
 * The catalog is a development-only aid: the route returns nothing in a production build, so a
 * production bundle never asks (Next inlines NODE_ENV) and the Agents tab never waits on it.
 */
export const AGENTCORE_CATALOG_ENABLED = process.env.NODE_ENV !== 'production';

const IDLE: AgentCoreAgentsState = { agents: [], loading: false, error: null };
const LOADING: AgentCoreAgentsState = { agents: [], loading: true, error: null };

const initialState = (active: boolean): AgentCoreAgentsState => {
    if (!active) return IDLE;
    const cached = peekAgentCoreCatalog();
    return cached ? { ...cached, loading: false } : LOADING;
};

/**
 * The local AgentCore catalog for the Agents tab: requested at most once per page load and shared
 * across mounts (see agentCoreCatalogLoader), with a timeout so it can never hang the tab.
 */
export const useAgentCoreAgents = (enabled: boolean): AgentCoreAgentsState => {
    const active = enabled && AGENTCORE_CATALOG_ENABLED;
    const [state, setState] = useState<AgentCoreAgentsState>(() => initialState(active));

    useEffect(() => {
        if (!active) {
            setState(IDLE);
            return;
        }
        const cached = peekAgentCoreCatalog();
        if (cached) {
            setState({ ...cached, loading: false });
            return;
        }
        // Re-armed in the effect body on every run (NEW_UI_GUIDE §5 rule 16).
        let mounted = true;
        setState(LOADING);
        getAgentCoreCatalog().then((result) => {
            if (mounted) setState({ ...result, loading: false });
        });
        return () => {
            mounted = false;
        };
    }, [active]);

    return state;
};
