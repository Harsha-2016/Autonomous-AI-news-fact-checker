import React, { useState } from 'react';
import { Search, Loader2, Link2 } from 'lucide-react';

const ArticleInput = ({ onAnalyze, isLoading }) => {
  const [articleUrl, setArticleUrl] = useState('');
  const [text, setText] = useState('');

  const urlTrim = articleUrl.trim();
  const textTrim = text.trim();
  const canSubmit = Boolean(urlTrim || textTrim);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit || isLoading) return;
    // URL field takes priority when both are filled
    const payload = urlTrim || textTrim;
    onAnalyze(payload);
  };

  return (
    <div className="w-full max-w-4xl mx-auto backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-transparent pointer-events-none" />
      <form onSubmit={handleSubmit} className="relative z-10">
        <h2 className="text-xl font-medium text-blue-100 mb-1 tracking-wide">
          Analyze News, Articles, or Claims
        </h2>
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          Use a link <span className="text-neutral-500">or</span> paste text — not both needed. If both are filled, the URL is analyzed first.
        </p>

        <label htmlFor="article-url" className="flex items-center gap-2 text-sm font-medium text-sky-200/90 mb-2">
          <Link2 className="w-4 h-4 opacity-80" aria-hidden />
          Article URL
        </label>
        <div className="relative group rounded-2xl mb-1">
          <input
            id="article-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            placeholder="https://www.example.com/news/article"
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/45 transition-all shadow-inner text-sm"
            disabled={isLoading}
          />
        </div>
        <p className="text-xs text-neutral-500 mb-6">We fetch the page and extract the main article text automatically.</p>

        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <span className="text-xs uppercase tracking-widest text-neutral-500">or paste text</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        <label htmlFor="article-text" className="sr-only">
          Article text
        </label>
        <div className="relative group rounded-2xl transition-all duration-300">
          <textarea
            id="article-text"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full article, claims, or statements here…"
            className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y transition-all shadow-inner"
            disabled={isLoading}
          />
          <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-500" />
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isLoading || !canSubmit}
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
