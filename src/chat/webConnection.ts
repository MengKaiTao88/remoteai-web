import type { AuthSession } from '../types';
import { fetchCurrentProfile, getActiveSession, refreshSession } from '../api';
import { ChatConnection, type ConnectionEvents } from '../../../../shared/remote-chat/client/connection';
import { createBrowserPacketCompression } from '../../../../shared/remote-chat/browserPacketCompression';
import { RtcPeer } from '../../../../shared/remote-chat/rtcPeer';
import { browserTrustStore, trustedHost, trustScope } from '../../../../shared/remote-chat/trustedHost';
import { CONNECTION_ERRORS } from '../../../../shared/remote-chat/connectionErrors';

export function createWebChatConnection(session: AuthSession, deviceId: string, events: ConnectionEvents) {
  const authorizedSession = () => {
    const current = getActiveSession();
    if (!current || current.baseUrl !== session.baseUrl || current.email !== session.email) {
      throw Object.assign(new Error(CONNECTION_ERRORS.expired), { status: 401 });
    }
    return current;
  };
  return new ChatConnection({ ...events, deviceId, managePolicyMode: false,
    createPacketCompression: createBrowserPacketCompression,
    verifyHostKey: trustedHost(browserTrustStore, trustScope(session.baseUrl, deviceId)),
    randomBytes: length => crypto.getRandomValues(new Uint8Array(length)),
    renewAuthorization: async () => { authorizedSession(); await refreshSession(); },
    authorize: async () => { await fetchCurrentProfile(); return authorizedSession(); },
    createPeer: options => new RtcPeer(options, () => new RTCPeerConnection({ iceServers: options.iceServers })),
  });
}
