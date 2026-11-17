import { expect, it } from 'vitest';
import { markdownBlocks } from './remodexMarkdown';

it('keeps settled blocks byte-identical while the tail streams', () => {
  const text = '# Result\n\nFirst paragraph.\n\nStreaming';
  expect(markdownBlocks(text)).toEqual(['# Result\n', 'First paragraph.\n', 'Streaming']);
  expect(markdownBlocks(text + ' more').slice(0, -1)).toEqual(markdownBlocks(text).slice(0, -1));
});
it('does not split open or closed fenced code at its blank lines', () => {
  expect(markdownBlocks('Intro\n\n```ts\na\n\nb')).toEqual(['Intro\n', '```ts\na\n\nb']);
  expect(markdownBlocks('Intro\n\n~~~~md\na\n\n~~~\nb\n~~~~\n\nTail'))
    .toEqual(['Intro\n', '~~~~md\na\n\n~~~\nb\n~~~~\n', 'Tail']);
});
it.each([
  '- First\n\n  Continued list\n\n- Second', '> Quoted\n\n> Continued',
  '[reference][id]\n\n[id]: https://example.test', '    indented\n\n    more code',
  '$$\na\n\nb\n$$', '| a | b |\n|---|---|\n| 1 | 2 |', '<details>\n\nbody\n\n</details>',
])('keeps context-dependent Markdown together: %s', tail => {
  expect(markdownBlocks('Intro\n\n' + tail)).toEqual(['Intro\n', tail]);
});
