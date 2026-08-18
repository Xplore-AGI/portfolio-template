# 个人博客 & 设计作品集模板

不用服务器、不用写代码的免费个人网站：**飞书写内容 → 自动同步 → 网站自动更新**。

参考 wireframe.co 的手绘拼贴风格，中文站点。Astro 静态构建，内容来自飞书多维表格/文档，部署在 Cloudflare Pages（免费、国内可访问、无需备案）。

> 零基础请直接跟着[搭建教程](docs/tutorial.md)走，每一步都有截图说明。

## 结构

```text
/
├── src/
│   ├── config.ts            # 站点信息：名字、邮箱、履历、客户（先改这里）
│   ├── content/works/       # 作品（Markdown，飞书同步生成）
│   ├── content/posts/       # 文章（Markdown，飞书同步生成）
│   ├── components/          # 导航、页脚、手绘涂鸦 SVG
│   ├── layouts/             # 页面骨架
│   └── pages/               # 首页 / 关于 / 作品 / 文章
├── scripts/feishu-sync.mjs  # 飞书 → Markdown 同步脚本
├── .github/workflows/       # 每 30 分钟自动同步
└── docs/
    ├── feishu-setup.md      # 飞书应用 & 多维表格配置指南
    └── deploy.md            # Cloudflare Pages 部署步骤
```

## 快速开始

```bash
npm install
npm run dev        # http://localhost:4321
```

## 上线三步

1. 改 `src/config.ts`（名字、邮箱、经历、客户）和 `astro.config.mjs`（域名）
2. 按 [docs/feishu-setup.md](docs/feishu-setup.md) 配好飞书和 GitHub Secrets
3. 按 [docs/deploy.md](docs/deploy.md) 推到 GitHub 并连接 Cloudflare Pages
