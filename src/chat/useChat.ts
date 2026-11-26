import { useEffect, useMemo, useState } from 'react';
import type { AuthSession } from '../types';
import { createBrowserHistoryVersions } from '../../../../shared/remote-chat/browserHistory';
import { ChatController } from '../../../../shared/remote-chat/client/controller';
import { createPreviewDownloads } from '../downloads/previews';
import { downloadOwner } from '../../../../shared/downloads/manager';
import { useActiveChatPolicy } from '../../../../shared/remote-chat/useActiveChatPolicy';
import { createWebSshProfiles } from '../sshProfiles';
import { boundedHistoryRequest } from './historyRequest';
import { useVisibleChatState } from './useVisibleChatState';
import { createWebChatConnection } from './webConnection';
import type { ChatConnection } from '../../../../shared/remote-chat/client/connection';
import { CockpitQuotaChannel, quotaConnectionScope, type CockpitQuotaSnapshot } from './cockpitQuotaChannel';

const HISTORY_REFRESH_MS = 15_000;

function createController(session: AuthSession, deviceId: string) {
  const quotas = new CockpitQuotaChannel(quotaConnectionScope(session, deviceId));
  const controller = new ChatController((events) => {
    const connection = createWebChatConnection(session, deviceId, { ...events,
      mode: mode => {
        if (mode === 'offline') quotas.disconnect();
        events.mode(mode);
      },
      error: message => { quotas.unavailable(); events.error(message); },
    });
    const request = boundedHistoryRequest(connection.request.bind(connection),
      import.meta.env.VITE_PERSONAL_WEB === 'true');
    const readQuotas = () => connection.request<CockpitQuotaSnapshot>('request', { operation: 'cockpitAccountQuotas' });
    const withHandshake: ChatConnection['request'] = <T>(
      method: Parameters<ChatConnection['request']>[0], body?: unknown,
    ) => {
      const result = request<T>(method, body);
      return method === 'connect' ? result.then(reply => { quotas.accept(reply, readQuotas); return reply; }) : result;
    };
    return { request: withHandshake, start: () => connection.start(), stop: () => {
        quotas.disconnect();
        connection.stop();
      },
      retryNow: () => connection.retryNow(),
      confirmHostIdentity: fingerprint => connection.confirmHostIdentity(fingerprint),
      reportDiagnostic: diagnostic => connection.reportDiagnostic(diagnostic),
      downloadsBulk: connection.downloadsBulk, setBulkSupport: value => connection.setBulkSupport(value) };
  }, undefined, createBrowserHistoryVersions(), createWebSshProfiles(session));
  controller.deferToolDetails = true;
  controller.deferProcessDetails = true;
  controller.previewDownloads = createPreviewDownloads({ owner: downloadOwner(session), deviceId });
  return { controller, quotas };
}

export function useChat(session: AuthSession, deviceId: string, active: boolean) {
  // Token refresh keeps the same conversation; reconnect reads the renewed account credentials.
  const { controller, quotas } = useMemo(() => createController(session, deviceId),
    [session.baseUrl, session.email, deviceId]);
  const [foreground, setForeground] = useState(document.visibilityState === 'visible');
  const state = useVisibleChatState(controller, active && foreground);
  useActiveChatPolicy(active, state.mode);
  useEffect(() => {
    const update = () => setForeground(document.visibilityState === 'visible');
    const hide = () => setForeground(false);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', update);
    };
  }, []);
  useEffect(() => {
    // Keep the session and pending requests alive when another page or browser tab is shown.
    if (!deviceId) return;
    controller.start();
    return () => controller.stop();
  }, [deviceId, controller]);
  useEffect(() => {
    if (active && foreground && deviceId) controller.connectNow();
  }, [active, foreground, deviceId, controller]);
  useEffect(() => {
    if (!active || !foreground || (state.mode !== 'direct' && state.mode !== 'relay')) return;
    void controller.refreshSelected();
    const timer = window.setInterval(() => { void controller.refreshSelected(); }, HISTORY_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [active, foreground, controller, state.mode]);
  return { controller, state, foreground, quotas };
}
