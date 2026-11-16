# Personal mobile Web / PWA

This edition keeps Remote AI's existing application, authentication, transport and ChatController.
Only the personal Web/PWA GUI chat workspace uses a dedicated DSH-style React presentation.
Application navigation, accounts, 2FA, settings, devices and token summary retain their host UI.
The normal Web build and desktop/native packages keep their existing conversation presentation.

## Source basis and implementation

The reference is DSH Go revision
[`d46847ff2e0953d2035e0e6078be1e06dd7cbc40`](https://github.com/ccch1mneyyy/dsh-go/tree/d46847ff2e0953d2035e0e6078be1e06dd7cbc40).
The researched Flutter sources include `adaptive_layout.dart`, `chat_header.dart`, `composer.dart`,
`chat_rows.dart`, `chat_list.dart` and `model_sheet.dart`. The React code implements their layout and interaction rules:

- Compact layouts below 600 CSS px wide or 480 px high, medium layouts below 840 px, and expanded layouts.
- A phone drawer, medium bottom details sheet, 68 px rail, 320 px conversation sidebar and 320-420 px
  details panel. Navigation collapses when necessary to preserve the reading column.
- Floating header controls and model chip, 44 px header hit targets, a 28 px composer radius, glass
  surfaces and optional browser-supported superellipse corners.
- Successful process folding, three-adjacent-tool groups, stable row keys, visible interrupted/failed
  work, current approvals and original pending-message identities.
- Retained chat/composer nodes across shell transitions and existing DOM reading-anchor/following hooks.

`dshViewModel.ts` adapts Remote AI conversation entries and queue messages; it does not change the
protocol or recreate history synchronization. `DshChatWorkspace`, `DshMessages`, `DshComposer` and
`DshDetails` form the presentation. Original message, approval, editable-message, file/image, queue,
settings, terminal and tool components remain connected through `DshChatProviders` and ChatController.
Cached unchanged turns and memoized presentation rows limit unrelated streamed updates.

`DshModelPicker` follows the reference's `model_sheet.dart`: a bottom sheet with model cards and a
segmented effort capsule. The header and focused-composer pill share this picker. Remote AI's real
catalog and acknowledged settings remain authoritative; model provider management is not fabricated.
`DshComposerInput` uses the existing `useComposerState`, draft, attachment and menu hooks with a
dedicated presentation: one 48 px capsule at rest and two rows while editing, with 36 px end keys.
The history uses a bounded grid row above the composer, so live or long history cannot displace it.

This is an original TypeScript adaptation, with no copied Flutter source, DSH brands, mascot assets
or Android runtime. It does not introduce DSH's independent agent engine, phone automation or native
background services. The reference project's root license and file-specific notices are not treated
as permission to import its excluded artwork. Unsupported CSS corner shapes use ordinary round corners.

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

Use `npm run check:personal`, `npm test`, `npm run test:personal:e2e`,
`npm run test:personal:pwa` and `npm run test:personal:webkit` sequentially. The commands prepare a
generated workspace; concurrent preparations would interfere with one another.
Browser tests use a local fixture, bundled Chromium and bundled WebKit, without real cloud credentials.
The matrix covers light/dark phones, a 320 px enlarged-font phone, a tablet sheet, WebKit and wide/narrow
desktop layouts. Screenshots and reports are retained in `test-results/` and selected evidence is kept
in the parent workspace's `.artifacts/personal-mobile-web/` delivery folder.
Physical iPhone/Android installation, real paired-computer use and cellular-network behavior still
require device acceptance; browser engine tests do not establish those outcomes.

Local verification on 2026-11-16 passed the personal type/build/i18n/provenance checks, two Node
workspace tests, 41 Vitest tests, 21 personal browser journeys and production PWA/WebKit recovery checks.
The ordinary Web relay journey passed on desktop and mobile; its mobile dev-server cold start exceeded
the existing 20-second navigation deadline and needed a warm retry. No application assertion was removed.

To return to the author's interface, open `https://codex.onepiper.cloud/web/`. The two entry points
are independent; this edition cannot replace the author's hosted files.
