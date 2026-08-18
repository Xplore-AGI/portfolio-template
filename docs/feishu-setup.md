# 飞书配置指南

## 一、创建飞书自建应用

1. 打开 [飞书开放平台](https://open.feishu.cn/) → 开发者后台 → **创建企业自建应用**
2. 记下 **App ID** 和 **App Secret**
3. 「权限管理」中开通以下权限：
   - `bitable:app`（查看、评论多维表格）
   - `docx:document:readonly`（查看文档）
   - `drive:drive:readonly`（查看云空间中文件，用于下载图片）
4. 「安全设置」中把仓库域名等回调域名随便填一个（同步不需要回调）
5. **发布应用**（版本管理与发布 → 创建版本 → 申请发布）

## 二、创建多维表格

在飞书里新建一个多维表格（可以两个表放同一个里），按下表建字段。

### 作品表

| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| 标题 | 文本 | 必填，项目名称 |
| 简介 | 文本 | 列表页的一句话描述 |
| 封面 | 附件 | 上传封面图（建议 3:2 比例） |
| 标签 | 多选 | 如：品牌设计 / 产品设计 |
| 客户 | 文本 | 可选 |
| 年份 | 文本 | 如 2025 |
| 链接 | 文本 | 可选，线上项目地址 |
| 精选 | 复选框 | 勾选后可做首页推荐 |
| 日期 | 日期 | 排序用 |
| 发布 | 复选框 | 不勾选则不同步 |
| slug | 文本 | 可选，自定义 URL（如 `tea-brand`） |
| 正文 | 多行文本 | 项目详情，直接写 Markdown |
| 详情文档 | 超链接 | 可选，链接一篇飞书文档作为详情（优先级高于「正文」） |

### 文章表

| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| 标题 | 文本 | 必填 |
| 简介 | 文本 | 可选 |
| 标签 | 多选 | 分类 |
| 日期 | 日期 | 发布日期 |
| 发布 | 复选框 | 不勾选则不同步 |
| slug | 文本 | 可选 |
| 正文 | 多行文本 | 直接写 Markdown |
| 文档 | 超链接 | 可选，链接飞书文档（优先级高于「正文」，支持标题/列表/引用/代码块/图片） |

> 写长文建议用「文档」字段：在飞书里正常写富文本，图片会自动下载到仓库。简单的短文直接在「正文」里写 Markdown 就行。

### 拿到表格 ID

打开多维表格，看浏览器地址栏：

```
https://xxx.feishu.cn/base/<APP_TOKEN>?table=<TABLE_ID>&view=...
```

- `FEISHU_WORKS_APP_TOKEN` / `FEISHU_POSTS_APP_TOKEN` = `<APP_TOKEN>`
- `FEISHU_WORKS_TABLE_ID` / `FEISHU_POSTS_TABLE_ID` = `<TABLE_ID>`

> 注意：把这两个多维表格**添加为应用可用资源**（应用详情 → 添加应用 → 选你的多维表格），否则 API 会报无权限。文档同理，在文档右上角「…」→ 添加文档应用。

## 三、配置 GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret，添加：

| Secret | 值 |
| --- | --- |
| `FEISHU_APP_ID` | 应用 App ID |
| `FEISHU_APP_SECRET` | 应用 App Secret |
| `FEISHU_WORKS_APP_TOKEN` | 作品表 App Token |
| `FEISHU_WORKS_TABLE_ID` | 作品表 Table ID |
| `FEISHU_POSTS_APP_TOKEN` | 文章表 App Token |
| `FEISHU_POSTS_TABLE_ID` | 文章表 Table ID |

配置完后 Actions 会每 30 分钟自动同步一次，也可以在 Actions 页面手动触发「飞书同步」。

## 四、本地测试同步

```bash
export FEISHU_APP_ID=xxx
export FEISHU_APP_SECRET=xxx
export FEISHU_WORKS_APP_TOKEN=xxx
export FEISHU_WORKS_TABLE_ID=xxx
export FEISHU_POSTS_APP_TOKEN=xxx
export FEISHU_POSTS_TABLE_ID=xxx
node scripts/feishu-sync.mjs
```

## 五、发布流程

1. 在飞书表格里新建一行，填好内容，勾选「发布」
2. 等最多 30 分钟（或手动触发 Actions）
3. 同步脚本把内容提交进仓库 → Cloudflare Pages 自动重新部署
4. 几分钟后网站更新
