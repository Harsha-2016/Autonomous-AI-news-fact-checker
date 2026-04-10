import React, { forwardRef } from 'react';

const ShareCard = forwardRef(({ result }, ref) => {
  if (!result) return null;

  const topSources = result.sources ? result.sources.slice(0, 2) : [];
  
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div 
      ref={ref}
      className="w-[600px] p-8 rounded-3xl bg-[#07070a] border border-white/20 shadow-2xl relative overflow-hidden"
      style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}
    >
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[100px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
          <div className="flex flex-col">
             <h1 className="text-3xl font-black tracking-tighter">
                <span className="bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">Truth</span>
                <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Lens</span>
             </h1>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-white">
              {result.truth_score}<span className="text-lg text-gray-500">/100</span>
            </div>
            <div className="text-sm font-semibold tracking-wider text-blue-400 uppercase">
              {result.verdict}
            </div>
          </div>
        </div>

        {/* Claim / Summary Snippet */}
        <div className="mb-6">
          <h3 className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-2">Analysis Summary</h3>
          <p className="text-gray-200 text-base leading-relaxed font-medium">
            {result.summary}
          </p>
        </div>

        {/* Top Sources */}
        {topSources.length > 0 && (
          <div className="mb-6">
            <h3 className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3">Top Verified Sources</h3>
            <div className="flex flex-col gap-3">
              {topSources.map((source, i) => {
                const domain = new URL(source.url).hostname.replace('www.', '');
                const isTrusty = source.trust_score >= 0.8;
                return (
                  <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-300 font-medium text-sm line-clamp-1">{source.title || "Reference Source"}</span>
                      <span className={`text-xs font-bold ${isTrusty ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {(source.trust_score * 100).toFixed(0)}% TRUST
                      </span>
                    </div>
                    <span className="px-2 py-0.5 w-max rounded-md bg-black/40 text-gray-400/80 text-[10px] font-mono tracking-wider">
                      {domain}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center text-xs text-gray-500 font-medium pt-4 border-t border-white/5">
          <span>Analyzed: {dateStr}</span>
          <span>truthlens.app</span>
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
