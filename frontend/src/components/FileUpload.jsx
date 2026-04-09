/**
 * FileUpload.jsx
 * --------------
 * Drag-and-drop + click-to-browse file upload component.
 * Shows file name, size, and a short preview of extracted
 * text returned by the backend before running the full analysis.
 *
 * Props:
 *   onResult(data)   — called with AnalyzeResponse when analysis is done
 *   onError(msg)     — called with error string on failure
 */

import { useState, useRef, useCallback } from "react";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const ACCEPTED = {
  "application/pdf":                          ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain":                               ".txt",
  "image/png":                                ".png",
  "image/jpeg":                               ".jpg/.jpeg",
};
const ACCEPTED_MIME = Object.keys(ACCEPTED).join(",");

const FORMAT_LABELS = [
  { icon: "📄", label: "PDF" },
  { icon: "📝", label: "DOCX" },
  { icon: "🔤", label: "TXT" },
  { icon: "🖼️", label: "PNG / JPG" },
];

export default function FileUpload({ onResult, onError }) {
  const [dragging, setDragging]     = useState(false);
  const [file,     setFile]         = useState(null);     // File object
  const [status,   setStatus]       = useState("idle");   // idle | uploading | done | error
  const [progress, setProgress]     = useState(0);
  const inputRef                    = useRef(null);

  // ── drag handlers ────────────────────────────────────────────────────────
  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true);  }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setDragging(false); }, []);
  const onDrop      = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }, []);

  // ── file selection ───────────────────────────────────────────────────────
  function selectFile(f) {
    // Basic client-side mime check
    if (!Object.keys(ACCEPTED).includes(f.type) && !f.name.match(/\.(txt|pdf|docx|png|jpe?g)$/i)) {
      onError(`Unsupported file type. Please upload: PDF, DOCX, TXT, PNG, or JPG.`);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      onError("File is too large. Maximum size is 10 MB.");
      return;
    }
    setFile(f);
    setStatus("idle");
    setProgress(0);
  }

  // ── upload + analyze ─────────────────────────────────────────────────────
  async function handleUpload() {
    if (!file || status === "uploading") return;
    setStatus("uploading");
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await axios.post(`${BASE_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
        timeout: 120_000,   // 2 min — OCR + NLI can be slow
      });

      setStatus("done");
      onResult(data);

    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Upload failed. Make sure the backend is running.";
      setStatus("error");
      onError(msg);
    }
  }

  function reset() {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center
          rounded-2xl border-2 border-dashed transition cursor-pointer
          px-6 py-10 text-center backdrop-blur-sm
          ${dragging
            ? "border-blue-500 bg-blue-500/10"
            : file
              ? "border-emerald-500/30 bg-emerald-500/5 cursor-default"
              : "border-white/10 bg-white/5 hover:border-blue-500/30 hover:bg-white/10"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME}
          className="hidden"
          onChange={(e) => { if (e.target.files[0]) selectFile(e.target.files[0]); }}
        />

        {!file ? (
          <>
            {/* Upload icon */}
            <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20
                            flex items-center justify-center mb-4 text-2xl shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              ⬆
            </div>
            <p className="text-sm font-semibold text-neutral-200">
              {dragging ? "Drop it here" : "Drag & drop a file, or click to browse"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">Up to 10 MB</p>
            {/* Format pills */}
            <div className="flex gap-2 mt-4 flex-wrap justify-center">
              {FORMAT_LABELS.map(({ icon, label }) => (
                <span key={label}
                      className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5
                                 text-neutral-400 border border-white/5">
                  {icon} {label}
                </span>
              ))}
            </div>
          </>
        ) : (
          /* Selected file preview */
          <div className="w-full space-y-3">
            <div className="flex items-center gap-3">
              <FileTypeIcon name={file.name} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-neutral-100 truncate">{file.name}</p>
                <p className="text-xs text-neutral-500">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); reset(); }}
                className="text-neutral-500 hover:text-rose-400 text-lg leading-none transition"
                title="Remove file"
              >
                ×
              </button>
            </div>

            {/* Progress bar (shown while uploading) */}
            {status === "uploading" && (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-400 text-center">
                  {progress < 100
                    ? `Uploading… ${progress}%`
                    : "Extracting text & analyzing…"}
                </p>
              </div>
            )}

            {status === "error" && (
              <p className="text-xs text-rose-500 text-center font-medium">
                Upload failed — check the error details.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Analyze button (only shown when file is selected and not uploading) */}
      {file && status !== "uploading" && status !== "done" && (
        <button
          onClick={handleUpload}
          className="group relative w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm
                     font-bold hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-900/20
                     active:scale-[0.98] transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
          <span className="relative">Analyze File →</span>
        </button>
      )}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function FileTypeIcon({ name }) {
  const ext = name.split(".").pop().toLowerCase();
  const map = { pdf: "📄", docx: "📝", doc: "📝", txt: "🔤", png: "🖼️", jpg: "🖼️", jpeg: "🖼️" };
  return (
    <span className="text-3xl flex-shrink-0">{map[ext] || "📎"}</span>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}