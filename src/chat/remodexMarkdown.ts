/**
 * Source-informed by Remodex StreamingMarkdownBlockSplitter (c06dcb1).
 * Cache complete simple blocks. Context-sensitive syntax keeps the rest of the document together.
 */
export function markdownBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let start = 0;
  let pending = false;
  let content = false;
  let fence: { marker: string; length: number } | undefined;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!fence && (/^(?: {4}|\t)/.test(line) || /^(?:[-+*]\s|\d+[.)]\s|>|<)/.test(trimmed)
      || /[\[\]$|]/.test(line) || /\\[()]/.test(line))) {
      if (pending) { blocks.push(lines.slice(start, index).join('\n')); start = index; }
      break;
    }
    if (fence) {
      if (new RegExp('^ {0,3}' + fence.marker + '{' + fence.length + ',}\\s*$').test(line)) fence = undefined;
      continue;
    }
    const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (trimmed) {
      if (pending) { blocks.push(lines.slice(start, index).join('\n')); start = index; pending = false; }
      if (delimiter) fence = { marker: delimiter[0], length: delimiter.length };
      content = true;
    } else if (content) pending = true;
  }
  blocks.push(lines.slice(start).join('\n'));
  return blocks;
}
