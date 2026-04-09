import React from 'react';
import TruthGauge from './TruthGauge';
import SourceBadge from './SourceBadge';
import { motion } from 'framer-motion';

const ResultPanel = ({ result }) => {
  if (!result) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
      className="w-full max-w-6xl mx-auto mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8"
    >
      <div className="lg:col-span-4">
        <div className="sticky top-8 space-y-6">
          <TruthGauge score={result.truth_score} />
          
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl"
          >
             <h3 className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                 Analysis Summary
             </h3>
             <p className="text-gray-200 leading-relaxed text-sm font-medium">
               {result.summary}
             </p>
          </motion.div>
        </div>
      </div>

      <div className="lg:col-span-8">
        <h2 className="text-2xl font-semibold text-white mb-6 px-2 flex items-center gap-3">
          Cross-Referenced Sources
          <span className="flex items-center justify-center bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 w-7 h-7 rounded-full text-sm font-bold shadow-[0_0_10px_rgba(99,102,241,0.2)]">
            {result.sources?.length || 0}
          </span>
        </h2>
        
        {result.sources && result.sources.length > 0 ? (
          <div className="flex flex-col gap-4">
            {result.sources.map((source, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15 + 0.3 }}
              >
                <SourceBadge source={source} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-12 rounded-3xl bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center text-center backdrop-blur-sm">
            <div className="w-20 h-20 bg-black/30 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <span className="text-3xl grayscale opacity-50">📡</span>
            </div>
            <h3 className="text-gray-300 font-semibold mb-2 text-lg">No corroborating evidence found</h3>
            <p className="text-gray-500 text-sm max-w-md">Our intelligence systems could not securely locate reliable references regarding this claim anywhere online.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ResultPanel;
