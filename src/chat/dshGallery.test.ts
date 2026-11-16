import { expect, it } from 'vitest';
import { createDshGalleryProjector } from './dshGallery';
import { conversationImages } from '../../../../shared/chat/imageGallerySources';
import type { Turn } from '../../../../shared/conversation/types';

it('preserves image navigation from markdown, tools and deferred process results', () => {
  const turns: Turn[] = [{ id: 'live', status: 'inProgress', items: [
    { id: 'text', type: 'agentMessage', text: '[source](https://example.test/source.ts)' },
    { id: 'image', type: 'agentMessage', text: '![preview](https://example.test/preview.png)' },
    { id: 'tool', type: 'mcpToolCall', result: { content: [{ type: 'image', mimeType: 'image/png', data: 'AA==' }] } },
    { id: 'process', type: 'commandExecution', processOutputs: [
      { id: 'generated', type: 'agentMessage', text: '![result](https://example.test/result.png)' },
    ] },
  ] }];
  const projected = createDshGalleryProjector()(turns);
  expect(projected[0].items.map(item => item.id)).toEqual(['image', 'tool', 'process']);
  expect(conversationImages(projected).map(image => image.source)).toEqual([
    'https://example.test/preview.png', 'data:image/png;base64,AA==', 'https://example.test/result.png',
  ]);
});

it('keeps the gallery stable while unrelated text streams and updates replaced image items', () => {
  const project = createDshGalleryProjector();
  const image = { id: 'image', type: 'agentMessage', text: '![one](https://example.test/one.png)' };
  const turn: Turn = { id: 'live', status: 'inProgress', items: [image,
    { id: 'stream', type: 'agentMessage', text: '[source](https://example.test/source.ts)' }] };
  const before = project([turn]);
  expect(project([{ ...turn, items: [image, { ...turn.items[1], text: 'new streamed text' }] }])).toBe(before);
  const updated = project([{ ...turn, items: [{ ...image, text: '![two](https://example.test/two.png)' }] }]);
  expect(conversationImages(updated).map(entry => entry.source)).toEqual(['https://example.test/two.png']);
  expect(project([{ ...turn, items: [{ ...image, text: 'image removed' }] }])).toEqual([]);
});
