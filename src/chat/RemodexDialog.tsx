import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ConfigProvider } from 'antd';
import { OverlayContainerContext } from '../../../../shared/layout/overlayContainer';
import { X } from 'lucide-react';
import { t } from '../../../../shared/localization/browserClient';

/** Keep the owner mounted; release the native modal layer on navigation and unmount. */
export function RemodexDialog({ label, children, close, className = '', anchor, presentation }: {
  label: string; children: ReactNode; close: () => void; className?: string; anchor?: Element | null;
  presentation?: string;
}) {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const backdropPress = useRef(false);
  const owner = useRef(document.activeElement);
  useEffect(() => {
    if (!dialog) return;
    dialog.showModal();
    dialog?.focus();
    return () => {
      dialog?.close();
      const previous = owner.current;
      if (previous instanceof HTMLElement && previous.isConnected && previous.getClientRects().length) previous.focus();
    };
  }, [dialog]);
  return createPortal(<dialog ref={setDialog} tabIndex={-1} className={'remodex-dialog ' + className} aria-label={label}
    data-presentation={presentation}
    onCancel={event => { event.preventDefault(); close(); }} onPointerDown={event => {
      const box = event.currentTarget.getBoundingClientRect();
      backdropPress.current = event.target === event.currentTarget && (event.clientX < box.left
        || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
    }} onPointerCancel={() => { backdropPress.current = false; }} onClick={event => {
      // A touch that opens this modal must not become its backdrop dismissal click.
      const outsideStart = backdropPress.current;
      backdropPress.current = false;
      if (!outsideStart) return;
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top
        || event.clientY > box.bottom) close();
    }}>
    <button type="button" className="remodex-dialog-close" aria-label={t('client.projectBrowser.close')}
      onClick={close}><X size={18} /></button>
    <OverlayContainerContext.Provider value={dialog}>
      <ConfigProvider getPopupContainer={node => dialog ?? node?.parentElement ?? document.body}>
        {children}
      </ConfigProvider>
    </OverlayContainerContext.Provider>
  </dialog>, anchor?.closest('.dsh-workspace')
    ?? owner.current?.closest('.dsh-workspace') ?? document.body);
}
