import type { Item } from '../../../../shared/conversation/types';
import { messageContent } from '../../../../shared/chat/messageDetails';

export interface ReasoningSection { id: string; title: string; detail: string }

/** Headings are only a presentation hint. Never interpret user content as protocol state. */
export function reasoningSections(text: string): ReasoningSection[] {
  const sections: ReasoningSection[] = [];
  let current: ReasoningSection | undefined;
  const preamble: string[] = [];
  let fence: { marker: string; length: number } | undefined;
  for (const line of text.trim().split('\n')) {
    const trimmed = line.trim();
    const delimiter = /^(`{3,}|~{3,})/.exec(trimmed)?.[1];
    const wasFenced = !!fence;
    if (delimiter && !fence) fence = { marker: delimiter[0], length: delimiter.length };
    else if (delimiter && fence && delimiter[0] === fence.marker && delimiter.length >= fence.length
      && new RegExp('^' + fence.marker + '+\\s*$').test(trimmed)) fence = undefined;
    const heading = !wasFenced && !delimiter
      ? /^(?:\*\*(.+?)\*\*|#{1,4}\s+(.+?))\s*$/.exec(trimmed) : null;
    if (heading) {
      current = { id: String(sections.length), title: (heading[1] ?? heading[2]).trim(), detail: '' };
      sections.push(current);
    } else if (current) current.detail += (current.detail ? '\n' : '') + line;
    else preamble.push(line);
  }
  if (sections.length && preamble.join('\n').trim()) {
    sections[0].detail = [preamble.join('\n').trim(), sections[0].detail].filter(Boolean).join('\n\n');
  }
  const result: ReasoningSection[] = [];
  for (const section of sections) {
    section.detail = section.detail.replace(/^\s*<!--\s*-->\s*$/gm, '').trim();
    const previous = result.at(-1);
    if (!previous || previous.title !== section.title) result.push(section);
    else if (!previous.detail || section.detail.includes(previous.detail)) previous.detail = section.detail;
    else if (section.detail && !previous.detail.includes(section.detail)) previous.detail += '\n\n' + section.detail;
  }
  return result;
}

export function reasoningText(item: Item) {
  return [...item.summary ?? [], messageContent(item)].filter(Boolean).join('\n\n');
}

/** Preserve protocol summary/detail fields before falling back to Markdown heading hints. */
export function itemReasoningSections(item: Item): ReasoningSection[] {
  const summary = (item.summary ?? []).filter(value => value.trim());
  const detail = messageContent(item).trim();
  const parsed = reasoningSections(reasoningText(item));
  if (parsed.length) return parsed;
  if (!summary.length || !detail || detail === summary.join('\n\n').trim()) return [];
  return summary.map((title, index) => ({ id: String(index), title,
    detail: index === summary.length - 1 ? detail : '' }));
}
