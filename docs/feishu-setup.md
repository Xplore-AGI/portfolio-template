# 飞书配置指南

## 一、创建飞书自建应用

1. 打开 [飞书开放平台](https://open.feishu.cn/) → 开发者后台 → **创建企业自建应用**
2. 记下 **App ID** 和 **App Secret**
3. 「权限管理」中开通以下权限：
   - `bitable:app`（查看、评论多维表格）
   - `docx:document:readonly`（查看文档）
   - `drive:drive:readonly`（查看云空间中文件，用于下载图片）
   - `wiki:wiki:readonly`（查看知识库，用于解析知识库链接）
4. 「安全设置」中把仓库域名等回调域名随便填一个（同步不需要回调）
5. **发布应用**（版本管理与发布 → 创建版本 → 申请发布）

## 二、创建多维表格

建议在飞书**知识库**里新建多维表格（知识库 → 新建 → 多维表格），后续的文章文档也放在同一个知识库里，权限好管理。两个数据表放在同一个多维表格里即可，按下表建字段。

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

### 拿到表格链接

在知识库左侧目录里，**右键多维表格 → 复制链接**，得到一个 `https://xxx.feishu.cn/wiki/...` 开头的链接，后面填 Secret 时直接粘贴它即可：

- `FEISHU_WORKS_APP_TOKEN` / `FEISHU_POSTS_APP_TOKEN` = 粘贴多维表格的链接（`/wiki/` 或 `/base/` 开头都支持，也可以只填纯 token）
- `FEISHU_WORKS_TABLE_ID` / `FEISHU_POSTS_TABLE_ID` = 直接填表名（如 `作品表`、`文章表`），也可以填 `tbl` 开头的表 ID

> ⚠️ 表名要和上面建的字段表名完全一致（脚本按表名查找）。若脚本提示「表里找不到」，错误信息会列出所有现有表名，照着改即可。

> 注意：把多维表格**添加为应用可用资源**（多维表格右上角「…」→ 更多 → 添加文档应用），否则 API 会报无权限。文档同理，在文档右上角「…」→ 添加文档应用。

## 三、配置 GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret，添加：

| Secret | 值 |
| --- | --- |
| `FEISHU_APP_ID` | 应用 App ID |
| `FEISHU_APP_SECRET` | 应用 App Secret |
| `FEISHU_WORKS_APP_TOKEN` | 作品多维表格的链接（`/wiki/` 或 `/base/`） |
| `FEISHU_WORKS_TABLE_ID` | `作品表`（或 `tbl` 开头的表 ID） |
| `FEISHU_POSTS_APP_TOKEN` | 文章多维表格的链接（可与作品同一个） |
| `FEISHU_POSTS_TABLE_ID` | `文章表`（或 `tbl` 开头的表 ID） |

配置完后 Actions 会每 30 分钟自动同步一次，也可以在 Actions 页面手动触发「飞书同步」。

## 四、本地测试同步

```bash
export FEISHU_APP_ID=xxx
export FEISHU_APP_SECRET=xxx
export FEISHU_WORKS_APP_TOKEN="https://xxx.feishu.cn/wiki/xxx"   # 多维表格链接
export FEISHU_WORKS_TABLE_ID="作品表"
export FEISHU_POSTS_APP_TOKEN="https://xxx.feishu.cn/wiki/xxx"   # 可以和上面同一个
export FEISHU_POSTS_TABLE_ID="文章表"
node scripts/feishu-sync.mjs
```

## 五、发布流程

1. 在飞书表格里新建一行，填好内容，勾选「发布」
2. 等最多 30 分钟（或手动触发 Actions）
3. 同步脚本把内容提交进仓库 → Cloudflare Pages 自动重新部署
4. 几分钟后网站更新
