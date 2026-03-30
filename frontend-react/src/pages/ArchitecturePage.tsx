import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { architectureApi } from '../api/client'
import {
  WIREFRAME, LABELS, HUB_VERSION,
  GRAPH_BG, CHARGE_STRENGTH, LINK_DISTANCE,
  getColor, getOpacity, getLabelOpacity, getLinkColor,
  nodeRadius, buildGeometry,
} from '../config/viz'
import type { GraphNode } from '../types'

interface RuntimeNode extends GraphNode {
  type: string
  x?: number
  y?: number
  z?: number
}

interface RuntimeLink {
  source: string | RuntimeNode
  target: string | RuntimeNode
}

function resolveId(ref: string | RuntimeNode): string {
  return typeof ref === 'object' ? ref.id : ref
}

/** Group display order */
const GROUP_ORDER = ['router', 'agent', 'tool', 'gateway', 'plugin', 'storage']

/** Chevron SVG */
function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function ArchitecturePage() {
  const graphRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)
  const [nodes, setNodes] = useState<RuntimeNode[]>([])
  const [links, setLinks] = useState<RuntimeLink[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const expandedIdRef = useRef<string>('')
  const [colors, setColors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load graph data
  useEffect(() => {
    architectureApi.graph()
      .then((data) => {
        // Extract color map from viz_config
        const vizConfig = data.meta?.viz_config
        if (vizConfig) {
          const colorMap: Record<string, string> = {}
          for (const [group, cfg] of Object.entries(vizConfig)) {
            colorMap[group] = cfg.color
          }
          setColors(colorMap)
        }

        const runtimeNodes: RuntimeNode[] = (data.nodes || []).map((n) => ({
          ...n,
          type: n.group || 'tool',
          shape: n.shape || 'octahedron',
        }))
        const runtimeLinks: RuntimeLink[] = (data.links || []).map((l) => ({ ...l }))
        setNodes(runtimeNodes)
        setLinks(runtimeLinks)
        setLoading(false)
      })
      .catch((e) => {
        console.error('Failed to load arch graph:', e)
        setError('Failed to load graph data')
        setLoading(false)
      })
  }, [])

  /** Group nodes by type for sidebar */
  const groupedNodes = useMemo(() => {
    const groups: Record<string, RuntimeNode[]> = {}
    for (const n of nodes) {
      const g = n.type || 'tool'
      if (!groups[g]) groups[g] = []
      groups[g].push(n)
    }
    const sorted: { group: string; nodes: RuntimeNode[] }[] = []
    for (const g of GROUP_ORDER) {
      if (groups[g]) sorted.push({ group: g, nodes: groups[g] })
    }
    for (const g of Object.keys(groups)) {
      if (!GROUP_ORDER.includes(g)) sorted.push({ group: g, nodes: groups[g] })
    }
    return sorted
  }, [nodes])

  /** Get display color for a node: node.color > colors[group] > #888 */
  const getNodeColor = useCallback((node: RuntimeNode) => {
    return node.color || colors[node.type] || '#888'
  }, [colors])

  /** Get display color for a group */
  const getGroupColor = useCallback((group: string) => {
    return colors[group] || '#888'
  }, [colors])

  const refreshNodeVisuals = useCallback(() => {
    try {
      if (fgRef.current) {
        fgRef.current.nodeThreeObject(fgRef.current.nodeThreeObject())
      }
    } catch { /* ignore */ }
  }, [])

  const focusNode = useCallback((node: RuntimeNode) => {
    if (!fgRef.current) return
    const nx = node.x || 0, ny = node.y || 0, nz = node.z || 0

    // Update auto-rotation pivot to orbit around this node
    const setPivot = (fgRef.current as { _setPivot?: (p: { x: number; y: number; z: number }) => void })._setPivot
    if (setPivot) setPivot({ x: nx, y: ny, z: nz })

    const distance = 120
    const hyp = Math.hypot(nx, ny, nz) || 1
    const distRatio = 1 + distance / hyp
    fgRef.current.cameraPosition(
      { x: nx * distRatio, y: ny * distRatio, z: nz * distRatio },
      { x: nx, y: ny, z: nz },
      800,
    )
  }, [])

  const selectModule = useCallback((nodeId: string) => {
    // Toggle: if already expanded, collapse
    if (expandedIdRef.current === nodeId) {
      expandedIdRef.current = ''
      setExpandedId(null)
      refreshNodeVisuals()
      return
    }
    expandedIdRef.current = nodeId
    setExpandedId(nodeId)
    refreshNodeVisuals()

    // Find the runtime node in the graph (with coordinates) and focus camera
    if (fgRef.current) {
      const data = fgRef.current.graphData()
      const runtimeNode = data.nodes.find((n: object) => (n as RuntimeNode).id === nodeId)
      if (runtimeNode) focusNode(runtimeNode as RuntimeNode)
    }
  }, [refreshNodeVisuals, focusNode])

  // Init 3D graph
  useEffect(() => {
    if (!graphRef.current || nodes.length === 0) return
    if (fgRef.current) return // already initialized

    const el = graphRef.current
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fg: any = null
    try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg = (ForceGraph3D as any)()(el)
      .graphData({ nodes: [...nodes], links: [...links] })
      .backgroundColor(GRAPH_BG)
      .nodeVal((n: object) => Math.max(3, ((n as RuntimeNode).val || 5) * 0.5))
      .nodeColor((n: object) => {
        const node = n as RuntimeNode
        return node.color || getColor(node.type, node.planned, colors)
      })
      .nodeOpacity(0.85)
      .linkColor((l: object) => {
        const link = l as RuntimeLink
        const t = typeof link.target === 'object' ? link.target : null
        return getLinkColor(t?.planned)
      })
      .linkWidth(1)
      .onNodeClick((node: object) => selectModule((node as RuntimeNode).id))
      .nodeThreeObject((node: object) => {
        const n = node as RuntimeNode
        const group = new THREE.Group()
        const r = nodeRadius(n.val)
        const fill = n.color || getColor(n.type, n.planned, colors)
        const opacity = getOpacity(n.planned)
        const isActive = n.id === expandedIdRef.current

        const geo = buildGeometry(n.shape, r, THREE) as THREE.BufferGeometry
        group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
          color: fill, transparent: true, opacity,
        })))

        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: isActive ? fill : WIREFRAME,
            transparent: true,
            opacity: n.planned ? 0.25 : (isActive ? 0.9 : 0.5),
          }),
        )
        wire.scale.setScalar(1.04)
        group.add(wire)

        if (isActive) {
          const glowGeo = new THREE.IcosahedronGeometry(r * 1.8, 1)
          group.add(new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
            color: fill, transparent: true, opacity: 0.12,
          })))
        }

        const la = getLabelOpacity(n.planned)
        const s = new SpriteText(n.name)
        s.color = `rgba(255,255,255,${isActive ? 1 : la})`
        s.textHeight = 4
        s.backgroundColor = `rgba(0,0,0,${la * 0.5})`
        s.padding = 1
        s.borderRadius = 1.5
        s.material.depthWrite = false
        s.material.depthTest = false
        s.renderOrder = 999
        s.center.set(-0.3, 0.5)
        group.add(s)

        return group
      })
      .nodeThreeObjectExtend(false)

    fg.d3Force('charge')?.strength(CHARGE_STRENGTH)
    fg.d3Force('link')?.distance(LINK_DISTANCE)

    fgRef.current = fg

    // Auto-rotation around a pivot point (default: origin, changes to selected node)
    let autoRotate = true
    let angle = 0
    let orbitDist = 300
    let pivot = { x: 0, y: 0, z: 0 }

    // Expose pivot setter for selectModule
    ;(fg as { _setPivot?: (p: { x: number; y: number; z: number }) => void })._setPivot = (p) => {
      pivot = p
      // Recalculate orbit distance from pivot
      const cam = fgRef.current?.cameraPosition()
      if (cam) {
        const dx = cam.x - pivot.x, dz = cam.z - pivot.z
        orbitDist = Math.sqrt(dx * dx + dz * dz) || 120
      }
    }

    function animate() {
      if (!autoRotate || !fgRef.current) return
      angle += 0.0015
      const cam = fgRef.current.cameraPosition()
      const dx = cam.x - pivot.x, dz = cam.z - pivot.z
      orbitDist = Math.sqrt(dx * dx + dz * dz) || orbitDist
      fgRef.current.cameraPosition({
        x: pivot.x + orbitDist * Math.sin(angle),
        y: cam.y,
        z: pivot.z + orbitDist * Math.cos(angle),
      })
      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)

    // Stop auto-rotation on manual interaction, but track spin momentum
    let lastMouseX = 0
    let mouseVelocity = 0
    let isDragging = false

    el.addEventListener('mousedown', (e) => {
      autoRotate = false
      isDragging = true
      lastMouseX = e.clientX
      mouseVelocity = 0
    })

    el.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      mouseVelocity = (e.clientX - lastMouseX) * 0.00003
      lastMouseX = e.clientX
    })

    const handleMouseUp = () => {
      if (!isDragging) return
      isDragging = false
      // If spin was fast enough, continue as auto-rotation with that velocity
      if (Math.abs(mouseVelocity) > 0.0003) {
        autoRotate = true
        // Override angle speed in animate loop
        const spinSpeed = mouseVelocity
        let decayFrame = 0
        function spinDecay() {
          if (!autoRotate || !fgRef.current) return
          const decay = Math.pow(0.995, decayFrame++)
          const speed = spinSpeed * decay
          if (Math.abs(speed) < 0.0002) {
            // Decayed enough, keep gentle auto-rotate
            return
          }
          angle += speed
          const cam = fgRef.current.cameraPosition()
          const dx = cam.x - pivot.x, dz = cam.z - pivot.z
          orbitDist = Math.sqrt(dx * dx + dz * dz) || orbitDist
          fgRef.current.cameraPosition({
            x: pivot.x + orbitDist * Math.sin(angle),
            y: cam.y,
            z: pivot.z + orbitDist * Math.cos(angle),
          })
          requestAnimationFrame(spinDecay)
        }
        requestAnimationFrame(spinDecay)
      }
    }

    el.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mouseup', handleMouseUp) // catch release outside element
    el.addEventListener('contextmenu', () => { autoRotate = false })

    // Resize — observe container div, not just window
    const ro = new ResizeObserver(() => {
      if (fgRef.current && el.clientWidth > 50) {
        fgRef.current.width(el.clientWidth).height(el.clientHeight)
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      if (fgRef.current) {
        fgRef.current._destructor?.()
        fgRef.current = null
      }
    }
    } catch (e) {
      console.error('3D graph init failed:', e)
    }
  }, [nodes, links, colors, selectModule])

  /** Compute connections for a given node */
  const getConnections = useCallback((nodeId: string) => {
    const outSet = new Set<string>()
    const inSet = new Set<string>()
    links.forEach((l) => {
      const src = resolveId(l.source)
      const tgt = resolveId(l.target)
      if (src === nodeId) outSet.add(tgt)
      if (tgt === nodeId) inSet.add(src)
    })
    const bidi: string[] = []
    const outOnly: string[] = []
    const inOnly: string[] = []
    for (const id of outSet) {
      if (inSet.has(id)) bidi.push(id)
      else outOnly.push(id)
    }
    for (const id of inSet) {
      if (!outSet.has(id)) inOnly.push(id)
    }
    return { bidi, outOnly, inOnly }
  }, [links])

  const findNode = useCallback((id: string) => nodes.find((n) => n.id === id), [nodes])

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 48px)' }}>
        <span className="text-sm text-[#64748b]">Loading architecture...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 48px)' }}>
        <span className="text-sm text-red-400">{error}</span>
      </div>
    )
  }

  const expandedNode = expandedId ? findNode(expandedId) : null
  const connections = expandedId ? getConnections(expandedId) : null

  /** Render a clickable connection item */
  const renderConnectionItem = (id: string, arrow: string, arrowColor: string) => {
    const node = findNode(id)
    const nc = node ? getNodeColor(node as RuntimeNode) : '#888'
    return (
      <div
        key={id}
        className="text-[0.68rem] py-0.5 cursor-pointer hover:opacity-80 flex items-center gap-1"
        onClick={() => selectModule(id)}
      >
        <span style={{ color: arrowColor }}>{arrow}</span>
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: nc }}
        />
        <span className="text-[#cbd5e1]">{node?.name || id}</span>
      </div>
    )
  }

  return (
    <div className="flex" style={{ height: 'calc(100vh - 48px)' }}>
      {/* 3D Graph — takes remaining space */}
      <div className="flex-1 relative min-w-0">
        <div className="w-full h-full" ref={graphRef} />
        {/* Version badge */}
        <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-md text-[11px] font-medium pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' }}
        >
          Dental Hub v{HUB_VERSION}
        </div>
      </div>

      {/* Sidebar — always visible, module list with accordion */}
      <div className="w-[300px] flex-shrink-0 bg-[#111127] border-l border-[#1e293b] overflow-y-auto">
        <div className="p-3">
          <div className="text-[0.7rem] font-medium text-[#64748b] uppercase tracking-wider mb-3">
            Modules
          </div>

          {groupedNodes.map(({ group, nodes: groupNodes }) => {
            const groupColor = getGroupColor(group)
            return (
              <div key={group} className="mb-3">
                {/* Group header */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: groupColor }}
                  />
                  <span
                    className="text-[0.62rem] font-semibold uppercase tracking-wider"
                    style={{ color: groupColor }}
                  >
                    {LABELS[group] || group}
                  </span>
                  <span className="text-[0.55rem] text-[#475569]">({groupNodes.length})</span>
                </div>

                {/* Module list within group */}
                {groupNodes.map((node) => {
                  const isExpanded = expandedId === node.id
                  const nodeColor = getNodeColor(node)

                  return (
                    <div key={node.id}>
                      {/* Module row — clickable */}
                      <div
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors duration-150 ${
                          isExpanded ? 'bg-[#1e293b]' : 'hover:bg-[#1a1a3a]'
                        }`}
                        onClick={() => selectModule(node.id)}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: nodeColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.72rem] text-[#e2e8f0] truncate">
                            {node.name}
                          </div>
                        </div>
                        {node.planned && (
                          <span className="text-[0.55rem] text-[#475569] italic flex-shrink-0">plan</span>
                        )}
                        <span className="text-[#475569] flex-shrink-0">
                          <Chevron expanded={isExpanded} />
                        </span>
                      </div>

                      {/* Expanded details (accordion) */}
                      {isExpanded && expandedNode && (
                        <div className="ml-4 mr-1 mb-2 mt-1 pl-2 border-l border-[#1e293b]">
                          {/* ID */}
                          <div className="text-[0.6rem] text-[#475569] mb-1">
                            <code>{node.id}</code>
                          </div>

                          {/* Description */}
                          {node.description && (
                            <p className="text-[0.68rem] text-[#94a3b8] mb-2 leading-relaxed">
                              {node.description}
                            </p>
                          )}

                          {/* Prompt */}
                          {node.prompt_name && (
                            <div className="mb-2">
                              <div className="text-[0.6rem] text-[#7dd3fc] mb-0.5">Prompt</div>
                              <code className="text-[0.65rem] text-[#f0abfc]">{node.prompt_name}</code>
                            </div>
                          )}

                          {/* Inputs */}
                          {node.inputs && node.inputs.length > 0 && (
                            <div className="mb-2">
                              <div className="text-[0.6rem] text-[#7dd3fc] mb-0.5">Inputs</div>
                              {node.inputs.map((inp, i) => {
                                const port = typeof inp === 'string' ? { name: inp } : inp as { name: string; type?: string; required?: boolean; description?: string }
                                return (
                                  <div key={i} className="text-[0.62rem] text-[#94a3b8] py-0.5">
                                    <code className="text-[#7dd3fc]">{port.name}</code>
                                    {port.type && <span className="text-[#64748b] ml-1 text-[0.55rem]">{port.type}</span>}
                                    {port.required === false && <span className="text-[#475569] ml-1 text-[0.5rem] italic">opt</span>}
                                    {port.description && <div className="text-[0.55rem] text-[#475569] ml-2">{port.description}</div>}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Outputs */}
                          {node.outputs && node.outputs.length > 0 && (
                            <div className="mb-2">
                              <div className="text-[0.6rem] text-[#34d399] mb-0.5">Outputs</div>
                              {node.outputs.map((out, i) => {
                                const port = typeof out === 'string' ? { name: out } : out as { name: string; type?: string; required?: boolean; description?: string }
                                return (
                                  <div key={i} className="text-[0.62rem] text-[#94a3b8] py-0.5">
                                    <code className="text-[#34d399]">{port.name}</code>
                                    {port.type && <span className="text-[#64748b] ml-1 text-[0.55rem]">{port.type}</span>}
                                    {port.required === false && <span className="text-[#475569] ml-1 text-[0.5rem] italic">opt</span>}
                                    {port.description && <div className="text-[0.55rem] text-[#475569] ml-2">{port.description}</div>}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Connections */}
                          {connections && (connections.bidi.length > 0 || connections.outOnly.length > 0 || connections.inOnly.length > 0) && (
                            <div className="mt-1.5 pt-1.5 border-t border-[#1e293b]">
                              <div className="text-[0.6rem] text-[#7dd3fc] mb-1">Connections</div>
                              {connections.bidi.length > 0 && (
                                <>
                                  <div className="text-[0.55rem] text-[#475569] mb-0.5">Bidirectional</div>
                                  {connections.bidi.map((c) => {
                                    const cn = findNode(c)
                                    return renderConnectionItem(c, '\u25C4\u25BA', cn ? getNodeColor(cn as RuntimeNode) : '#888')
                                  })}
                                </>
                              )}
                              {connections.outOnly.length > 0 && (
                                <>
                                  <div className="text-[0.55rem] text-[#475569] mt-1 mb-0.5">Outgoing</div>
                                  {connections.outOnly.map((c) => {
                                    const cn = findNode(c)
                                    return renderConnectionItem(c, '\u25BA', cn ? getNodeColor(cn as RuntimeNode) : '#888')
                                  })}
                                </>
                              )}
                              {connections.inOnly.length > 0 && (
                                <>
                                  <div className="text-[0.55rem] text-[#475569] mt-1 mb-0.5">Incoming</div>
                                  {connections.inOnly.map((c) => {
                                    const cn = findNode(c)
                                    return renderConnectionItem(c, '\u25C4', cn ? getNodeColor(cn as RuntimeNode) : '#888')
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
