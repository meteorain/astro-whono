import { describe, expect, it } from 'vitest';
import {
  applyMarkdownToolbarCommandToText,
  applyMarkdownToolToText,
  insertMarkdownText,
  type MarkdownTextEdit
} from '../src/components/admin/editor/editor-markdown-transforms';

const expectMarkdownEdit = (
  source: string,
  edit: MarkdownTextEdit,
  expected: {
    value: string;
    selection: MarkdownTextEdit['selection'];
  }
) => {
  expect(`${source.slice(0, edit.from)}${edit.insert}${source.slice(edit.to)}`).toBe(expected.value);
  expect(edit.selection).toEqual(expected.selection);
};

describe('admin editor markdown transforms', () => {
  it('wraps empty and non-empty inline selections', () => {
    expectMarkdownEdit('Hello ', applyMarkdownToolToText('Hello ', { from: 6, to: 6 }, 'bold'), {
      value: 'Hello **text**',
      selection: { from: 8, to: 12 }
    });

    expectMarkdownEdit('Hello world', applyMarkdownToolToText('Hello world', { from: 6, to: 11 }, 'italic'), {
      value: 'Hello *world*',
      selection: { from: 7, to: 12 }
    });
  });

  it('applies and removes line prefixes across selected lines', () => {
    expectMarkdownEdit('One\nTwo', applyMarkdownToolToText('One\nTwo', { from: 0, to: 7 }, 'list'), {
      value: '- One\n- Two',
      selection: { from: 0, to: 11 }
    });

    expectMarkdownEdit('- One\n- Two', applyMarkdownToolToText('- One\n- Two', { from: 0, to: 11 }, 'list'), {
      value: 'One\nTwo',
      selection: { from: 0, to: 7 }
    });
  });

  it('sets heading levels while preserving shallow indentation', () => {
    const edit = applyMarkdownToolbarCommandToText('  ## Old', { from: 2, to: 8 }, {
      id: 1,
      kind: 'heading',
      level: 3
    });

    expectMarkdownEdit('  ## Old', edit, {
      value: '  ### Old',
      selection: { from: 0, to: 9 }
    });
  });

  it('inserts callouts and image markdown at the current selection', () => {
    const calloutEdit = applyMarkdownToolbarCommandToText('Intro', { from: 5, to: 5 }, {
      id: 1,
      kind: 'callout',
      calloutType: 'note'
    });

    expectMarkdownEdit('Intro', calloutEdit, {
      value: 'Intro\n:::note[标题]\n内容\n:::\n',
      selection: { from: 25, to: 25 }
    });

    expectMarkdownEdit('Intro outro', insertMarkdownText('Intro outro', { from: 6, to: 11 }, '![Alt](./image.webp)'), {
      value: 'Intro ![Alt](./image.webp)',
      selection: { from: 26, to: 26 }
    });
  });

  it('creates ordered lists using selected line order', () => {
    expectMarkdownEdit('One\nTwo\nThree', applyMarkdownToolToText('One\nTwo\nThree', { from: 0, to: 13 }, 'orderedList'), {
      value: '1. One\n2. Two\n3. Three',
      selection: { from: 0, to: 22 }
    });
  });
});
