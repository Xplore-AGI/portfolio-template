# 部署到 Cloudflare Pages（免费）

## 步骤

1. **推送代码到 GitHub**

   ```bash
   cd portfolio
   git init
   git add -A
   git commit -m "init: 个人博客与作品集"
   gh repo create portfolio --private --source=. --push
   # 或者手动在 GitHub 建仓库后 git remote add + git push
   ```

2. **连接 Cloudflare Pages**

   - 打开 [dash.cloudflare.com](https://dash.cloudflare.com/) → Workers & Pages → Create → Pages → **Connect to Git**
   - 选中刚推的 `portfolio` 仓库
   - 构建配置：
     - Framework preset: **Astro**
     - Build command: `npm run build`
     - Build output directory: `dist`
   - 点 Save and Deploy

3. **首次部署完成后**，你会拿到一个 `xxx.pages.dev` 域名（国内可直接访问，无需备案）。

4. **绑定自定义域名**（可选）：Custom domains → Add → 按提示加 CNAME 记录。域名托管在 Cloudflare 的话一键完成。

## 发布文章的完整链路

```
飞书表格写内容并勾选「发布」
  → GitHub Actions 每 30 分钟同步（scripts/feishu-sync.mjs）
  → 提交 Markdown 到仓库
  → Cloudflare Pages 检测到 push，自动构建部署
  → 约 3~5 分钟后网站更新
```

## 本地开发

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # 构建到 dist/
```

## 想要即时发布？

在飞书多维表格里加一个「按钮」字段或用飞书机器人 webhook 触发 GitHub Actions 的 `workflow_dispatch`，发文后点一下立即同步，不用等 30 分钟。
