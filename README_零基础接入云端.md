# 《你为什么画星星？》数字编织 V6 — 零基础云端部署指南

这一版**继承 V5 的星网装置造型**、三维编织工作台、多笔绘制、旋转缩放和选中后移动功能。升级重点是 **Supabase 云端共享**。你不需要安装新软件；继续使用 VS Code 和 Live Server 即可。

## 0. 先备份 V5，独立打开 V6

1. 在 V5 里点击 **备份作品 JSON**，保存作品。
2. 下载并 **全部解压** V6 压缩包，不要把新文件直接扔进 V2/V3/V5 文件夹。
3. VS Code → **File → Open Folder** → 选择 `weaving_v6_cloud` 文件夹。
4. 右下角 **Go Live**，打开网页。左上方会写 **INTERACTIVE STUDY V6**。
5. 这时没有连接 Supabase，也能正常三维绘制和本机保存。**如果只看到代码，说明你还没有启动 Live Server。**

## 1. 创建 Supabase 云端数据库（一次性操作）

1. 浏览器访问 https://supabase.com/ ，注册或登录。
2. 点击 **New project**，新建项目（例如 `star-weaving`）。记住自己设置的数据库密码，不用把密码给任何人。
3. 待项目建好后，进入左侧 **Authentication → Providers / Sign In / Anonymous**（后台菜单文字可能更新），打开 **Anonymous Sign-Ins / Allow anonymous sign-ins**。
4. 左侧找到 **SQL Editor → New query**，用 VS Code 打开本项目的 `supabase_setup.sql`，按 `Ctrl + A`、`Ctrl + C` 复制全部内容，粘贴进 SQL Editor，点击 **Run**。
5. SQL 执行成功后，点击 **Table Editor**，确认看到 `public.weaving_works` 表。

这份 SQL 已打开 RLS 权限保护：登陆的所有访客都能读到作品，但只有匿名身份对应的作品创建者才能修改/删除。SQL 还限制了每个匿名身份最多发布 40 组作品（但这不能彻底防恶意批量注册）。

## 2. 在 VS Code 填写两个云端连接字段

进入 Supabase 项目 **Project Settings / API Keys** 或顶部 **Connect**，找到：

- **Project URL**：例如 `https://abcdefgh.supabase.co`
- **Publishable key**：以 `sb_publishable_` 开头。旧项目可能标为 `anon` / `public`，也可用（但优先 publishable）。

在 VS Code 打开 V6 的 `config.js`，把前两行空引号改成你的值，保留单引号、逗号和其余设置。例如：

```js
window.WEAVE_CONFIG = {
  supabaseUrl: 'https://abcdefgh.supabase.co',
  supabasePublishableKey: 'sb_publishable_示例不是实际密钥',
  galleryModelUrl: '',
  installationModelUrl: ''
};
```

按 `Ctrl + S` 保存。回到本机预览网页按 `Ctrl + Shift + R` 刷新。

**千万不要填写 Supabase `secret` / `service_role` / 数据库密码！** 这几个是管理员权限，只应保存在安全的后端，不能放进公开网页，更不要发到聊天里。Publishable key 本身是可公开的前端标识，安全性依赖 SQL 中 RLS 授权。

## 3. 在自己电脑上先完成云端测试

1. 等待右侧 **05 · 多人共享 / CLOUD SHARING** 显示「已连接」。
2. 右侧画一根不规则彩色铁丝；点击 **将整组铁丝加入装置**。
3. 左侧用彩色三轴手柄放好位置，然后点击 **确认位置并发布（或保存本机）**。
4. 观察是否出现「作品已经发布到云端」提示。
5. 打开浏览器 **无痕窗口**，输入同一个本机 Live Server URL。无痕窗口会获得新的匿名身份，应能看到刚才发布的铁丝，但点击它时应显示“其他观众的作品，不可编辑”。
6. 反过来在无痕窗口也发布一根不同颜色的线，再回到普通窗口，点击 **刷新公共作品**。应能看到两人的作品。
7. 正常情况下 Realtime 收到数据库变化后会自动刷新；若网络限制 WebSocket，后台每 30 秒也会自动读取。

如果「云端连接失败」：检查 `config.js` 中 URL 与 Publishable key、是否开启匿名登录、SQL 是否执行成功、是否通过 Live Server 而非 file:// 打开、浏览器是否能访问 Supabase。

## 4. 让真正不在现场的观众访问：发布静态网站

**Live Server 只把网站临时运行在你的电脑上，不能直接作为公共展览链接。** 完成上面的测试后，可以用 GitHub Pages 免费发布静态文件：

1. 登录 https://github.com/ ，点击右上角 `+` → `New repository`。
2. 仓库名例如 `star-weaving`，选择 **Public**，创建仓库。
3. 在仓库 `Code` 页面，选择 **Add file → Upload files**，把 V6 文件夹中的 `index.html`、`app.js`、`cloud.js`、`config.js`、`installation_reference.js`、`参考效果图.png` 上传到**仓库根目录**，提交上传。
4. 不需要上传 `supabase_setup.sql` 和说明文件。**发布前再次确保没有 `sb_secret_`、`service_role` 或数据库密码。**
5. GitHub 仓库 **Settings → Pages → Build and deployment → Deploy from a branch**，选择 `main` 和 `/ (root)`，保存。
6. 等几分钟后访问 GitHub Pages 给出的公共 URL，网址通常类似 `https://你的GitHub名.github.io/star-weaving/`。
7. 用手机或另一台电脑打开这个**公共网址**，重复上面的双人共享测试。

注意：本机 `http://127.0.0.1:5500` 与公开 `https://...github.io` 是**不同网站来源**，匿名会话不会自动互通。你在本机创建的作品依然可被所有人看到，但登录公开网址时可能无法编辑原先由本机匿名身份创建的那根线。正式上线后建议以后都用公共网址进行演示。

## 5. 怎样处理 V5 留在本机的旧作品？

V6 兼容 V5 的作品格式，通常同一个 `127.0.0.1:5500` 地址打开时，会自动读取浏览器本机 `localStorage` 中保存的作品。由于 Live Server 的运行地址可能变化，建议使用 V5 导出的 JSON：

1. 在 V6 点击 **恢复备份**，选择 V5 导出的 JSON。
2. 验证本机作品已显示。
3. 云端连接成功后，点击右侧 **上传本机作品到云端**，确认公开上传。

**不会把你以前的本机草稿偷偷自动公开。** 上传前会让你确认。V6 的 JSON 备份只包含当前浏览器保存的本人作品，不包含其他访客的作品。

## 6. 你已经实现什么，哪些还没有？

- 真三维：彩色铁丝具有三维路径和厚度；星网装置可旋转、缩放；观众自己创建的整组铁丝可移动、旋转、缩放。
- 云端共享：由 Supabase 存储路径与变换数据；匿名访客共享看到彼此作品；作品作者可再次编辑和删除；数据库变化会触发刷新，另有定时刷新兜底。
- 视觉近似：参考图中的石壁、网状星体与再生材料由代码程序化重建，不是精准测绘或从图片自动恢复的真实三维模型。
- 暂无真实碰撞、物理打结；没有多个观众同时拉拽同一根线的权限模型，实际上每位观众只能编辑自己的作品。
- 正式开放参观前，建议开启匿名登录的 CAPTCHA / 防滥用机制、设置作品审核、监控项目用量并备份数据库；目前是课堂/小规模展示版本，不适合没有管理措施就长期高流量公开投放。
- 匿名身份存储在每个网站来源下的浏览器会话数据中。清理浏览器数据、换浏览器或换域名后可能失去该身份；已发布作品仍可观看，但可能无法重新编辑。保留 JSON 备份以免失去创作记录。

## 官方文档

- 匿名登录：https://supabase.com/docs/guides/auth/auth-anonymous
- RLS 权限：https://supabase.com/docs/guides/database/postgres/row-level-security
- API 密钥：https://supabase.com/docs/guides/getting-started/api-keys
- GitHub Pages：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
