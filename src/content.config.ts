import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 作品集：Markdown，frontmatter 存结构化数据，正文为详情页内容
// （飞书多维表格同步脚本会生成同样格式的文件）
const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),
    client: z.string().optional(),
    year: z.string(),
    link: z.string().optional(),
    featured: z.boolean().default(false),
    pubDate: z.coerce.date(),
  }),
});

// 文章：Markdown，飞书知识库同步脚本会生成同样格式的文件
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),
    pubDate: z.coerce.date(),
    feishuUrl: z.string().optional(), // 飞书原文链接，方便回去编辑
  }),
});

export const collections = { works, posts };
