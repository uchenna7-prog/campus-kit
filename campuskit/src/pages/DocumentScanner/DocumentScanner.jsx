import { useState, useRef, useEffect } from "react";
import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./DocumentScanner.module.css";

// ─────────────────────────────────────────────────────────────
//  CANVAS HELPERS
// ─────────────────────────────────────────────────────────────
const clamp = (v) => Math.max(0, Math.min(255, v));

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      sum += src[y * w + x];
      if (x > r) sum -= src[y * w + (x - r - 1)];
      tmp[y * w + x] = sum / (Math.min(x, r) + 1 + Math.min(w - 1 - x, r));
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      sum += tmp[y * w + x];
      if (y > r) sum -= tmp[(y - r - 1) * w + x];
      out[y * w + x] = sum / (Math.min(y, r) + 1 + Math.min(h - 1 - y, r));
    }
  }
  return out;
}

/** Local adaptive threshold — same pipeline as CamScanner B&W */
function applyBW(canvas) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    grey[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  }
  const r = Math.max(10, Math.round(Math.min(w, h) * 0.06));
  const mean = boxBlur(grey, w, h, r);
  const C = 14;
  const out = ctx.createImageData(w, h);
  const od = out.data;
  for (let i = 0; i < w * h; i++) {
    const v = grey[i] < mean[i] - C ? 0 : 255;
    const p = i * 4;
    od[p] = od[p + 1] = od[p + 2] = v;
    od[p + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

function applyGrey(canvas) {
  const ctx = canvas.getContext("2d");
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data;
  let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const range = hi - lo || 1;
  for (let i = 0; i < d.length; i += 4) {
    let v = ((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) - lo) / range * 255;
    v = clamp((v / 255 - 0.5) * 1.3 + 0.5) * 255;
    d[i] = d[i + 1] = d[i + 2] = clamp(v);
  }
  ctx.putImageData(id, 0, 0);
}

function applyColour(canvas) {
  const ctx = canvas.getContext("2d");
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data;
  let rMn = 255, rMx = 0, gMn = 255, gMx = 0, bMn = 255, bMx = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < rMn) rMn = d[i]; if (d[i] > rMx) rMx = d[i];
    if (d[i+1] < gMn) gMn = d[i+1]; if (d[i+1] > gMx) gMx = d[i+1];
    if (d[i+2] < bMn) bMn = d[i+2]; if (d[i+2] > bMx) bMx = d[i+2];
  }
  const rR = rMx - rMn || 1, gR = gMx - gMn || 1, bR = bMx - bMn || 1;
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = clamp(((d[i]   - rMn) / rR) * 265);
    d[i+1] = clamp(((d[i+1] - gMn) / gR) * 265);
    d[i+2] = clamp(((d[i+2] - bMn) / bR) * 265);
  }
  ctx.putImageData(id, 0, 0);
}

function processCanvas(raw, mode) {
  const c = document.createElement("canvas");
  c.width = raw.width; c.height = raw.height;
  c.getContext("2d").drawImage(raw, 0, 0);
  if (mode === "bw")     applyBW(c);
  else if (mode === "grey")   applyGrey(c);
  else if (mode === "colour") applyColour(c);
  return c;
}

function fileToCanvas(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 2400;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Resize canvas to max dimension for API call (keeps it fast + within token limits) */
function resizeForAPI(canvas, maxSide = 1024) {
  let w = canvas.width, h = canvas.height;
  if (w <= maxSide && h <= maxSide) return canvas;
  const r = Math.min(maxSide / w, maxSide / h);
  const c = document.createElement("canvas");
  c.width = Math.round(w * r); c.height = Math.round(h * r);
  c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

const toJpeg = (c, q = 0.93) => c.toDataURL("image/jpeg", q);
let _uid = 0;
const uid = () => ++_uid;

// ─────────────────────────────────────────────────────────────
//  AI ENHANCEMENT via Claude Vision API
//  Sends the image to Claude, asks it to describe the best
//  processing approach, then applies it on the canvas.
//  Falls back to local pipeline if API fails.
// ─────────────────────────────────────────────────────────────
async function aiEnhanceCanvas(rawCanvas, mode) {
  // First do the local pipeline as baseline
  const localResult = processCanvas(rawCanvas, mode);

  try {
    const small = resizeForAPI(rawCanvas, 1024);
    const base64 = small.toDataURL("image/jpeg", 0.85).split(",")[1];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a document image processing expert. Analyse the provided image and return ONLY a JSON object — no markdown, no explanation.
The JSON must have this exact shape:
{
  "brightness": <number 70–150>,
  "contrast": <number 80–180>,
  "shadows": <"light"|"medium"|"heavy">,
  "skew": <estimated degrees the page is tilted, number -10 to 10>,
  "documentType": <"text"|"photo"|"mixed"|"form">,
  "recommendation": <"bw"|"grey"|"colour">
}
Analyse lighting, shadows, skew, and content type. 
brightness: 100 = neutral. Increase for dark/underexposed images.
contrast: 100 = neutral. Increase for flat/washed images.
shadows: how heavy are background shadows or uneven lighting.
skew: how many degrees clockwise the document is rotated.
documentType: what kind of content is in the image.
recommendation: best scan mode for this image.`,
        messages: [{
          role: "user",
          content: [{
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64 }
          }, {
            type: "text",
            text: "Analyse this document image and return the JSON."
          }]
        }]
      })
    });

    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    const text = data.content?.[0]?.text?.trim() ?? "";
    const clean = text.replace(/```json|```/g, "").trim();
    const params = JSON.parse(clean);

    // Apply AI-recommended parameters on top of local pipeline
    const c = document.createElement("canvas");
    c.width = rawCanvas.width; c.height = rawCanvas.height;
    c.getContext("2d").drawImage(rawCanvas, 0, 0);

    // Apply skew correction if needed
    if (Math.abs(params.skew ?? 0) > 0.8) {
      const angle = -(params.skew * Math.PI) / 180;
      const ctx2 = document.createElement("canvas").getContext("2d");
      const w = c.width, h = c.height;
      const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
      const nw = Math.round(w * cos + h * sin);
      const nh = Math.round(h * cos + w * sin);
      ctx2.canvas.width = nw; ctx2.canvas.height = nh;
      ctx2.translate(nw / 2, nh / 2);
      ctx2.rotate(angle);
      ctx2.drawImage(c, -w / 2, -h / 2);
      c.width = nw; c.height = nh;
      c.getContext("2d").drawImage(ctx2.canvas, 0, 0);
    }

    // Apply brightness/contrast via CSS filter on offscreen canvas
    const final = document.createElement("canvas");
    final.width = c.width; final.height = c.height;
    const fctx = final.getContext("2d");
    fctx.filter = `brightness(${params.brightness ?? 100}%) contrast(${params.contrast ?? 100}%)`;
    fctx.drawImage(c, 0, 0);
    fctx.filter = "none";

    // Use AI recommended mode if different from user choice
    const effectiveMode = params.recommendation ?? mode;
    return processCanvas(final, effectiveMode);

  } catch (err) {
    console.warn("AI enhancement fell back to local pipeline:", err.message);
    return localResult;
  }
}

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
export default function DocumentScanner() {
  const [pages,       setPages]       = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [editMode,    setEditMode]    = useState(null);
  const [cameraOpen,  setCameraOpen]  = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragIdx,     setDragIdx]     = useState(null);
  const [processing,  setProcessing]  = useState(false);
  const [procLabel,   setProcLabel]   = useState("");
  const [procStep,    setProcStep]    = useState(0); // 0-100 fake progress
  const [exportOpen,  setExportOpen]  = useState(false);
  const [toast,       setToast]       = useState(null);
  const [scanMode,    setScanMode]    = useState("bw");
  const [adjVals,     setAdjVals]     = useState({ brt: 100, con: 110 });
  const [useAI,       setUseAI]       = useState(true);

  const fileRef    = useRef(null);
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const dragSrcRef = useRef(null);
  const timerRef   = useRef(null);

  const selectedPage = pages.find((p) => p.id === selectedId) ?? null;

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  function startFakeProgress(label) {
    setProcLabel(label);
    setProcessing(true);
    setProcStep(0);
    let v = 0;
    timerRef.current = setInterval(() => {
      v += Math.random() * 12;
      if (v >= 88) v = 88;
      setProcStep(Math.round(v));
    }, 280);
  }

  function finishProgress() {
    clearInterval(timerRef.current);
    setProcStep(100);
    setTimeout(() => { setProcessing(false); setProcStep(0); }, 400);
  }

  // ── Add files ──────────────────────────────────────────────
  async function handleFiles(files) {
    if (!files?.length) return;
    const arr = Array.from(files);
    const firstId = uid(); // to select first new page

    for (let i = 0; i < arr.length; i++) {
      const pageId = i === 0 ? firstId : uid();
      startFakeProgress(
        useAI
          ? `AI scanning page ${i + 1} of ${arr.length}…`
          : `Processing page ${i + 1} of ${arr.length}…`
      );
      const raw = await fileToCanvas(arr[i]);
      const processed = useAI
        ? await aiEnhanceCanvas(raw, scanMode)
        : processCanvas(raw, scanMode);
      const p = {
        id: pageId,
        dataUrl: toJpeg(processed),
        rawCanvas: raw,
        mode: scanMode,
        aiEnhanced: useAI,
        name: arr[i].name?.replace(/\.[^.]+$/, "") || `Page ${pages.length + i + 1}`,
      };
      finishProgress();
      setPages((prev) => [...prev, p]);
      if (i === 0) setSelectedId(pageId);
    }
    showToast(`${arr.length} page${arr.length > 1 ? "s" : ""} scanned`);
  }

  // ── Camera ─────────────────────────────────────────────────
  async function openCamera() {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch { showToast("Camera access denied", "error"); setCameraOpen(false); }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = videoRef.current; if (!video) return;
    closeCamera();
    startFakeProgress(useAI ? "AI processing scan…" : "Processing scan…");
    const raw = document.createElement("canvas");
    raw.width = video.videoWidth; raw.height = video.videoHeight;
    raw.getContext("2d").drawImage(video, 0, 0);
    const processed = useAI
      ? await aiEnhanceCanvas(raw, scanMode)
      : processCanvas(raw, scanMode);
    const pageId = uid();
    const p = { id: pageId, dataUrl: toJpeg(processed), rawCanvas: raw, mode: scanMode, aiEnhanced: useAI, name: `Scan ${pages.length + 1}` };
    finishProgress();
    setPages((prev) => [...prev, p]);
    setSelectedId(pageId);
    showToast("Page scanned");
  }

  // ── Delete ─────────────────────────────────────────────────
  function deletePage(id) {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (selectedId === id) { setSelectedId(next[0]?.id ?? null); setEditMode(null); }
      return next;
    });
    showToast("Page removed");
  }

  // ── Reprocess ──────────────────────────────────────────────
  async function reprocess(id, mode) {
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    startFakeProgress(useAI ? "AI reprocessing…" : "Reprocessing…");
    const processed = useAI
      ? await aiEnhanceCanvas(page.rawCanvas, mode)
      : processCanvas(page.rawCanvas, mode);
    finishProgress();
    setPages((prev) =>
      prev.map((p) => p.id === id ? { ...p, dataUrl: toJpeg(processed), mode, aiEnhanced: useAI } : p)
    );
  }

  // ── Drag reorder ───────────────────────────────────────────
  function onDragStart(e, i) { dragSrcRef.current = i; setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }
  function onDragOver(e, i)  { e.preventDefault(); setDragOverIdx(i); }
  function onDrop(e, ti) {
    e.preventDefault();
    const si = dragSrcRef.current;
    if (si != null && si !== ti) {
      setPages((prev) => { const a = [...prev]; const [m] = a.splice(si, 1); a.splice(ti, 0, m); return a; });
    }
    setDragOverIdx(null); setDragIdx(null); dragSrcRef.current = null;
  }

  // ── Manual adjustments ─────────────────────────────────────
  function applyAdj() {
    if (!selectedPage) return;
    const c = document.createElement("canvas");
    c.width = selectedPage.rawCanvas.width; c.height = selectedPage.rawCanvas.height;
    const ctx = c.getContext("2d");
    ctx.filter = `brightness(${adjVals.brt}%) contrast(${adjVals.con}%)`;
    ctx.drawImage(selectedPage.rawCanvas, 0, 0);
    ctx.filter = "none";
    setPages((prev) => prev.map((p) => p.id === selectedId ? { ...p, dataUrl: toJpeg(c) } : p));
    showToast("Adjustments applied"); setEditMode(null);
  }

  // ── Export PDF ─────────────────────────────────────────────
  async function exportPDF() {
    if (!pages.length) return;
    setExportOpen(false);
    startFakeProgress("Building PDF…");
    await new Promise((res, rej) => {
      if (window.jspdf) return res();
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    const { jsPDF } = window.jspdf;
    let pdf;
    for (let i = 0; i < pages.length; i++) {
      setProcLabel(`Adding page ${i + 1} of ${pages.length}…`);
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = pages[i].dataUrl; });
      const pw = img.naturalWidth, ph = img.naturalHeight;
      const orient = pw > ph ? "landscape" : "portrait";
      if (i === 0) pdf = new jsPDF({ orientation: orient, unit: "px", format: [pw, ph] });
      else pdf.addPage([pw, ph], orient);
      pdf.addImage(pages[i].dataUrl, "JPEG", 0, 0, pw, ph);
    }
    pdf.save("scanned-document.pdf");
    finishProgress(); showToast("PDF saved!");
  }

  // ── Export ZIP ─────────────────────────────────────────────
  async function exportZip() {
    if (!pages.length) return;
    setExportOpen(false);
    startFakeProgress("Zipping images…");
    await new Promise((res, rej) => {
      if (window.JSZip) return res();
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    const zip = new window.JSZip();
    pages.forEach((p, i) => zip.file(`page-${String(i+1).padStart(3,"0")}.jpg`, p.dataUrl.split(",")[1], { base64: true }));
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "scanned-pages.zip"; a.click();
    finishProgress(); showToast("Images downloaded!");
  }

  useEffect(() => {
    const fn = (e) => { if (!e.target.closest(`.${styles.exportWrap}`)) setExportOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={styles.homeContainer}>
      <SideBar />
      <div className={styles.mainWrapper}>
        <Header />
        <main className={styles.mainContent}>
          <div className={styles.page}>

            {/* ── Page Header ── */}
            <div className={styles.pageHeader}>
              <div className={styles.pageEyebrow}>Student Utilities</div>
              <h1 className={styles.pageTitle}>Document <em>Scanner</em></h1>
            </div>

            {/* ── Toolbar row ── */}
            <div className={styles.toolRow}>
              {/* AI toggle */}
              <div className={styles.aiToggleWrap}>
                <button
                  className={`${styles.aiToggle} ${useAI ? styles.aiToggleOn : ""}`}
                  onClick={() => setUseAI((v) => !v)}
                >
                  <span className={styles.aiDot} />
                  <span>{useAI ? "AI Enhance: On" : "AI Enhance: Off"}</span>
                </button>
              </div>

              {/* Scan mode */}
              <div className={styles.modeToggle}>
                {[
                  { k: "bw",     icon: "fa-solid fa-file-lines",        label: "B&W" },
                  { k: "grey",   icon: "fa-solid fa-circle-half-stroke", label: "Grey" },
                  { k: "colour", icon: "fa-solid fa-palette",            label: "Colour" },
                ].map((m) => (
                  <button key={m.k}
                    className={`${styles.modeBtn} ${scanMode === m.k ? styles.modeBtnOn : ""}`}
                    onClick={() => setScanMode(m.k)}>
                    <i className={m.icon}></i>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Export */}
              {pages.length > 0 && (
                <div className={styles.exportWrap}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setExportOpen((v) => !v)}>
                    <i className="fa-solid fa-file-export"></i> Export
                    <i className="fa-solid fa-chevron-down" style={{ fontSize: 9, marginLeft: 2 }}></i>
                  </button>
                  {exportOpen && (
                    <div className={styles.exportMenu}>
                      <button onClick={exportPDF}>
                        <i className="fa-solid fa-file-pdf"></i>
                        <div><span>Save as PDF</span><small>{pages.length} page{pages.length > 1 ? "s" : ""} combined</small></div>
                      </button>
                      <button onClick={exportZip}>
                        <i className="fa-solid fa-images"></i>
                        <div><span>Save as Images</span><small>ZIP of JPG files</small></div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Main layout ── */}
            <div className={styles.layout}>

              {/* Left strip */}
              <div className={styles.strip}>
                <div className={styles.stripHead}>
                  <span>Pages</span>
                  <span className={styles.badge}>{pages.length}</span>
                </div>
                <div className={styles.stripScroll}>
                  {pages.length === 0 && (
                    <div className={styles.stripEmpty}>
                      <i className="fa-regular fa-file-image"></i>
                      <p>No pages yet</p>
                    </div>
                  )}
                  {pages.map((p, i) => (
                    <div key={p.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, i)}
                      onDragOver={(e) => onDragOver(e, i)}
                      onDrop={(e) => onDrop(e, i)}
                      onDragEnd={() => { setDragOverIdx(null); setDragIdx(null); }}
                      onClick={() => { setSelectedId(p.id); setEditMode(null); }}
                      className={[
                        styles.thumb,
                        selectedId === p.id ? styles.thumbOn : "",
                        dragOverIdx === i   ? styles.thumbOver : "",
                        dragIdx === i       ? styles.thumbGhost : "",
                      ].join(" ")}
                    >
                      <span className={styles.thumbNum}>{i + 1}</span>
                      {p.aiEnhanced && <span className={styles.thumbAiBadge}>AI</span>}
                      <img src={p.dataUrl} alt={`Page ${i + 1}`} />
                      <button className={styles.thumbDel}
                        onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                      <span className={styles.grip}><i className="fa-solid fa-grip-vertical"></i></span>
                    </div>
                  ))}
                </div>
                <div className={styles.addRow}>
                  <button className={`${styles.btn} ${styles.btnInk}`} onClick={() => fileRef.current?.click()}>
                    <i className="fa-solid fa-arrow-up-from-bracket"></i> Upload
                  </button>
                  <button className={`${styles.btn} ${styles.btnOutline}`} onClick={openCamera}>
                    <i className="fa-solid fa-camera"></i> Camera
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                    onChange={(e) => handleFiles(e.target.files)} />
                </div>
              </div>

              {/* Right viewer */}
              <div className={styles.viewer}>
                {!selectedPage ? (
                  <div className={styles.dropZone}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
                    <div className={styles.dropIco}><i className="fa-solid fa-file-magnifying-glass"></i></div>
                    <h2 className={styles.dropTitle}>Drop documents here</h2>
                    <p className={styles.dropSub}>
                      JPG · PNG · HEIC · multiple files supported<br />
                      {useAI ? "Claude AI will enhance every page automatically" : "Pages are auto-processed on upload"}
                    </p>
                    <div className={styles.dropBtns}>
                      <button className={`${styles.btn} ${styles.btnInk}`}
                        onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                        <i className="fa-solid fa-arrow-up-from-bracket"></i> Choose Files
                      </button>
                      <button className={`${styles.btn} ${styles.btnOutline}`}
                        onClick={(e) => { e.stopPropagation(); openCamera(); }}>
                        <i className="fa-solid fa-camera"></i> Use Camera
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.editorWrap}>
                    {/* Toolbar */}
                    <div className={styles.toolbar}>
                      <div className={styles.tbL}>
                        <span className={styles.docName}>{selectedPage.name}</span>
                        <span className={styles.docIdx}>{pages.findIndex((p) => p.id === selectedId) + 1} / {pages.length}</span>
                        {selectedPage.aiEnhanced && <span className={styles.aiBadge}>AI</span>}
                      </div>
                      <div className={styles.tbR}>
                        <div className={styles.modeMini}>
                          {[{k:"bw",l:"B&W"},{k:"grey",l:"Grey"},{k:"colour",l:"Colour"}].map((m) => (
                            <button key={m.k}
                              className={`${styles.miniBtn} ${selectedPage.mode === m.k ? styles.miniBtnOn : ""}`}
                              onClick={() => reprocess(selectedId, m.k)}>{m.l}</button>
                          ))}
                        </div>
                        <button className={`${styles.toolBtn} ${editMode === "enhance" ? styles.toolBtnOn : ""}`}
                          onClick={() => setEditMode(editMode === "enhance" ? null : "enhance")}>
                          <i className="fa-solid fa-sliders"></i> Adjust
                        </button>
                        <button className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
                          onClick={() => deletePage(selectedId)}>
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    {/* Adjust panel */}
                    {editMode === "enhance" && (
                      <div className={styles.adjPanel}>
                        {[
                          { k: "brt", label: "Brightness", min: 50, max: 200, suffix: "%" },
                          { k: "con", label: "Contrast",   min: 50, max: 200, suffix: "%" },
                        ].map((sl) => (
                          <div className={styles.slRow} key={sl.k}>
                            <span className={styles.slLabel}>{sl.label}</span>
                            <input type="range" min={sl.min} max={sl.max} value={adjVals[sl.k]}
                              onChange={(e) => setAdjVals((v) => ({ ...v, [sl.k]: Number(e.target.value) }))} />
                            <span className={styles.slVal}>{adjVals[sl.k]}{sl.suffix}</span>
                          </div>
                        ))}
                        <div className={styles.adjActions}>
                          <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                            onClick={() => { setAdjVals({ brt: 100, con: 110 }); setEditMode(null); }}>Reset</button>
                          <button className={`${styles.btn} ${styles.btnInk} ${styles.btnSm}`} onClick={applyAdj}>Apply</button>
                        </div>
                      </div>
                    )}

                    {/* Image */}
                    <div className={styles.imgWrap}>
                      <img src={selectedPage.dataUrl} alt="Scanned page" />
                    </div>

                    {/* Nav */}
                    <div className={styles.navBar}>
                      <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                        disabled={pages.findIndex((p) => p.id === selectedId) === 0}
                        onClick={() => { const i = pages.findIndex((p) => p.id === selectedId); if (i > 0) { setSelectedId(pages[i-1].id); setEditMode(null); } }}>
                        <i className="fa-solid fa-chevron-left"></i> Prev
                      </button>
                      <div className={styles.dots}>
                        {pages.map((p) => (
                          <span key={p.id}
                            className={`${styles.dot} ${p.id === selectedId ? styles.dotOn : ""}`}
                            onClick={() => { setSelectedId(p.id); setEditMode(null); }} />
                        ))}
                      </div>
                      <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                        disabled={pages.findIndex((p) => p.id === selectedId) === pages.length - 1}
                        onClick={() => { const i = pages.findIndex((p) => p.id === selectedId); if (i < pages.length - 1) { setSelectedId(pages[i+1].id); setEditMode(null); } }}>
                        Next <i className="fa-solid fa-chevron-right"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Camera modal ── */}
          {cameraOpen && (
            <div className={styles.overlay}>
              <div className={styles.camModal}>
                <div className={styles.camHead}>
                  <span>Camera</span>
                  <button className={styles.camClose} onClick={closeCamera}><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className={styles.camBody}>
                  <video ref={videoRef} className={styles.camVideo} playsInline muted />
                  <div className={styles.camGuide} />
                </div>
                <div className={styles.camFoot}>
                  <div className={styles.camModes}>
                    {[{k:"bw",l:"B&W"},{k:"grey",l:"Grey"},{k:"colour",l:"Colour"}].map((m) => (
                      <button key={m.k}
                        className={`${styles.camModeBtn} ${scanMode === m.k ? styles.camModeBtnOn : ""}`}
                        onClick={() => setScanMode(m.k)}>{m.l}</button>
                    ))}
                  </div>
                  <button className={styles.shutter} onClick={capturePhoto}>
                    <span className={styles.shutterInner} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Processing overlay ── */}
          {processing && (
            <div className={styles.overlay}>
              <div className={styles.procCard}>
                <div className={styles.procTop}>
                  <div className={styles.spinner} />
                  <span className={styles.procLabel}>{procLabel}</span>
                </div>
                <div className={styles.progTrack}>
                  <div className={styles.progFill} style={{ width: `${procStep}%` }} />
                </div>
                <span className={styles.procPct}>{procStep}%</span>
              </div>
            </div>
          )}

          {/* ── Toast ── */}
          {toast && (
            <div className={`${styles.toast} ${toast.type === "error" ? styles.toastErr : ""}`}>
              <i className={`fa-solid ${toast.type === "error" ? "fa-circle-xmark" : "fa-circle-check"}`}></i>
              {toast.msg}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
