# Personal mobile Web / PWA

This edition keeps Remote AI's existing application and transports. Its mobile chat presentation is
inspired by DSH Go's floating controls, rounded composer and compact activity/file cards, implemented
independently in CSS. It includes none of DSH Go's code, brands, mascot assets or Android runtime.
Application navigation, accounts, 2FA, settings and wide-screen desktop layouts retain their host UI.

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

To return to the author's interface, open `https://codex.onepiper.cloud/web/`. The two entry points
are independent; this edition cannot replace the author's hosted files.
