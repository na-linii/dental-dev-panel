import { useEffect, useRef } from 'react'
import ForceGraph3DLib from '3d-force-graph'

/**
 * Test page: 3 nodes, 2 links.
 * Link A→B: stream of particles for 1 second
 * Link C→B: stream of particles for 2 seconds (reverse direction)
 * Uses linkDirectionalParticles as continuous stream, toggled on/off per link.
 */
export function TestAnimPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const gData = {
      nodes: [
        { id: 'A', name: 'Node A' },
        { id: 'B', name: 'Node B' },
        { id: 'C', name: 'Node C' },
      ],
      links: [
        { source: 'A', target: 'B', _active: false },
        { source: 'C', target: 'B', _active: false },
      ],
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Graph = (ForceGraph3DLib as any)()(el)
      .graphData(gData)
      .backgroundColor('#0a0a1a')
      .nodeColor(() => '#22d3ee')
      .nodeLabel('name')
      .nodeVal(8)
      .linkColor(() => 'rgba(255,255,255,0.3)')
      .linkWidth(2)
      // Continuous particle stream — count controlled per-link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .linkDirectionalParticles((link: any) => link._active ? 12 : 0)
      .linkDirectionalParticleWidth(3)
      .linkDirectionalParticleColor(() => '#7dd3fc')
      .linkDirectionalParticleSpeed(0.004)

    Graph.d3Force('link')?.distance(200)
    Graph.d3Force('charge')?.strength(-300)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function setLinkActive(linkIndex: number, active: boolean) {
      const links = Graph.graphData().links
      if (links[linkIndex]) {
        links[linkIndex]._active = active
        // Force refresh of particle counts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Graph.linkDirectionalParticles(Graph.linkDirectionalParticles())
      }
    }

    function runAnimation() {
      // Link 0 (A→B): active for 1 second
      setLinkActive(0, true)
      setTimeout(() => setLinkActive(0, false), 1000)

      // Link 1 (C→B): active for 2 seconds
      setLinkActive(1, true)
      setTimeout(() => setLinkActive(1, false), 2000)
    }

    // Run immediately + repeat every 4 seconds
    runAnimation()
    const interval = setInterval(runAnimation, 4000)

    return () => {
      clearInterval(interval)
      Graph._destructor?.()
    }
  }, [])

  return (
    <div style={{ height: 'calc(100vh - 48px)' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 20,
          zIndex: 10,
          color: '#7dd3fc',
          fontSize: '13px',
          background: 'rgba(0,0,0,0.8)',
          padding: '12px 16px',
          borderRadius: 8,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Test: electron stream animation</div>
        <div>A → B: <span style={{ color: '#4ade80' }}>1 second stream</span></div>
        <div>C → B: <span style={{ color: '#facc15' }}>2 second stream</span></div>
        <div style={{ color: '#64748b', marginTop: 4 }}>Repeats every 4 seconds</div>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
