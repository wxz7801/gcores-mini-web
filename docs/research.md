# 机核播客触屏前端：调研记录

调研日期：2026-11-10。以下接口都用 curl 实测过，不需要登录。

## 1. 接口概况

- Base URL：`https://www.gcores.com/gapi/v1`
- 协议：JSON:API（`Content-Type: application/vnd.api+json`），字段用 kebab-case，关联数据放在 `included`。
- 分页：`page[limit]` + `page[offset]`，总数在 `meta.record-count`。
- **API 不返回 CORS 头**，浏览器不能直接跨域调用，必须经过反向代理（开发时用 Vite proxy，上线用 Nginx 或 Cloudflare Worker）。
- 资源 CDN 返回 `access-control-allow-origin: *`，支持 Range 请求，前端可以直接用：
  - 图片：`https://image.gcores.com/{file}?x-oss-process=image/resize,limit_1,m_fill,w_{W},h_{H}/quality,q_90`
  - 音频：`https://alioss.gcores.com/uploads/audio/{media.audio}`

## 2. 已验证接口

| 用途 | 请求 | 说明 |
| --- | --- | --- |
| 最新节目流 | `GET /radios?page[limit]=20&page[offset]=0&sort=-published-at&include=category,djs` | `filter[category]` / `filter[djs]` 不可用（400 Filter not allowed） |
| 节目详情 | `GET /radios/{id}?include=media.timelines,category,djs,albums,tags` | `media.audio` 是 mp3 文件名；`media-type` 为 `audio` 或 `protected_audio` |
| 时间轴 | 同上，`include=media.timelines` | `timelines.attributes`: `at`(秒) / `title` / `content` / `asset`(配图) / `quote-href` |
| 栏目列表 | `GET /categories?filter[scope]=original&page[limit]=50` | 共 58 个 |
| 栏目下节目 | `GET /categories/{id}/radios?sort=-published-at` | |
| 专辑列表 | `GET /albums?page[limit]=20` | `content-type: radio` |
| 专辑节目 | `GET /albums/{id}/published-radios` | |
| 相似推荐 | `GET /radios/{id}/similarities` | |
| 评论 | `GET /radios/{id}/comments?include=user` | `radio-timestamp` 可与播放进度关联 |
| 搜索 | `GET /search?query={kw}&type=radios` | |
| 主播作品 | `GET /users/{id}/radios` | |
| 机核 FM | `GET /radios?filter[is-fm]=1` | |

## 3. 字段要点

- `radios.attributes`：`title`、`desc`、`summary`、`duration`(秒)、`cover`(1:1)、`thumb`(16:9)、`published-at`、`likes-count`、`comments-count`、`plays`、`is-free`、`is-require-privilege`
- `content` 是 Draft.js 的 raw JSON 字符串（`blocks` + `entityMap`，entity 类型有 `IMAGE`、`LINK`），要自己渲染成节目简介。
- 付费节目：`is-free=false`、`media-type=protected_audio`，音频地址要登录并有会员权限，直接拼 alioss 地址会 404。时间轴和简介仍可公开获取。
- 用户：`nickname`、`thumb`（头像，同一个图片 CDN）。

## 4. 账号登录与付费内容（2026-11-10 调研）

从 `Session.*.js`、`5.*.js`、`Main.*.js` 前端源码中逆向得到，均走同一个 `/gapi/v1`。

### 4.1 鉴权方式

- 登录成功后服务端返回 `token` 和 `user-id`。
- 之后所有请求带请求头 `Authorization: Token token={token}`。
- token 由前端自己保存（官方站保存在 session state + 本地存储，`remember: true`）。

### 4.2 可用的登录方式

| 方式 | 接口 | 第三方前端能否用 |
| --- | --- | --- |
| App 扫码 | `POST /security/generate-qr-code` → `{code, expired-at}`；二维码内容 `https://www.gcores.com/qr/{code}`；每 5 秒 `POST /security/signin-with-qr-code` body `{"data":{"code":"…"}}`，未确认时返回 404，扫描后 `is-scanned=true`，确认后返回 `token` + `user-id` | 可以。已实测生成二维码（201，约 10 分钟有效）和轮询（404） |
| 手机号 + 密码 | `POST /tokens/refresh` body `{"data":{"provider":"identity","username":"手机号","password":"…","remember":true}}` | 可以。无需验证码，用不存在的号码实测返回 422「用户不存在」 |
| 短信验证码 | `provider:"vc"`，发码前需要网易易盾（NECaptcha）人机验证 | 难。易盾绑定官方域名，不建议做 |
| 微信 / 微博 / Apple | OAuth，回调地址绑定 gcores.com | 不行 |

### 4.3 付费音频播放（播客 GPASS 节目、有声书）

1. 节目 `media.media-type === "protected_audio"` 时，不能直接拼 alioss 地址。
2. `POST /medias/protected/radios/{radioId}/listening-session`，body `{"data":{"device-id":"本机随机 UUID"}}`，需带 token。
   返回 `{url, tracked, session-id, heartbeat-interval}`，`url` 是可播放地址。未登录实测 403。
3. `tracked=true` 时按 `heartbeat-interval`（默认 60 秒）发心跳：`PATCH /medias/listening-session` body `{"data":{"session-id":"…"}}`，返回 `{tracked}`；错误码 `invalid_listening_session` 表示会话失效，需重新申请。
4. 停止或切换节目时：`DELETE /medias/listening-session`（官方用 `keepalive: true`）。
5. 返回的 `url` 很可能是带签名、有时效的地址，暂停太久后要重新申请。

### 4.4 有声书

- 列表：`GET /albums?filter[display-type]=audiobook`（共 61 部）。
- 字段：`is-free`、`is-require-privilege`、`credit`（兑换所需点数，GPASS 会员每季度可免费兑换）、`chapters-count`。
- 章节：`GET /albums/{id}/published-radios?include=media`，章节本身就是 radio，媒体类型为 `protected_audio`，播放流程同 4.3。
- 购买和兑换（`/order_token`、`/order_token/purchase`）建议跳回官方网站或 App 完成，本项目只负责播放。

### 4.5 结论

可行。推荐以扫码登录为主（密码不经过我们的系统），密码登录为备选。代理层只透传 `Authorization` 头，不记录请求体、不保存 token。
未实测部分：带有效 token 的 listening-session 返回结构，需要一个有会员的账号配合验证。

## 5. 风险

- 这是非公开接口，字段和参数可能变动，前端要做一层适配（adapter），不要把 JSON:API 结构直接散落到组件里。
- 付费内容必须走官方登录与鉴权，不做绕过。
- 需注意机核的用户协议，建议仅作个人使用，不做公开分发；请求加缓存、控制频率。
