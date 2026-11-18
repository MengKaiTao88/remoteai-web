import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { observeViewport } from '../../../../shared/chat/viewportObserver';
import { restoreVirtualScroll, type VirtualScrollAnchor } from '../../../../shared/chat/virtualScroll';

const ROW_ESTIMATE_PX = 96;
export const DshHistoryActiveContext = createContext(true);

function interacting(node: HTMLElement) {
  const selection = window.getSelection();
  return node.contains(document.activeElement)
    || !!node.querySelector('textarea, input, [contenteditable="true"], details[open], [aria-expanded="true"]')
    || !!document.querySelector('dialog[open], [aria-modal="true"]')
    || !!(selection && !selection.isCollapsed
      && (node.contains(selection.anchorNode) || node.contains(selection.focusNode)));
}

/** Start older rows as slots: mounting every rich row once can exhaust a phone before recycling starts. */
export function DshHistoryViewport({ children, initiallyVisible, enabled = true, estimatedHeight = ROW_ESTIMATE_PX }: {
  children: () => ReactNode; initiallyVisible: boolean; enabled?: boolean; estimatedHeight?: number;
}) {
  const active = useContext(DshHistoryActiveContext);
  const root = useRef<HTMLDivElement>(null);
  const supported = typeof IntersectionObserver !== 'undefined';
  const [visible, setVisible] = useState(initiallyVisible || !supported);
  const measuredHeight = useRef(estimatedHeight);
  const anchor = useRef<VirtualScrollAnchor | null>(null);
  const mounted = visible || !enabled || !supported;
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !active || !enabled || !supported) return;
    let observing = true;
    const stop = observeViewport(node, (next, snapshot) => {
      if (!observing || (!next && interacting(node))) return;
      anchor.current = snapshot;
      setVisible(next);
    });
    return () => { observing = false; stop(); anchor.current = null; };
  }, [active, enabled, supported]);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !active || !mounted) return;
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      // display:none reports zero geometry. Keep slots from collapsing and remounting the entire chat on return.
      if (bounds.width > 0) measuredHeight.current = bounds.height;
    };
    measure();
    if (anchor.current) { restoreVirtualScroll(anchor.current); anchor.current = null; }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, mounted]);
  return <div ref={root} data-viewport-content={mounted ? 'visible' : 'placeholder'}
    style={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%',
      height: mounted ? undefined : measuredHeight.current }}>
    {mounted && children()}
  </div>;
}
