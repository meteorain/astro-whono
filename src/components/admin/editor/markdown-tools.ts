export type MarkdownToolId =
  | 'heading'
  | 'bold'
  | 'italic'
  | 'quote'
  | 'link'
  | 'image'
  | 'code'
  | 'codeBlock'
  | 'list'
  | 'orderedList'
  | 'taskList'
  | 'table';

export type MarkdownToolbarState = {
  heading: boolean;
  bold: boolean;
  italic: boolean;
  quote: boolean;
  link: boolean;
  code: boolean;
  list: boolean;
  orderedList: boolean;
  taskList: boolean;
};

export type MarkdownToolbarCommand =
  | {
      id: number;
      kind: 'tool';
      toolId: MarkdownToolId;
    }
  | {
      id: number;
      kind: 'insert';
      text: string;
    };

export const createEmptyMarkdownToolbarState = (): MarkdownToolbarState => ({
  heading: false,
  bold: false,
  italic: false,
  quote: false,
  link: false,
  code: false,
  list: false,
  orderedList: false,
  taskList: false
});

export const isToggleMarkdownTool = (toolId: MarkdownToolId): boolean =>
  !['image', 'codeBlock', 'table'].includes(toolId);
