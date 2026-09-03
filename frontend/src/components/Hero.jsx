import React, { useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

const Hero = ({ transactions = [] }) => {
  const heroCardRef = useRef(null);
  const heroSectionRef = useRef(null);

  // Calculate KPIs
  const totalAtRisk = transactions
    .filter(t => t.status === 'FAILED')
    .reduce((sum, t) => sum + t.amount_inr, 0);

  const recoveredEngaged = transactions
    .filter(t => t.status !== 'FAILED' && t.status !== 'ESCALATED')
    .reduce((sum, t) => sum + t.amount_inr, 0);

  const silentRetries = transactions
    .filter(t => t.status === 'SCHEDULED_RETRY' || t.status === 'RETRY_QUEUED').length;

  const total = transactions.length || 1;
  const escalated = transactions.filter(t => t.status === 'ESCALATED').length;
  const compliance = Math.round(((total - escalated) / total) * 100);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!heroSectionRef.current || !heroCardRef.current) return;
      const rect = heroSectionRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;
      heroCardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const handleMouseLeave = () => {
      if (!heroCardRef.current) return;
      heroCardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
    };

    const section = heroSectionRef.current;
    if (section) {
      section.addEventListener('mousemove', handleMouseMove);
      section.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (section) {
        section.removeEventListener('mousemove', handleMouseMove);
        section.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  return (
    <main id="overview" className="overflow-visible pt-40 pb-20 relative" ref={heroSectionRef}>
      <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md mb-8 hover:border-orange-500/50 transition-all cursor-pointer group shadow-[0_0_20px_-10px_rgba(249,115,22,0.3)] border-white/5 bg-white/[0.03] hover:bg-white/[0.08]">
          <span className="text-xs group-hover:text-white transition-colors text-zinc-400">RecoverPay Agent v1.0</span>
        </div>

        <h1 className="md:text-7xl lg:text-8xl bg-clip-text leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000 text-5xl font-medium text-transparent tracking-tighter bg-gradient-to-b from-white via-white to-zinc-500 max-w-5xl mr-auto mb-6 ml-auto">
          Autonomous Revenue <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-200 via-orange-100/80 to-amber-200">Recovery.</span>
        </h1>

        <p className="text-lg md:text-xl text-zinc-500 font-light max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
          AI-Driven Payment Routing and automated customer outreach. Recover failed transactions with <span className="text-zinc-200">zero manual effort</span>.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
          <a href="#batch-engine" className="shine-button h-12 px-8 rounded-full text-sm font-semibold transition-all flex items-center gap-2 shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 bg-white text-black hover:bg-zinc-100">
            Launch Batch Engine
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        <div className="perspective-container relative w-full max-w-4xl mx-auto h-[400px] animate-in fade-in zoom-in-95 duration-1000 delay-500">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[40%] bg-orange-500/10 blur-[100px] rounded-full -z-10 transition-opacity duration-500 group-hover:opacity-80"></div>
          
          <div ref={heroCardRef} className="transform-3d-card w-full h-full bg-[#0a0a0a] rounded-xl border shadow-2xl overflow-hidden relative group border-white/10" style={{transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)'}}>
            <div className="h-10 border-b bg-[#0a0a0a] flex items-center px-4 justify-between z-20 relative border-white/5">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div className="text-xs text-zinc-500 font-mono">recoverpay_agent_v1.exe</div>
              <div className="w-12"></div>
            </div>

            <div className="flex-1 p-8 bg-[#050505] relative h-[calc(100%-2.5rem)]">
              <div className="absolute inset-0 bg-grid-slate opacity-30 pointer-events-none"></div>
              <div className="relative z-10 grid grid-cols-2 gap-6 h-full items-center pop-out">
                <div className="p-8 rounded-xl border bg-white/[0.01] hover:bg-white/[0.03] transition-colors border-white/5 flex flex-col justify-center text-left h-full group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 group-hover:shadow-[0_0_8px_rgba(239,68,68,0.6)] transition-shadow"></div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Total At-Risk</div>
                  </div>
                  <div className="text-4xl font-semibold text-white tracking-tight">₹ {totalAtRisk.toLocaleString()}</div>
                </div>
                <div className="p-8 rounded-xl border bg-white/[0.01] hover:bg-white/[0.03] transition-colors border-white/5 flex flex-col justify-center text-left h-full group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 group-hover:shadow-[0_0_8px_rgba(34,197,94,0.6)] transition-shadow"></div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Recovered / Engaged</div>
                  </div>
                  <div className="text-4xl font-semibold text-white tracking-tight">₹ {recoveredEngaged.toLocaleString()}</div>
                </div>
                <div className="p-8 rounded-xl border bg-white/[0.01] hover:bg-white/[0.03] transition-colors border-white/5 flex flex-col justify-center text-left h-full group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-shadow"></div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Silent Retries</div>
                  </div>
                  <div className="text-4xl font-semibold text-white tracking-tight">{silentRetries}</div>
                </div>
                <div className="p-8 rounded-xl border bg-white/[0.01] hover:bg-white/[0.03] transition-colors border-white/5 flex flex-col justify-center text-left h-full group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500 group-hover:shadow-[0_0_8px_rgba(249,115,22,0.6)] transition-shadow"></div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Compliance</div>
                  </div>
                  <div className="text-4xl font-semibold text-white tracking-tight">{compliance}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Hero;
