import type { Item } from '../../../../shared/conversation/types';
import { isCollaborationActivity } from '../../../../shared/conversation/collaborationActivity';
import { activityStatus } from '../../../../shared/conversation/itemStatus';
import { hasVisibleProcessContent } from '../../../../shared/chat/processContent';

export type ActivityCategory =
  | 'read' | 'list' | 'search' | 'command' | 'web' | 'integration' | 'chats' | 'tool' | 'files'
  | 'agent' | 'plan' | 'image' | 'review' | 'context' | 'wait' | 'error' | 'other';

export function activityCategory(item: Item, official = false): ActivityCategory {
  if (isCollaborationActivity(item)) return 'agent';
  switch (item.type) {
    case 'commandExecution': {
      const actions = item.commandActions?.map(action => action.type) ?? [];
      if (actions.length && actions.every(action => action === actions[0])) {
        if (actions[0] === 'read') return 'read';
        if (actions[0] === 'listFiles' || actions[0] === 'list_files') return 'list';
        if (actions[0] === 'search') return 'search';
      }
      return 'command';
    }
    case 'fileChange': return 'files';
    case 'webSearch': return 'web';
    case 'mcpToolCall': {
      if (official && item.server === 'codex_app' && item.tool === 'list_threads') return 'chats';
      return item.server ? 'integration' : 'tool';
    }
    case 'dynamicToolCall': {
      // Older Desktop bridges send these activities with only their gateway title.
      if (official && item.tool === '文件变更') return 'files';
      if (official && item.tool === 'codex_app · list_threads') return 'chats';
      return 'tool';
    }
    case 'functionCallOutput': return 'tool';
    case 'plan': return 'plan';
    case 'imageGeneration':
    case 'imageView': return 'image';
    case 'enteredReviewMode':
    case 'exitedReviewMode': return 'review';
    case 'contextCompaction': return 'context';
    case 'sleep': return 'wait';
    case 'error': return 'error';
    default: return 'other';
  }
}

export type ProcessEntry =
  | { kind: 'group'; id: string; items: Item[] }
  | { kind: 'standalone'; id: string; item: Item };

const GROUPABLE = new Set<ActivityCategory>(['read', 'list', 'search', 'command', 'web', 'integration', 'chats', 'tool', 'files']);

/** Activities can share a group across tool types. Explanations and independent events end that group. */
export function processEntries(items: readonly Item[], official = false): ProcessEntry[] {
  const entries: ProcessEntry[] = [];
  for (const item of items) {
    if ((official && item.type === 'reasoning') || !hasVisibleProcessContent(item)) continue;
    if (GROUPABLE.has(activityCategory(item, official))) {
      const previous = entries.at(-1);
      if (previous?.kind === 'group') previous.items.push(item);
      else entries.push({ kind: 'group', id: item.id, items: [item] });
    } else entries.push({ kind: 'standalone', id: item.id, item });
  }
  return entries;
}

/** Compact history references and in-progress operations may gain more details later. */
export function canInspectActivity(item: Item): boolean {
  return Boolean(item.detailsRef || item.command || item.commandPreview || item.aggregatedOutput
    || item.exitCode != null || item.changes?.length || item.query || item.action || item.results?.length
    || item.arguments != null || item.result != null || item.error != null || item.output != null
    || item.failure?.message || item.contentItems?.length || item.content?.length || item.summary?.length
    || item.progress?.length || item.text || item.prompt || item.agentsStates || item.agentStatus
    || item.review || item.imageUrl || item.path || item.savedPath || item.durationMs != null
    || item.type === 'contextCompaction');
}

export function processActivityStatus(item: Item, live: boolean): string | undefined {
  if (item.success === false) return 'failed';
  const status = activityStatus(item);
  return status === 'inProgress' && !live ? undefined : status;
}
