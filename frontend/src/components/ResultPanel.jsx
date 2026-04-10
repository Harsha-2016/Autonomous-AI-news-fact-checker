import React, { useRef, useState } from 'react';
import TruthGauge from './TruthGauge';
import SourceBadge from './SourceBadge';
import ShareCard from './ShareCard';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { Check, Loader2 } from 'lucide-react';
import { simplifyVerdict } from '../api/client';

const ResultPanel = ({ result }) => {
  const shareCardRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  
  // ELI5 State
  const [mode, setMode] = useState('technical');
  const [eli5Text, setEli5Text] = useState(null);
  const [isSimplifying, setIsSimplifying] = useState(false);

  if (!result) return null;

  const handleEli5 = async () => {
    setMode('eli5');
    if (!eli5Text) {
      setIsSimplifying(true);
      try {
        const response = await simplifyVerdict(result.summary, result.truth_score);
        setEli5Text(response.simple_explanation);
      } catch (err) {
        console.error("Simple explanation failed", err);
        setEli5Text("Failed to simplify. Please try again later.");
      } finally {
        setIsSimplifying(false);
      }
    }
  };

  const handleExport = async () => {
    if (!shareCardRef.current || sharing) return;
    setSharing(true);
    
    // 1. Copy text summary to clipboard
    let supported = 0;
    let refuted = 0;
    let total = 0;
    
    if (result.claim_breakdown) {
      total = result.claim_breakdown.length;
      result.claim_breakdown.forEach(c => {
        if (c.verdict === 'True') supported++;
        else if (c.verdict === 'False') refuted++;
      });
    }

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const text = `TruthLens verdict: ${result.verdict.toUpperCase()} (Score ${result.truth_score}/100)
${total} claims checked · ${supported} supported · ${refuted} refuted
Analyzed: ${dateStr}
truthlens.app`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (e) {
      console.error('Copy to clipboard failed', e);
    }
    
    // 2. Capture and download Share Card image
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#07070a',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const image = canvas.toDataURL("image/png");
      const a = document.createElement('a');
      a.href = image;
      a.download = `truthlens-analysis-${Date.now()}.png`;
      a.click();
    } catch (e) {
      console.error('Error generating image', e);
    }
    
    setSharing(false);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <>
      <ShareCard ref={shareCardRef} result={result} />
      
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
               <div className="flex bg-black/40 border border-white/5 rounded-xl p-1 mb-4 shadow-inner">
                 <button 
                   onClick={() => setMode('technical')}
                   className={`flex-1 py-1.5 text-xs font-bold tracking-wide rounded-lg transition-all duration-300 ${mode === 'technical' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                 >
                   TECHNICAL
                 </button>
                 <button 
                   onClick={handleEli5}
                   className={`flex-1 py-1.5 text-xs font-bold tracking-wide rounded-lg transition-all duration-300 ${mode === 'eli5' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                 >
                   ELI5
                 </button>
               </div>

               <h3 className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full animate-pulse ${mode === 'technical' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                   {mode === 'technical' ? 'Analysis Summary' : 'Simple Explanation'}
               </h3>
               
               <div className="mb-6 min-h-[80px]">
                 <AnimatePresence mode="wait">
                   {mode === 'technical' ? (
                     <motion.p 
                       key="tech"
                       initial={{ opacity: 0, y: 5 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -5 }}
                       className="text-gray-200 leading-relaxed text-sm font-medium"
                     >
                       {result.summary}
                     </motion.p>
                   ) : (
                     <motion.p 
                       key="eli5"
                       initial={{ opacity: 0, y: 5 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -5 }}
                       className="text-purple-100 leading-relaxed text-sm font-medium"
                     >
                       {isSimplifying ? (
                         <span className="flex items-center gap-2 text-purple-300">
                           <Loader2 className="w-4 h-4 animate-spin" /> Simplifying...
                         </span>
                       ) : (
                         eli5Text
                       )}
                     </motion.p>
                   )}
                 </AnimatePresence>
               </div>

               {/* Share Button (Combined) */}
               <div className="flex flex-col gap-3 pt-6 border-t border-white/10">
                 <button
                   onClick={handleExport}
                   className="relative overflow-hidden group flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#1ebd5a] text-white text-sm font-bold shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all"
                   disabled={sharing}
                 >
                   <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
                   {sharing ? (
                     <Loader2 className="w-4 h-4 text-emerald-100 animate-spin relative z-10" />
                   ) : copied ? (
                     <Check className="w-4 h-4 text-emerald-100 relative z-10" />
                   ) : (
                     <svg className="w-4 h-4 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                       <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                     </svg>
                   )}
                   
                   <span className="relative z-10 text-base">
                     {sharing ? "Generating..." : copied ? "Copied" : "Share"}
                   </span>
                 </button>
               </div>
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

          {/* Extension Promotion Banner */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="mt-8 p-6 rounded-3xl bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-indigo-500/20 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-sm"
          >
            <div>
              <h4 className="text-white font-semibold mb-1 text-lg">Liked TruthLens So far?</h4>
              <p className="text-indigo-200/70 text-sm">You can also add an extension to your own browser for instant fact-checking anywhere on the web.</p>
            </div>
            <a 
              href="https://github.com/Harsha-2016/Autonomous-AI-news-fact-checker/tree/main/extension" 
              target="_blank" 
              rel="noopener noreferrer"
              className="whitespace-nowrap px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-900/20 transition-all active:scale-[0.98]"
            >
              Get Extension 🚀
            </a>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
};

export default ResultPanel;
