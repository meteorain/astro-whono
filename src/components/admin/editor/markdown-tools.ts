export type MarkdownHeadingLevel = 2 | 3 | 4 | 5;
export type MarkdownCalloutType = 'note' | 'tip' | 'info' | 'warning';

export type MarkdownToolId =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'quote'
  | 'link'
  | 'image'
  | 'code'
  | 'codeBlock'
  | 'list'
  | 'orderedList'
  | 'taskList'
  | 'table';

export type MarkdownToolbarCommand =
  | {
      id: number;
      kind: 'tool';
      toolId: MarkdownToolId;
    }
  | {
      id: number;
      kind: 'heading';
      level: MarkdownHeadingLevel;
    }
  | {
      id: number;
      kind: 'callout';
      calloutType: MarkdownCalloutType;
    }
  | {
      id: number;
      kind: 'insert';
      text: string;
    };

export const buildMarkdownCalloutText = (calloutType: MarkdownCalloutType): string =>
  `\n:::${calloutType}[标题]\n内容\n:::\n`;
