# Personal chat layout and reliability

The personal GUI workspace adapts assistant-ui's ChatGPT demo at revision
8f30cfc76b6e1483cc390a293eafc4d8fffb2bcd. Its React runtime and cloud services are not
installed. Remote AI remains the single owner of authentication, transport, thread
identity, history paging, drafts, queue operations and actual execution.

Remodex revision c06dcb16a7059603a41e26a2cb4a81b6d4b5514d informs reasoning sections,
chronological task records, runtime controls and task-card presentation. These are
browser adaptations, not a bundled native runtime or a claim of official iOS parity.
Source notices and licenses are retained in this repository.

## Presentation boundary

Only the personal GUI chat imports assistantChat.css. The entry point separates shell,
composer, message/task content and dialogs. Earlier overlapping DSH and Remodex style
sheets are removed. Management pages keep their existing Remote AI appearance.
Shared task-card presentation and step-by-step questions are opt-in for this surface.

- The existing composer DOM remains mounted while focus, menus and layout change.
- The model/effort chip and context ring remain available when the input is empty.
- WebKit placeholder measurement no longer adds an unintended empty line.
- The add menu scrolls within a short viewport. Table gestures do not open the sidebar.
- User actions appear on focus, right-click or touch long-press without reserving a blank row.
- One process aggregate reveals chronological reasoning, commentary and executions.
- Reasoning summary and content deltas retain their separate indices and fields.
- Nonzero exits and cancelled work retain failure/stopped semantics in lightweight history.
- Context/settings sheets and pickers opened inside native dialogs share the same modal container.
- Per-chat drafts retain text, skill mentions, images, files and quotes while this workspace is mounted.
  New drafts retain their cache identity after thread creation; acknowledged sends clear only their source draft.
  This change does not introduce persistence across reloads or app restarts.

## Image handling

Sent and assistant image blocks use the existing scoped image loader. Explicit retry
requests fresh online previews after a decode failure instead of reusing the same
completed cache entry. Offline behavior and authenticated per-thread file access remain.
Markdown image links, tool images and generated-image results keep their existing loaders.
Missing originals without a retained copy cannot be reconstructed by the Web client.

The official desktop bridge has separate attachment projection and archived-file routing.
Those changes require a subsequent desktop release; deploying Web alone does not replace
the installed bridge. The user requested Web acceptance before the full desktop build.

## Verification

Meaningful regressions cover reasoning deltas, process identity, failure summaries,
per-chat drafts and stale sends; browser tests exercise image decoding/retry, short
viewports, nested modal controls, questions, approvals, queues, history anchors and
sustained long-history updates. The browser matrix includes bundled Chromium and
WebKit, light/dark phones, enlarged narrow layouts, tablet and wide/narrow desktop Web.
Physical iPhone keyboard, safe-area behavior and long-running PWA usage still require
real-device acceptance. No live user message is sent by these fixtures.
