import { expect, it, vi } from 'vitest';
import { PreviewDownloads, type PreviewTask, type PreviewBackend } from '../../../../shared/remote-chat/previewDownloads';

it('refreshes a completed online preview after decode failure while retaining offline recovery', async () => {
  let ready = true;
  const tasks: PreviewTask[] = [{ id: 'cached', source: { owner: 'account', deviceId: 'computer', deviceName: 'PC',
    scope: 'project', threadId: 'thread', path: '/picture.png', preview: 'thumbnail' }, status: 'ready',
    size: 100, received: 100, createdAt: Date.now(), message: '' }];
  const backend: PreviewBackend<PreviewTask> = {
    initialize: async () => {}, snapshot: () => tasks, subscribe: () => () => {}, error: () => '',
    connection: () => ({ owner: 'account', deviceId: 'computer', deviceName: 'PC', ready }),
    enqueue: vi.fn(async source => {
      const id = 'fresh-' + tasks.length;
      tasks.push({ ...tasks[0], id, source, createdAt: Date.now() });
      return id;
    }),
    resume: async () => {}, remove: async () => {}, image: async task => task.id,
    text: async () => '', save: async () => {},
  };
  const previews = new PreviewDownloads(backend, { owner: 'account', deviceId: 'computer' });
  expect(await previews.image('thread', '/picture.png', false)).toBe('cached');
  expect(backend.enqueue).not.toHaveBeenCalled();
  expect(await previews.image('thread', '/picture.png', false, { refresh: true })).toBe('fresh-1');
  expect(backend.enqueue).toHaveBeenCalledTimes(1);
  ready = false;
  expect(await previews.image('thread', '/picture.png', false, { refresh: true })).toBeTruthy();
  expect(backend.enqueue).toHaveBeenCalledTimes(1);
  previews.dispose();
});
