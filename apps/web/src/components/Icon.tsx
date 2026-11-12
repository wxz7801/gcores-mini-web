import type { ReactNode } from 'react'
import { SYMBOLS, type SymbolName } from '../lib/symbols'

type IconProps = {
  /** Material Symbols 名，见 lib/symbols.ts */
  name: SymbolName
  /** 渲染尺寸（px），默认 24 */
  size?: number
  className?: string
  /** 无可见文字时给读屏用的名称；给了就对外暴露成 img 语义 */
  label?: string
}

/**
 * Material Symbols 图标。
 *
 * 源 svg 的画布是「0 -960 960 960」（负 y 轴，M3 符号的标准坐标系），
 * 这里把 viewBox 原样搬过来，按 size 缩放，所以和 24dp 的 Material 图标视觉一致。
 * 用 currentColor 填充：颜色跟文字走，深浅主题自动适配。
 */
export function Icon({ name, size = 24, className, label }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={SYMBOLS[name]} />
    </svg>
  )
}

/** 图标容器：把只能传 children 的旧位置也能塞进 <Icon /> */
export function iconOf(name: SymbolName, size?: number, className?: string): ReactNode {
  return <Icon name={name} size={size} className={className} />
}
