import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, RotateCcw, X } from 'lucide-react';
import { t, displayText, displayError, useLanguage } from '../../../../shared/localization/browserClient';
import { EFFORT_LABELS, type ComposerSettings } from '../../../../shared/remote-chat/composer';
import { modelSelectionError, resolveModelSelection } from '../../../../shared/conversation/modelSelection';
import type { Model } from '../../../../shared/conversation/types';

interface Props {
  models: Model[]; selection: ComposerSettings; ready: boolean; settingsBusy: boolean;
  settingsError?: string; scope?: string | null; variant?: 'header' | 'footer';
  updateSettings: (patch: Partial<ComposerSettings>) => Promise<void>;
  refreshModels: () => Promise<void>; beforeOpen?: () => void;
}

/** DSH's model cards and effort capsule share one sheet, backed by the original controller. */
export function DshModelPicker(props: Props) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [settle, setSettle] = useState<{ model: string; effort: string }>();
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const current = resolveModelSelection(props.models, props.selection);
  const model = props.models.find(value => value.model === current.model);
  const name = model?.displayName || current.model || t('client.shared.chooseModel');
  const effort = displayText(EFFORT_LABELS[current.effort] || current.effort);
  const unavailable = modelSelectionError(props.models, current);
  const disabled = !props.ready || props.settingsBusy;
  const close = () => { setOpen(false); setSettle(undefined); };
  useEffect(() => { close(); }, [props.scope]);
  useEffect(() => {
    if (!open) return;
    sheet.current?.showModal();
    return () => { sheet.current?.close(); trigger.current?.focus(); };
  }, [open]);
  useEffect(() => {
    if (!open || !settle || disabled || props.settingsError
      || settle.model !== current.model || settle.effort !== current.effort) return;
    const timer = setTimeout(close, 300);
    return () => clearTimeout(timer);
  }, [open, settle, disabled, props.settingsError, current.model, current.effort]);
  const chooseModel = (entry: Model) => {
    if (disabled) return;
    setSettle(undefined);
    const supported = entry.supportedReasoningEfforts.some(value => value.reasoningEffort === current.effort);
    const next = resolveModelSelection([entry], { model: entry.model, effort: supported ? current.effort : '' });
    void props.updateSettings(next);
  };
  const chooseEffort = (value: string) => {
    if (disabled || !model) return;
    const next = { model: current.model, effort: value };
    setSettle(next);
    if (value !== current.effort) void props.updateSettings(next);
  };
  const shown = props.models.filter(entry => `${entry.displayName} ${entry.model}`.toLowerCase()
    .includes(query.trim().toLowerCase()));
  const dialog = open && <dialog ref={sheet} className="dsh-model-sheet" aria-label={t('client.shared.chooseModel')}
    onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientY < bounds.top || event.clientX < bounds.left || event.clientX > bounds.right) close();
    }}>
    <div className="dsh-sheet-handle" aria-hidden="true" />
    <header className="dsh-sheet-heading"><h2>{t('client.shared.chooseModel')}</h2>
      <button type="button" className="dsh-sheet-close" onClick={close} aria-label={t('client.projectBrowser.close')}><X size={18} /></button>
    </header>
    <div className="dsh-model-sheet-body">
      <p className="dsh-sheet-section">Codex</p>
      {props.models.length > 8 && <input className="dsh-model-search" value={query}
        placeholder={t('client.chat.searchModels')} aria-label={t('client.chat.searchModels')}
        onChange={event => setQuery(event.target.value)} />}
      <div className="dsh-model-grid" role="radiogroup" aria-label={t('client.shared.chooseModel')}>
        {shown.map(entry => <button key={entry.model} type="button" className="dsh-model-card" role="radio"
          aria-checked={current.model === entry.model} disabled={disabled} onClick={() => chooseModel(entry)}>
          <strong>{entry.displayName || entry.model}</strong>
          <span className="dsh-model-check">{current.model === entry.model && <Check size={14} />}</span>
        </button>)}
      </div>
      {!shown.length && <p>{t('client.chat.noModelsFound')}</p>}
      {!!model && model.supportedReasoningEfforts.length > 1 && <>
        <p className="dsh-sheet-section">{t('client.configLabels.reasoningEffort')}</p>
        <div className="dsh-effort-capsule" role="radiogroup" aria-label={t('client.shared.reasoningEffort')}>
          {model.supportedReasoningEfforts.map(value => <button type="button" key={value.reasoningEffort}
            role="radio" aria-checked={current.effort === value.reasoningEffort} disabled={disabled}
            onClick={() => chooseEffort(value.reasoningEffort)}>
            {displayText(EFFORT_LABELS[value.reasoningEffort] || value.reasoningEffort)}</button>)}
        </div>
      </>}
      {(props.settingsError || unavailable) && <p className="dsh-model-error" role="alert">
        {props.settingsError ? displayError(props.settingsError) : displayText(unavailable!)}</p>}
      <button className="dsh-model-refresh" type="button" disabled={disabled} onClick={() => { void props.refreshModels(); }}>
        <RotateCcw size={16} />{t('client.mobile.refreshModels')}</button>
    </div>
  </dialog>;
  return <>
    <button ref={trigger} type="button" className={'dsh-model-chip dsh-model-chip-' + (props.variant ?? 'header')}
      aria-label={t('client.chat.modelAndReasoningEffort.bae75e', { model: name, effort })}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => {
        props.beforeOpen?.(); setQuery(''); setOpen(true);
      }}><span className="dsh-model-chip-name">{name}</span>
      {!!effort && <span className="dsh-model-chip-effort"> · {effort}</span>}<ChevronDown size={16} /></button>
    {dialog && createPortal(dialog, trigger.current?.closest('.dsh-workspace') ?? document.body)}
  </>;
}
