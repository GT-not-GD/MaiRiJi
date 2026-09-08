# 旧GitHub Pages官网迁移公告 v1.0.0

目标旧仓库：`GT-not-GD/MaiRiJi`

新官网：`https://mairiji-website.mairiji.workers.dev/`

## 使用GitHub Desktop更新

1. 先确认已下载并离线保存`mairiji-legacy-archive-2026-09-07.zip`。
2. 在GitHub Desktop打开旧官网仓库`MaiRiJi`。
3. 删除仓库内原有商城文件（不要删除仓库本身或Git历史）。
4. 把本公告包内的`index.html`和`.nojekyll`复制到仓库根目录。
5. Commit信息填写：`旧官网改为新网址迁移公告 v1.0.0`。
6. 点击Push origin。
7. 打开旧网址，确认只显示搬家公告，按钮进入新Cloudflare官网。

公告页会在访客打开时注销旧Service Worker并清除该旧站缓存，避免旧PWA继续打开原商城。
