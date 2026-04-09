import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

const ArticleInput = ({ onAnalyze, isLoading }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim() && !isLoading) {
      onAnalyze(text);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-transparent pointer-events-none" />
      <form onSubmit={handleSubmit} className="relative z-10">
        <label htmlFor="article-text" className="block text-xl font-medium text-blue-100 mb-4 tracking-wide">
          Analyze News, Articles, or Claims
        </label>
        <div className="relative group rounded-2xl transition-all duration-300">
          <textarea
            id="article-text"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste confusing news messages or claims here, and TruthLens will inspect it..."
            className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y transition-all shadow-inner"
            required
            disabled={isLoading}
          />
          <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-500" />
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isLoading || !text.trim()}
            className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white transition-all duration-300 ease-in-out bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
            <span className="relative flex items-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing Sources...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Discover the Truth
                </>
              )}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ArticleInput;
