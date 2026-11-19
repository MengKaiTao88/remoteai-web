import type { ChatConnection } from '../../../../shared/remote-chat/client/connection';
import { historyDelta, type HistoryVersion } from '../../../../shared/remote-chat/historySync';
import type { HistoryPage, HistoryWindow } from '../../../../shared/remote-chat/historyPage';
import type { Thread } from '../../../../shared/remote-chat/client/types';

const HISTORY_TIMEOUT_MS = 40_000;
const VIEW_TIMEOUT_MS = 10_000;
const FIRST_PAGE_ITEMS = 16;
type Request = ChatConnection['request'];
type InitialHistory = { threadId: string; known: HistoryVersion; window?: HistoryWindow; deferToolDetails?: boolean };

function initialHistory(body: object): InitialHistory | undefined {
  const input = body as Partial<InitialHistory>;
  if (typeof input.threadId !== 'string' || !input.deferToolDetails || input.window?.older || input.window?.start
    || !Array.isArray(input.known?.turns) || input.known.turns.length) return;
  return input as InitialHistory;
}

async function readFirstPage<T>(request: Request, input: InitialHistory, body: unknown): Promise<T> {
  try {
    const { thread, page } = await request<{ thread?: Thread; page?: HistoryPage }>('request', {
      operation: 'read', threadId: input.threadId, deferToolDetails: true, includeToolDetails: false,
      window: { pageSize: FIRST_PAGE_ITEMS },
    });
    if (thread?.id === input.threadId && typeof page?.hasMore === 'boolean'
      && (!page.hasMore || page.start)) {
      return { ...historyDelta(thread, input.known), page } as T;
    }
  } catch {
    // Hosts that only understand the original history request can still open chats.
  }
  return request<T>('request', body);
}

/** A stalled optional view acknowledgement must not leave history waiting forever. */
export function boundedHistoryRequest(request: Request, fastFirstPage = false): Request {
  return <T>(method: Parameters<Request>[0], body?: unknown): Promise<T> => {
    const operation = body && typeof body === 'object' && 'operation' in body ? body.operation : undefined;
    const deadline = operation === 'viewThread' ? VIEW_TIMEOUT_MS
      : operation === 'syncHistory' || operation === 'read'
        || operation === 'processDetails' || operation === 'toolDetails' ? HISTORY_TIMEOUT_MS : undefined;
    if (!deadline) return request<T>(method, body);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('client.projectBrowser.theRequestTimedOutPleaseTryAgain')), deadline);
      const first = fastFirstPage && method === 'request' && operation === 'syncHistory' && initialHistory(body as object);
      const paged = fastFirstPage && method === 'request' && operation === 'syncHistory'
        && body && typeof body === 'object'
        ? { ...body as Record<string, unknown>,
          window: { ...((body as Record<string, unknown>).window as Record<string, unknown> | undefined),
            pageSize: FIRST_PAGE_ITEMS } }
        : body;
      const read = first ? readFirstPage<T>(request, first, body)
        : paged === body ? request<T>(method, body)
          : request<T>(method, paged).catch(() => request<T>(method, body));
      read
        .then(resolve, reject).finally(() => clearTimeout(timer));
    });
  };
}
