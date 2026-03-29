import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import ForceGraph3DLib from '3d-force-graph'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { COLORS, WIREFRAME, GRAPH_BG, CHARGE_STRENGTH, LINK_DISTANCE, nodeRadius, buildGeometry } from '../config/viz'
import type { GraphData, GraphNode } from '../types'

export interface AnimStep {
  links: [string, string][]
  dur: number
  llmNodes?: Record<string, 'openai' | 'openrouter'>
}

const LLM_COLORS = {
  openai: '#fb923c',    // orange
  openrouter: '#f472b6', // pink
} as const

export interface ForceGraph3DHandle {
  animateFlow: (path: AnimStep[], speed: number, color?: string) => void
}

interface ForceGraph3DProps {
  data: GraphData | null
  className?: string
  onNodeClick?: (nodeId: string) => void
}

const C: Record<string, string> = { ...COLORS, connector: COLORS.plugin }

function buildNodeObject(node: GraphNode): THREE.Group {
  const group = new THREE.Group()
  const r = nodeRadius(node.val)
  const color = C[node.group] || '#888'

  const geo = buildGeometry(node.shape, r, THREE) as THREE.BufferGeometry

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

/**
 * Find directed link: exact source→target match.
 * Links have _dir='fwd' or _dir='rev' to distinguish directions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findDirectedLink(graph: any, srcId: string, tgtId: string): any | null {
  const gd = graph.graphData()
  if (!gd?.links) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return gd.links.find((l: any) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source
    const t = typeof l.target === 'object' ? l.target.id : l.target
    return s === srcId && t === tgtId
  }) || null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function refreshParticles(graph: any) {
  graph.linkDirectionalParticles(graph.linkDirectionalParticles())
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
    const animTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
    // Track which nodes are "thinking" (LLM call) — nodeId → color
    const glowingNodesRef = useRef<Map<string, string>>(new Map())

    const stopRotation = useCallback(() => {
      autoRotateRef.current = false
    }, [])

    // Update wireframe color for glowing nodes
    function updateNodeGlows() {
      const g = graphRef.current
      if (!g) return
      const gd = g.graphData()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gd.nodes.forEach((node: any) => {
        const obj = node.__threeObj as THREE.Group | undefined
        if (!obj) return
        const glowColor = glowingNodesRef.current.get(node.id)
        obj.children.forEach((child: THREE.Object3D) => {
          if (child instanceof THREE.LineSegments) {
            const mat = child.material as THREE.LineBasicMaterial
            if (glowColor) {
              mat.color.set(glowColor)
              mat.opacity = 0.9
            } else {
              mat.color.set(WIREFRAME)
              mat.opacity = 0.5
            }
          }
        })
      })
    }

    useImperativeHandle(ref, () => ({
      animateFlow(path: AnimStep[], speed: number, color?: string) {
        const g = graphRef.current
        if (!g) return

        // Set particle color for this animation
        if (color) {
          g.linkDirectionalParticleColor(() => color)
        }

        // Clear previous
        animTimeoutsRef.current.forEach(clearTimeout)
        animTimeoutsRef.current = []
        const gd = g.graphData()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gd.links.forEach((l: any) => { l._active = false })
        refreshParticles(g)

        let delay = 0
        for (const step of path) {
          const stepDur = Math.max(step.dur / speed, 100)

          // Turn ON links + node glows
          const tOn = setTimeout(() => {
            for (const [src, tgt] of step.links) {
              let link = findDirectedLink(g, src, tgt)
              if (!link) link = findDirectedLink(g, tgt, src)
              if (link) link._active = true
            }
            // Set LLM node glows
            if (step.llmNodes) {
              for (const [nodeId, provider] of Object.entries(step.llmNodes)) {
                glowingNodesRef.current.set(nodeId, LLM_COLORS[provider])
              }
              updateNodeGlows()
            }
            refreshParticles(g)
          }, delay)
          animTimeoutsRef.current.push(tOn)

          // Turn OFF links + node glows
          const tOff = setTimeout(() => {
            for (const [src, tgt] of step.links) {
              let link = findDirectedLink(g, src, tgt)
              if (!link) link = findDirectedLink(g, tgt, src)
              if (link) link._active = false
            }
            // Clear LLM node glows for this step
            if (step.llmNodes) {
              for (const nodeId of Object.keys(step.llmNodes)) {
                glowingNodesRef.current.delete(nodeId)
              }
              updateNodeGlows()
            }
            refreshParticles(g)
          }, delay + stepDur)
          animTimeoutsRef.current.push(tOff)

          delay += stepDur
        }
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
          .backgroundColor(GRAPH_BG)
          .nodeVal((n: GraphNode) => Math.max(4, (n.val || 5) * 0.6))
          .nodeColor((n: GraphNode) => C[n.group] || '#888')
          .nodeOpacity(0.85)
          // Forward links visible, reverse links invisible
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkColor((link: any) => link._dir === 'rev' ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.25)')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkWidth((link: any) => link._dir === 'rev' ? 0 : 1.2)
          // Electron stream
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkDirectionalParticles((link: any) => link._active ? 10 : 0)
          .linkDirectionalParticleWidth(3)
          .linkDirectionalParticleColor(() => '#7dd3fc')
          .linkDirectionalParticleSpeed(0.004)
          .nodeThreeObject((node: GraphNode) => buildNodeObject(node))
          .nodeThreeObjectExtend(false)
          .onNodeClick((node: GraphNode) => {
            if (onNodeClick && node.id) onNodeClick(node.id)
          })

        graph.d3Force('charge')?.strength(CHARGE_STRENGTH)
        graph.d3Force('link')?.distance(LINK_DISTANCE)
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
          animTimeoutsRef.current.forEach(clearTimeout)
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
        // Build bidirectional links: forward (visible) + reverse (invisible, for animation)
        const existingPairs = new Set<string>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const links: any[] = data.links.map((l) => {
          existingPairs.add(`${l.source}__${l.target}`)
          return { ...l, _active: false, _dir: 'fwd' }
        })
        // Add reverse links for animation (only if reverse doesn't already exist)
        for (const l of data.links) {
          const revKey = `${l.target}__${l.source}`
          if (!existingPairs.has(revKey)) {
            existingPairs.add(revKey)
            links.push({ source: l.target, target: l.source, _active: false, _dir: 'rev' })
          }
        }
        graphRef.current.graphData({ nodes: data.nodes, links })
      }
    }, [data])

    return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
  },
)
