import type { MarkdownOutlineItem } from '../../../lib/admin-console/editor-outline';

export {
  buildEssayOutlineListItems,
  extractMarkdownOutline,
  getMarkdownOutlineSelectionRange
} from '../../../lib/admin-console/editor-outline';

export type {
  EditorOutlineEssayListItem,
  EditorOutlineEssaySourceItem,
  EditorOutlineTab,
  MarkdownOutlineItem,
  MarkdownOutlineSelectionRange
} from '../../../lib/admin-console/editor-outline';

export type MarkdownOutlineJumpCommand = {
  id: number;
  item: MarkdownOutlineItem;
  targetOffsetRatio?: number;
};
