import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { clinicsApi } from '../api/client'
import {
  COLORS, WIREFRAME, LABELS,
  getColor, getOpacity, getLabelOpacity, getLinkColor,
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

export function ArchitecturePage() {
  const graphRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)
  const [nodes, setNodes] = useState<RuntimeNode[]>([])
  const [links, setLinks] = useState<RuntimeLink[]>([])
  const [selected, setSelected] = useState<RuntimeNode | null>(null)
  const selectedIdRef = useRef<string>('router')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load graph data
  useEffect(() => {
    const clinicId = new URLSearchParams(window.location.search).get('clinic') || 'zubatka'
    clinicsApi.graph(clinicId, { include_planned: 'true' })
      .then((data) => {
        const runtimeNodes: RuntimeNode[] = (data.nodes || []).map((n) => ({
          ...n,
          type: n.group || 'tool',
          shape: n.shape || 'octahedron',
        }))
        const runtimeLinks: RuntimeLink[] = (data.links || []).map((l) => ({ ...l }))
        setNodes(runtimeNodes)
        setLinks(runtimeLinks)
        // Select router by default
        const router = runtimeNodes.find((n) => n.id === 'router')
        if (router) {
          setSelected(router)
          selectedIdRef.current = router.id
        }
        setLoading(false)
      })
      .catch((e) => {
        console.error('Failed to load arch graph:', e)
        setError('Failed to load graph data')
        setLoading(false)
      })
  }, [])

  const selectNode = useCallback((node: RuntimeNode) => {
    selectedIdRef.current = node.id
    setSelected(node)
    if (fgRef.current) {
      // Force re-render of node objects to update glow/wireframe
      fgRef.current.nodeThreeObject(fgRef.current.nodeThreeObject())
    }
  }, [])

  // Init 3D graph
  useEffect(() => {
    if (!graphRef.current || nodes.length === 0) return
    if (fgRef.current) return // already initialized

    const el = graphRef.current
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fg = (ForceGraph3D as any)()(el)
      .graphData({ nodes: [...nodes], links: [...links] })
      .backgroundColor('#0a0a1a')
      .nodeVal((n: object) => Math.max(3, ((n as RuntimeNode).val || 5) * 0.5))
      .nodeColor((n: object) => {
        const node = n as RuntimeNode
        return getColor(node.type, node.planned)
      })
      .nodeOpacity(0.85)
      .linkColor((l: object) => {
        const link = l as RuntimeLink
        const t = typeof link.target === 'object' ? link.target : null
        return getLinkColor(t?.planned)
      })
      .linkWidth(1)
      .onNodeClick((node: object) => selectNode(node as RuntimeNode))
      .nodeThreeObject((node: object) => {
        const n = node as RuntimeNode
        const group = new THREE.Group()
        const r = Math.cbrt(n.val || 5) * 4.5
        const fill = getColor(n.type, n.planned)
        const opacity = getOpacity(n.planned)
        const isActive = n.id === selectedIdRef.current

        let geo: THREE.BufferGeometry
        switch (n.shape) {
          case 'dodecahedron': geo = new THREE.IcosahedronGeometry(r * 1.3, 2); break
          case 'icosahedron': geo = new THREE.IcosahedronGeometry(r, 1); break
          case 'box': geo = new THREE.IcosahedronGeometry(r, 0); break
          case 'octahedron': geo = new THREE.DodecahedronGeometry(r * 0.8, 0); break
          case 'tetrahedron': geo = new THREE.OctahedronGeometry(r * 0.9, 0); break
          default: geo = new THREE.IcosahedronGeometry(r, 0)
        }
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

    fg.d3Force('charge')?.strength(-400)
    fg.d3Force('link')?.distance(80)

    fgRef.current = fg

    // Auto-rotation
    let autoRotate = true
    let angle = 0
    let dist = 300

    function animate() {
      if (!autoRotate || !fgRef.current) return
      angle += 0.0015
      const cam = fgRef.current.cameraPosition()
      dist = Math.sqrt(cam.x * cam.x + cam.z * cam.z) || dist
      fgRef.current.cameraPosition({
        x: dist * Math.sin(angle),
        y: cam.y,
        z: dist * Math.cos(angle),
      })
      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)

    el.addEventListener('mousedown', () => { autoRotate = false })
    el.addEventListener('contextmenu', () => { autoRotate = false })

    // Resize
    const onResize = () => {
      if (fgRef.current && el.clientWidth > 50) {
        fgRef.current.width(el.clientWidth).height(el.clientHeight)
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      if (fgRef.current) {
        fgRef.current._destructor?.()
        fgRef.current = null
      }
    }
  }, [nodes, links, selectNode])

  // Handle sidebar connection click
  const handleConnectionClick = useCallback((nodeId: string) => {
    if (!fgRef.current) return
    const data = fgRef.current.graphData()
    const node = data.nodes.find((n: object) => (n as RuntimeNode).id === nodeId)
    if (node) selectNode(node as RuntimeNode)
  }, [selectNode])

  // Compute connections for selected node
  const connsOut: string[] = []
  const connsIn: string[] = []
  if (selected) {
    links.forEach((l) => {
      const src = resolveId(l.source)
      const tgt = resolveId(l.target)
      if (src === selected.id) connsOut.push(tgt)
      if (tgt === selected.id) connsIn.push(src)
    })
  }

  const findNode = (id: string) => nodes.find((n) => n.id === id)

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

  return (
    <div className="flex" style={{ height: 'calc(100vh - 48px)' }}>
      {/* 3D Graph */}
      <div className="flex-1 relative" ref={graphRef} />

      {/* Sidebar */}
      <div className="w-80 bg-[#111127] border-l border-[#1e293b] overflow-y-auto p-4">
        {selected ? (
          <>
            {/* Type badge */}
            <div className="flex items-center gap-1.5 mb-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: COLORS[selected.type] || '#888' }}
              />
              <span className="text-[0.65rem]" style={{ color: COLORS[selected.type] || '#888' }}>
                {LABELS[selected.type] || selected.type}
              </span>
              {selected.planned && (
                <span className="text-[0.65rem] text-[#64748b] italic">(planned)</span>
              )}
            </div>

            {/* Name + ID */}
            <h3 className="text-[0.9rem] font-medium text-white mb-1">{selected.name}</h3>
            <div className="text-[0.68rem] text-[#64748b] mb-1.5">
              <code>{selected.id}</code>
            </div>

            {/* Description */}
            {selected.description && (
              <p className="text-[0.72rem] text-[#cbd5e1] my-2 leading-relaxed">
                {selected.description}
              </p>
            )}

            {/* Prompt */}
            {selected.prompt_name && (
              <div className="my-2">
                <div className="text-[0.65rem] text-[#7dd3fc] mb-0.5">Prompt (Langfuse)</div>
                <code className="text-[0.7rem] text-[#f0abfc]">{selected.prompt_name}</code>
              </div>
            )}

            {/* Inputs */}
            {selected.inputs && selected.inputs.length > 0 && (
              <div className="my-2">
                <div className="text-[0.65rem] text-[#7dd3fc] mb-0.5">Inputs</div>
                {selected.inputs.map((inp, i) => (
                  <div key={i} className="text-[0.68rem] text-[#94a3b8] py-0.5">
                    <code className="text-[#7dd3fc]">
                      {typeof inp === 'string' ? inp : (inp as { name: string }).name}
                    </code>
                  </div>
                ))}
              </div>
            )}

            {/* Outputs */}
            {selected.outputs && selected.outputs.length > 0 && (
              <div className="my-2">
                <div className="text-[0.65rem] text-[#7dd3fc] mb-0.5">Outputs</div>
                {selected.outputs.map((out, i) => (
                  <div key={i} className="text-[0.68rem] text-[#94a3b8] py-0.5">
                    <code className="text-[#34d399]">
                      {typeof out === 'string' ? out : (out as { name: string }).name}
                    </code>
                  </div>
                ))}
              </div>
            )}

            {/* Connections */}
            {(connsOut.length > 0 || connsIn.length > 0) && (
              <div className="mt-2.5 border-t border-[#1e293b] pt-2">
                <div className="text-[0.65rem] text-[#7dd3fc] mb-1">Connections</div>
                {connsOut.length > 0 && (
                  <>
                    <div className="text-[0.65rem] text-[#64748b] mb-0.5">Outgoing:</div>
                    {connsOut.map((c) => {
                      const target = findNode(c)
                      const tc = target ? (COLORS[target.type] || '#888') : '#888'
                      return (
                        <div
                          key={c}
                          className="text-[0.68rem] py-0.5 cursor-pointer hover:opacity-80"
                          onClick={() => handleConnectionClick(c)}
                        >
                          <span style={{ color: tc }}>&#9654;</span>{' '}
                          <span className="text-[#cbd5e1]">{target?.name || c}</span>
                        </div>
                      )
                    })}
                  </>
                )}
                {connsIn.length > 0 && (
                  <>
                    <div className="text-[0.65rem] text-[#64748b] mt-1 mb-0.5">Incoming:</div>
                    {connsIn.map((c) => {
                      const source = findNode(c)
                      const sc = source ? (COLORS[source.type] || '#888') : '#888'
                      return (
                        <div
                          key={c}
                          className="text-[0.68rem] py-0.5 cursor-pointer hover:opacity-80"
                          onClick={() => handleConnectionClick(c)}
                        >
                          <span style={{ color: sc }}>&#9664;</span>{' '}
                          <span className="text-[#cbd5e1]">{source?.name || c}</span>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-[#64748b]">Click a node to inspect</div>
        )}
      </div>
    </div>
  )
}
