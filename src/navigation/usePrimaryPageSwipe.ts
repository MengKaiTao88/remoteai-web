import { useCallback } from 'react';
import { adjacentPage, type PrimaryPage, type SwipeProgress } from '../../../../shared/navigation/pageSwipe';
import { useDesktopLayout } from '../../../../shared/layout/useDesktopLayout';
import { swipeSurface } from '../../../../shared/navigation/swipeSurface';
import { useHorizontalSwipe } from '../../../../shared/navigation/useHorizontalSwipe';

const surface = (target: EventTarget | null) => swipeSurface(target, '.main-content', true);

export function usePrimaryPageSwipe(page: string, onChange: (page: PrimaryPage) => void, progress?: SwipeProgress,
  returnToChat = false) {
  const desktop = useDesktopLayout();
  const previous = returnToChat ? 'chat' : adjacentPage(page, 'right');
  const next = returnToChat ? undefined : adjacentPage(page, 'left');
  const onLeft = useCallback(() => { if (next) onChange(next); }, [next, onChange]);
  const onRight = useCallback(() => { if (previous) onChange(previous); }, [previous, onChange]);
  useHorizontalSwipe({ enabled: !desktop && page !== 'chat' && Boolean(next || previous), surface,
    onLeft: next ? onLeft : undefined, onRight: previous ? onRight : undefined, ...progress });
}
