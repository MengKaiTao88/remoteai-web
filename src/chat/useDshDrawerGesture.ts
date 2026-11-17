import { useEffect, useRef, type RefObject } from 'react';

export function useDshDrawerGesture(input: {
  host: RefObject<HTMLElement>; enabled: boolean; open: boolean; onChange: (open: boolean) => void;
}) {
  const current = useRef(input);
  current.current = input;
  useEffect(() => {
    const root = input.host.current;
    if (!root || !input.enabled) return;
    let gesture: { x: number; y: number; open: boolean; dx: number; locked: boolean } | undefined;
    const reset = () => {
      gesture = undefined;
      delete root.dataset.drawerDragging;
      root.style.removeProperty('--dsh-drag-offset');
      root.style.removeProperty('--dsh-drag-progress');
    };
    const start = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.touches.length !== 1 || !target?.closest('.dsh-message-region, .dsh-sidebar')
        || target.closest('textarea,input,pre,code,video,table,.chat-table-viewport,[data-no-swipe]')) return;
      const point = event.touches[0];
      gesture = { x: point.clientX, y: point.clientY, dx: 0, open: current.current.open, locked: false };
    };
    const move = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - gesture.x;
      const dy = event.touches[0].clientY - gesture.y;
      if (!gesture.locked) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { reset(); return; }
        if (Math.abs(dx) < 20 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if ((!gesture.open && dx < 0) || (gesture.open && dx > 0)) { reset(); return; }
        if (window.getSelection()?.isCollapsed === false) { reset(); return; }
        gesture.locked = true;
        current.current.onChange(true);
      }
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      gesture.dx = dx;
      const width = Math.min(320, root.clientWidth * .88);
      const offset = Math.max(0, Math.min(width, (gesture.open ? width : 0) + dx));
      root.dataset.drawerDragging = 'true';
      root.style.setProperty('--dsh-drag-offset', offset + 'px');
      root.style.setProperty('--dsh-drag-progress', String(offset / width));
    };
    const end = () => {
      if (gesture?.locked) {
        const threshold = Math.min(80, root.clientWidth * .2);
        current.current.onChange(gesture.open ? gesture.dx > -threshold : gesture.dx > threshold);
      }
      reset();
    };
    const cancel = () => { if (gesture?.locked) current.current.onChange(gesture.open); reset(); };
    root.addEventListener('touchstart', start, { capture: true, passive: true });
    root.addEventListener('touchmove', move, { capture: true, passive: false });
    root.addEventListener('touchend', end, { capture: true });
    root.addEventListener('touchcancel', cancel, { capture: true });
    return () => {
      root.removeEventListener('touchstart', start, true);
      root.removeEventListener('touchmove', move, true);
      root.removeEventListener('touchend', end, true);
      root.removeEventListener('touchcancel', cancel, true);
      reset();
    };
  }, [input.host, input.enabled]);
}
