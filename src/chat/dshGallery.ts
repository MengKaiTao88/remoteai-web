import type { Item, Turn } from '../../../../shared/conversation/types';
import { conversationImages } from '../../../../shared/chat/imageGallerySources';

/** Immutable items need image discovery once, even in a still-running, very long turn. */
export function createDshGalleryProjector() {
  const candidates = new WeakMap<Item, boolean>();
  let previous: Turn[] = [];
  let byId = new Map<string, Turn>();
  return (turns: readonly Turn[]): Turn[] => {
    const next: Turn[] = [];
    for (const turn of turns) {
      const items = turn.items.filter(item => {
        let hasImages = candidates.get(item);
        if (hasImages === undefined) {
          hasImages = conversationImages([{ ...turn, items: [item] }]).length > 0;
          candidates.set(item, hasImages);
        }
        return hasImages;
      });
      if (!items.length) continue;
      const old = byId.get(turn.id);
      next.push(old && old.status === turn.status && old.items.length === items.length
        && old.items.every((item, index) => item === items[index]) ? old : { id: turn.id, status: turn.status, items });
    }
    if (previous.length === next.length && previous.every((turn, index) => turn === next[index])) return previous;
    previous = next;
    byId = new Map(next.map(turn => [turn.id, turn]));
    return next;
  };
}
