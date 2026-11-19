import { useEffect, useMemo, useState } from 'react';
import { apiJson, getActiveSession, refreshSession } from '../api';
import type { AuthSession } from '../types';
import { ChatConnection } from '../../../../shared/remote-chat/client/connection';
import { createBrowserPacketCompression } from '../../../../shared/remote-chat/browserPacketCompression';
import { createBrowserHistoryVersions } from '../../../../shared/remote-chat/browserHistory';
import { ChatController } from '../../../../shared/remote-chat/client/controller';
import { RtcPeer } from '../../../../shared/remote-chat/rtcPeer';
import { browserTrustStore, trustedHost, trustScope } from '../../../../shared/remote-chat/trustedHost';
import { createPreviewDownloads } from '../downloads/previews';
import { downloadOwner } from '../../../../shared/downloads/manager';
import { useActiveChatPolicy } from '../../../../shared/remote-chat/useActiveChatPolicy';
import { createWebSshProfiles } from '../sshProfiles';
import { boundedHistoryRequest } from './historyRequest';
import { useVisibleChatState } from './useVisibleChatState';

const HISTORY_REFRESH_MS = 15_000;

function createController(session: AuthSession, deviceId: string) {
  const controller = new ChatController((events) => {
    const connection = new ChatConnection({ ...events, deviceId, managePolicyMode: false,
    createPacketCompression: createBrowserPacketCompression,
    verifyHostKey: trustedHost(browserTrustStore, trustScope(session.baseUrl, deviceId)),
    randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
    renewAuthorization: async () => {
      const current = getActiveSession();
      if (!current || current.baseUrl !== session.baseUrl || current.email !== session.email) {
        throw Object.assign(new Error('请重新登录后连接电脑。'), { status: 401 });
      }
      await refreshSession();
    },
    authorize: async () => {
      await apiJson('/auth/me');
      const current = getActiveSession();
      if (!current || current.baseUrl !== session.baseUrl || current.email !== session.email) {
        throw new Error('请重新登录后连接电脑。');
      }
      return current;
    },
    createPeer: (options) => new RtcPeer(options, () => new RTCPeerConnection({ iceServers: options.iceServers })),
    });
    const request = boundedHistoryRequest(connection.request.bind(connection),
      import.meta.env.VITE_PERSONAL_WEB === 'true');
    return { request, start: () => connection.start(), stop: () => connection.stop(),
      retryNow: () => connection.retryNow(),
      confirmHostIdentity: fingerprint => connection.confirmHostIdentity(fingerprint),
      reportDiagnostic: diagnostic => connection.reportDiagnostic(diagnostic),
      downloadsBulk: connection.downloadsBulk, setBulkSupport: value => connection.setBulkSupport(value) };
  }, undefined, createBrowserHistoryVersions(), createWebSshProfiles(session));
  controller.deferToolDetails = true;
  controller.deferProcessDetails = true;
  controller.previewDownloads = createPreviewDownloads({ owner: downloadOwner(session), deviceId });
  return controller;
}

export function useChat(session: AuthSession, deviceId: string, active: boolean) {
  // Token refresh keeps the same conversation; reconnect reads the renewed account credentials.
  const controller = useMemo(() => createController(session, deviceId), [session.baseUrl, session.email, deviceId]);
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
  return { controller, state, foreground };
}
