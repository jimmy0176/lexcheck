/** 装饰性波纹线条背景，用于深色品牌区块（参照 Vultr 风格：细线条渐变波纹）。 */
export function HeroWaves({
  className,
  linesA = 14,
  linesB = 9,
  strokeOpacity = 0.55,
  strokeWidth = 1.5,
}: {
  className?: string;
  /** 第一组线条数量 */
  linesA?: number;
  /** 第二组线条数量 */
  linesB?: number;
  /** 渐变起始处的线条不透明度，越大线条越明显 */
  strokeOpacity?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="hero-wave-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.14 262)" stopOpacity={strokeOpacity} />
          <stop offset="100%" stopColor="oklch(0.72 0.14 262)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: linesA }, (_, i) => i).map((i) => (
        <path
          key={i}
          d={`M ${1000 - i * 80} ${-80} C ${920 - i * 80} ${220}, ${760 - i * 80} ${420}, ${700 - i * 80} ${900}`}
          fill="none"
          stroke="url(#hero-wave-stroke)"
          strokeWidth={strokeWidth}
        />
      ))}
      {Array.from({ length: linesB }, (_, i) => i).map((i) => (
        <path
          key={`b${i}`}
          d={`M ${1400 - i * 94} ${-80} C ${1300 - i * 94} ${300}, ${1180 - i * 94} ${480}, ${1080 - i * 94} ${900}`}
          fill="none"
          stroke="url(#hero-wave-stroke)"
          strokeWidth={strokeWidth}
          opacity={0.7}
        />
      ))}
    </svg>
  );
}
