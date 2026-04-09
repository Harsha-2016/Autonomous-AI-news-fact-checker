import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ArticleInput from "./components/ArticleInput";
import FileUpload from "./components/FileUpload";
import ResultPanel from "./components/ResultPanel";
import DetectiveScene from "./components/DetectiveScene";
import { analyzeText } from "./api/client";

const TABS = [
  { id: "text", label: "✏️ Paste Text" },
  { id: "file", label: "📎 Upload File" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("text");
  const [appState, setAppState] = useState("idle"); // idle | loading | result | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [scanProgress, setScanProgress] = useState(0);

  /** @type {'idle' | 'scanning' | 'results'} */
  const detectiveState =
    appState === "loading" ? "scanning" : appState === "result" ? "results" : "idle";

  const truthScoreForScene =
    appState === "result" && result != null
      ? Number(result.truth_score) || 0
      : 0;

  useEffect(() => {
    if (appState !== "loading") {
      if (appState !== "result") setScanProgress(0);
      return;
    }
    setScanProgress(0);
    const id = window.setInterval(() => {
      setScanProgress((p) => (p >= 92 ? 92 : p + 2));
    }, 100);
    return () => window.clearInterval(id);
  }, [appState]);

  // Called by ArticleInput with the raw text string
  async function handleAnalyzeText(text) {
    setAppState("loading");
    setError("");
    setResult(null);
    try {
      const data = await analyzeText(text);
      setResult(data);
      setAppState("result");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((e) => e?.msg || String(e)).join(" ")
            : err?.message;
      setError(
        msg ||
          "Something went wrong. Make sure the backend is running on port 8000."
      );
      setAppState("error");
    }
  }

  // Called by FileUpload with the AnalyzeResponse from POST /upload
  function handleUploadResult(data) {
    setResult(data);
    setAppState("result");
    setError("");
  }

  // Called by FileUpload with an error string
  function handleUploadError(msg) {
    setError(msg);
    setAppState("error");
  }

  function handleReset() {
    setAppState("idle");
    setResult(null);
    setError("");
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-neutral-50 overflow-x-hidden selection:bg-blue-500/30 relative font-sans">
      {/* 3D detective + flashlight (Truth Seeker) */}
      <div className="fixed inset-0 z-0">
        <DetectiveScene
          state={detectiveState}
          truthScore={truthScoreForScene}
          progress={scanProgress}
        />
      </div>

      <div className="fixed inset-0 z-[1] pointer-events-none bg-gradient-to-t from-[#07070a]/90 via-[#07070a]/40 to-transparent" />

      <AnimatePresence>
        {appState === "loading" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="page-scanner-overlay"
          >
            <div className="page-scanner-grid" />
            <div className="page-scanner-line" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Soft ambient orbs behind UI */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-[2] opacity-30">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/5 blur-[140px]" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-600/5 blur-[150px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10 min-h-screen flex flex-col">
        {/* Input views — anchored lower so the 3D detective stays visible above */}
        {(appState === "idle" || appState === "loading") && (
          <div className="flex flex-col flex-1 min-h-0 justify-end pb-8 md:pb-20 pt-[35vh]">
            <div className="space-y-6 md:space-y-8 max-w-3xl mx-auto w-full">
              {/* Brand header */}
              <div className="text-center opacity-90 transition-opacity hover:opacity-100">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-2 md:mb-3 tracking-tighter">
                  <span className="bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                    Truth
                  </span>
                  <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                    Lens
                  </span>
                </h1>
                <p className="text-base md:text-lg text-neutral-400/80 font-medium">
                  Autonomous Fact-Checking Intelligence System
                </p>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-2 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-1 shadow-2xl">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    disabled={appState === "loading"}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === tab.id
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                        : "text-neutral-400 hover:text-white"
                    } disabled:opacity-50`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === "text" && (
                <ArticleInput
                  onAnalyze={handleAnalyzeText}
                  isLoading={appState === "loading"}
                />
              )}

              {activeTab === "file" && (
                <FileUpload onResult={handleUploadResult} onError={handleUploadError} />
              )}
            </div>
          </div>
        )}

        {/* Error view */}
        {appState === "error" && (
          <div className="max-w-3xl mx-auto space-y-4 py-10 md:py-14">
            <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
              <p className="font-semibold mb-2">Analysis failed</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={handleReset}
              className="text-neutral-400 hover:text-white text-sm transition"
            >
              ← Try again
            </button>
          </div>
        )}

        {/* Result view */}
        {appState === "result" && result && (
          <div className="max-w-3xl mx-auto py-6 md:py-10">
            <ResultPanel result={result} />
            <button
              onClick={handleReset}
              className="mt-6 text-neutral-400 hover:text-white text-sm transition"
            >
              ← Analyze another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
