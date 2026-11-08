/**
 * Loading the local AgentCore catalog for the Agents tab, kept free of React so every branch can be
 * unit-tested in the node test environment. `useAgentCoreAgents` is a thin wrapper around it.
 */
import { AgentCoreAgent, parseAgentCoreAgents } from './agentCoreAgentModel';

export interface AgentCoreCatalogResult {
    agents: AgentCoreAgent[];
    /** Set when the catalog exists but could not be loaded; a missing catalog is not an error. */
    error: string | null;
}

export const AGENTCORE_CATALOG_ENDPOINT = '/api/agentcore/agents';
export const AGENTCORE_CATALOG_TIMEOUT_MS = 10_000;
const MAX_REASON_LENGTH = 200;
const PREFIX = 'Could not load AgentCore agents';

type CatalogResponse = Pick<Response, 'ok' | 'status' | 'json'>;

/** Turns the route's response into what the tab shows. Never throws. */
export const classifyCatalogResponse = async (res: CatalogResponse): Promise<AgentCoreCatalogResult> => {
    // Signed out: nothing to show, and nothing the user can fix from this tab.
    if (res.status === 401) return { agents: [], error: null };

    if (!res.ok) {
        let reason = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            const routeReason = typeof body?.error === 'string' ? body.error.trim() : '';
            // The route names the problem (e.g. the catalog file is not valid JSON); pass it on.
            if (routeReason) reason = routeReason.slice(0, MAX_REASON_LENGTH);
        } catch {
            // Not JSON (a proxy or error page): keep the status code.
        }
        return { agents: [], error: `${PREFIX}: ${reason}` };
    }

    try {
        const body = await res.json();
        return { agents: parseAgentCoreAgents(body?.agents), error: null };
    } catch {
        return { agents: [], error: `${PREFIX}: the response was not valid JSON.` };
    }
};

/** One request with a timeout, so a stalled request can never hold the tab on "Loading agents…". */
export const loadAgentCoreCatalog = async (
    fetchImpl: typeof fetch = fetch,
    timeoutMs: number = AGENTCORE_CATALOG_TIMEOUT_MS,
): Promise<AgentCoreCatalogResult> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const res = await fetchImpl(AGENTCORE_CATALOG_ENDPOINT, {
            headers: { Accept: 'application/json' },
            signal: controller?.signal,
        });
        return await classifyCatalogResponse(res);
    } catch {
        return {
            agents: [],
            error: controller?.signal.aborted ? `${PREFIX}: the request timed out.` : `${PREFIX}.`,
        };
    } finally {
        if (timer) clearTimeout(timer);
    }
};

// One request per page load, shared by every mount of the tab (and React StrictMode's double
// effect). A failed load is not kept, so the next visit tries again. Editing the catalog file
// therefore shows up after a page reload.
let pending: Promise<AgentCoreCatalogResult> | null = null;
let resolved: AgentCoreCatalogResult | null = null;

export const getAgentCoreCatalog = (
    load: () => Promise<AgentCoreCatalogResult> = loadAgentCoreCatalog,
): Promise<AgentCoreCatalogResult> => {
    if (resolved) return Promise.resolve(resolved);
    if (!pending) {
        pending = load().then((result) => {
            pending = null;
            if (!result.error) resolved = result;
            return result;
        });
    }
    return pending;
};

/** The successful result of this page load, if there is one yet — lets a revisit render at once. */
export const peekAgentCoreCatalog = (): AgentCoreCatalogResult | null => resolved;

/** Tests only. */
export const resetAgentCoreCatalogCache = (): void => {
    pending = null;
    resolved = null;
};
