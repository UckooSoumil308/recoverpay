import React from 'react';

const Navbar = () => {
  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-2xl transition-all duration-300 hover:-translate-y-1">
      <div className="relative flex items-center justify-between px-2 py-2 rounded-full border backdrop-blur-xl shadow-2xl ring-1 transition-all border-white/5 bg-black/50 ring-white/5 hover:bg-black/80 hover:border-white/10">
        <div className="flex items-center pl-4 gap-3 cursor-pointer">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </div>
          <span className="text-sm font-medium tracking-tight text-zinc-100">RecoverPay</span>
        </div>

        <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          <a href="#overview" className="px-3 py-1.5 text-xs transition-colors rounded-full text-zinc-500 hover:text-orange-100 hover:bg-white/5">Overview</a>
          <a href="#batch-engine" className="px-3 py-1.5 text-xs transition-colors rounded-full text-zinc-500 hover:text-orange-100 hover:bg-white/5">Batch Engine</a>
          <a href="#simulator" className="px-3 py-1.5 text-xs transition-colors rounded-full text-zinc-500 hover:text-orange-100 hover:bg-white/5">Simulator</a>
        </div>

        <div className="flex items-center pr-1 gap-2">
          <button className="relative group overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-slate-50">
            <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#fdba74_0%,#f97316_50%,#fdba74_100%)] opacity-70 group-hover:opacity-100 transition-opacity"></span>
            <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full px-4 py-1.5 text-xs font-medium backdrop-blur-3xl transition-colors bg-zinc-950 text-white hover:bg-zinc-900">
              Login
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
