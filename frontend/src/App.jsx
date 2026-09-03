import React, { useEffect, useRef, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import BatchLedger from './components/BatchLedger'
import Simulator from './components/Simulator'
import AuditTrail from './components/AuditTrail'
import { useWebSocket } from './hooks/useWebSocket'
import './index.css'

const ParticleCanvas = () => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let width, height
    let particles = []
    
    const config = {
        particleCount: 80,
        connectionRadius: 150,
        mouseRadius: 200,
        baseColor: 'rgba(255, 255, 255, 0.2)',
        highlightColor: 'rgba(249, 115, 22, 0.8)',
        lineColor: 'rgba(249, 115, 22, 0.1)',
    }

    const mouse = { x: null, y: null }

    class Particle {
        constructor() {
            this.x = Math.random() * width
            this.y = Math.random() * height
            this.vx = (Math.random() - 0.5) * 0.4
            this.vy = (Math.random() - 0.5) * 0.4
            this.size = Math.random() * 1.5 + 0.5
            this.baseAlpha = Math.random() * 0.3 + 0.1
            this.currentAlpha = this.baseAlpha
        }

        update() {
            this.x += this.vx
            this.y += this.vy

            if (this.x < 0 || this.x > width) this.vx *= -1
            if (this.y < 0 || this.y > height) this.vy *= -1

            const dx = mouse.x - this.x
            const dy = mouse.y - this.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < config.mouseRadius) {
                this.currentAlpha = Math.min(this.baseAlpha + 0.5, 1)
                ctx.beginPath()
                ctx.strokeStyle = config.lineColor
                ctx.lineWidth = 0.5
                ctx.moveTo(this.x, this.y)
                ctx.lineTo(mouse.x, mouse.y)
                ctx.stroke()
                ctx.closePath()
                ctx.fillStyle = config.highlightColor
            } else {
                this.currentAlpha = this.baseAlpha
                ctx.fillStyle = config.baseColor
            }
        }

        draw() {
            ctx.globalAlpha = this.currentAlpha
            ctx.beginPath()
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    const resize = () => {
        width = canvas.width = window.innerWidth
        height = canvas.height = window.innerHeight
        particles = []
        const count = window.innerWidth < 768 ? 40 : config.particleCount
        for (let i = 0; i < count; i++) particles.push(new Particle())
    }

    let animationFrameId;
    const animate = () => {
        ctx.clearRect(0, 0, width, height)
        if (mouse.x) {
            const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 400)
            gradient.addColorStop(0, 'rgba(249, 115, 22, 0.05)')
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, width, height)
        }
        particles.forEach(p => { p.update(); p.draw(); })
        animationFrameId = requestAnimationFrame(animate)
    }

    const handleMouseMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }
    const handleMouseOut = () => { mouse.x = null; mouse.y = null; }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseout', handleMouseOut)

    resize()
    animate()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseout', handleMouseOut)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} id="particle-canvas" className="" />
}

function App() {
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [highlightedTxnId, setHighlightedTxnId] = useState(null);
  const [auditTrigger, setAuditTrigger] = useState(0);
  const highlightTimerRef = useRef(null);

  // Shared WebSocket Message Handler
  const handleWebSocketMessage = React.useCallback((data) => {
    if (data && data.type === 'TRANSACTION_UPDATED') {
      // Dynamically update the transaction row in BatchLedger without full refetch
      if (data.transaction) {
        setTransactions((prev) => {
          const index = prev.findIndex((t) => t.id === data.transaction.id);
          if (index !== -1) {
            const copy = [...prev];
            copy[index] = { ...copy[index], ...data.transaction };
            return copy;
          }
          return [data.transaction, ...prev];
        });

        // Trigger brief border highlight animation (ring-2 ring-orange-500/50)
        setHighlightedTxnId(data.transaction.id);
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => {
          setHighlightedTxnId(null);
        }, 3000);
      }

      // Dynamically prepend the new audit log in real time
      if (data.audit_log) {
        setAuditLogs((prev) => {
          const exists = prev.some((l) => l.id === data.audit_log.id && l.id !== undefined);
          if (exists) return prev;
          return [data.audit_log, ...prev];
        });
      }
    }
  }, []);

  // Shared WebSocket Hook
  const { isConnected } = useWebSocket(handleWebSocketMessage);

  return (
    <div className="dark bg-[#020202] text-slate-200 min-h-screen selection:bg-orange-500/30 selection:text-orange-200 font-sans antialiased overflow-x-hidden scroll-smooth">
      <ParticleCanvas />
      
      {/* Ambient Spotlights */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] blur-[120px] rounded-[100%] mix-blend-screen opacity-20 animate-spotlight bg-orange-600/10"></div>
          <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] blur-[90px] rounded-full mix-blend-screen opacity-10 bg-amber-600/10"></div>
      </div>
      <div className="fixed inset-0 bg-grid-slate pointer-events-none -z-20"></div>

      {/* Floating Real-Time WebSocket Connection Badge */}
      <div className="fixed bottom-4 right-4 z-50 pointer-events-none sm:pointer-events-auto">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono backdrop-blur-md border shadow-xl transition-all ${
            isConnected
              ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
              : 'bg-zinc-900/80 border-zinc-700 text-zinc-400'
          }`}
        >
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? 'bg-emerald-400' : 'bg-zinc-500'
              }`}
            ></span>
          </span>
          <span>{isConnected ? 'Real-Time WebSocket: Live' : 'WebSocket: Connecting...'}</span>
        </div>
      </div>

      <Navbar />
      <Hero transactions={transactions} />
      <BatchLedger 
        transactions={transactions} 
        setTransactions={setTransactions} 
        highlightedTxnId={highlightedTxnId}
        isLiveConnected={isConnected}
        onBatchComplete={() => setAuditTrigger((prev) => prev + 1)}
      />

      {/* Simulator & Audit Trail Section */}
      <section id="simulator" className="py-32 relative border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <Simulator />
            <AuditTrail
              trigger={auditTrigger}
              auditLogs={auditLogs}
              setAuditLogs={setAuditLogs}
              isLiveConnected={isConnected}
            />
          </div>
        </div>
      </section>

      <footer className="border-t py-12 px-6 border-white/5 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0 font-medium text-white">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                RecoverPay Agent
            </div>
            <p className="text-xs text-zinc-500">Built for Razorpay Buildathon Demo.</p>
        </div>
      </footer>
    </div>
  )
}

export default App

