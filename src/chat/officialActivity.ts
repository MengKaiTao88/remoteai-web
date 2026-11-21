import type { Item } from '../../../../shared/conversation/types';
import { isCollaborationActivity } from '../../../../shared/conversation/collaborationActivity';
import { activityStatus } from '../../../../shared/conversation/itemStatus';
import { hasVisibleProcessContent } from '../../../../shared/chat/processContent';

export type ActivityCategory =
  | 'read' | 'list' | 'search' | 'command' | 'web' | 'browser' | 'integration' | 'chats' | 'tool' | 'files'
  | 'agent' | 'plan' | 'image' | 'review' | 'context' | 'wait' | 'error' | 'other';

export function integrationActivity(item: Item) {
  if (item.type === 'mcpToolCall' && item.server) {
    return { server: item.server, title: item.name || item.tool };
  }
  // The desktop gateway also sends integration labels as “server · tool”.
  if (item.type === 'dynamicToolCall') {
    const label = item.tool?.match(/^([a-z][\w-]*) · (.+)$/iu);
    if (label) return { server: label[1], title: label[2] };
  }
}

function integrationCategory(item: Item): ActivityCategory {
  const tool = integrationActivity(item);
  if (tool?.server === 'chrome' || tool?.server === 'browser') return 'browser';
  if (tool?.server === 'codex_app' && (item.tool === 'list_threads' || tool.title === 'list_threads')) return 'chats';
  return tool ? 'integration' : 'tool';
}

export function activityCategory(item: Item): ActivityCategory {
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
    case 'mcpToolCall': return integrationCategory(item);
    case 'dynamicToolCall': {
      // Older Desktop bridges send these activities with only their gateway title.
      if (item.tool === '文件变更') return 'files';
      if (item.tool === '图片预览') return 'image';
      if (item.tool === 'sleep') return 'wait';
      if (item.tool === 'webSearch') return 'web';
      return integrationCategory(item);
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

const GROUPABLE = new Set<ActivityCategory>([
  'read', 'list', 'search', 'command', 'web', 'browser', 'integration', 'chats', 'tool', 'files',
]);

/** Activities can share a group across tool types. Explanations and independent events end that group. */
export function processEntries(items: readonly Item[]): ProcessEntry[] {
  const entries: ProcessEntry[] = [];
  for (const item of items) {
    if (item.type === 'reasoning' || !hasVisibleProcessContent(item)) continue;
    // Codex Desktop keeps sleep events in the turn data but omits them from
    // the visible process timeline. Keep the surrounding activities together
    // so the Web timeline follows that presentation and preserves order.
    const category = activityCategory(item);
    if (category === 'wait') continue;
    if (GROUPABLE.has(category)) {
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
