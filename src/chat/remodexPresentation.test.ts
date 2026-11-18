import { expect, it } from 'vitest';
import { reasoningSections, reasoningText } from './remodexPresentation';

it('preserves preambles and independently collapsible summaries without inventing detail', () => {
  expect(reasoningSections('Preamble\n\n**Inspect**\nSource detail\n\n**Verify**')).toEqual([
    { id: '0', title: 'Inspect', detail: 'Preamble\n\nSource detail' },
    { id: '1', title: 'Verify', detail: '' },
  ]);
  expect(reasoningSections('Plain reasoning without summary anchors')).toEqual([]);
  expect(reasoningSections('')).toEqual([]);
});
it('does not treat headings inside fenced examples as new reasoning summaries', () => {
  const result = reasoningSections('**Inspect**\n```md\n**literal**\n# example\n```\n~~~\n**also literal**\n~~~\n**Verify**\nDone');
  expect(result.map(section => section.title)).toEqual(['Inspect', 'Verify']);
  expect(result[0].detail).toContain('**literal**\n# example');
  expect(result[0].detail).toContain('**also literal**');
});
it('coalesces adjacent streaming snapshots and keeps earlier section keys stable', () => {
  const before = reasoningSections('**Inspect**\nA\n**Inspect**\nAB\n**Verify**\n');
  const after = reasoningSections('**Inspect**\nA\n**Inspect**\nAB\n**Verify**\nMore detail');
  expect(before.map(section => section.detail)).toEqual(['AB', '']);
  expect(after.map(section => section.id)).toEqual(before.map(section => section.id));
  expect(reasoningSections('**Only summary**\n<!-- -->')[0].detail).toBe('');
});
it('keeps summary and reasoning text distinct', () => {
  expect(reasoningText({ id: 'r', type: 'reasoning', summary: ['**Inspect**'], text: 'Detail' }))
    .toBe('**Inspect**\n\nDetail');
});
