"use client";

import { useState, useRef, useCallback } from "react";

const SIZES = [
  { value: "auto", label: "自动" },
  { value: "1024x1024", label: "1024 x 1024" },
  { value: "1536x1024", label: "1536 x 1024" },
  { value: "1024x1536", label: "1024 x 1536" },
  { value: "2048x2048", label: "2048 x 2048" },
  { value: "2048x1152", label: "2048 x 1152" },
  { value: "1152x2048", label: "1152 x 2048" },
  { value: "3840x2160", label: "3840 x 2160 (4K)" },
  { value: "2160x3840", label: "2160 x 3840 (4K竖)" },
  { value: "custom", label: "自定义..." },
];

const QUALITIES = [
  { value: "low", label: "低 — 快速草稿" },
  { value: "medium", label: "中 — 平衡" },
  { value: "high", label: "高 — 最佳质量" },
];

const FORMATS = [
  { value: "png", label: "PNG", mime: "image/png" },
  { value: "jpeg", label: "JPEG — 更快", mime: "image/jpeg" },
  { value: "webp", label: "WebP — 更小", mime: "image/webp" },
  { value: "svg", label: "SVG — 矢量", mime: "image/svg+xml" },
  { value: "pptx", label: "PPTX — 幻灯片", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
];

const AI_MODELS = [
  { value: "openai/gpt-5.5", label: "GPT-5.5" },
  { value: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6" },
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

const ACCEPTED_TYPES = "image/*,.pdf,.txt,.md,.csv,.json";

interface UploadedFile {
  base64: string;
  type: string;
  name: string;
  preview?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PptxLayout = any;

interface ImageRecord {
  id: string;
  prompt: string;
  image?: string;
  svg?: string;
  pptx?: string;
  pptxLayout?: PptxLayout;
  format: string;
  model?: string;
}

function fileIcon(type: string) {
  if (type === "application/pdf") return "PDF";
  if (type === "text/plain" || type === "text/markdown") return "TXT";
  if (type === "text/csv") return "CSV";
  if (type === "application/json") return "JSON";
  return "DOC";
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("auto");
  const [customWidth, setCustomWidth] = useState("1920");
  const [customHeight, setCustomHeight] = useState("1080");
  const [quality, setQuality] = useState("medium");
  const [format, setFormat] = useState("png");
  const [svgModel, setSvgModel] = useState("openai/gpt-5.5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSVG = format === "svg";
  const isPPTX = format === "pptx";
  const needsModel = isSVG || isPPTX;
  const isRaster = !isSVG && !isPPTX;
  const canGenerate = prompt.trim() || files.length > 0;

  const addFiles = useCallback((fileList: FileList | File[]) => {
    for (const file of Array.from(fileList)) {
      if (file.size > 20 * 1024 * 1024) {
        setError(`${file.name} 超过 20MB 限制`);
        continue;
      }

      if (file.type.startsWith("image/")) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const MAX = 1600;
          let { width: w, height: h } = img;
          if (w > MAX || h > MAX) {
            const scale = MAX / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          const base64 = dataUrl.split(",")[1];
          setFiles((prev) => [
            ...prev,
            { base64, type: "image/jpeg", name: file.name, preview: dataUrl },
          ]);
          setError("");
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          setFiles((prev) => [
            ...prev,
            { base64, type: file.type || "application/octet-stream", name: file.name },
          ]);
          setError("");
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);

    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
      return;
    }

    const html = e.dataTransfer.getData("text/html");
    const srcMatch = html?.match(/<img[^>]+src="([^"]+)"/);
    const imgUrl =
      srcMatch?.[1] || e.dataTransfer.getData("text/uri-list") || "";

    if (imgUrl.startsWith("data:")) {
      const [header, data] = imgUrl.split(",");
      const mime = header.match(/data:([^;]+)/)?.[1] || "image/png";
      setFiles((prev) => [
        ...prev,
        { base64: data, type: mime, name: "dragged_image.png", preview: imgUrl },
      ]);
      return;
    }

    if (imgUrl.match(/^https?:\/\//)) {
      fetch(imgUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            setFiles((prev) => [
              ...prev,
              {
                base64,
                type: blob.type || "image/png",
                name: imgUrl.split("/").pop()?.split("?")[0] || "image.png",
                preview: dataUrl,
              },
            ]);
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => setError("无法加载该图片"));
    }
  }

  async function handleGenerate() {
    if (!canGenerate || loading) return;
    setLoading(true);
    setError("");

    try {
      const finalSize =
        size === "custom" ? `${customWidth}x${customHeight}` : size;
      const attachments = files.map((f) => ({
        base64: f.base64,
        type: f.type,
        name: f.name,
      }));
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          size: finalSize,
          quality,
          format,
          svgModel: needsModel ? svgModel : undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
          password,
        }),
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
        const fileNames = files.map((f) => f.name).join(", ");
        const displayPrompt =
          prompt.trim() || (fileNames ? `基于: ${fileNames}` : "");
        const record: ImageRecord = {
          id: Date.now().toString(),
          prompt: displayPrompt,
          image: data.image,
          svg: data.svg,
          pptx: data.pptx,
          pptxLayout: data.pptxLayout,
          format,
          model: needsModel
            ? AI_MODELS.find((m) => m.value === svgModel)?.label
            : "GPT-Image-2",
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

  async function handleDownload(record: ImageRecord) {
    let name: string;
    try {
      const res = await fetch("/api/filename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: record.prompt }),
      });
      const data = await res.json();
      name = data.filename || "image";
    } catch {
      name = record.prompt.slice(0, 20).replace(/[^\w一-鿿]/g, "_") || "image";
    }

    const link = document.createElement("a");
    if (record.format === "pptx" && record.pptx) {
      const bin = atob(record.pptx);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      link.href = URL.createObjectURL(blob);
      link.download = `${name}.pptx`;
    } else if (record.format === "svg" && record.svg) {
      const blob = new Blob([record.svg], { type: "image/svg+xml" });
      link.href = URL.createObjectURL(blob);
      link.download = `${name}.svg`;
    } else if (record.image) {
      const fmt =
        FORMATS.find((f) => f.value === record.format) || FORMATS[0];
      link.href = `data:${fmt.mime};base64,${record.image}`;
      link.download = `${name}.${record.format}`;
    }
    link.click();
  }

  function renderPptxPreview(layout: PptxLayout) {
    const slide = layout?.slides?.[0];
    if (!slide) return null;
    const SW = 13.33;
    const SH = 7.5;
    const bg = slide.background?.color || "#FFFFFF";

    return (
      <div className="w-full overflow-hidden" style={{ aspectRatio: `${SW} / ${SH}` }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: `${(SH / SW) * 100}%`,
            background: bg,
          }}
        >
          {(slide.elements || []).map((el: PptxLayout, i: number) => {
            if (el.type === "rect") {
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${(el.x / SW) * 100}%`,
                    top: `${(el.y / SH) * 100}%`,
                    width: `${(el.w / SW) * 100}%`,
                    height: `${(el.h / SH) * 100}%`,
                    background: el.fill || "transparent",
                    border: el.borderColor ? `${el.borderWidth || 1}px solid ${el.borderColor}` : "none",
                    borderRadius: el.borderRadius ? `${el.borderRadius * 8}px` : undefined,
                  }}
                />
              );
            }
            if (el.type === "text") {
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${(el.x / SW) * 100}%`,
                    top: `${(el.y / SH) * 100}%`,
                    width: `${(el.w / SW) * 100}%`,
                    height: `${(el.h / SH) * 100}%`,
                    background: el.fill || "transparent",
                    border: el.borderColor ? `${el.borderWidth || 1}px solid ${el.borderColor}` : "none",
                    borderRadius: el.borderRadius ? `${el.borderRadius * 8}px` : undefined,
                    display: "flex",
                    alignItems: el.valign === "top" ? "flex-start" : el.valign === "bottom" ? "flex-end" : "center",
                    justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center",
                    padding: "2px 4px",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      fontSize: `${Math.max((el.fontSize || 12) * 0.55, 5)}px`,
                      fontWeight: el.bold ? "bold" : "normal",
                      fontStyle: el.italic ? "italic" : "normal",
                      color: el.color || "#333333",
                      fontFamily: el.fontFace || "Microsoft YaHei, sans-serif",
                      lineHeight: 1.3,
                      textAlign: (el.align as CanvasTextAlign) || "left",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {el.text}
                  </span>
                </div>
              );
            }
            if (el.type === "line") {
              const x1p = (el.x1 / SW) * 100;
              const y1p = (el.y1 / SH) * 100;
              const x2p = (el.x2 / SW) * 100;
              const y2p = (el.y2 / SH) * 100;
              return (
                <svg
                  key={i}
                  style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                  viewBox={`0 0 100 100`}
                  preserveAspectRatio="none"
                >
                  <line
                    x1={x1p}
                    y1={y1p}
                    x2={x2p}
                    y2={y2p}
                    stroke={el.color || "#666666"}
                    strokeWidth={el.width || 1}
                    strokeDasharray={el.dash === "dash" ? "4 2" : el.dash === "dot" ? "1 2" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              );
            }
            if (el.type === "circle") {
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${(el.x / SW) * 100}%`,
                    top: `${(el.y / SH) * 100}%`,
                    width: `${(el.w / SW) * 100}%`,
                    height: `${(el.h / SH) * 100}%`,
                    background: el.fill || "transparent",
                    border: el.borderColor ? `${el.borderWidth || 1}px solid ${el.borderColor}` : "none",
                    borderRadius: "50%",
                  }}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  function renderImage(record: ImageRecord) {
    if (record.format === "pptx" && record.pptxLayout) {
      return renderPptxPreview(record.pptxLayout);
    }
    if (record.format === "pptx" && record.pptx) {
      return (
        <div className="w-full py-12 flex flex-col items-center justify-center gap-3 bg-surface">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <text x="8" y="17" fill="#C0392B" stroke="none" fontSize="6" fontWeight="bold" fontFamily="Arial">PPT</text>
          </svg>
          <p className="text-foreground text-sm font-medium">PPTX 文件已生成</p>
          <p className="text-muted text-xs">点击下载在 PowerPoint 中打开</p>
        </div>
      );
    }
    if (record.format === "svg" && record.svg) {
      return (
        <div
          className="w-full bg-white p-4 flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: record.svg }}
        />
      );
    }
    if (record.image) {
      const fmt =
        FORMATS.find((f) => f.value === record.format) || FORMATS[0];
      return (
        <img
          src={`data:${fmt.mime};base64,${record.image}`}
          alt={record.prompt}
          className="w-full"
        />
      );
    }
    return null;
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
            输入描述或上传文件，AI 为你生成图像
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
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleGenerate();
              }
            }}
            placeholder={
              files.length > 0
                ? "描述你想根据上传内容生成什么样的图像..."
                : "描述你想生成的图像..."
            }
            rows={3}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
          />

          {/* File Upload Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full border border-dashed rounded-xl py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              dragOver
                ? "border-accent bg-accent/5 text-foreground"
                : "border-border text-muted hover:text-foreground hover:border-accent"
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm">
              上传文件 (图片、PDF、TXT、CSV、JSON)
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Uploaded Files List */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2"
                >
                  {f.preview ? (
                    <img
                      src={f.preview}
                      alt={f.name}
                      className="w-8 h-8 object-cover rounded"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center">
                      {fileIcon(f.type)}
                    </span>
                  )}
                  <span className="text-xs text-foreground max-w-[120px] truncate">
                    {f.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="text-muted hover:text-red-400 transition-colors"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Options Row */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {isRaster && (
              <>
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

                {size === "custom" && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      className="w-20 bg-surface border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                      min={256}
                      max={3840}
                      step={16}
                    />
                    <span className="text-muted text-sm">x</span>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      className="w-20 bg-surface border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                      min={256}
                      max={3840}
                      step={16}
                    />
                  </div>
                )}

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
              </>
            )}

            {needsModel && (
              <select
                value={svgModel}
                onChange={(e) => setSvgModel(e.target.value)}
                className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              >
                {AI_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}

            <div className="flex-1" />

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || loading}
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
            Ctrl+Enter 快速生成 | 支持拖拽上传
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="border border-border rounded-xl aspect-video flex items-center justify-center bg-surface">
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
                {files.length > 0 ? "正在处理文件并生成..." : isPPTX ? "PPTX 生成中..." : isSVG ? "SVG 生成中..." : "图片生成中，通常需要 15-45 秒..."}
              </p>
            </div>
          </div>
        )}

        {/* Gallery */}
        {images.length > 0 && (
          <div ref={galleryRef} className="space-y-6">
            {images.map((record) => (
              <div
                key={record.id}
                className="border border-border rounded-xl overflow-hidden bg-surface"
              >
                {renderImage(record)}
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  <p className="text-sm text-muted truncate flex-1">
                    {record.prompt}
                  </p>
                  {record.model && (
                    <span className="text-xs text-muted/60 shrink-0">
                      {record.model}
                    </span>
                  )}
                  <button
                    onClick={() => handleDownload(record)}
                    className="text-accent hover:text-accent-hover text-sm font-medium shrink-0 transition-colors"
                  >
                    下载 .{record.format}
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
