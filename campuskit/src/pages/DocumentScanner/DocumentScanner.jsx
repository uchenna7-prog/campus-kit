import { useState, useRef, useCallback } from "react";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "var(--off-white, #f7f7f5)",
    color: "var(--ink, #1a1a18)",
    fontFamily: "'Geist', sans-serif",
    padding: "0 0 60px 0",
  },
  header: {
    padding: "32px 40px 24px",
    borderBottom: "1px solid rgba(26,26,24,0.1)",
    marginBottom: "40px",
  },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: "2rem",
    fontWeight: 400,
    margin: 0,
    color: "var(--ink, #1a1a18)",
  },
  subtitle: {
    fontSize: "0.875rem",
    color: "rgba(26,26,24,0.5)",
    marginTop: "6px",
  },
  container: {
    maxWidth: "820px",
    margin: "0 auto",
    padding: "0 40px",
  },
  uploadZone: {
    border: "2px dashed rgba(26,26,24,0.2)",
    borderRadius: "16px",
    padding: "60px 40px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backgroundColor: "rgba(26,26,24,0.02)",
    position: "relative",
    overflow: "hidden",
  },
  uploadZoneHover: {
    border: "2px dashed rgba(26,26,24,0.5)",
    backgroundColor: "rgba(26,26,24,0.05)",
  },
  uploadIcon: {
    width: "48px",
    height: "48px",
    margin: "0 auto 16px",
    opacity: 0.3,
  },
  uploadText: {
    fontSize: "1rem",
    fontWeight: 500,
    marginBottom: "8px",
  },
  uploadSubtext: {
    fontSize: "0.8rem",
    color: "rgba(26,26,24,0.45)",
  },
  orDivider: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    margin: "24px 0",
    color: "rgba(26,26,24,0.3)",
    fontSize: "0.8rem",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: "rgba(26,26,24,0.1)",
  },
  cameraBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "1.5px solid rgba(26,26,24,0.15)",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontFamily: "'Geist', sans-serif",
    color: "var(--ink, #1a1a18)",
    fontWeight: 500,
    transition: "all 0.15s ease",
  },
  previewCard: {
    borderRadius: "16px",
    overflow: "hidden",
    border: "1px solid rgba(26,26,24,0.08)",
    backgroundColor: "#fff",
  },
  previewImg: {
    width: "100%",
    display: "block",
    maxHeight: "340px",
    objectFit: "contain",
    backgroundColor: "#fafafa",
  },
  canvasWrapper: {
    position: "relative",
    width: "100%",
  },
  actionBar: {
    display: "flex",
    gap: "12px",
    marginTop: "28px",
    flexWrap: "wrap",
  },
  btnPrimary: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "13px 24px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "var(--ink, #1a1a18)",
    color: "#f7f7f5",
    fontFamily: "'Geist', sans-serif",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "opacity 0.15s ease",
  },
  btnSecondary: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "13px 24px",
    borderRadius: "10px",
    border: "1.5px solid rgba(26,26,24,0.15)",
    backgroundColor: "transparent",
    color: "var(--ink, #1a1a18)",
    fontFamily: "'Geist', sans-serif",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  btnDanger: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "13px 24px",
    borderRadius: "10px",
    border: "1.5px solid rgba(220,50,50,0.25)",
    backgroundColor: "transparent",
    color: "#dc3232",
    fontFamily: "'Geist', sans-serif",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 18px",
    borderRadius: "12px",
    marginTop: "20px",
    fontSize: "0.85rem",
  },
  statusProcessing: {
    backgroundColor: "rgba(245, 166, 35, 0.08)",
    border: "1px solid rgba(245, 166, 35, 0.2)",
    color: "#a06c00",
  },
  statusSuccess: {
    backgroundColor: "rgba(34, 160, 80, 0.07)",
    border: "1px solid rgba(34, 160, 80, 0.2)",
    color: "#1a6e3a",
  },
  statusError: {
    backgroundColor: "rgba(220, 50, 50, 0.07)",
    border: "1px solid rgba(220, 50, 50, 0.2)",
    color: "#b02020",
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid currentColor",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    flexShrink: 0,
  },
  cornersInfo: {
    marginTop: "20px",
    padding: "18px",
    borderRadius: "12px",
    backgroundColor: "rgba(26,26,24,0.03)",
    border: "1px solid rgba(26,26,24,0.07)",
  },
  cornersTitle: {
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(26,26,24,0.4)",
    marginBottom: "12px",
  },
  cornersGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  cornerItem: {
    fontSize: "0.8rem",
    padding: "8px 12px",
    borderRadius: "8px",
    backgroundColor: "#fff",
    border: "1px solid rgba(26,26,24,0.08)",
    fontFamily: "monospace",
  },
  extractedText: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "12px",
    backgroundColor: "#fff",
    border: "1px solid rgba(26,26,24,0.08)",
    fontSize: "0.875rem",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    maxHeight: "300px",
    overflowY: "auto",
    color: "var(--ink, #1a1a18)",
  },
  tabRow: {
    display: "flex",
    gap: "4px",
    marginTop: "28px",
    borderBottom: "1px solid rgba(26,26,24,0.1)",
    paddingBottom: "0",
  },
  tab: {
    padding: "10px 18px",
    fontSize: "0.85rem",
    fontFamily: "'Geist', sans-serif",
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    backgroundColor: "transparent",
    color: "rgba(26,26,24,0.4)",
    borderBottom: "2px solid transparent",
    marginBottom: "-1px",
    transition: "all 0.15s ease",
  },
  tabActive: {
    color: "var(--ink, #1a1a18)",
    borderBottom: "2px solid var(--ink, #1a1a18)",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    color: "rgba(26,26,24,0.3)",
    fontSize: "0.875rem",
  },
  cameraModal: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
  },
  cameraVideo: {
    width: "min(90vw, 600px)",
    borderRadius: "16px",
    backgroundColor: "#000",
  },
  cameraBtnRow: {
    display: "flex",
    gap: "16px",
  },
  snapBtn: {
    padding: "14px 32px",
    borderRadius: "50px",
    border: "none",
    backgroundColor: "#fff",
    color: "#1a1a18",
    fontFamily: "'Geist', sans-serif",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  closeCamBtn: {
    padding: "14px 24px",
    borderRadius: "50px",
    border: "1.5px solid rgba(255,255,255,0.3)",
    backgroundColor: "transparent",
    color: "#fff",
    fontFamily: "'Geist', sans-serif",
    fontSize: "0.9rem",
    cursor: "pointer",
  },
};

const CORNER_LABELS = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"];
const CORNER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];

// ─── Gemini API helper ─────────────────────────────────────────
async function callGemini(base64, mimeType, prompt) {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export default function DocumentScanner() {
  const [image, setImage] = useState(null);
  const [corners, setCorners] = useState(null);
  const [warpedImage, setWarpedImage] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [status, setStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("corners");
  const [dragOver, setDragOver] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [draggingCorner, setDraggingCorner] = useState(null);

  const fileInputRef = useRef();
  const canvasRef = useRef();
  const overlayCanvasRef = useRef();
  const videoRef = useRef();
  const streamRef = useRef();

  // ─── Load image ────────────────────────────────────────────────
  const loadImage = (dataUrl) => {
    const img = new Image();
    img.onload = () => {
      setImage({ dataUrl, width: img.width, height: img.height });
      setCorners(null);
      setWarpedImage(null);
      setExtractedText("");
      setStatus(null);
    };
    img.src = dataUrl;
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => loadImage(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // ─── Camera ────────────────────────────────────────────────────
  const openCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setShowCamera(false);
      setStatus({ type: "error", msg: "Camera access denied or unavailable." });
    }
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();
    loadImage(dataUrl);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setShowCamera(false);
  };

  // ─── Gemini: detect corners ────────────────────────────────────
  const detectCorners = async () => {
    if (!image) return;

    if (!GEMINI_API_KEY) {
      setStatus({ type: "error", msg: "API key not found. Make sure VITE_GEMINI_API_KEY is set in your .env file." });
      return;
    }

    setStatus({ type: "processing", msg: "Detecting document corners with Gemini Vision…" });
    setCorners(null);
    setWarpedImage(null);
    setExtractedText("");

    try {
      const base64 = image.dataUrl.split(",")[1];
      const mimeType = image.dataUrl.split(";")[0].split(":")[1];

      const prompt = `Detect the four corners of the document or paper visible in this image.
Return ONLY a JSON object in this exact format, no explanation, no markdown:
{
  "corners": [
    {"x": <0-1 normalized>, "y": <0-1 normalized>, "label": "top-left"},
    {"x": <0-1 normalized>, "y": <0-1 normalized>, "label": "top-right"},
    {"x": <0-1 normalized>, "y": <0-1 normalized>, "label": "bottom-right"},
    {"x": <0-1 normalized>, "y": <0-1 normalized>, "label": "bottom-left"}
  ]
}
x and y are normalized coordinates from 0 to 1 relative to image width and height.
Order must be: top-left, top-right, bottom-right, bottom-left.`;

      const raw = await callGemini(base64, mimeType, prompt);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const pts = parsed.corners.map((c) => ({
        x: Math.round(c.x * image.width),
        y: Math.round(c.y * image.height),
      }));

      setCorners(pts);
      setStatus({ type: "success", msg: "Corners detected! Drag them to adjust, then warp." });
      setActiveTab("corners");
    } catch (err) {
      setStatus({ type: "error", msg: `Detection failed: ${err.message}` });
    }
  };

  // ─── Gemini: extract text ──────────────────────────────────────
  const extractText = async () => {
    const src = warpedImage || image?.dataUrl;
    if (!src) return;

    if (!GEMINI_API_KEY) {
      setStatus({ type: "error", msg: "API key not found. Make sure VITE_GEMINI_API_KEY is set in your .env file." });
      return;
    }

    setStatus({ type: "processing", msg: "Extracting text with Gemini Vision…" });
    setActiveTab("text");

    try {
      const base64 = src.split(",")[1];
      const mimeType = src.split(";")[0].split(":")[1];

      const prompt = "Extract all the text from this document image. Preserve the original formatting and structure as much as possible. Return only the extracted text, nothing else.";

      const text = await callGemini(base64, mimeType, prompt);
      setExtractedText(text.trim());
      setStatus({ type: "success", msg: "Text extracted successfully." });
    } catch (err) {
      setStatus({ type: "error", msg: `Text extraction failed: ${err.message}` });
    }
  };

  // ─── Perspective warp ─────────────────────────────────────────
  const warpDocument = useCallback(() => {
    if (!image || !corners || corners.length !== 4) return;

    const img = new Image();
    img.onload = () => {
      const outW = 794;
      const outH = 1123;
      const canvas = canvasRef.current;
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");

      const dst = [
        { x: 0, y: 0 },
        { x: outW, y: 0 },
        { x: outW, y: outH },
        { x: 0, y: outH },
      ];

      const H = computeHomography(corners, dst);
      if (!H) {
        setStatus({ type: "error", msg: "Could not compute warp. Adjust corners and retry." });
        return;
      }

      const Hinv = invertMatrix3x3(H);
      const imgData = ctx.createImageData(outW, outH);
      const offscreen = document.createElement("canvas");
      offscreen.width = img.width;
      offscreen.height = img.height;
      const offCtx = offscreen.getContext("2d");
      offCtx.drawImage(img, 0, 0);
      const srcData = offCtx.getImageData(0, 0, img.width, img.height);

      if (!Hinv) {
        ctx.drawImage(img, 0, 0, outW, outH);
      } else {
        for (let dy = 0; dy < outH; dy++) {
          for (let dx = 0; dx < outW; dx++) {
            const [sx, sy] = applyHomography(Hinv, dx, dy);
            const six = Math.round(sx);
            const siy = Math.round(sy);
            if (six >= 0 && six < img.width && siy >= 0 && siy < img.height) {
              const si = (siy * img.width + six) * 4;
              const di = (dy * outW + dx) * 4;
              imgData.data[di]     = srcData.data[si];
              imgData.data[di + 1] = srcData.data[si + 1];
              imgData.data[di + 2] = srcData.data[si + 2];
              imgData.data[di + 3] = srcData.data[si + 3];
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setWarpedImage(dataUrl);
      setStatus({ type: "success", msg: "Document warped! Ready for text extraction." });
      setActiveTab("warped");
    };
    img.src = image.dataUrl;
  }, [image, corners]);

  // ─── Corner overlay drawing ────────────────────────────────────
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !corners || !image) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / image.width;
    const scaleY = canvas.height / image.height;
    const pts = corners.map((c) => ({ x: c.x * scaleX, y: c.y * scaleY }));

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.strokeStyle = "rgba(26,26,24,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(26,26,24,0.06)";
    ctx.fill();

    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = CORNER_COLORS[i];
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [corners, image]);

  // ─── Draggable corner handlers ─────────────────────────────────
  const getCanvasPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * image.width,
      y: ((clientY - rect.top) / rect.height) * image.height,
    };
  };

  const onOverlayMouseDown = (e) => {
    if (!corners) return;
    const canvas = overlayCanvasRef.current;
    const pos = getCanvasPos(e, canvas);
    const scaleX = canvas.clientWidth / image.width;
    const scaleY = canvas.clientHeight / image.height;
    const idx = corners.findIndex((c) => {
      const dx = (c.x - pos.x) * scaleX;
      const dy = (c.y - pos.y) * scaleY;
      return Math.sqrt(dx * dx + dy * dy) < 18;
    });
    if (idx !== -1) setDraggingCorner(idx);
  };

  const onOverlayMouseMove = (e) => {
    if (draggingCorner === null) return;
    const canvas = overlayCanvasRef.current;
    const pos = getCanvasPos(e, canvas);
    const newCorners = corners.map((c, i) =>
      i === draggingCorner
        ? {
            x: Math.max(0, Math.min(image.width, pos.x)),
            y: Math.max(0, Math.min(image.height, pos.y)),
          }
        : c
    );
    setCorners(newCorners);
    drawOverlay();
  };

  const onOverlayMouseUp = () => setDraggingCorner(null);

  // ─── Reset ─────────────────────────────────────────────────────
  const reset = () => {
    setImage(null);
    setCorners(null);
    setWarpedImage(null);
    setExtractedText("");
    setStatus(null);
  };

  const copyText = () => {
    navigator.clipboard.writeText(extractedText);
    setStatus({ type: "success", msg: "Text copied to clipboard!" });
  };

  const hasImage = !!image;
  const hasCorners = !!corners;
  const hasWarped = !!warpedImage;
  const hasText = !!extractedText;

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .upload-zone:hover { border-color: rgba(26,26,24,0.4) !important; background: rgba(26,26,24,0.04) !important; }
        .cam-btn:hover { background: rgba(26,26,24,0.04) !important; }
        .btn-primary:hover { opacity: 0.82; }
        .btn-secondary:hover { background: rgba(26,26,24,0.04) !important; }
        .btn-danger:hover { background: rgba(220,50,50,0.05) !important; }
        .overlay-canvas { cursor: crosshair; position: absolute; inset: 0; width: 100%; height: 100%; }
      `}</style>

      <div style={styles.header}>
        <h1 style={styles.title}>Document Scanner</h1>
        <p style={styles.subtitle}>
          Capture, detect corners, warp perspective, and extract text from documents
        </p>
      </div>

      <div style={styles.container}>

        {/* ── Upload zone ── */}
        {!hasImage && (
          <>
            <div
              className="upload-zone"
              style={{ ...styles.uploadZone, ...(dragOver ? styles.uploadZoneHover : {}) }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <svg style={styles.uploadIcon} viewBox="0 0 48 48" fill="none">
                <rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" />
                <path d="M16 20h16M16 28h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M24 4v10M20 8l4-4 4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p style={styles.uploadText}>Drop an image here or click to upload</p>
              <p style={styles.uploadSubtext}>JPG, PNG, WEBP supported</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>

            <div style={styles.orDivider}>
              <div style={styles.dividerLine} />
              <span>or</span>
              <div style={styles.dividerLine} />
            </div>

            <button className="cam-btn" style={styles.cameraBtn} onClick={openCamera}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              Use Camera
            </button>
          </>
        )}

        {/* ── Status bar ── */}
        {status && (
          <div
            style={{
              ...styles.statusBar,
              ...(status.type === "processing" ? styles.statusProcessing : {}),
              ...(status.type === "success"    ? styles.statusSuccess    : {}),
              ...(status.type === "error"      ? styles.statusError      : {}),
              ...(hasImage ? { marginTop: "20px" } : {}),
            }}
          >
            {status.type === "processing" && <div style={styles.spinner} />}
            {status.type === "success" && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {status.type === "error" && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            <span>{status.msg}</span>
          </div>
        )}

        {/* ── Workspace ── */}
        {hasImage && (
          <>
            <div style={styles.tabRow}>
              <button
                style={{ ...styles.tab, ...(activeTab === "original" ? styles.tabActive : {}) }}
                onClick={() => setActiveTab("original")}
              >
                Original
              </button>
              {hasCorners && (
                <button
                  style={{ ...styles.tab, ...(activeTab === "corners" ? styles.tabActive : {}) }}
                  onClick={() => { setActiveTab("corners"); setTimeout(drawOverlay, 50); }}
                >
                  Corners
                </button>
              )}
              {hasWarped && (
                <button
                  style={{ ...styles.tab, ...(activeTab === "warped" ? styles.tabActive : {}) }}
                  onClick={() => setActiveTab("warped")}
                >
                  Warped
                </button>
              )}
              {hasText && (
                <button
                  style={{ ...styles.tab, ...(activeTab === "text" ? styles.tabActive : {}) }}
                  onClick={() => setActiveTab("text")}
                >
                  Text
                </button>
              )}
            </div>

            {activeTab === "original" && (
              <div style={{ ...styles.previewCard, marginTop: "16px" }}>
                <img src={image.dataUrl} alt="Original" style={styles.previewImg} />
              </div>
            )}

            {activeTab === "corners" && hasCorners && (
              <div style={{ ...styles.previewCard, marginTop: "16px" }}>
                <div style={styles.canvasWrapper}>
                  <img
                    src={image.dataUrl}
                    alt="Original"
                    style={{ ...styles.previewImg, display: "block" }}
                  />
                  <canvas
                    className="overlay-canvas"
                    width={image.width}
                    height={image.height}
                    onMouseDown={onOverlayMouseDown}
                    onMouseMove={onOverlayMouseMove}
                    onMouseUp={onOverlayMouseUp}
                    onMouseLeave={onOverlayMouseUp}
                    onTouchStart={onOverlayMouseDown}
                    onTouchMove={onOverlayMouseMove}
                    onTouchEnd={onOverlayMouseUp}
                    ref={(el) => {
                      overlayCanvasRef.current = el;
                      if (el && corners) {
                        el.width = image.width;
                        el.height = image.height;
                        setTimeout(drawOverlay, 0);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === "warped" && hasWarped && (
              <div style={{ ...styles.previewCard, marginTop: "16px" }}>
                <img src={warpedImage} alt="Warped document" style={styles.previewImg} />
              </div>
            )}

            {activeTab === "text" && (
              <div style={{ marginTop: "16px" }}>
                {hasText ? (
                  <div style={styles.extractedText}>{extractedText}</div>
                ) : (
                  <div style={styles.emptyState}>
                    No text extracted yet. Click &ldquo;Extract Text&rdquo; below.
                  </div>
                )}
              </div>
            )}

            {hasCorners && activeTab === "corners" && (
              <div style={styles.cornersInfo}>
                <div style={styles.cornersTitle}>Detected Corner Coordinates</div>
                <div style={styles.cornersGrid}>
                  {corners.map((c, i) => (
                    <div
                      key={i}
                      style={{ ...styles.cornerItem, borderLeft: `3px solid ${CORNER_COLORS[i]}` }}
                    >
                      <span style={{ color: CORNER_COLORS[i], fontWeight: 600 }}>
                        {CORNER_LABELS[i]}
                      </span>
                      <br />
                      x: {Math.round(c.x)}, y: {Math.round(c.y)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.actionBar}>
              {!hasCorners && (
                <button
                  className="btn-primary"
                  style={styles.btnPrimary}
                  onClick={detectCorners}
                  disabled={status?.type === "processing"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Detect Corners
                </button>
              )}

              {hasCorners && !hasWarped && (
                <button
                  className="btn-primary"
                  style={styles.btnPrimary}
                  onClick={warpDocument}
                  disabled={status?.type === "processing"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4l16 0M4 20l16 0M4 4l4 16M20 4l-4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Warp Document
                </button>
              )}

              {(hasWarped || hasImage) && (
                <button
                  className="btn-secondary"
                  style={styles.btnSecondary}
                  onClick={extractText}
                  disabled={status?.type === "processing"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  Extract Text
                </button>
              )}

              {hasText && (
                <button
                  className="btn-secondary"
                  style={styles.btnSecondary}
                  onClick={copyText}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  Copy Text
                </button>
              )}

              {hasWarped && (
                <button
                  className="btn-secondary"
                  style={styles.btnSecondary}
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = warpedImage;
                    a.download = "scanned-document.jpg";
                    a.click();
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Download
                </button>
              )}

              <button
                className="btn-danger"
                style={styles.btnDanger}
                onClick={reset}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Clear
              </button>
            </div>
          </>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {/* ── Camera modal ── */}
      {showCamera && (
        <div style={styles.cameraModal}>
          <video ref={videoRef} autoPlay playsInline style={styles.cameraVideo} />
          <div style={styles.cameraBtnRow}>
            <button style={styles.snapBtn} onClick={snapPhoto}>📸 Capture</button>
            <button style={styles.closeCamBtn} onClick={stopCamera}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Homography math (no external dependencies) ─────────────────

function computeHomography(src, dst) {
  const A = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([-sx, -sy, -1,   0,   0,  0, dx * sx, dx * sy, dx]);
    A.push([  0,   0,  0, -sx, -sy, -1, dy * sx, dy * sy, dy]);
  }
  const h = solveDLT(A);
  if (!h) return null;
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ];
}

function solveDLT(A) {
  const n = 9;
  const At = transpose(A);
  const AtA = matMul(At, A);
  return smallestEigenvector(AtA, n);
}

function transpose(M) {
  return M[0].map((_, j) => M.map((row) => row[j]));
}

function matMul(A, B) {
  const rows = A.length;
  const cols = B[0].length;
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) =>
      A[i].reduce((s, _, k) => s + A[i][k] * B[k][j], 0)
    )
  );
}

function smallestEigenvector(M, n) {
  let v = Array(n).fill(0).map((_, i) => (i === n - 1 ? 1 : 0));
  const shift = 1e-6;
  const shifted = M.map((row, i) =>
    row.map((val, j) => (i === j ? val + shift : val))
  );
  for (let iter = 0; iter < 200; iter++) {
    const Mv = gaussSolve(shifted, v);
    if (!Mv) return null;
    const norm = Math.sqrt(Mv.reduce((s, x) => s + x * x, 0));
    v = Mv.map((x) => x / norm);
  }
  return v;
}

function gaussSolve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) return null;
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function invertMatrix3x3(m) {
  const [a, b, c] = m[0];
  const [d, e, f] = m[1];
  const [g, h, k] = m[2];
  const det =
    a * (e * k - f * h) -
    b * (d * k - f * g) +
    c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  return [
    [(e * k - f * h) * inv, (c * h - b * k) * inv, (b * f - c * e) * inv],
    [(f * g - d * k) * inv, (a * k - c * g) * inv, (c * d - a * f) * inv],
    [(d * h - e * g) * inv, (b * g - a * h) * inv, (a * e - b * d) * inv],
  ];
}

function applyHomography(H, x, y) {
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  return [
    (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    (H[1][0] * x + H[1][1] * y + H[1][2]) / w,
  ];
}
