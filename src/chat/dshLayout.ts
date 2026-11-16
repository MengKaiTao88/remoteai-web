export type DshSizeClass = 'compact' | 'medium' | 'expanded';
export interface DshLayout {
  sizeClass: DshSizeClass;
  left: 'none' | 'rail' | 'sidebar';
  detail: 'page' | 'sheet' | 'panel';
  detailWidth: number;
}

/** Reading width takes precedence over persistent navigation and details. */
export function resolveDshLayout(input: {
  width: number; height: number; sidebar: boolean; details: boolean;
}): DshLayout {
  const { width, height, sidebar, details } = input;
  const sizeClass = height < 480 || width < 600 ? 'compact' : width < 840 ? 'medium' : 'expanded';
  if (sizeClass !== 'expanded') return {
    sizeClass, left: 'none', detail: sizeClass === 'compact' ? 'page' : 'sheet', detailWidth: 0,
  };
  const ideal = Math.max(360, Math.min(420, Math.round(width * .3 / 4) * 4));
  const detailWidth = Math.min(ideal, width - 68 - 400);
  const panel = details && detailWidth >= 320;
  const sidebarFits = width - 320 - (panel ? detailWidth : 0) >= 600;
  return { sizeClass, left: sidebar && sidebarFits ? 'sidebar' : 'rail',
    detail: detailWidth >= 320 ? 'panel' : 'sheet', detailWidth: Math.max(0, detailWidth) };
}
