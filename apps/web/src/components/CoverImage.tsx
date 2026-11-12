import { cn } from '../lib/format'
/**
 * 机核图片 CDN 有 Referer ACL：从别的站点引用会返回 403。
 * 统一用 no-referrer 请求，浏览器就不会带 Referer。
 */
export function CoverImage({
  src,
  alt = '',
  className,
  eager = false,
}: {
  src: string
  alt?: string
  className?: string
  eager?: boolean
}) {
  // .img-ready 给未下载完的图一个淡入（原图加载完先按容器裁好，避免「先出一点点再铺满」的闪动）
  // 没有图时不要渲染 <img>：空的 src 会显示浏览器破图图标
  if (!src) {
    // 占位用 M3 的 surface-container-high；不要渐变（M3 不允许给普通内容面加装饰性填充）
    return <div className={cn(className, 'bg-surface-container-high')} aria-hidden="true" />
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn(className, 'img-ready')}
      loading={eager ? 'eager' : 'lazy'}
      onLoad={(e) => e.currentTarget.classList.add('img-loaded')}
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
    />
  )
}
