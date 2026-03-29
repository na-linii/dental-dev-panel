import { useEffect, useRef, useCallback } from 'react'
import ForceGraph3DLib from '3d-force-graph'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { COLORS, WIREFRAME } from '../config/viz'
import type { GraphData, GraphNode } from '../types'

interface ForceGraph3DProps {
  data: GraphData | null
  className?: string
  onNodeClick?: (nodeId: string) => void
}

const C: Record<string, string> = { ...COLORS, connector: COLORS.plugin }

function buildNodeObject(node: GraphNode): THREE.Group {
  const group = new THREE.Group()
  const r = Math.cbrt(node.val || 5) * 5
  const color = C[node.group] || '#888'

  let geo: THREE.BufferGeometry
  switch (node.shape) {
    case 'dodecahedron':
      geo = new THREE.IcosahedronGeometry(r * 1.3, 2)
      break
    case 'icosahedron':
      geo = new THREE.IcosahedronGeometry(r, 1)
      break
    case 'box':
      geo = new THREE.IcosahedronGeometry(r, 0)
      break
    case 'octahedron':
      geo = new THREE.DodecahedronGeometry(r * 0.8, 0)
      break
    case 'tetrahedron':
      geo = new THREE.OctahedronGeometry(r * 0.9, 0)
      break
    default:
      geo = new THREE.IcosahedronGeometry(r, 0)
  }

  group.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: 0.85,
      }),
    ),
  )

  // Wireframe overlay
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({
      color: WIREFRAME,
      transparent: true,
      opacity: 0.5,
    }),
  )
  wire.scale.setScalar(1.03)
  group.add(wire)

  // Label
  const s = new SpriteText(node.name)
  s.color = '#ffffff'
  s.textHeight = 5
  s.backgroundColor = 'rgba(0,0,0,0.55)'
  s.padding = 1.2
  s.borderRadius = 2
  s.material.depthWrite = false
  s.material.depthTest = false
  s.renderOrder = 999
  s.center.set(-0.3, 0.5)
  ;(s as unknown as Record<string, boolean>)._isLabel = true
  group.add(s)

  return group
}

export function ForceGraph3D({ data, className, onNodeClick }: ForceGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)
  const autoRotateRef = useRef(true)
  const angleRef = useRef(0)
  const distRef = useRef(350)
  const animFrameRef = useRef(0)

  const stopRotation = useCallback(() => {
    autoRotateRef.current = false
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let graph: any = null
    try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    graph = (ForceGraph3DLib as any)()(el)
      .backgroundColor('#0a0a1a')
      .nodeVal((n: GraphNode) => Math.max(4, (n.val || 5) * 0.6))
      .nodeColor((n: GraphNode) => C[n.group] || '#888')
      .nodeOpacity(0.85)
      .linkColor(() => 'rgba(255,255,255,0.35)')
      .linkWidth(1.5)
      .linkDirectionalParticles(0)
      .linkDirectionalParticleWidth(3)
      .linkDirectionalParticleColor(() => '#7dd3fc')
      .linkDirectionalParticleSpeed(0.012)
      .nodeThreeObject((node: GraphNode) => buildNodeObject(node))
      .nodeThreeObjectExtend(false)
      .onNodeClick((node: GraphNode) => {
        if (onNodeClick && node.id) onNodeClick(node.id)
      })

    graph.d3Force('charge')?.strength(-500)
    graph.d3Force('link')?.distance(120)

    graphRef.current = graph

    // Auto-rotation
    autoRotateRef.current = true
    angleRef.current = 0

    function animate() {
      if (!autoRotateRef.current || !graphRef.current) return
      angleRef.current += 0.0015
      const cam = graphRef.current.cameraPosition()
      distRef.current = Math.sqrt(cam.x * cam.x + cam.z * cam.z) || distRef.current
      graphRef.current.cameraPosition({
        x: distRef.current * Math.sin(angleRef.current),
        y: cam.y,
        z: distRef.current * Math.cos(angleRef.current),
      })
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)

    el.addEventListener('mousedown', stopRotation)
    el.addEventListener('contextmenu', stopRotation)

    // Resize
    const ro = new ResizeObserver(() => {
      if (graphRef.current && el.clientWidth > 0) {
        graphRef.current.width(el.clientWidth).height(el.clientHeight)
      }
    })
    ro.observe(el)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      el.removeEventListener('mousedown', stopRotation)
      el.removeEventListener('contextmenu', stopRotation)
      ro.disconnect()
      // Clean up renderer
      const renderer = graphRef.current?.renderer?.()
      if (renderer) renderer.dispose()
      graphRef.current?._destructor?.()
      graphRef.current = null
    }
    } catch (e) {
      console.error('3D graph init failed:', e)
    }
  }, [onNodeClick, stopRotation])

  // Update data when it changes
  useEffect(() => {
    if (graphRef.current && data) {
      graphRef.current.graphData({ nodes: data.nodes, links: data.links })
    }
  }, [data])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
}
