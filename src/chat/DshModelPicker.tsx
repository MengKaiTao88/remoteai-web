import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, RotateCcw, Zap } from 'lucide-react';
import { t, displayText, displayError, useLanguage } from '../../../../shared/localization/browserClient';
import { EFFORT_LABELS, type ComposerSettings } from '../../../../shared/remote-chat/composer';
import { modelSelectionError, resolveModelSelection } from '../../../../shared/conversation/modelSelection';
import type { Model } from '../../../../shared/conversation/types';
import { RemodexDialog } from './RemodexDialog';
import { FocusPreservingButton } from '../../../../shared/chat/FocusPreservingButton';

interface Props {
  models: Model[]; selection: ComposerSettings; ready: boolean; settingsBusy: boolean;
  settingsError?: string; scope?: string | null; variant?: 'header' | 'footer'; active?: boolean;
  updateSettings: (patch: Partial<ComposerSettings>) => Promise<void>;
  refreshModels: () => Promise<void>; beforeOpen?: () => void;
}
const EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

/** Source reference: Remodex ComposerRuntimeSliderOverlay; Remote AI owns confirmed settings. */
export function DshModelPicker(props: Props) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [listing, setListing] = useState(false);
  const [query, setQuery] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragging = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = resolveModelSelection(props.models, props.selection);
  const model = props.models.find(value => value.model === current.model);
  const name = model?.displayName || current.model || t('client.shared.chooseModel');
  const effortLabel = (value: string) => displayText(EFFORT_LABELS[value] || value);
  const effort = effortLabel(current.effort);
  const unavailable = modelSelectionError(props.models, current);
  const disabled = !props.ready || props.settingsBusy;
  const efforts = [...model?.supportedReasoningEfforts ?? []].sort((a, b) =>
    EFFORT_ORDER.indexOf(a.reasoningEffort) - EFFORT_ORDER.indexOf(b.reasoningEffort));
  const selectedIndex = Math.max(0, efforts.findIndex(value => value.reasoningEffort === current.effort));
  const shownIndex = dragIndex ?? selectedIndex;
  const shownEffort = efforts[shownIndex] ? effortLabel(efforts[shownIndex].reasoningEffort) : effort;
  const pointerIndex = (event: React.PointerEvent<HTMLInputElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - 30) / Math.max(1, box.width - 60);
    return Math.max(0, Math.min(efforts.length - 1, Math.round(ratio * (efforts.length - 1))));
  };
  const close = () => { setOpen(false); setListing(false); setDragIndex(null); dragging.current = false; };
  useEffect(close, [props.scope]);
  useEffect(() => { if (props.active === false) close(); }, [props.active]);
  const chooseModel = (entry: Model) => {
    if (disabled) return;
    const supported = entry.supportedReasoningEfforts.some(value => value.reasoningEffort === current.effort);
    void props.updateSettings(resolveModelSelection([entry], { model: entry.model,
      effort: supported ? current.effort : '' }));
    setListing(false);
  };
  const shown = props.models.filter(entry => (entry.displayName + ' ' + entry.model).toLowerCase()
    .includes(query.trim().toLowerCase()));
  return <>
    <FocusPreservingButton ref={trigger} type="button" className={'dsh-model-chip dsh-model-chip-' + (props.variant ?? 'header')}
      aria-label={t('client.chat.modelAndReasoningEffort.bae75e', { model: name, effort })}
      aria-haspopup="dialog" aria-expanded={open}
      onClick={() => {
        if (props.active === false) return;
        props.beforeOpen?.(); setQuery(''); setOpen(true);
        if (!props.models.length && props.ready) void props.refreshModels();
      }}><span className="dsh-model-chip-name">{name}</span>
      {!!effort && <span className="dsh-model-chip-effort">{effort}</span>}<ChevronRight size={12} /></FocusPreservingButton>
    {open && <RemodexDialog label={t('client.shared.chooseModel')} close={close} anchor={trigger.current}
      className={'dsh-model-sheet remodex-runtime ' + (listing ? 'is-listing' : '')}>
      {listing ? <>
        <h2>{t('client.shared.chooseModel')}</h2>
        {props.models.length > 8 && <input className="dsh-model-search" value={query}
          placeholder={t('client.chat.searchModels')} aria-label={t('client.chat.searchModels')}
          onChange={event => setQuery(event.target.value)} />}
        <div className="dsh-model-grid" role="radiogroup" aria-label={t('client.shared.chooseModel')}>
          {shown.map(entry => <button key={entry.model} type="button" className="dsh-model-card" role="radio"
            aria-checked={current.model === entry.model} disabled={disabled} onClick={() => chooseModel(entry)}>
            <strong>{entry.displayName || entry.model}</strong>
            <span className="dsh-model-check">{current.model === entry.model && <Check size={17} />}</span>
          </button>)}
        </div>
        {!shown.length && <p>{t('client.chat.noModelsFound')}</p>}
      </> : <div className="remodex-runtime-controls">
        <div className="remodex-runtime-heading">
          <button type="button" aria-label={t('client.chat.fastMode.6e02d1')}
            aria-pressed={props.selection.speed === 'fast'} disabled={disabled}
            onClick={() => { void props.updateSettings({ speed: props.selection.speed === 'fast' ? 'normal' : 'fast' }); }}>
            <Zap size={23} fill={props.selection.speed === 'fast' ? 'currentColor' : 'none'} /></button>
          <button type="button" className="remodex-model-list-trigger" onClick={() => setListing(true)}>
            <strong>{name}</strong><span>{effort}</span><ChevronRight size={16} /></button>
        </div>
        {props.settingsBusy && <p role="status" className="chat-muted">{t('client.projectBrowser.saving')}</p>}
        {efforts.length > 1 && <div className="remodex-effort-control">
          <div className="remodex-effort-track" style={{ '--effort-factor':
            shownIndex / (efforts.length - 1) } as React.CSSProperties}>
            <div className="remodex-effort-fill" /><div className="remodex-effort-dots" aria-hidden>
              {efforts.map(value => <i key={value.reasoningEffort} />)}</div>
            <input type="range" min={0} max={efforts.length - 1} step={1} value={shownIndex}
              aria-label={t('client.shared.reasoningEffort')} aria-valuetext={shownEffort} disabled={disabled}
              onPointerDown={event => {
                event.preventDefault(); dragging.current = true; setDragIndex(pointerIndex(event));
                event.currentTarget.focus({ preventScroll: true });
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={event => { if (dragging.current) setDragIndex(pointerIndex(event)); }}
              onPointerUp={event => {
                if (!dragging.current) return;
                event.preventDefault();
                const next = efforts[pointerIndex(event)];
                dragging.current = false; setDragIndex(null);
                if (next && next.reasoningEffort !== current.effort) void props.updateSettings({ effort: next.reasoningEffort });
              }}
              onPointerCancel={() => { dragging.current = false; setDragIndex(null); }}
              onChange={event => {
                const index = Number(event.target.value);
                if (!dragging.current && efforts[index]) void props.updateSettings({ effort: efforts[index].reasoningEffort });
              }} />
          </div>
          <div className="remodex-effort-labels">{efforts.map(value =>
            <span key={value.reasoningEffort}>{effortLabel(value.reasoningEffort)}</span>)}</div>
        </div>}
      </div>}
      {(props.settingsError || unavailable) && <p className="dsh-model-error" role="alert">
        {props.settingsError ? displayError(props.settingsError) : displayText(unavailable!)}</p>}
      {(!model || listing) && <button className="dsh-model-refresh" type="button" disabled={disabled}
        onClick={() => { void props.refreshModels(); }}>
        <RotateCcw size={16} />{t('client.mobile.refreshModels')}</button>}
    </RemodexDialog>}
  </>;
}
