import type { ChatConnection } from '../../../../shared/remote-chat/client/connection';

const HISTORY_TIMEOUT_MS = 40_000;
const VIEW_TIMEOUT_MS = 10_000;
type Request = ChatConnection['request'];

/** A stalled optional view acknowledgement must not leave history waiting forever. */
export function boundedHistoryRequest(request: Request): Request {
  return <T>(method: Parameters<Request>[0], body?: unknown): Promise<T> => {
    const operation = body && typeof body === 'object' && 'operation' in body ? body.operation : undefined;
    const deadline = operation === 'viewThread' ? VIEW_TIMEOUT_MS
      : operation === 'syncHistory' || operation === 'read'
        || operation === 'processDetails' || operation === 'toolDetails' ? HISTORY_TIMEOUT_MS : undefined;
    if (!deadline) return request<T>(method, body);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('client.projectBrowser.theRequestTimedOutPleaseTryAgain')), deadline);
      request<T>(method, body).then(resolve, reject).finally(() => clearTimeout(timer));
    });
  };
}
