# 机核播客 · 触屏版（gcores-mini）

把机核（gcores.com）的播客内容重新做成一套**触屏优先**的前端：竖屏手机一套布局，横屏平板 / 车机一套布局。
数据全部来自机核私有 API，本项目不含任何后端逻辑，只做读取与播放。

---

## 1. 快速开始

```bash
# 环境：Node 22+ / pnpm 9+
cd apps/web
pnpm install
pnpm dev          # http://localhost:5273
```

> Windows 访问 WSL 里的 dev server 时只能用 `http://[::1]:5273/`（WSL 端口转发只绑 IPv6 回环）。

生产构建：

```bash
pnpm build         # 产物在 apps/web/dist
pnpm preview
```

**上线必须自带反向代理**：机核 API 没有 CORS 头，浏览器直连会被拦。开发环境已经配好 Vite proxy（`/gapi` → `https://www.gcores.com`），生产用 Nginx / Cloudflare Worker 转发同样路径即可，见第 5 节。

---

## 2. 已实现的页面

| 路由 | 说明 |
| --- | --- |
| `/` | 播客首页（对齐 gcores.com/radios）：`GPASS` 页签只挑会员专享（`is-free=false` 或 `is-require-privilege=true`，接口不支持按权限过滤，客户端分流并自动多翻几页直到攒够 36 期），GPASS 里录音笔不再逐期铺进网格，而是收成网格第一张 `SeriesTile` 方格（封面 + 总期数 + 最新一期一行，可直达系列页）；`最新 / 机核 / 入驻` 不做合集，照常逐期展示；`最新 / 机核 / 入驻 / GPASS / 机核 FM` 五个行内页签，默认停在 `机核`；电台卡片网格 + 无限加载；列表下方是「接着听」（进度 3%~95%）。「机核 FM」页签里 8 期全部平铺（首期是循环陪伴流），不再需要单独的 FM 页 |
| `/playlists` | 播单（192 张，`/albums?filter[display-type]=album`） |
| `/series/:slug` | 系列合订（目前只有 `/series/recorder` 录音笔）：接口里录音笔是按年拆开的 4 张专辑（333/247/214/199），这里并发拉齐后按标题里的 `VOL.x` 连成一条线，番外排进对应期次之后；季节胶囊筛年份，每次渲染 80 期；GPASS 栏通过 `useRecorderIds()` 按栏目名 + 四张年份专辑各 100 期把录音笔从网格里摘掉（只在 GPASS 栏触发请求） |
| `/playlist/:id` | 播单详情：方图封面 + 免费/期数/总时长 + 全部播放/全部入队 + 带序号的节目列表 |
| `/audiobooks` | 有声书 61 部，一行 3（竖屏）/ 4~7（横屏），方图封面 |
| `/album/:id` | 有声书详情 + 章节列表（`display-type≠audiobook` 的 id 会自动转去 `/playlist/:id`，反之亦然） |
| `/radio/:id` | 节目详情：大播放按钮、收藏、简介 / 评论 / 时间轴、「更多节目」 |
| `/me` | 我的：会员信息 + **收听记录**（同一期多次收听已按 radioId 合并，取最新时间与最大进度，可续播）/ **我的收藏**（可收藏/取消） |
| `/search` | 搜索：350ms 防抖、搜索历史（localStorage）、热词 |
| `/queue` | 播放队列：卡片右下角「＋」攒进来的节目（zustand persist）。「播放全部」/点某一条会把它作为**自定义队列**交给播放器，之后上一集/下一集都在这条队列里走；卡片浮层里还有「立即播放」 |
| `/login` | 扫码登录 + 手机号密码登录 |
| `/categories`、`/category/:id` | 栏目（首页不再露出，作为二级入口保留） |

---

## 3. 两种布局

### 竖屏（`orientation: portrait` 或宽度 < 900px）

单列 + 底部常驻迷你播放条 + 一条**悬浮胶囊导航**（发现 / 播单 / 有声书 / 我的）浮在播放条上方居中。
任何可点元素都不贴屏幕边缘 8px 以内，避免被系统手势区误触。
有声书在竖屏是 2 列方图（原来的 3 列在 390px 下书名会挤成三行）。

### 横屏（`min-width: 900px` 且 `landscape`）

- **左侧 1/3 是「舞台区」**：`--dead-zone: clamp(280px, 32vw, 460px)`。这块靠近车机/支架的物理按键与旋钮，**容器 `pointer-events: none`**，只有内部标了 `.stage-interactive` 的播放面板接收事件。
- 舞台区内容（对齐机核 App 的播放条）：顶部整期信息（封面 + 标题 + DJ + 「N 段」）→ **时间轴卡片流**（时间戳 pill + 16:9 配图 + 标题 + 简介，当前段高亮并自动跟随滚动，点击跳转）→ 两端时间戳 + 细进度线（带章节刻痕）→ 一排图标化控制（−15s / 上一集 / 播放 / 下一集 / +15s）→ 次操作**只留图标**（点赞 / 倍速 / 评论 / 循环 / 展开）。
- 中间内容区限宽 1440px 居中，超宽屏 1600px。
- **底部常驻播放条**：不管有没有在播，底部永远有一条（没播时是「选择一期节目开始收听」的占位条），不需要滚动就能看到播放控制。
- **悬浮胶囊导航**：横竖屏都浮在底部中间（横屏在内容区下方居中，即「右侧节目区的底部中间」），`backdrop-blur`，不带环形进度。
- 左侧舞台的时间轴是**官方 App 的卡片流**：每段 = 时间戳 pill + 16:9 配图 + 标题 + 简介，正在播放的一段高亮并自动跟随滚动；下方控制行只保留图标。
- 全屏播放页：`left-[var(--dead-zone)]`，让开左侧舞台区。

### 导航与滚动

- 竖屏：底部悬浮胶囊（`fixed`，距底部 84px，避开迷你播放条），不带环形进度；内容区 `pb-[104px]` 保证最后一条不被压住。
- 首页头部（标题 + 搜索 + 队列 + 四个页签）`sticky` 常驻，不再有滚动后浮出的第二套页签。

两套布局通过 `hooks/useLayout.ts` 的 `useWideLandscape()`（`useSyncExternalStore` + `matchMedia`）**只渲染一套**，不会出现同一页面挂载两份导致重复请求。

## 4. 关键实现要点（踩过的坑）

1. **图片 CDN 有 Referer ACL**：`image.gcores.com` 带 Referer 会 403。所有 `<img>` 必须 `referrerPolicy="no-referrer"`，统一封装在 `components/CoverImage.tsx`。
2. **封面字段可能为 `null`**：`attributes.cover` 经常是空，要回退到 `attributes.thumb`（16:9）。`CoverImage` 在 `src` 为空时渲染占位 div，避免浏览器破图图标。
3. **`coverUrl()` 必须走**：API 返回的是文件名（`xxx-1000-1000.jpg`），不是 URL。忘记包一层会变成相对路径 `http://localhost:5273/radio/xxx.jpg`。
4. **免费音频源有两种形态**：`media.audio` 可能是纯文件名（走 `alioss.gcores.com`），也可能是绝对 URL（RSS 入驻播客：wavpub / lizhi / ximalaya）。`freeAudioUrl()` 里用 `/^https?:\/\//` 判断。
5. **`<audio>` 必须挂到 DOM**：游离 `new Audio()` 在部分情况下被回收，导致读不到播放状态。现在挂在 `document.body#gcores-audio`，每次取用时检查 `isConnected`。
6. **自动播放策略**：程序化 `el.click()` 会报 `NotAllowedError`，这是 Chrome 的正常行为，不是 bug。真实手势点击可以正常播放（已实测付费 + 免费两种源）。错误已用 `humanizeError()` 翻译成中文提示。
7. **关系字段形状不一致**：`category` 是**单个对象**，`djs` 是**数组**。早期代码一律当数组处理，导致整个列表静默为空。
8. **机核 FM 是 HLS**：`media.audio` 是 `.m3u8`（`alioss.gcores.com/uploads/fm_programs/…`），Chrome 不能原生播，需 `hls.js`（懒加载）。判断方式：`attributes['is-fm']` / `playback-type: hls`。别把文件名前缀成 alioss 音频路径——它本身就是完整 URL。
9. **收听记录不是 JSON:API**：`GET /history` 返回 `{updated-at, playlist:[{id, progress, timestamp}]}`，没有标题；要用 `GET /radios?filter[id]=1,2,3`（逗号分隔）水合。**返回顺序不等于请求顺序**，必须按 id 重建。`filter[id-in]` 会 400。
10. **收藏接口**：列表 `GET /users/{uid}/bookmarks?include=bookmarkable`（`included` 是空的，只有关系 id，需再水合）；新增 `POST /bookmarks` 必须同时带 `bookmarkable` 和 `user` 两条 resource linkage，少 `user` 会 422「user-id - 已经被使用」；删除 `DELETE /bookmarks/{id}` → 204。
11. **大屏下内容要限宽**：`main` 上限 1440px，否则 4K 车机上 3 列网格每列被拉到 400px+，封面糊成一片。
12. **触屏尺寸是一套硬约束**（不是视觉偏好）：
    - 正文字号下限 15px，次要信息（时长 / 日期 / 计数）13px，页面标题 28px。改样式时别再掉回 11~12px。
    - 热区：`index.css` 里给所有 `button` / `[role=button]` 挂了 44px 伪元素撑大命中盒（`pointer-events:none`，不吃布局）；
      叠在封面上的圆形按钮（卡片播放 64px、＋ 48px、播放条 56px / 大播放键 84px）单独给足。
    - 进度条热区 56px 高、轨道 6px、旋钮 20px；用 `pointerdown` + `setPointerCapture` 单点拖动，不依赖 hover。
    - 不能依赖 hover：`opacity-0 group-hover:opacity-100` 那种只在 `[@media(hover:none)]` 下常显。
    - 列表别只靠 7px 行距分隔——竖屏列表加了 `divide-y divide-line/70`，一行一行读得清。

---

### 12. 时间轴只有「详情 → media.timelines」一条路
- `GET /medias/{mediaId}/timelines` 是 **404**；`/timelines` 集合只能按 id 单条取（`/timelines/{id}` 200，`/timelines?filter[id]=…` 404）。
- 列表接口 `GET /radios?include=media.timelines` 会带回几百条 timelines（偏移 0 处 60 期里有 944 条），但它们的 `relationships.media` **全是空对象 `{}`**，无法归属到具体某一期 —— 所以不能在列表里预取。
- 可用写法只有 `GET /radios/{id}?include=media.timelines`。`included` 里是按 `at` 排序的 chapters：`{at, title, asset, content, quote-href}`。机核自制节目（Gadio Pro / Spec / Wave / Story、特辑）普遍有 4~50 段，入驻播客一般没有。
- 代码：`fetchRadioTimelines(radioId)` → `hooks/useTimelines.ts`；刻痕在 `TimelineTicks`，舞台与详情页共用。

### 13. 首页「最新 / 机核 / 入驻」三栏是客户端分流的
`filter[category]` 返回 400（`category is not allowed`），而且「入驻播客」这个 category 的 `scope` 同样是 `original`。所以只能一次性取回 `include=category` 再按 `categories[].name === '入驻播客'` 分流（`RadioListItem.isImported`）。

### 14. 播放进度刷新后恢复
`store/player.ts` 里 `LAST_KEY = 'gcores.last-player.v1'`：`timeupdate` 每 5 秒落盘一次，`pagehide` 再落一次；启动时 `restoreLastSession()` 恢复节目、封面与进度（**不自动播放**，浏览器策略会拦截）。

## 5. 部署：反向代理

机核 API 不返回 `Access-Control-Allow-Origin`，所以浏览器不能直连。两种做法：

### Nginx

```nginx
location /gapi/ {
    proxy_pass https://www.gcores.com/gapi/;
    proxy_set_header Host www.gcores.com;
    proxy_set_header Referer https://www.gcores.com/;
    proxy_ssl_server_name on;
    proxy_hide_header Access-Control-Allow-Origin;
}
```

### Cloudflare Worker

```js
export default {
  async fetch(req) {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/gapi/')) return new Response('Not found', { status: 404 })
    const upstream = new URL(url.pathname + url.search, 'https://www.gcores.com')
    const headers = new Headers(req.headers)
    headers.set('Referer', 'https://www.gcores.com/')
    headers.delete('host')
    return fetch(upstream, { method: req.method, headers, body: req.body })
  },
}
```

---

## 6. 目录结构

```
apps/web/src/
├── api/
│   ├── client.ts      # JSON:API 请求封装、错误类型、token 注入
│   ├── gcores.ts      # 所有机核 API 调用
│   └── auth.ts        # 登录态、扫码、设备 ID
├── components/
│   ├── AppShell.tsx   # 双布局外壳（禁区 / 内容 / 导航）
│   ├── NowPlaying.tsx # 全屏播放页
│   ├── PlayerBar.tsx  # 迷你播放条
│   ├── CoverImage.tsx # no-referrer 图片
│   ├── RadioRow.tsx   # 节目行
│   └── Tabs.tsx       # 底部 Tab / 侧边导航
├── hooks/
│   ├── useLayout.ts   # 横竖屏判断
│   └── useRadioFeed.ts
├── lib/format.ts      # coverUrl / formatTime / relativeDate
├── pages/             # 9 个页面
└── store/player.ts    # zustand 播放器（单例 audio + 心跳 + Media Session）
docs/
├── research.md        # API 与鉴权逆向记录
└── design.md          # 设计说明与取舍
```

---

## 7. 已知限制

- **时间轴只覆盖机核自制节目**：入驻播客没有章节数据，此时详情页默认落在「简介」，舞台区显示「这期没有时间轴」。机核自制节目普遍有 4~50 段。
- **`/albums/{id}` 不能带 `include=category`**：albums 没有 category 关系，会直接 400 `category is not a valid relationship of albums`（页面上表现为「播单不存在」）。播单/有声书详情只请求裸资源。
- **播单合集没有期数字段**：`chapters-count`/`radios-count` 对 `display-type=album` 的合集是 0，真实期数要读 `/albums/{id}/published-radios` 的 `meta.record-count`。
- **有声书章节受会员限制**：非会员能拿到章节列表，但 `protected_audio` 需要登录会话才能真正取流。
- **不等于官方客户端**：登录信息只存在本机 localStorage，不上传任何服务器；这是一个第三方播放器。
- **无离线下载**：受保护音频的 URL 是带 `lease-ttl` 的临时地址，缓存回放会失效，暂不做下载。
