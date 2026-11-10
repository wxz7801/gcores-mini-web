import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { createQrCode, pollQrCode, qrContent, signInWithPassword, subscribeAuth, getAuth } from '../api/auth'

type Mode = 'qr' | 'password'

export function LoginPage() {
  const nav = useNavigate()
  const [mode, setMode] = useState<Mode>('qr')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDone(Boolean(getAuth()))
    const off = subscribeAuth((s) => {
      if (s) {
        setDone(true)
        // 让「成功」状态可见一下再返回
        window.setTimeout(() => nav(-1), 700)
      }
    })
    return () => {
      off()
    }
  }, [nav])

  return (
    <div className="min-h-full bg-ink px-5 pt-[max(16px,env(safe-area-inset-top))] pb-8">
      <button type="button" onClick={() => nav(-1)} className="tap -ml-2 mb-6 text-[#e8eaef]" aria-label="返回">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      <h1 className="text-[28px] leading-tight font-bold text-white">登录机核</h1>
      <p className="mt-1.5 text-[15px] text-[#8a92a3]">登录后可收听 GPASS 节目、有声书，并同步收听进度。</p>

      <div className="mt-6 flex rounded-xl bg-card p-1">
        {(
          [
            { id: 'qr', label: '扫码登录' },
            { id: 'password', label: '手机号密码' },
          ] as { id: Mode; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={
              'flex-1 rounded-lg py-2.5 text-[16px] ' +
              (mode === t.id ? 'bg-ink font-medium text-white' : 'text-[#8a92a3]')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {done ? (
        <div className="mt-10 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gcores/15">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff3e4d" strokeWidth="2.5">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <div className="text-[16px] text-white">登录成功</div>
        </div>
      ) : mode === 'qr' ? (
        <QrLogin />
      ) : (
        <PasswordLogin />
      )}
    </div>
  )
}

/** 二维码登录：轮询 signin-with-qr-code，404 视为未扫码 */
function QrLogin() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'loading' | 'waiting' | 'scanned' | 'expired' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let stopped = false
    let timer: number | undefined

    const run = async () => {
      try {
        setState('loading')
        const session = await createQrCode()
        if (stopped) return
        setState('waiting')

        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, qrContent(session.code), {
            width: 216,
            margin: 1,
            color: { dark: '#0d0f14', light: '#ffffff' },
          })
        }

        const ttlMs = Math.max(10_000, session.expireAt * 1000 - Date.now())
        const deadline = Date.now() + ttlMs

        const tick = async () => {
          if (stopped) return
          if (Date.now() > deadline) {
            setState('expired')
            return
          }
          try {
            const res = await pollQrCode(session.code)
            if (stopped) return
            if (res.status === 'confirmed') return
            if (res.status === 'scanned') setState('scanned')
            timer = window.setTimeout(tick, 3000)
          } catch {
            timer = window.setTimeout(tick, 3000)
          }
        }
        timer = window.setTimeout(tick, 3000)
      } catch (err) {
        if (stopped) return
        setState('error')
        setError(err instanceof Error ? err.message : '生成二维码失败')
      }
    }

    void run()
    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
    }
  }, [nonce])

  return (
    <div className="mt-8 flex flex-col items-center">
      <div className="relative flex h-[248px] w-[248px] items-center justify-center rounded-2xl bg-white">
        <canvas ref={canvasRef} className="h-[216px] w-[216px]" />
        {(state === 'loading' || state === 'expired') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white">
            {state === 'loading' ? (
              <span className="text-[15px] text-[#5c6371]">二维码生成中…</span>
            ) : (
              <>
                <span className="text-[15px] text-[#5c6371]">二维码已过期</span>
                <button
                  type="button"
                  onClick={() => setNonce((n) => n + 1)}
                  className="rounded-full bg-gcores px-4 py-2 text-[15px] text-white"
                >
                  刷新二维码
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 text-center text-[15px] text-[#8a92a3]">
        {state === 'scanned' ? (
          <span className="text-timeline">已扫码，请在手机上确认登录</span>
        ) : state === 'error' ? (
          <span>二维码服务暂不可用：{error}</span>
        ) : (
          <>
            打开机核 App → 右上角「扫一扫」
            <br />
            扫码后自动登录，无需输入密码
          </>
        )}
      </div>
    </div>
  )
}

function PasswordLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true)
    setError(null)
    try {
      await signInWithPassword(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查手机号和密码')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[14px] text-[#8a92a3]">手机号</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          type="tel"
          inputMode="numeric"
          autoComplete="username"
          placeholder="输入手机号"
          className="h-12 w-full rounded-xl bg-card px-4 text-[17px] text-white outline-none placeholder:text-[#5c6371] focus:ring-1 focus:ring-gcores"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[14px] text-[#8a92a3]">密码</span>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="输入密码"
          className="h-12 w-full rounded-xl bg-card px-4 text-[17px] text-white outline-none placeholder:text-[#5c6371] focus:ring-1 focus:ring-gcores"
        />
      </label>

      {error && <div className="rounded-xl bg-gcores/10 px-3 py-2.5 text-[14px] text-gcores">{error}</div>}

      <button
        type="submit"
        disabled={busy || !username || !password}
        className="mt-2 h-12 w-full rounded-full bg-gcores text-[17px] font-medium text-white disabled:opacity-40"
      >
        {busy ? '登录中…' : '登录'}
      </button>
      <p className="pt-1 text-center text-[13px] leading-relaxed text-[#5c6371]">
        账号信息只保存在本机浏览器，不会上传到任何第三方
      </p>
    </form>
  )
}
