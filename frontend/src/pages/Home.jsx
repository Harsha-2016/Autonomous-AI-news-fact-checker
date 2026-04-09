import React, { useState } from 'react';
import ArticleInput from '../components/ArticleInput';
import ResultPanel from '../components/ResultPanel';
import { analyzeText } from '../api/client';
import { ScanEyeIcon } from 'lucide-react';

const Home = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleAnalyze = async (text) => {
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await analyzeText(text);
      setResult(data);
    } catch (err) {
      setError('System integration failure. Please verify the backend API endpoints and Tavily key.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-neutral-50 overflow-x-hidden selection:bg-blue-500/30 relative font-sans">
      {/* Dynamic Background Effects */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[50%] rounded-full bg-emerald-600/5 blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 py-20 flex flex-col items-center relative z-10 w-full">
        
        {/* Header Section */}
        <div className="text-center mb-16 w-full max-w-3xl">
          <div className="inline-flex items-center justify-center p-3.5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 shadow-2xl mb-6 backdrop-blur-md">
             <ScanEyeIcon className="w-10 h-10 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
          </div>
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tighter drop-shadow-xl">
            <span className="bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent drop-shadow-sm">Truth</span>
            <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Lens</span>
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed font-medium bg-white/5 py-3 px-6 rounded-full border border-white/5 shadow-inner">
            Autonomous Fact-Checking Intelligence System
          </p>
        </div>

        {/* Input Region */}
        <div className="w-full">
          <ArticleInput onAnalyze={handleAnalyze} isLoading={isLoading} />
        </div>
        
        {/* Error State */}
        {error && (
          <div className="mt-8 p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 max-w-xl w-full text-center shadow-2xl backdrop-blur-lg flex items-center justify-center gap-3">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-medium tracking-wide">{error}</span>
          </div>
        )}

        {/* Dynamic Display Rendering */}
        <div className="w-full">
           <ResultPanel result={result} />
        </div>
        
      </div>
    </div>
  );
};

export default Home;
