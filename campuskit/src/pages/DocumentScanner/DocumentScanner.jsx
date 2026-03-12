import { useState, useRef, useEffect } from "react";
import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./DocumentScanner.module.css";

// ─────────────────────────────────────────────────────────────
//  IMAGE PROCESSING  (CamScanner-style pipeline, pure Canvas)
// ─────────────────────────────────────────────────────────────

const clamp = (v) => Math.max(0, Math.min(255, v));

/**
 * Box-blur a Float32Array in-place, returns new blurred array.
 * Used for local mean shadow-removal.
 */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  // horizontal
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      sum += src[y * w + x];
      if (x > r) sum -= src[y * w + (x - r - 1)];
      const start = Math.max(0, x - r);
      tmp[y * w + x] = sum / (x - start + 1);
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      sum += tmp[y * w + x];
      if (y > r) sum -= tmp[(y - r - 1) * w + x];
      const start = Math.max(0, y - r);
      out[y * w + x] = sum / (y - start + 1);
    }
  }
  return out;
}

/**
 * CamScanner B&W pipeline:
 * greyscale → local-mean shadow removal → adaptive threshold → unsharp mask
 */
function applyBW(canvas) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h).data;

  // 1. greyscale
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    grey[i] = 0.299 * src[p] + 0.587 * src[p + 1] + 0.114 * src[p + 2];
  }

  // 2. local mean (large radius) for shadow / uneven lighting
  const r = Math.max(8, Math.round(Math.min(w, h) * 0.05));
  const localMean = boxBlur(grey, w, h, r);

  // 3. adaptive threshold: pixel black if significantly darker than local mean
  const C = 14;
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    binary[i] = grey[i] < localMean[i] - C ? 0 : 255;
  }

  // 4. small unsharp mask to sharpen edges
  const bF = new Float32Array(binary);
  const blurred = boxBlur(bF, w, h, 1);
  const sharp = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    sharp[i] = clamp(binary[i] + 1.5 * (binary[i] - blurred[i]));
  }

  // 5. write back
  const out = ctx.createImageData(w, h);
  const od = out.data;
  for (let i = 0; i < w * h; i++) {
    const v = sharp[i] > 128 ? 255 : 0; // hard binarise
    const p = i * 4;
    od[p] = od[p + 1] = od[p + 2] = v;
    od[p + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

/**
 * CamScanner Greyscale pipeline:
 * greyscale → auto-levels → contrast boost → unsharp mask
 */
function applyGrey(canvas) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;

  // greyscale + auto-levels
  const vals = [];
  for (let i = 0; i < d.length; i += 4) {
    vals.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  }
  let lo = 255, hi = 0;
  vals.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; });
  const range = hi - lo || 1;

  for (let i = 0; i < d.length; i += 4) {
    let v = ((vals[i / 4] - lo) / range) * 255;
    // S-curve contrast
    v = clamp((v / 255 - 0.5) * 1.35 + 0.5) * 255;
    d[i] = d[i + 1] = d[i + 2] = clamp(v);
  }
  ctx.putImageData(id, 0, 0);
}

/**
 * Colour mode: just auto-levels + slight contrast
 */
function applyColour(canvas) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i]   < rMin) rMin = d[i];   if (d[i]   > rMax) rMax = d[i];
    if (d[i+1] < gMin) gMin = d[i+1]; if (d[i+1] > gMax) gMax = d[i+1];
    if (d[i+2] < bMin) bMin = d[i+2]; if (d[i+2] > bMax) bMax = d[i+2];
  }
  const rR = rMax - rMin || 1, gR = gMax - gMin || 1, bR = bMax - bMin || 1;
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = clamp(((d[i]   - rMin) / rR) * 255 * 1.05);
    d[i+1] = clamp(((d[i+1] - gMin) / gR) * 255 * 1.05);
    d[i+2] = clamp(((d[i+2] - bMin) / bR) * 255 * 1.05);
  }
  ctx.putImageData(id, 0, 0);
}

function processCanvas(rawCanvas, mode) {
  const c = document.createElement("canvas");
  c.width = rawCanvas.width; c.height = rawCanvas.height;
  c.getContext("2d").drawImage(rawCanvas, 0, 0);
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

const toJpeg = (c) => c.toDataURL("image/jpeg", 0.93);

let _uid = 0;
const uid = () => ++_uid;

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
export default function DocumentScanner() {
  const [pages, setPages]           = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editMode, setEditMode]     = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragIdx, setDragIdx]       = useState(null);
  const [processing, setProcessing] = useState(false);
  const [procLabel, setProcLabel]   = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast]           = useState(null);
  const [scanMode, setScanMode]     = useState("bw");
  const [adjVals, setAdjVals]       = useState({ brt: 100, con: 110 });

  const fileRef    = useRef(null);
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const dragSrcRef = useRef(null);

  const selectedPage = pages.find((p) => p.id === selectedId) ?? null;

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  // ── Add files ──────────────────────────────────────────────
  async function handleFiles(files) {
    if (!files?.length) return;
    setProcessing(true);
    const arr = Array.from(files);
    const newPages = [];
    for (let i = 0; i < arr.length; i++) {
      setProcLabel(`Scanning page ${i + 1} of ${arr.length}…`);
      const raw = await fileToCanvas(arr[i]);
      const processed = processCanvas(raw, scanMode);
      const p = { id: uid(), dataUrl: toJpeg(processed), rawCanvas: raw, mode: scanMode,
        name: arr[i].name?.replace(/\.[^.]+$/, "") || `Page ${pages.length + i + 1}` };
      newPages.push(p);
      setPages((prev) => [...prev, p]);
    }
    if (!selectedId && newPages.length) setSelectedId(newPages[0].id);
    setProcessing(false); setProcLabel("");
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
    setProcessing(true); setProcLabel("Processing scan…");
    const raw = document.createElement("canvas");
    raw.width = video.videoWidth; raw.height = video.videoHeight;
    raw.getContext("2d").drawImage(video, 0, 0);
    const processed = processCanvas(raw, scanMode);
    const p = { id: uid(), dataUrl: toJpeg(processed), rawCanvas: raw, mode: scanMode, name: `Scan ${pages.length + 1}` };
    setPages((prev) => [...prev, p]);
    setSelectedId(p.id);
    setProcessing(false); setProcLabel("");
    showToast("Page captured");
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

  // ── Reprocess page ─────────────────────────────────────────
  function reprocess(id, mode) {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const c = processCanvas(p.rawCanvas, mode);
        return { ...p, dataUrl: toJpeg(c), mode };
      })
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
    clearDrag();
  }
  function clearDrag() { setDragOverIdx(null); setDragIdx(null); dragSrcRef.current = null; }

  // ── Apply manual adjustments ───────────────────────────────
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
    setExportOpen(false); setProcessing(true); setProcLabel("Building PDF…");
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
    setProcessing(false); setProcLabel(""); showToast("PDF saved!");
  }

  // ── Export ZIP ─────────────────────────────────────────────
  async function exportZip() {
    if (!pages.length) return;
    setExportOpen(false); setProcessing(true); setProcLabel("Zipping images…");
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
    setProcessing(false); setProcLabel(""); showToast("Images downloaded!");
  }

  // Close export on outside click
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

            {/* Page header */}
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.pageEyebrow}>Student Utilities</div>
                <div className={styles.pageTitle}>Document <em>Scanner</em></div>
              </div>
              <div className={styles.headerRight}>
                {/* Global scan mode */}
                <div className={styles.modeToggle}>
                  {[
                    { k: "bw",     icon: "fa-solid fa-file-lines",        label: "B&W" },
                    { k: "grey",   icon: "fa-solid fa-circle-half-stroke", label: "Grey" },
                    { k: "colour", icon: "fa-solid fa-palette",            label: "Colour" },
                  ].map((m) => (
                    <button key={m.k}
                      className={`${styles.modeBtn} ${scanMode === m.k ? styles.modeBtnOn : ""}`}
                      onClick={() => setScanMode(m.k)}>
                      <i className={m.icon}></i><span>{m.label}</span>
                    </button>
                  ))}
                </div>
                {pages.length > 0 && (
                  <div className={styles.exportWrap}>
                    <button className={`${styles.btn} ${styles.primary}`} onClick={() => setExportOpen((v) => !v)}>
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
            </div>

            {/* Layout */}
            <div className={styles.layout}>

              {/* ── Left strip ── */}
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
                      onDragEnd={clearDrag}
                      onClick={() => { setSelectedId(p.id); setEditMode(null); }}
                      className={[
                        styles.thumb,
                        selectedId === p.id ? styles.thumbOn : "",
                        dragOverIdx === i   ? styles.thumbOver : "",
                        dragIdx === i       ? styles.thumbGhost : "",
                      ].join(" ")}
                    >
                      <span className={styles.thumbNum}>{i + 1}</span>
                      <img src={p.dataUrl} alt={`Page ${i+1}`} />
                      <button className={styles.thumbDel}
                        onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                      <span className={styles.grip}><i className="fa-solid fa-grip-vertical"></i></span>
                    </div>
                  ))}
                </div>
                <div className={styles.addRow}>
                  <button className={`${styles.btn} ${styles.addBtn}`} onClick={() => fileRef.current?.click()}>
                    <i className="fa-solid fa-arrow-up-from-bracket"></i> Upload
                  </button>
                  <button className={`${styles.btn} ${styles.addBtn}`} onClick={openCamera}>
                    <i className="fa-solid fa-camera"></i> Camera
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple
                    style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
                </div>
              </div>

              {/* ── Right viewer ── */}
              <div className={styles.viewer}>
                {!selectedPage ? (
                  <div className={styles.dropZone}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
                    <div className={styles.dropIco}><i className="fa-solid fa-file-magnifying-glass"></i></div>
                    <div className={styles.dropTitle}>Drop documents here</div>
                    <div className={styles.dropSub}>
                      JPG · PNG · HEIC · multiple files<br/>
                      Auto-enhanced like CamScanner
                    </div>
                    <div className={styles.dropBtns}>
                      <button className={`${styles.btn} ${styles.primary}`}
                        onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                        <i className="fa-solid fa-arrow-up-from-bracket"></i> Choose Files
                      </button>
                      <button className={`${styles.btn} ${styles.ghost}`}
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
                      </div>
                      <div className={styles.tbR}>
                        {/* Per-page mode switcher */}
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
                        <button className={`${styles.toolBtn} ${styles.danger}`}
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
                          <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                            onClick={() => { setAdjVals({ brt: 100, con: 110 }); setEditMode(null); }}>Reset</button>
                          <button className={`${styles.btn} ${styles.primary} ${styles.sm}`} onClick={applyAdj}>Apply</button>
                        </div>
                      </div>
                    )}

                    {/* Image */}
                    <div className={styles.imgWrap}>
                      <img src={selectedPage.dataUrl} alt="Scanned page" />
                    </div>

                    {/* Nav */}
                    <div className={styles.navBar}>
                      <button className={styles.navBtn}
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
                      <button className={styles.navBtn}
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

          {/* ── Processing ── */}
          {processing && (
            <div className={styles.overlay}>
              <div className={styles.procCard}>
                <div className={styles.spinner} />
                <span>{procLabel}</span>
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
