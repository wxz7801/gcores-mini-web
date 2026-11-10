// Cloudflare Worker：静态资源 + 同源反向代理 /gapi/* → https://www.gcores.com/gapi/*
//
// 为什么需要代理：机核 API 不返回 Access-Control-Allow-Origin，浏览器直连会被 CORS 拦。
// 前端 api/client.ts 的 BASE 是 '/gapi/v1'，只要部署在同域就能直接用。
//
// 架构说明（Workers + Static Assets）：
//   wrangler.toml 里 [assets].run_worker_first = ["/gapi/*"]，
//   因此只有 /gapi/* 会进入这个 Worker，其余请求（静态文件、SPA 深链）由 assets 直接处理。
//   进来之后仍然再判一次前缀，作为兜底。
//
// 注意：workers runtime 的 fetch 会自动补齐 Origin / Referer 等头，
// 直接透传浏览器的 Origin 会让上游把它当成跨域请求，所以这里显式覆盖成机核自己的值。

const UPSTREAM = 'https://www.gcores.com'

// 不向上游透传的头（由 Cloudflare 注入的、逐跳的、以及需要改写的）
const DROP_REQ_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
  'te',
  'trailer',
  'origin',
  'referer',
  'cf-connecting-ip',
  'cf-connecting-ipv6',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'cf-ew-via',
  'cf-pseudo-ipv4',
  'cdn-loop',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-real-ip',
])

// 上游返回的、由边缘重新处理或会误导同源代理的响应头
const DROP_RES_HEADERS = new Set([
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-expose-headers',
  'access-control-max-age',
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
  'set-cookie', // 机核后端不设 cookie；透传会污染同源域自己的 cookie
])

/**
 * 把 /gapi/* 转发到机核上游。
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function proxyToUpstream(request) {
  const url = new URL(request.url)
  const upstreamUrl = new URL(url.pathname + url.search, UPSTREAM)

  const headers = new Headers()
  for (const [key, value] of request.headers) {
    if (!DROP_REQ_HEADERS.has(key.toLowerCase())) headers.set(key, value)
  }
  headers.set('Referer', UPSTREAM + '/')
  headers.set('Origin', UPSTREAM)
  headers.set('Accept-Encoding', 'identity') // 避免上游返回压缩体而 Content-Encoding 已被剥离

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  const upstreamRes = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // 自行处理重定向：登录/收藏接口若 302 到登录页，不能把 HTML 当 API 响应返回
    redirect: 'manual',
  })

  const resHeaders = new Headers()
  for (const [key, value] of upstreamRes.headers) {
    if (!DROP_RES_HEADERS.has(key.toLowerCase())) resHeaders.append(key, value)
  }

  // 上游若用绝对地址跳转到 www.gcores.com，改写成同源相对路径
  const location = resHeaders.get('location')
  if (location) {
    try {
      const loc = new URL(location, UPSTREAM)
      if (loc.origin === UPSTREAM) {
        resHeaders.set('location', loc.pathname + loc.search + loc.hash)
      }
    } catch {
      /* 非 URL，保持原样 */
    }
  }

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: resHeaders,
  })
}

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (r: Request) => Promise<Response> } }} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // run_worker_first 已保证只有 /gapi/* 进来，这里再判一次作兜底
    if (url.pathname.startsWith('/gapi/')) {
      return proxyToUpstream(request)
    }

    // 其余一律交给静态资源（含 SPA 深链回退，由 not_found_handling 决定）
    if (env?.ASSETS) return env.ASSETS.fetch(request)
    return new Response('Not found', { status: 404 })
  },
}