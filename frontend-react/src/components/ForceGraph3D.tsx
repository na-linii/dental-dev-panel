import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import ForceGraph3DLib from '3d-force-graph'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { COLORS, WIREFRAME } from '../config/viz'
import type { GraphData, GraphNode } from '../types'

export interface AnimStep {
  links: [string, string][]
  dur: number
}

export interface ForceGraph3DHandle {
  animateFlow: (path: AnimStep[], speed: number) => void
}

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
    case 'dodecahedron': geo = new THREE.IcosahedronGeometry(r * 1.3, 2); break
    case 'icosahedron': geo = new THREE.IcosahedronGeometry(r, 1); break
    case 'box': geo = new THREE.IcosahedronGeometry(r, 0); break
    case 'octahedron': geo = new THREE.DodecahedronGeometry(r * 0.8, 0); break
    case 'tetrahedron': geo = new THREE.OctahedronGeometry(r * 0.9, 0); break
    default: geo = new THREE.IcosahedronGeometry(r, 0)
  }

  group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    color, transparent: true, opacity: 0.85,
  })))

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: WIREFRAME, transparent: true, opacity: 0.5 }),
  )
  wire.scale.setScalar(1.03)
  group.add(wire)

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

export const ForceGraph3D = forwardRef<ForceGraph3DHandle, ForceGraph3DProps>(
  function ForceGraph3D({ data, className, onNodeClick }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graphRef = useRef<any>(null)
    const autoRotateRef = useRef(true)
    const angleRef = useRef(0)
    const distRef = useRef(350)
    const animFrameRef = useRef(0)
    // Track which links are currently "active" for particle animation
    const activeLinkSetRef = useRef<Set<string>>(new Set())

    const stopRotation = useCallback(() => {
      autoRotateRef.current = false
    }, [])

    function linkKey(src: string, tgt: string) {
      return `${src}__${tgt}`
    }

    useImperativeHandle(ref, () => ({
      animateFlow(path: AnimStep[], speed: number) {
        const g = graphRef.current
        if (!g) return

        // Clear previous animation
        activeLinkSetRef.current.clear()
        g.linkDirectionalParticles((/* link */) => 0)

        let delay = 0
        const allTimeouts: ReturnType<typeof setTimeout>[] = []

        for (const step of path) {
          const stepDur = Math.max(step.dur / speed, 80)
          for (const [src, tgt] of step.links) {
            const t = setTimeout(() => {
              activeLinkSetRef.current.add(linkKey(src, tgt))
              activeLinkSetRef.current.add(linkKey(tgt, src)) // both directions
              // Update particle count for active links
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              g.linkDirectionalParticles((link: any) => {
                const s = typeof link.source === 'object' ? link.source.id : link.source
                const t2 = typeof link.target === 'object' ? link.target.id : link.target
                return activeLinkSetRef.current.has(linkKey(s, t2)) ? 4 : 0
              })
            }, delay)
            allTimeouts.push(t)

            // Turn off this link's particles after stepDur
            const t2 = setTimeout(() => {
              activeLinkSetRef.current.delete(linkKey(src, tgt))
              activeLinkSetRef.current.delete(linkKey(tgt, src))
            }, delay + stepDur)
            allTimeouts.push(t2)
          }
          delay += stepDur
        }

        // Final cleanup
        const tFinal = setTimeout(() => {
          activeLinkSetRef.current.clear()
          g.linkDirectionalParticles(0)
        }, delay + 300)
        allTimeouts.push(tFinal)
      },
    }), [])

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
          .linkDirectionalParticleWidth(5)
          .linkDirectionalParticleColor(() => '#7dd3fc')
          .linkDirectionalParticleSpeed(0.025)
          .nodeThreeObject((node: GraphNode) => buildNodeObject(node))
          .nodeThreeObjectExtend(false)
          .onNodeClick((node: GraphNode) => {
            if (onNodeClick && node.id) onNodeClick(node.id)
          })

        graph.d3Force('charge')?.strength(-500)
        graph.d3Force('link')?.distance(120)
        graphRef.current = graph

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
          const renderer = graphRef.current?.renderer?.()
          if (renderer) renderer.dispose()
          graphRef.current?._destructor?.()
          graphRef.current = null
        }
      } catch (e) {
        console.error('3D graph init failed:', e)
      }
    }, [onNodeClick, stopRotation])

    useEffect(() => {
      if (graphRef.current && data) {
        graphRef.current.graphData({ nodes: data.nodes, links: data.links })
      }
    }, [data])

    return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
  },
)
