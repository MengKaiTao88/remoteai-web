import type { ImagePreviewOptions } from '../../../../shared/remote-chat/client/useChatImage';
import type { PreviewLoadOptions } from '../../../../shared/remote-chat/previewProgress';

export async function loadChatImage(
  load: ImagePreviewOptions['load'],
  legacyBridge: boolean,
  threadId: string,
  source: string,
  original?: boolean,
  options?: PreviewLoadOptions,
) {
  try {
    return await load(threadId, source, original, options);
  } catch (error) {
    // Older bridges can return the full image for a thumbnail request and exceed the
    // preview response limit. On explicit retry, use the existing bounded chunk transfer.
    if (!legacyBridge || original || !options?.refresh) throw error;
    return load(threadId, source, true, options);
  }
}
