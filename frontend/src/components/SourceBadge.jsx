import React from 'react';
import { ExternalLink, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

const SourceBadge = ({ source }) => {
  const { title, url, trust_score, content } = source;
  const domain = new URL(url).hostname.replace('www.', '');
  
  let TrustIcon = ShieldQuestion;
  let trustColor = "text-amber-400";
  let badgeBg = "bg-amber-400/10 border-amber-400/20";
  
  if (trust_score >= 0.8) {
    TrustIcon = ShieldCheck;
    trustColor = "text-emerald-400";
    badgeBg = "bg-emerald-400/10 border-emerald-400/20";
  } else if (trust_score < 0.5) {
    TrustIcon = ShieldAlert;
    trustColor = "text-rose-400";
    badgeBg = "bg-rose-400/10 border-rose-400/20";
  }

  return (
    <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-lg backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 mb-2">
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-lg font-medium text-blue-300 hover:text-blue-100 line-clamp-2 inline-flex items-center gap-2 group-hover:underline decoration-blue-400/50 underline-offset-4 transition-colors"
        >
          {title || "Reference Source"}
          <ExternalLink className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all text-blue-400" />
        </a>
        <div className={`flex items-center gap-1.5 px-3 py-1 flex-shrink-0 rounded-full border ${badgeBg} whitespace-nowrap`}>
          <TrustIcon className={`w-4 h-4 ${trustColor}`} />
          <span className={`text-xs font-bold tracking-widest ${trustColor}`}>
            {(trust_score * 100).toFixed(0)}% TRUST
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3 mt-1">
        <span className="px-2 py-0.5 rounded-md bg-black/40 text-gray-400/80 text-xs font-mono tracking-wider">
          {domain}
        </span>
      </div>
      <p className="text-gray-300/80 text-sm leading-relaxed line-clamp-3 italic border-l-2 border-white/10 pl-3 ml-1">
        "{content}"
      </p>
    </div>
  );
};

export default SourceBadge;
