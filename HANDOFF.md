# 交接说明（进度快照 2026-11-10）

## 怎么跑起来

```bash
cd apps/web
pnpm install        # 已装好 node_modules，重新拉代码时才需要
pnpm dev            # http://[::1]:5273
pnpm build          # 产物在 apps/web/dist
```

WSL 里没装 Node 时，用 `export PATH=$HOME/.local/node/bin:$PATH` 再执行 pnpm。

**注意：API 没有 CORS 头**，必须走 Vite 代理（`vite.config.ts` 里 `/gapi` → `https://www.gcores.com`）。
部署到自有域名时要配 Nginx 或 Cloudflare Worker 反向代理，浏览器直连会被拦。

## 当前形态

- **竖屏（<640px）**：单列 / 两列小卡片网格，底部播放条（常驻，未播放时是占位条），
  播放条上方是浮动导航胶囊（发现 / 播单 / 有声书 / 我的），页签：最新 · 机核 · 入驻 · GPASS · 机核 FM。
- **横屏（宽 ≥ 某阈值且高度小）**：左侧「舞台」（封面 + 进度 + 5 个按钮，点封面进详情），
  右侧内容区，底部居中浮动导航。左侧区域大部分 `pointer-events: none`，
  需要交互的子元素必须挂 `.stage-interactive` 类，否则点不动。

## 关键接口事实（踩过的坑都在 README「实现踩坑」一节）

- 列表 `GET /radios?include=category,djs,media`；时间轴只能 `GET /radios/{id}?include=media.timelines`。
- `/medias/{id}/timelines` 是 404；列表里带回来的 timelines 没有 media 归属，无法预取。
- `filter[category]` / `filter[is-free]` / `filter[album]` 一律 400，只能客户端分流。
- 单页上限 100（`page[limit]=250` → 400）。
- 录音笔 = 4 张按年专辑（333/247/214/199），合集页 `/series/recorder`。

## 最近一轮改动（本轮）

1. 全站字号上调（正文 15+，次要 13，标题 28），44px 伪元素热区，播放条 56px 拖动区。
2. 录音笔在 GPASS 收成方格（`components/SeriesTile.tsx`），其余页签照常逐期。
3. 竖屏网格改两列小卡片（166×159，一屏 6 期），≥640px 恢复完整信息。

## 待定 / 用户明确暂缓

- 竖屏列表模式 + 顶栏「◫/☰」切换（用户说先不加）。
- 录音笔方格加浅金描边（可选，未做）。
