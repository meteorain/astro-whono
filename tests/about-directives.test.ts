import { describe, expect, it } from 'vitest';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';
import { rehypeAboutDirectives, remarkAboutDirectives } from '../src/plugins/about-directives.mjs';

const renderAboutMarkdown = async (
  source: string,
  {
    base = '/',
    path = new URL('../src/content/about/index.md', import.meta.url)
  }: { base?: string; path?: URL | string } = {}
): Promise<string> => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkAboutDirectives)
    .use(remarkRehype)
    .use(rehypeAboutDirectives, { base })
    .use(rehypeStringify);

  const file = new VFile({ value: source, path });
  const result = await processor.process(file);
  return String(result);
};

describe('about directives markdown transform', () => {
  it('prefixes local friend avatar paths with deployment base', async () => {
    const html = await renderAboutMarkdown(
      [
        ':::friend{name="Alice" url="https://alice.example" avatar="author/avatar.webp"}',
        'Engineer',
        ':::'
      ].join('\n'),
      { base: '/blog/' }
    );

    expect(html).toContain('src="/blog/author/avatar.webp"');
    expect(html).toContain('href="https://alice.example/"');
  });

  it('groups whitespace-separated friend and FAQ directive runs', async () => {
    const html = await renderAboutMarkdown(
      [
        ':::friend{name="Alice" url="https://alice.example"}',
        'Engineer',
        ':::',
        '',
        ':::friend{name="Bob" url="https://bob.example"}',
        'Designer',
        ':::',
        '',
        ':::faq{question="Q1"}',
        'A1',
        ':::',
        '',
        ':::faq{question="Q2"}',
        'A2',
        ':::'
      ].join('\n')
    );

    expect(html.match(/<ul class="friend-list">/g)).toHaveLength(1);
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html.match(/<div class="qa-list" aria-label="常见问题">/g)).toHaveLength(1);
    expect(html.match(/<details class="qa-item">/g)).toHaveLength(2);
  });

  it('does not transform directives outside the about source file', async () => {
    const html = await renderAboutMarkdown(
      [
        ':::faq{question="Q1"}',
        'A1',
        ':::'
      ].join('\n'),
      { path: new URL('../src/content/essay/demo.md', import.meta.url) }
    );

    expect(html).not.toContain('qa-list');
    expect(html).not.toContain('qa-item');
    expect(html).toContain('A1');
  });
});
