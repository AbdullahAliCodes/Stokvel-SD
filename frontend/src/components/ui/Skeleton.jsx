export default function Skeleton({
  className = '',
  width,
  height,
  rounded = 'rounded-lg',
}) {
  const style = {}
  if (width != null) {
    style.width = typeof width === 'number' ? `${width}px` : width
  }
  if (height != null) {
    style.height = typeof height === 'number' ? `${height}px` : height
  }

  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-pulse bg-stone-200 dark:bg-slate-800 ${rounded} ${className}`.trim()}
    />
  )
}
