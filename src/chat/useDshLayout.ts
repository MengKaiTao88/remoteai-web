import { useLayoutEffect, useRef, useState } from 'react';
import { resolveDshLayout } from './dshLayout';

export function useDshLayout(sidebar: boolean, details: boolean) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const updateSize = (width: number, height: number) => {
      if (height) node.style.setProperty('--dsh-available-height', height + 'px');
      // Retained hidden device sessions keep their last visible geometry.
      if (width && height) setSize(current =>
        current.width === width && current.height === height ? current : { width, height });
    };
    updateSize(node.clientWidth, node.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { host, layout: resolveDshLayout({ ...size, sidebar, details }) };
}
