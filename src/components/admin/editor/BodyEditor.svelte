<script lang="ts">
import type { MarkdownToolbarCommand, MarkdownToolbarState, MarkdownToolId } from './markdown-tools';

type Props = {
  value: string;
  disabled?: boolean;
  bodyPersistEnabled?: boolean;
  toolbarCommand?: MarkdownToolbarCommand | null;
  onToolbarStateChange?: (state: MarkdownToolbarState) => void;
};

let {
  value = $bindable(''),
  disabled = false,
  bodyPersistEnabled = false,
  toolbarCommand = null,
  onToolbarStateChange
}: Props = $props();

let textareaEl: HTMLTextAreaElement | null = null;
let selectionStart = $state(0);
let selectionEnd = $state(0);
let appliedToolbarCommandId = 0;

const lineCount = $derived(value.length === 0 ? 1 : value.split(/\r\n|\r|\n/).length);
const charCount = $derived(value.length);

const updateSelectionState = () => {
  if (!textareaEl) return;
  selectionStart = textareaEl.selectionStart ?? 0;
  selectionEnd = textareaEl.selectionEnd ?? selectionStart;
};

const focusTextarea = () => {
  textareaEl?.focus();
};

const commitTextareaValue = (nextSelectionStart: number, nextSelectionEnd = nextSelectionStart) => {
  if (!textareaEl) return;
  value = textareaEl.value;
  textareaEl.setSelectionRange(nextSelectionStart, nextSelectionEnd);
  updateSelectionState();
  focusTextarea();
};

const getLineAt = (source: string, cursor: number): string => {
  const lineStart = source.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
  const lineEndIndex = source.indexOf('\n', cursor);
  const lineEnd = lineEndIndex === -1 ? source.length : lineEndIndex;
  return source.slice(lineStart, lineEnd);
};

const findSingleStarBefore = (source: string, cursor: number): number => {
  for (let index = cursor - 1; index >= 0; index -= 1) {
    if (source[index] !== '*') continue;
    if (source[index - 1] === '*' || source[index + 1] === '*') continue;
    return index;
  }
  return -1;
};

const findSingleStarAfter = (source: string, cursor: number): number => {
  for (let index = cursor; index < source.length; index += 1) {
    if (source[index] !== '*') continue;
    if (source[index - 1] === '*' || source[index + 1] === '*') continue;
    return index;
  }
  return -1;
};

const isWrappedBy = (source: string, before: string, after: string, start: number, end: number): boolean => {
  const left = source.lastIndexOf(before, start);
  if (left === -1) return false;
  const right = source.indexOf(after, end);
  if (right === -1 || right <= left) return false;
  return left + before.length <= start && end <= right;
};

const isInsideSingleStar = (source: string, start: number, end: number): boolean => {
  const left = findSingleStarBefore(source, start);
  if (left === -1) return false;
  const right = findSingleStarAfter(source, end);
  if (right === -1 || right <= left) return false;
  return left + 1 <= start && end <= right;
};

const isInsideLink = (source: string, start: number, end: number): boolean => {
  const left = source.lastIndexOf('[', start);
  if (left === -1) return false;
  const middle = source.indexOf('](', left);
  if (middle === -1) return false;
  const right = source.indexOf(')', middle);
  if (right === -1) return false;
  return start >= left + 1 && end <= right;
};

const createToolbarState = (source: string, start: number, end: number): MarkdownToolbarState => {
  const line = getLineAt(source, start);
  const taskList = /^\s*[-*+]\s+\[[ xX]\]\s+/.test(line);
  const bold = isWrappedBy(source, '**', '**', start, end);

  return {
    heading: /^\s*#{1,6}\s+/.test(line),
    bold,
    italic: !bold && isInsideSingleStar(source, start, end),
    quote: /^\s*>\s?/.test(line),
    link: isInsideLink(source, start, end),
    code: isWrappedBy(source, '`', '`', start, end),
    list: !taskList && /^\s*[-*+]\s+/.test(line),
    orderedList: /^\s*\d+\.\s+/.test(line),
    taskList
  };
};

const wrapSelection = (before: string, after: string, placeholder: string) => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  const selected = start === end ? placeholder : value.slice(start, end);
  const next = `${before}${selected}${after}`;
  const innerStart = start + before.length;
  const innerEnd = innerStart + selected.length;

  textareaEl.setRangeText(next, start, end, 'select');
  commitTextareaValue(innerStart, innerEnd);
};

const wrapBlockSelection = (before: string, after: string, placeholder: string) => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  const selected = start === end ? placeholder : value.slice(start, end);
  const previousChar = start > 0 ? value[start - 1] : '\n';
  const nextChar = end < value.length ? value[end] : '\n';
  const lead = previousChar === '\n' ? '' : '\n';
  const trail = nextChar === '\n' ? '' : '\n';
  const next = `${lead}${before}${selected}${after}${trail}`;
  const innerStart = start + lead.length + before.length;
  const innerEnd = innerStart + selected.length;

  textareaEl.setRangeText(next, start, end, 'select');
  commitTextareaValue(innerStart, innerEnd);
};

const toggleLinePrefix = (prefix: string) => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const segment = value.slice(lineStart, lineEnd);
  const lines = segment.split('\n');
  const shouldRemove = segment.length > 0 && lines.every((line) => line.length === 0 || line.startsWith(prefix));
  const next = lines
    .map((line) => {
      if (shouldRemove) return line.startsWith(prefix) ? line.slice(prefix.length) : line;
      return `${prefix}${line}`;
    })
    .join('\n');

  textareaEl.setRangeText(next, lineStart, lineEnd, 'select');
  commitTextareaValue(lineStart, lineStart + next.length);
};

const toggleOrderedList = () => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const segment = value.slice(lineStart, lineEnd);
  const lines = segment.split('\n');
  const shouldRemove = segment.length > 0 && lines.every((line) => line.length === 0 || /^\d+\.\s+/.test(line));
  const next = lines
    .map((line, index) => {
      if (shouldRemove) return line.replace(/^\d+\.\s+/, '');
      return `${index + 1}. ${line}`;
    })
    .join('\n');

  textareaEl.setRangeText(next, lineStart, lineEnd, 'select');
  commitTextareaValue(lineStart, lineStart + next.length);
};

const insertText = (text: string) => {
  if (!textareaEl) return;
  focusTextarea();

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? start;
  textareaEl.setRangeText(text, start, end, 'end');
  commitTextareaValue(start + text.length);
};

const applyMarkdownTool = (toolId: MarkdownToolId) => {
  if (disabled) return;

  switch (toolId) {
    case 'heading':
      toggleLinePrefix('## ');
      break;
    case 'bold':
      wrapSelection('**', '**', 'text');
      break;
    case 'italic':
      wrapSelection('*', '*', 'text');
      break;
    case 'code':
      wrapSelection('`', '`', 'code');
      break;
    case 'quote':
      toggleLinePrefix('> ');
      break;
    case 'link':
      wrapSelection('[', '](url)', 'text');
      break;
    case 'image':
      break;
    case 'codeBlock':
      wrapBlockSelection('```text\n', '\n```', 'code');
      break;
    case 'list':
      toggleLinePrefix('- ');
      break;
    case 'orderedList':
      toggleOrderedList();
      break;
    case 'taskList':
      toggleLinePrefix('- [ ] ');
      break;
    case 'table':
      insertText('\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n');
      break;
  }
};

$effect(() => {
  onToolbarStateChange?.(createToolbarState(value, selectionStart, selectionEnd));
});

$effect(() => {
  const command = toolbarCommand;
  if (!command || command.id === appliedToolbarCommandId) return;

  appliedToolbarCommandId = command.id;
  if (command.kind === 'insert') {
    insertText(command.text);
  } else {
    applyMarkdownTool(command.toolId);
  }
});
</script>

<section class="admin-editor-body" aria-label="Markdown body editor">
  <label class="admin-field admin-editor-body__field">
    <span class="admin-sr-only">Markdown 正文</span>
    <textarea
      class="admin-field__control admin-editor-body__textarea"
      name="body"
      bind:value
      bind:this={textareaEl}
      spellcheck="false"
      {disabled}
      onfocus={updateSelectionState}
      oninput={updateSelectionState}
      onkeyup={updateSelectionState}
      onmouseup={updateSelectionState}
      onselect={updateSelectionState}
    ></textarea>
  </label>

  <div class="admin-editor-body__meta">
    <span>{lineCount} lines</span>
    <span>{charCount} chars</span>
    {#if !bodyPersistEnabled}
      <span>当前上下文未启用正文写盘</span>
    {/if}
  </div>
</section>
