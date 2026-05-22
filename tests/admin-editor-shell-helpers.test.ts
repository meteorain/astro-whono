import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_EDITOR_DISPLAY_PREFERENCE,
  clampEditorSidePanelStackedRatio,
  getEditorBodyValueSyncReplacement,
  getEditorSidePanelLayout,
  getEditorSidePanelStackedRatioFromPointer,
  mergeEditorDisplayPreference,
  normalizeEditorBodyValue,
  readStoredEditorDisplayPreference,
  readStoredEditorSidePanelPreference,
  resolveEditorLayoutPreference,
  resolveEditorSidePanelPreference
} from '../src/components/admin/editor/editor-shell-helpers';
import {
  DEFAULT_MARKDOWN_HIGHLIGHT_THEME,
  MARKDOWN_HIGHLIGHT_THEME_OPTIONS,
  resolveMarkdownHighlightTheme
} from '../src/components/admin/editor/editor-markdown-highlight';
import {
  DEFAULT_ADMIN_EDITOR_DEFAULTS,
  parseAdminEditorDefaults,
  serializeAdminEditorDefaults
} from '../src/lib/admin-console/ui-prefs-keys';

describe('admin editor shell helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes editor body line endings to LF coordinates', () => {
    expect(normalizeEditorBodyValue('A\r\nB\rC\nD')).toBe('A\nB\nC\nD');
  });

  it('returns an editor value replacement only when external content differs after LF normalization', () => {
    expect(getEditorBodyValueSyncReplacement('A\nB', 'A\r\nB')).toBeNull();
    expect(getEditorBodyValueSyncReplacement('A\nB', 'A\r\nC')).toBe('A\nC');
  });

  it('derives side panel layout from outline and syntax intent', () => {
    expect(
      getEditorSidePanelLayout({
        outlineOpen: false,
        syntaxOpen: false,
        syntaxMaximized: false,
        available: true
      })
    ).toBe('none');
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: false,
        syntaxMaximized: false,
        available: true
      })
    ).toBe('outline');
    expect(
      getEditorSidePanelLayout({
        outlineOpen: false,
        syntaxOpen: true,
        syntaxMaximized: false,
        available: true
      })
    ).toBe('syntax');
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: true,
        syntaxMaximized: false,
        available: true
      })
    ).toBe('stacked');
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: true,
        syntaxMaximized: true,
        available: true
      })
    ).toBe('syntaxMaximized');
  });

  it('hides side panels when the editor width cannot support them', () => {
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: true,
        syntaxMaximized: true,
        available: false
      })
    ).toBe('none');
  });

  it('ignores maximized state when syntax is closed', () => {
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: false,
        syntaxMaximized: true,
        available: true
      })
    ).toBe('outline');
  });

  it('treats maximized syntax as a stacked-layout override only', () => {
    expect(
      getEditorSidePanelLayout({
        outlineOpen: false,
        syntaxOpen: true,
        syntaxMaximized: true,
        available: true
      })
    ).toBe('syntax');
  });

  it('reads legacy outline state as side panel preference with syntax closed', () => {
    const localStorage = {
      getItem: vi.fn(() => JSON.stringify({
        open: true,
        activeTab: 'headings'
      })),
      setItem: vi.fn()
    };
    vi.stubGlobal('window', { localStorage });

    expect(readStoredEditorSidePanelPreference('side-panel')).toEqual({
      outlineOpen: true,
      outlineActiveTab: 'headings',
      syntaxOpen: false
    });
  });

  it('resolves markdown highlight theme presets conservatively', () => {
    expect(MARKDOWN_HIGHLIGHT_THEME_OPTIONS.map((option) => option.id)).toEqual([
      'github',
      'nord',
      'onedark',
      'classic',
      'vivid'
    ]);
    expect(resolveMarkdownHighlightTheme('github')).toBe('github');
    expect(resolveMarkdownHighlightTheme('nord')).toBe('nord');
    expect(resolveMarkdownHighlightTheme('onedark')).toBe('onedark');
    expect(resolveMarkdownHighlightTheme('vivid')).toBe('vivid');
    expect(resolveMarkdownHighlightTheme('subtle')).toBe('github');
    expect(resolveMarkdownHighlightTheme('structured')).toBe('nord');
    expect(resolveMarkdownHighlightTheme('solarized')).toBe(DEFAULT_MARKDOWN_HIGHLIGHT_THEME);
    expect(resolveMarkdownHighlightTheme(null)).toBe(DEFAULT_MARKDOWN_HIGHLIGHT_THEME);
  });

  it('reads legacy display preferences with default markdown highlight theme', () => {
    const localStorage = {
      getItem: vi.fn(() => JSON.stringify({
        lineNumbers: true
      })),
      setItem: vi.fn()
    };
    vi.stubGlobal('window', { localStorage });

    expect(readStoredEditorDisplayPreference('display')).toEqual({
      lineNumbers: true,
      markdownHighlightTheme: DEFAULT_MARKDOWN_HIGHLIGHT_THEME
    });
  });

  it('falls back invalid markdown highlight theme in display preferences', () => {
    const localStorage = {
      getItem: vi.fn(() => JSON.stringify({
        lineNumbers: false,
        markdownHighlightTheme: 'solarized'
      })),
      setItem: vi.fn()
    };
    vi.stubGlobal('window', { localStorage });

    expect(readStoredEditorDisplayPreference('display')).toEqual(DEFAULT_EDITOR_DISPLAY_PREFERENCE);
  });

  it('rejects display preferences without a line number boolean', () => {
    const localStorage = {
      getItem: vi.fn(() => JSON.stringify({
        markdownHighlightTheme: 'nord'
      })),
      setItem: vi.fn()
    };
    vi.stubGlobal('window', { localStorage });

    expect(readStoredEditorDisplayPreference('display')).toBeNull();
  });

  it('merges editor display preferences without dropping unrelated fields', () => {
    expect(mergeEditorDisplayPreference({
      lineNumbers: true,
      markdownHighlightTheme: 'nord'
    }, {
      lineNumbers: false
    })).toEqual({
      lineNumbers: false,
      markdownHighlightTheme: 'nord'
    });

    expect(mergeEditorDisplayPreference({
      lineNumbers: true,
      markdownHighlightTheme: 'github'
    }, {
      markdownHighlightTheme: 'onedark'
    })).toEqual({
      lineNumbers: true,
      markdownHighlightTheme: 'onedark'
    });
  });

  it('parses admin editor defaults conservatively', () => {
    expect(parseAdminEditorDefaults(serializeAdminEditorDefaults({
      layout: 'stacked',
      outlineOpen: true,
      syntaxOpen: false
    }))).toEqual({
      layout: 'stacked',
      outlineOpen: true,
      syntaxOpen: false
    });
    expect(parseAdminEditorDefaults(JSON.stringify({
      layout: 'grid',
      outlineOpen: true,
      syntaxOpen: false
    }))).toBeNull();
    expect(parseAdminEditorDefaults('{bad json')).toBeNull();
  });

  it('keeps admin editor defaults ahead of explicit editor preferences', () => {
    expect(resolveEditorLayoutPreference('stacked', {
      ...DEFAULT_ADMIN_EDITOR_DEFAULTS,
      layout: 'split'
    })).toBe('split');

    expect(resolveEditorSidePanelPreference({
      outlineOpen: false,
      outlineActiveTab: 'essays',
      syntaxOpen: false
    }, {
      layout: 'split',
      outlineOpen: true,
      syntaxOpen: true
    })).toEqual({
      outlineOpen: true,
      outlineActiveTab: 'headings',
      syntaxOpen: true
    });
  });

  it('uses explicit editor preferences when admin editor defaults are missing', () => {
    expect(resolveEditorLayoutPreference('stacked', null)).toBe('stacked');

    expect(resolveEditorSidePanelPreference({
      outlineOpen: false,
      outlineActiveTab: 'essays',
      syntaxOpen: true
    }, null)).toEqual({
      outlineOpen: false,
      outlineActiveTab: 'essays',
      syntaxOpen: true
    });
  });

  it('uses admin editor defaults when no explicit editor preferences exist', () => {
    expect(resolveEditorLayoutPreference(null, {
      layout: 'stacked',
      outlineOpen: true,
      syntaxOpen: true
    })).toBe('stacked');

    expect(resolveEditorSidePanelPreference(null, {
      layout: 'split',
      outlineOpen: true,
      syntaxOpen: true
    })).toEqual({
      outlineOpen: true,
      outlineActiveTab: 'headings',
      syntaxOpen: true
    });
  });

  it('clamps stacked side panel ratios to usable bounds', () => {
    expect(clampEditorSidePanelStackedRatio(10, 1000)).toBe(20);
    expect(clampEditorSidePanelStackedRatio(90, 1000)).toBe(80);
    expect(clampEditorSidePanelStackedRatio(25, 300)).toBe(40);
    expect(clampEditorSidePanelStackedRatio(80, 300)).toBe(50);
  });

  it('derives stacked side panel ratio from pointer position', () => {
    expect(getEditorSidePanelStackedRatioFromPointer(100, 500, 350)).toBe(50);
    expect(getEditorSidePanelStackedRatioFromPointer(100, 500, 80)).toBe(24);
  });
});
