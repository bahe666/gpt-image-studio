"use client";

import { useState, useRef } from "react";

const SIZES = [
  { value: "1024x1024", label: "1024 x 1024 (正方形)" },
  { value: "1536x1024", label: "1536 x 1024 (横向)" },
  { value: "1024x1536", label: "1024 x 1536 (纵向)" },
];

const QUALITIES = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

interface ImageRecord {
  id: string;
  prompt: string;
  image: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const galleryRef = useRef<HTMLDivElement>(null);

  async function handleGenerate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), size, quality, password }),
      });

      const data = await res.json();

      if (res.status === 401) {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }

      if (!data.success) {
        setError(data.error || "生成失败");
      } else {
        const record: ImageRecord = {
          id: Date.now().toString(),
          prompt: prompt.trim(),
          image: data.image,
        };
        setImages((prev) => [record, ...prev]);
        setTimeout(() => {
          galleryRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch {
      setError("网络请求失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function handlePasswordSubmit() {
    setPassword(passwordInput);
    setNeedsPassword(false);
    setPasswordInput("");
  }

  function handleDownload(image: string, prompt: string) {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${image}`;
    link.download = `${prompt.slice(0, 30).replace(/[^\w一-鿿]/g, "_")}.png`;
    link.click();
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            GPT Image Studio
          </h1>
          <p className="text-muted text-sm">
            输入描述，GPT-Image-2 为你生成图像
          </p>
        </div>

        {/* Password Modal */}
        {needsPassword && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
              <h2 className="text-lg font-semibold">需要访问密码</h2>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                placeholder="请输入密码"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setNeedsPassword(false)}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Prompt Input */}
        <div className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleGenerate();
              }
            }}
            placeholder="描述你想生成的图像..."
            rows={4}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
          />

          {/* Options Row */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            >
              {QUALITIES.map((q) => (
                <option key={q.value} value={q.value}>
                  质量: {q.label}
                </option>
              ))}
            </select>

            <div className="flex-1" />

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="px-6 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              {loading ? "生成中..." : "生成"}
            </button>
          </div>

          <p className="text-muted text-xs">
            按 Ctrl+Enter 或 Cmd+Enter 快速生成
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Loading Placeholder */}
        {loading && (
          <div className="border border-border rounded-xl aspect-square flex items-center justify-center bg-surface">
            <div className="text-center space-y-3">
              <svg
                className="animate-spin h-8 w-8 text-accent mx-auto"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-muted text-sm animate-pulse">
                图片生成中，通常需要 15-45 秒...
              </p>
            </div>
          </div>
        )}

        {/* Image Gallery */}
        {images.length > 0 && (
          <div ref={galleryRef} className="space-y-6">
            {images.map((record) => (
              <div
                key={record.id}
                className="border border-border rounded-xl overflow-hidden bg-surface"
              >
                <img
                  src={`data:image/png;base64,${record.image}`}
                  alt={record.prompt}
                  className="w-full"
                />
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  <p className="text-sm text-muted truncate flex-1">
                    {record.prompt}
                  </p>
                  <button
                    onClick={() =>
                      handleDownload(record.image, record.prompt)
                    }
                    className="text-accent hover:text-accent-hover text-sm font-medium shrink-0 transition-colors"
                  >
                    下载
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && images.length === 0 && (
          <div className="border border-border border-dashed rounded-xl py-20 flex items-center justify-center">
            <p className="text-muted text-sm">生成的图片会显示在这里</p>
          </div>
        )}
      </div>
    </main>
  );
}
