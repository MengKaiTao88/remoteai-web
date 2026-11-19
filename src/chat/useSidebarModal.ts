import { useLayoutEffect, type RefObject } from 'react';

/** Match assistant-ui's mobile sheet boundary without replacing Remote AI's retained workspace. */
export function useSidebarModal(host: RefObject<HTMLElement>, open: boolean, panel = '.dsh-sidebar') {
  useLayoutEffect(() => {
    const root = host.current;
    const sidebar = root?.querySelector<HTMLElement>(panel);
    if (!root || !sidebar || !open) return;
    const previous = document.activeElement;
    const background = [...root.children].filter((node): node is HTMLElement => node instanceof HTMLElement
      && !node.contains(sidebar) && !node.classList.contains('dsh-sidebar-scrim'));
    const saved = background.map(node => ({ node, inert: node.inert, hidden: node.getAttribute('aria-hidden') }));
    for (const { node } of saved) { node.inert = true; node.setAttribute('aria-hidden', 'true'); }
    const buttons = () => [...sidebar.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])',
    )].filter(node => node.getClientRects().length > 0 && !node.closest('[hidden],[inert]'));
    buttons()[0]?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !sidebar.contains(event.target as Node)) return;
      const entries = buttons();
      const first = entries[0];
      const last = entries.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    sidebar.addEventListener('keydown', trap);
    return () => {
      sidebar.removeEventListener('keydown', trap);
      for (const { node, inert, hidden } of saved) {
        node.inert = inert;
        if (hidden === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', hidden);
      }
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [host, open, panel]);
}
