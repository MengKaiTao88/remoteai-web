import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useState } from 'react';
import { ApplicationTypography } from '../../../shared/appearance/ApplicationTypography';
import { CodexAppearance } from '../../../shared/appearance/CodexAppearance';
import { guiFontStyle, saveGlobalFontSize } from '../../../shared/appearance/fontSize';
import { activityDisclosureThread } from '../../../shared/testing/activityDisclosureFixture';
import { ChatMessages } from '../../../shared/remote-chat/views/ChatMessages';
import { WebLocaleProvider } from '../src/i18n/WebLocaleProvider';
import { setThemeMode } from '../src/theme/preference';
import '../src/styles.css';
import '../../../shared/remote-chat/views/chat.css';

const query = new URLSearchParams(location.search);
const font = Number(query.get('font') ?? 14);
saveGlobalFontSize(font);
setThemeMode(query.has('dark') ? 'dark' : 'light');
function Harness() {
  const [running, setRunning] = useState(query.has('running'));
  const thread = useMemo(() => activityDisclosureThread(running), [running]);
  useEffect(() => {
    const complete = () => setRunning(false);
    window.addEventListener('activity-disclosure-complete', complete);
    return () => window.removeEventListener('activity-disclosure-complete', complete);
  }, []);
  return <WebLocaleProvider><ApplicationTypography><CodexAppearance>
  <main className="chat-page" style={{ ...guiFontStyle(font), height: '100dvh' }}><section className="chat-conversation">
    <ChatMessages thread={thread} />
  </section></main>
</CodexAppearance></ApplicationTypography></WebLocaleProvider>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
