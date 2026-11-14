# Nextcloud content publishing

# 在 Nextcloud 更新个人网站

网站地址：https://xiaofan.ac.cn/
你只需在这里编辑内容，不需要手动提交 Git commit。

## 目录与发布

- 草稿：未完成的文章和相册，网站不会读取。
- 模板：博客模板、相册说明模板。
- 已发布 / 博客：公开的文章及配图。
- 已发布 / 图库：公开的相册及图片。

“已发布”文件夹有一个公开只读分享，里面的文件本身也是公开的。
因此请在“草稿”中完成编辑，再把整篇文章或整个相册文件夹移入“已发布”。
不要用文章里的 draft 字段替代草稿目录。

## 写一篇博客

1. 在“草稿”中新建一个文章文件夹，例如 2026-11-14-my-first-post。
2. 把“模板 / 博客模板.md”复制进去，重命名为 index.md。
3. 修改标题、日期和正文。一个文章文件夹保留一个 Markdown 文件。
4. 配图也放进这个文件夹，正文使用相对路径，例如 ![图注](figure.png)。
   Nextcloud Text 创建的 .attachments.* 配图文件夹也会同步。
5. 完成后，把整个文章文件夹移到“已发布 / 博客”。

发布后，直接在已发布文件夹中修改原文或替换图片即可。
文章网址取决于日期与文件夹名；修改标题不会改变网址。
请尽量保留已经发布的文件夹名和日期，以免旧链接失效。
日期优先使用模板中的 date；没有 date 时读取文件夹开头的 YYYY-MM-DD，
再没有则使用文件修改日期，因此推荐保留模板里的 date。

单独放在博客目录中的 .md 文件也支持作为文字文章；有配图时建议使用上述文章文件夹方式。
支持 Markdown、JPG、JPEG、PNG、WebP、GIF 和 PDF 附件，其他格式不会同步。

## 添加相册

1. 在“草稿”中新建相册文件夹，例如 sydney-2026。
2. 上传 JPG、JPEG、PNG、WebP 或 GIF 图片；HEIC/RAW 请先导出为 JPG。
3. 可把“模板 / 相册说明.md”复制进去并重命名为 index.md，修改相册标题和说明。
   不需要说明时，只放图片即可，文件夹名会作为相册标题。
4. 把整个文件夹移入“已发布 / 图库”。

图片按文件名排序；可用 01-、02- 前缀控制顺序。
网页自动生成缩略图与放大图，照片方向会自动纠正；网页放大图最长边为 2560 像素。
GIF 在图库中使用静态预览。Nextcloud 中的原图不被修改。
图片文件名会用作图注，建议使用有意义的文件名。

## 更新与撤下

后台约每 10 分钟检查一次，发现变化后构建并发布；GitHub 排队可能带来额外延迟。
移回“草稿”或从已发布中删除后，会在下次成功发布时撤下对应网页。
过去已经公开的内容可能仍存在于访客缓存或历史构建中。
同步失败时保留线上版本，不会把网站清空。
新增、修改和删除都无需手动 Git commit。

## 查看状态

构建记录：https://github.com/AnikiFan/AnikiFan.github.io/actions/workflows/ci.yml
必要时可在该页面使用 Run workflow 立即触发一次同步。
若长期不使用，GitHub 可能暂停定时工作流，届时可在 Actions 页面重新启用。
请不要删除“已发布 / 博客”和“已发布 / 图库”这两个目录本身。


## Implementation and validation

- Source settings: `config/nextcloud.json`. Its DAV URL is a deliberately public, read-only share of only the published folder. No account password or private-folder link is stored in the repository.
- Each run enumerates the two required folders over WebDAV, fingerprints file paths, ETags and sizes, then downloads a consistent snapshot. Missing folders, permission errors, invalid metadata and incomplete downloads fail the run without deploying.
- Downloads use If-Match; a second listing rejects changes during transfer.
- Only Markdown, common raster images and PDF attachments are accepted. Hidden files are skipped except Nextcloud Text's .attachments.* folders.
- Generated files live in ignored build locations. Existing Git-managed posts are preserved. Only generated post/album directories are replaced.
- Source content is never pushed to main. The existing GitHub Pages workflow commits the generated public website to gh-pages, as before.
- Scheduled runs compare against the last successfully published content fingerprint. Unchanged snapshots skip the LaTeX compilation, site build and deployment. Pushes and manual runs always rebuild.
- repository_dispatch accepts nextcloud-content-updated for a future external trigger; no Nextcloud webhook is currently configured.
- Post metadata disables Jinja/macros rendering and hides source-edit links on generated content.
- Publication is all-or-nothing: a failing sync/build does not replace the live site.

Validation commands:

```bash
uv sync --frozen
uv run --frozen python -m unittest discover -s tests -v
uv run --frozen python scripts/sync_nextcloud.py
uv run --frozen mkdocs build --strict
```

For offline fixtures, pass --local-source /path/to/fixture with the same two folder names.
Tests use synthetic content only. Real drafts are never read by the build.

