interface ShapeIconProps {
  shape: string
  color: string
  size?: number
}

export function ShapeIcon({ shape, color, size = 24 }: ShapeIconProps) {
  const r = size / 2
  const cx = r, cy = r

  // Generate polygon points for regular N-gon
  function polygon(sides: number, radius: number): string {
    return Array.from({ length: sides }, (_, i) => {
      const angle = (i * 2 * Math.PI / sides) - Math.PI / 2
      return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`
    }).join(' ')
  }

  const r2 = r * 0.85 // slightly smaller than viewbox

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {shape === 'sphere' ? (
        <circle cx={cx} cy={cy} r={r2} fill={color} opacity={0.3} stroke={color} strokeWidth={1.5} />
      ) : shape === 'tetrahedron' ? (
        <polygon points={polygon(3, r2)} fill={color} opacity={0.3} stroke={color} strokeWidth={1.5} />
      ) : shape === 'octahedron' ? (
        <polygon points={polygon(4, r2)} fill={color} opacity={0.3} stroke={color} strokeWidth={1.5} />
      ) : shape === 'box' ? (
        <rect x={cx - r2 * 0.75} y={cy - r2 * 0.75} width={r2 * 1.5} height={r2 * 1.5} fill={color} opacity={0.3} stroke={color} strokeWidth={1.5} rx={1} />
      ) : shape === 'dodecahedron' ? (
        <polygon points={polygon(5, r2)} fill={color} opacity={0.3} stroke={color} strokeWidth={1.5} />
      ) : shape === 'icosahedron' ? (
        <polygon points={polygon(6, r2)} fill={color} opacity={0.3} stroke={color} strokeWidth={1.5} />
      ) : (
        <polygon points={polygon(8, r2)} fill={color} opacity={0.3} stroke={color} strokeWidth={1.5} />
      )}
    </svg>
  )
}
