import type {
  MarkdownCalloutType,
  MarkdownHeadingLevel,
  MarkdownToolbarCommand,
  MarkdownToolId
} from './markdown-tools';

type MarkdownCommandDispatcherOptions = {
  isBusy: () => boolean;
  onCommand: (command: MarkdownToolbarCommand) => void;
  onOpenImageInsert: () => void;
};

export type MarkdownCommandDispatcher = {
  applyCallout: (calloutType: MarkdownCalloutType) => void;
  applyHeading: (level: MarkdownHeadingLevel) => void;
  applyTool: (toolId: MarkdownToolId) => void;
  insertText: (text: string) => void;
};

export const createMarkdownCommandDispatcher = ({
  isBusy,
  onCommand,
  onOpenImageInsert
}: MarkdownCommandDispatcherOptions): MarkdownCommandDispatcher => {
  let commandId = 0;

  const nextCommandId = () => {
    commandId += 1;
    return commandId;
  };

  return {
    applyCallout: (calloutType) => {
      if (isBusy()) return;
      onCommand({ id: nextCommandId(), kind: 'callout', calloutType });
    },
    applyHeading: (level) => {
      if (isBusy()) return;
      onCommand({ id: nextCommandId(), kind: 'heading', level });
    },
    applyTool: (toolId) => {
      if (isBusy()) return;
      if (toolId === 'image') {
        onOpenImageInsert();
        return;
      }
      onCommand({ id: nextCommandId(), kind: 'tool', toolId });
    },
    insertText: (text) => {
      if (isBusy()) return;
      onCommand({ id: nextCommandId(), kind: 'insert', text });
    }
  };
};
