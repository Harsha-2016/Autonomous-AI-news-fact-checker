import { useState } from "react";
import ArticleInput from "./components/ArticleInput";
import FileUpload from "./components/FileUpload";
import ResultPanel from "./components/ResultPanel";
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
      setError(
        err?.response?.data?.detail ||
        err?.message ||
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
      {/* Dynamic Background Effects */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[50%] rounded-full bg-emerald-600/5 blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        {/* Input views */}
        {(appState === "idle" || appState === "loading") && (
          <div className="space-y-8 max-w-3xl mx-auto">
            {/* Brand header */}
            <div className="text-center">
              <h1 className="text-5xl md:text-6xl font-black mb-3 tracking-tighter">
                <span className="bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                  Truth
                </span>
                <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                  Lens
                </span>
              </h1>
              <p className="text-lg text-neutral-400">
                Autonomous Fact-Checking Intelligence System
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-2 bg-white/5 border border-white/10 rounded-2xl p-1">
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
        )}

        {/* Error view */}
        {appState === "error" && (
          <div className="max-w-3xl mx-auto space-y-4">
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
          <div className="max-w-3xl mx-auto">
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
