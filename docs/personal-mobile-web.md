# Personal mobile Web / PWA

This edition keeps Remote AI's existing application, authentication, transport and ChatController.
Only the personal Web/PWA GUI chat workspace uses a dedicated Remodex-inspired React presentation.
Application navigation, accounts, 2FA, settings, devices and token summary retain their host UI.
The normal Web build and desktop/native packages keep their existing conversation presentation.

## Source basis and implementation

The current visual reference is [Remodex revision c06dcb16a7059603a41e26a2cb4a81b6d4b5514d](https://github.com/Emanuele-web04/remodex/tree/c06dcb16a7059603a41e26a2cb4a81b6d4b5514d).
The source review covered the composer host/bottom bar/runtime slider, thinking disclosure parser,
streaming Markdown splitter, queue, sidebar actions, timeline, approvals, plans and file diffs.
The fixed-revision source inventory and feature matrix are retained in the parent workspace's
research artifacts. Earlier DSH-inspired responsive shells remain internal component names.

The personal Web implementation includes:

- Neutral light/dark chat surfaces, gray user bubbles, plain assistant prose and compact header controls.
- One continuously mounted input: a narrow capsule at rest and an expanded writing surface with
  attachments, real context ring, model/effort selector, dictation and send/stop controls.
- A centered runtime overlay with real supported reasoning levels and fast mode; a separate model list
  uses the connected computer's catalog and confirmed settings. Full settings remain reachable from usage.
- Independent reasoning disclosures, summary-only labels, grouped consecutive tools and visible failures.
  Authenticated deferred process/tool loading is retained. Plain reasoning without headings remains intact.
- A live plan capsule showing the current step and completed count, linked to the existing plan details.
- Memoized settled Markdown blocks: only changing blocks re-render during streaming. Lists, references,
  quotes, HTML, math and tables conservatively keep the remaining document together for correct parsing.
- Project/recent conversation lists, circular new-chat/search/new-project actions, anchored management links,
  existing project creation, search, pinning, menus, long press and pagination.
- Existing file/diff/artifact cards, inline approvals/questions, per-chat drafts, attachments, queue actions,
  failed-send recovery and desktop-owned queue identities. These features keep their original controllers.

The runtime slider owns pointer drags and commits the final level on release, while retaining native range keyboard controls. The detail-panel picker closes with its owner so it cannot leave a native modal layer over the application.

Focus-preserving controls handle touch activation once without depending on a canceled compatibility click. Modal backdrop dismissal requires the press to begin outside; the opening touch cannot immediately dismiss its new modal. Queue toggles preserve the composer geometry through touch activation.

Composer width changes schedule height measurement in the next animation frame. This shared fix coalesces notifications and cancels pending work on unmount, preventing WebKit ResizeObserver delivery loops when the input expands or collapses. The generated Web snapshot is exported from the shared source; it is not edited manually. Desktop compilation remains deferred.

The adapter and history viewport preserve stable row keys, measured offscreen slots, reading anchors and
limited mounted rich content. They do not introduce another synchronization protocol or queue implementation.
The plan button appears only with a real plan; the interface does not expose Remodex-only protocol controls
that the current Remote AI connection cannot support. Browser approvals use accessible inline cards rather
than native iOS alerts. iPhone Safari/PWA cannot provide Remodex's native custom haptic feedback.

This is a TypeScript/CSS adaptation, not a SwiftUI runtime or installation of Remodex. Its Apache-2.0 source basis is
credited in source comments, this document, NOTICE-REMODEX.txt and the deployed third-party/remodex.txt; no Remodex artwork, icons, subscription mechanism or relay is
bundled. The layout adapts to phone drawers, tablet sheets and desktop rails/sidebars while retaining the
existing Remote AI application navigation and management pages.

## Build and hosting

Run `npm run check:personal` to validate and build. Existing dependencies and pinned vendor snapshots
are reused. The normal `npm run build` remains available without the personal theme or service worker.

The personal build defaults to:

- Web entry: `https://mengkaitao88.github.io/remoteai-web/`
- Backend: `https://codex.onepiper.cloud` (the API root, without `/web/`)
- Static base: `/remoteai-web/`

`VITE_API_BASE_URL`, `VITE_WEB_BASE_PATH` and `VITE_PUBLIC_WEB_URL` can override those public addresses.
They must never contain passwords, API keys or tokens. Login remains in the existing client; the
static host receives no backend credentials through the build. The public site serves application
files only. Users still need their own valid Remote AI login and an online paired computer.
Backend account synchronization and its credential behavior are unchanged by this UI task.

The personal GitHub repository's `Personal mobile Web` workflow builds and deploys the customization
branch using GitHub Pages. It is guarded against deployment from the upstream author's repository.
Publishing needs Pages configured with GitHub Actions and permission for the customization branch
in the `github-pages` environment. No paid cloud VM or custom domain is required by this setup.

## Install on a phone

Open the HTTPS entry in Safari on iPhone, use Share → Add to Home Screen, and enable Open as Web App
when offered. On Android, open the entry in a supporting browser and use Install app or Add to Home
screen. Log in using the same Remote AI cloud account as the computer. A separate origin has its own
login, local preferences and 2FA sync setting; browser-local settings do not migrate automatically.

The computer must remain online for live chats and computer tools. Mobile data works when the phone
can reach the backend and the paired computer's direct or relay connection. Web background execution
and notifications remain subject to the phone OS; this does not add native background services.

## Cache and updates

The service worker caches only the versioned application shell, never account APIs, login responses,
chat history, tokens, downloaded files or arbitrary same-origin requests. Offline shell availability
does not provide offline AI execution or guaranteed offline history. First installation requires a
successful download of the shell. An update waits for existing application windows to close before
activation, avoiding a forced reload during a running chat. Close all installed/browser windows and
reopen to activate a waiting update. The ordinary online build continues checking `version.json`.

The personal build removes the external Google Fonts import. A localized startup screen remains
available before JavaScript renders, with a retry action for a failed script download or startup.
Resource errors after a successful render do not cover the working app with that startup screen.
The retry handler is delegated before body markup arrives. Initialization waits for all fallback
children, including when HTML is streamed in pieces. Retry gives immediate feedback, removes only
this entry's public shell cache and worker registration, and navigates to a fresh entry URL. It leaves
local storage, authentication and chat data intact. Production smoke tests exercise an installed
manifest start URL with a failed entry script, then click Retry and verify recovery and saved preferences.

## Verification

Run npm run check:personal, npm test, npm run test:personal:e2e, npm run test:personal:pwa and
npm run test:personal:webkit sequentially. The build/test commands prepare a generated workspace;
concurrent preparations would interfere with each other. The ordinary npm run check remains supported.

The Web suite contains 66 Vitest cases plus two Node workspace cases. The shared helpers have six additional unit cases covering deferred/coalesced measurement, cancellation, touch/mouse/keyboard activation and duplicate-click suppression, including clicks retargeted to a different control after a layout change. The browser
matrix covers light/dark phones, a 320 px enlarged-font phone, a tablet sheet, WebKit and wide/narrow
Web desktop layouts. Mobile queue tests use real touch taps and require visible contents. Runtime
slider tests verify final drag/fast-mode values in the host fixture, not only the displayed label.
Deferred-history tests verify that process details load only when opened and retain the new thinking UI. Interleaved thinking/tool/commentary tests preserve chronology, and file-summary tests open the actual shared diff viewer.
Navigation tests verify native modal release when its owner closes or the application changes pages. A unit test verifies that a modal belongs to its own retained device workspace rather than the first workspace in the DOM.

The 1602-row, 10 Hz stress harness checks initial/mounted rich-node limits, stable settled Markdown,
input hit testing, typing, scrolling and click latency in Chromium and WebKit. The application tests
use a local fixture and bundled browsers, without real cloud credentials. The normal mobile composer
smoke check needed a warm retry after its existing 20-second development startup deadline; the same
prepared workspace then passed the UI assertions without changing the deadline.

Production PWA checks cover manifest installation, an offline public shell, retained local preferences,
and recovery from a failed entry script through Retry. WebKit checks cover light/dark startup and retry.
Screenshots and reports remain in test-results/; selected inspected running-interface evidence is kept
in the parent workspace's .artifacts/personal-mobile-web/remodex-v1/ delivery folder. These are fixture
screenshots, not screenshots from a real account. The source reference preview remains separate.

Physical iPhone/Android installation, actual paired-computer conversations and cellular-network behavior
still require device acceptance. This task does not compile desktop packages or run maintenance cleanup.
After the user accepts the Web edition, desktop compilation can proceed under the existing workflow.

The author's original entry remains https://codex.onepiper.cloud/web/. The personal edition is hosted
at https://mengkaitao88.github.io/remoteai-web/ and retains the existing Remote AI service connection.
