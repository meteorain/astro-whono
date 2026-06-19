import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ESSAY_PUBLIC_SLUG_RE } from './utils/slug-rules';
import { normalizeBitsAvatarPath } from './utils/format';
import { parseEssayDateInput } from './utils/date-only';
import { normalizeBitsImageSource } from './lib/bits-image-source';

const slugRule = z
  .string()
  .regex(ESSAY_PUBLIC_SLUG_RE, 'slug must be lowercase kebab-case');

// essay：内容来自 meteorain/content 的 posts 目录（WordPress 重导出，318 篇）。
// 转换器把 content 的 frontmatter 映射成 astro-whono essay 字段：
//   pubDatetime→date、modDatetime→updatedAt、tags→tags；
//   categories 既取第一个当 badge（每篇角标），又并入 tags（可在 /archive/tag/ 按分类浏览）。
// cover/slug 你的内容没有：声明为可选、恒为空（slug 空 → 公开 URL 走文件路径自动拼）。
const essay = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      // content（重导出）原始字段
      pubDatetime: z.unknown(),
      modDatetime: z.unknown().optional().nullable(),
      categories: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      // 你的文章没有封面/自定义 slug：声明为可选只为让类型上存在该属性，运行时恒为 undefined
      cover: z.string().optional(),
      slug: z.string().optional()
    })
    .transform((data, ctx) => {
      const dateResult = parseEssayDateInput(data.pubDatetime);
      if (!dateResult) {
        ctx.addIssue({
          code: 'custom',
          path: ['pubDatetime'],
          message: 'pubDatetime must be a valid date/datetime'
        });
        return z.NEVER;
      }

      let updatedAt: Date | undefined;
      const mod = data.modDatetime;
      if (mod != null && !(typeof mod === 'string' && mod.trim() === '')) {
        const u = parseEssayDateInput(mod);
        if (u && u.date.valueOf() >= dateResult.date.valueOf()) updatedAt = u.date;
      }

      // tags：把 categories 也并进来（去重 + 转小写）→ 既能按分类浏览，又配合下方 badge
      const tags = [
        ...new Set([...data.categories, ...(data.tags ?? [])].map((t) => t.toLowerCase()))
      ];

      return {
        title: data.title,
        description: data.description,
        date: dateResult.date,
        // tags = categories + tags（可在 /archive/tag/ 按分类浏览）
        tags,
        // badge 单独取第一个分类，在每篇上当角标显示（mood / live …）
        badge: data.categories[0],
        draft: data.draft,
        archive: true,
        // cover/slug 恒空：卡片/详情页自动不显示封面；slug 空 → URL 走文件路径
        cover: data.cover,
        slug: data.slug,
        ...(dateResult.publishedAt ? { publishedAt: dateResult.publishedAt } : {}),
        ...(updatedAt ? { updatedAt } : {})
      };
    })
});

const bitsImage = z.object({
  src: z
    .string()
    .superRefine((value, ctx) => {
      if (!normalizeBitsImageSource(value)) {
        ctx.addIssue({
          code: 'custom',
          message: 'images[].src 只允许 public/** 下的相对图片路径或 https:// 远程 URL，不要带 public/、不要以 / 开头，也不要使用 http、..、?、#'
        });
      }
    })
    .transform((value) => normalizeBitsImageSource(value) ?? value),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().optional()
});

const bitsAuthorAvatar = z
  .string()
  .superRefine((value, ctx) => {
    const normalized = normalizeBitsAvatarPath(value);
    if (normalized === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'author.avatar 只允许相对图片路径（例如 author/avatar.webp），不要带 public/、不要以 / 开头，也不要使用 URL、..、?、#'
      });
      return;
    }
  })
  .transform((value) => normalizeBitsAvatarPath(value) ?? value);

const bitsAuthor = z.object({
  name: z.string().optional(),
  avatar: bitsAuthorAvatar.optional()
});

const bits = defineCollection({
  // bits 改读本地生成目录（由 scripts/sync-bits-from-notion.mjs 从 Notion 同步生成，不放进共享 content 子模块）
  loader: glob({ pattern: '**/*.md', base: './src/generated-bits' }),
  schema: z.object({
    // Bits can be untitled.
    title: z.string().optional(),
    description: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    slug: slugRule.optional(),

    // Optional media for card display.
    images: z.array(bitsImage).optional(),
    author: bitsAuthor.optional()
  })
});

const memo = defineCollection({
  // memo/about 改读 astro-whono 本地目录（不放进共享 content 仓库），仅作占位让 build 通过。
  loader: glob({ pattern: '**/*.md', base: './src/site-pages/memo' }),
  schema: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    date: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    slug: z.string().optional()
  })
});

const about = defineCollection({
  loader: glob({ pattern: 'index.md', base: './src/site-pages/about' }),
  schema: z.looseObject({})
});

export const collections = { essay, bits, memo, about };
