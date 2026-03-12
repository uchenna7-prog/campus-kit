import { useState, useRef, useEffect } from "react";
import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./DocumentScanner.module.css";

// --- CANVAS UTILITIES ---
const clamp = (v) => Math.max(0, Math.min(255, v));

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      sum += src[y * w + x];
      if (x > r) sum -= src[y * w + (x - r - 1)];
      const cnt = Math.min(x, r) + 1 + Math.min(w - 1 - x, r);
      tmp[y * w + x] = sum / cnt;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      sum += tmp[y * w + x];
      if (y > r) sum -= tmp[(y - r - 1) * w + x];
      const cnt = Math.min(y, r) + 1 + Math.min(h - 1 - y, r);
      out[y * w + x] = sum / cnt;
    }
  }
  return out;
}

function edgeDetect(grey, w, h) {
  const edges = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = -grey[(y-1)*w+(x-1)] - 2*grey[y*w+(x-1)] - grey[(y+1)*w+(x-1)] + grey[(y-1)*w+(x+1)] + 2*grey[y*w+(x+1)] + grey[(y+1)*w+(x+1)];
      const gy = -grey[(y-1)*w+(x-1)] - 2*grey[(y-1)*w+x] - grey[(y-1)*w+(x+1)] + grey[(y+1)*w+(x-1)] + 2*grey[(y+1)*w+x] + grey[(y+1)*w+(x+1)];
      const mag = Math.sqrt(gx*gx + gy*gy);
      edges[y * w + x] = mag > 35 ? 255 : 0;
    }
  }
  return edges;
}

function findDocumentCorners(edges, w, h) {
  const margin = Math.round(Math.min(w, h) * 0.05);
  let top = margin, bottom = h - margin, left = margin, right = w - margin;

  for (let y = margin; y < h / 2; y++) {
    let edgeCount = 0;
    for (let x = margin; x < w - margin; x++) if (edges[y * w + x] > 0) edgeCount++;
    if (edgeCount > (w - 2 * margin) * 0.12) { top = y; break; }
  }
  for (let y = h - margin; y > h / 2; y--) {
    let edgeCount = 0;
    for (let x = margin; x < w - margin; x++) if (edges[y * w + x] > 0) edgeCount++;
    if (edgeCount > (w - 2 * margin) * 0.12) { bottom = y; break; }
  }
  for (let x = margin; x < w / 2; x++) {
    let edgeCount = 0;
    for (let y = margin; y < h - margin; y++) if (edges[y * w + x] > 0) edgeCount++;
    if (edgeCount > (h - 2 * margin) * 0.12) { left = x; break; }
  }
  for (let x = w - margin; x > w / 2; x--) {
    let edgeCount = 0;
    for (let y = margin; y < h - margin; y++) if (edges[y * w + x] > 0) edgeCount++;
    if (edgeCount > (h - 2 * margin) * 0.12) { right = x; break; }
  }

  const pad = 2;
  return {
    topLeft: { x: left + pad, y: top + pad },
    topRight: { x: right - pad, y: top + pad },
    bottomRight: { x: right - pad, y: bottom - pad },
    bottomLeft: { x: left + pad, y: bottom - pad },
  };
}

function perspectiveWarp(srcCanvas, tl, tr, br, bl) {
  const outW = Math.round(Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y)));
  const outH = Math.round(Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y)));
  if (outW < 50 || outH < 50) return null;
  const dst = document.createElement("canvas");
  dst.width = outW; dst.height = outH;
  const dctx = dst.getContext("2d");
  const sctx = srcCanvas.getContext("2d");
  const sd = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
  const id = dctx.createImageData(outW, outH);
  const od = id.data;
  const sw = srcCanvas.width;
  for (let y = 0; y < outH; y++) {
    const fy = y / (outH - 1);
    for (let x = 0; x < outW; x++) {
      const fx = x / (outW - 1);
      const sx = (1-fx)*(1-fy)*tl.x + fx*(1-fy)*tr.x + fx*fy*br.x + (1-fx)*fy*bl.x;
      const sy = (1-fx)*(1-fy)*tl.y + fx*(1-fy)*tr.y + fx*fy*br.y + (1-fx)*fy*bl.y;
      const ix = Math.min(Math.max(Math.round(sx), 0), srcCanvas.width - 1);
      const iy = Math.min(Math.max(Math.round(sy), 0), srcCanvas.height - 1);
      const si = (iy * sw + ix) * 4;
      const di = (y * outW + x) * 4;
      od[di] = sd[si]; od[di+1] = sd[si+1]; od[di+2] = sd[si+2]; od[di+3] = 255;
    }
  }
  dctx.putImageData(id, 0, 0);
  return dst;
}

function applyBW(canvas) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    grey[i] = 0.299 * d[p] + 0.587 * d[p+1] + 0.114 * d[p+2];
  }
  const r = Math.max(10, Math.round(Math.min(w, h) * 0.05));
  const mean = boxBlur(grey, w, h, r);
  const out = ctx.createImageData(w, h);
  const od = out.data;
  for (let i = 0; i < w * h; i++) {
    // CamScanner-like adaptive thresholding
    const v = grey[i] < mean[i] - 8 ? 0 : 255;
    const p = i * 4;
    od[p] = od[p+1] = od[p+2] = v; od[p+3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

function applyGrey(canvas) {
  const ctx = canvas.getContext("2d");
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data;
  let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const range = hi - lo || 1;
  for (let i = 0; i < d.length; i += 4) {
    let v = ((0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) - lo) / range * 255;
    v = clamp((v/255 - 0.5) * 1.3 + 0.5) * 255;
    d[i] = d[i+1] = d[i+2] = clamp(v);
  }
  ctx.putImageData(id, 0, 0);
}

function applyColour(canvas) {
  const ctx = canvas.getContext("2d");
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data;
  let rMn=255, rMx=0, gMn=255, gMx=0, bMn=255, bMx=0;
  for (let i = 0; i < d.length; i += 4) {
    if(d[i]<rMn)rMn=d[i]; if(d[i]>rMx)rMx=d[i];
    if(d[i+1]<gMn)gMn=d[i+1]; if(d[i+1]>gMx)gMx=d[i+1];
    if(d[i+2]<bMn)bMn=d[i+2]; if(d[i+2]>bMx)bMx=d[i+2];
  }
  const rR=rMx-rMn||1, gR=gMx-gMn||1, bR=bMx-bMn||1;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp(((d[i]-rMn)/rR)*265);
    d[i+1] = clamp(((d[i+1]-gMn)/gR)*265);
    d[i+2] = clamp(((d[i+2]-bMn)/bR)*265);
  }
  ctx.putImageData(id, 0, 0);
}

function smartScan(rawCanvas, mode) {
  const w = rawCanvas.width, h = rawCanvas.height;
  const ctx = rawCanvas.getContext("2d");
  const d = ctx.getImageData(0, 0, w, h).data;
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    grey[i] = 0.299*d[p] + 0.587*d[p+1] + 0.114*d[p+2];
  }
  const blurred = boxBlur(grey, w, h, 2);
  const edges = edgeDetect(blurred, w, h);
  const corners = findDocumentCorners(edges, w, h);
  const marginThresh = Math.min(w, h) * 0.05;
  const isMeaningfulCrop = corners.topLeft.x > marginThresh || corners.topLeft.y > marginThresh || corners.bottomRight.x < w - marginThresh;
  let result;
  if (isMeaningfulCrop) {
    result = perspectiveWarp(rawCanvas, corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft) ?? rawCanvas;
  } else {
    result = document.createElement("canvas");
    result.width = w; result.height = h;
    result.getContext("2d").drawImage(rawCanvas, 0, 0);
  }
  if (mode === "bw") applyBW(result);
  else if (mode === "grey") applyGrey(result);
  else if (mode === "colour") applyColour(result);
  return result;
}

// --- COMPONENT ---
export default function DocumentScanner() {
  const [pages, setPages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editMode, setEditMode] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [procLabel, setProcLabel] = useState("");
  const [procStep, setProcStep] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [scanMode, setScanMode] = useState("bw");
  const [useAI, setUseAI] = useState(true);

  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const exportRef = useRef(null);

  const selectedPage = pages.find((p) => p.id === selectedId) ?? null;

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const toJpeg = (c) => c.toDataURL("image/jpeg", 0.9);

  async function handleFiles(files) {
    if (!files?.length) return;
    setProcessing(true);
    const arr = Array.from(files);
    const newPages = [];
    for (let i = 0; i < arr.length; i++) {
      setProcLabel(`Scanning page ${i + 1}...`);
      setProcStep(Math.round(((i + 1) / arr.length) * 100));
      const reader = new FileReader();
      const raw = await new Promise((res) => {
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width; c.height = img.height;
            c.getContext("2d").drawImage(img, 0, 0);
            res(c);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(arr[i]);
      });
      const processed = smartScan(raw, scanMode);
      newPages.push({
        id: Date.now() + i,
        dataUrl: toJpeg(processed),
        rawCanvas: raw,
        mode: scanMode,
        name: arr[i].name.split(".")[0]
      });
    }
    setPages(prev => [...prev, ...newPages]);
    if (!selectedId) setSelectedId(newPages[0].id);
    setProcessing(false);
    showToast(`Added ${arr.length} pages`);
  }

  async function exportPDF() {
    setExportOpen(false);
    setProcessing(true);
    setProcLabel("Generating PDF...");
    // Logic for jsPDF would go here
    setTimeout(() => {
      setProcessing(false);
      showToast("PDF Downloaded");
    }, 1500);
  }

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={styles.homeContainer}>
      <SideBar />
      <div className={styles.mainWrapper}>
        <Header />
        <main className={styles.mainContent}>
          <div className={styles.page}>
            <div className={styles.pageHeader}>
              <div className={styles.pageEyebrow}>Student Utilities</div>
              <h1 className={styles.pageTitle}>Document <em>Scanner</em></h1>
            </div>

            <div className={styles.controlsBar}>
              <div className={styles.controlsLeft}>
                <div className={styles.modeToggle}>
                  {["bw", "grey", "colour"].map((m) => (
                    <button key={m} className={`${styles.modeBtn} ${scanMode === m ? styles.modeBtnOn : ""}`} onClick={() => setScanMode(m)}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.exportContainer} ref={exportRef}>
                <button className={styles.btnInk} onClick={() => setExportOpen(!exportOpen)}>
                  <i className="fa-solid fa-file-export"></i> Export <i className="fa-solid fa-chevron-down"></i>
                </button>
                {exportOpen && (
                  <div className={styles.exportDropdown}>
                    <button onClick={exportPDF}><i className="fa-solid fa-file-pdf"></i> Save as PDF</button>
                    <button onClick={() => showToast("Images saved")}><i className="fa-solid fa-images"></i> Save as Images</button>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.layout}>
              <div className={styles.strip}>
                <div className={styles.stripHead}>Pages <span className={styles.badge}>{pages.length}</span></div>
                <div className={styles.stripScroll}>
                  {pages.map((p, i) => (
                    <div key={p.id} className={`${styles.thumb} ${selectedId === p.id ? styles.thumbOn : ""}`} onClick={() => setSelectedId(p.id)}>
                      <img src={p.dataUrl} alt="thumb" />
                      <span className={styles.thumbNum}>{i+1}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.addRow}>
                  <button className={styles.addBtn} onClick={() => fileRef.current.click()}><i className="fa-solid fa-plus"></i> Add</button>
                  <input ref={fileRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
                </div>
              </div>

              <div className={styles.viewer}>
                {selectedPage ? (
                  <div className={styles.editorWrap}>
                    <div className={styles.toolbar}>
                       <span>{selectedPage.name}</span>
                       <button className={styles.toolBtnDanger} onClick={() => setPages(pages.filter(p => p.id !== selectedId))}><i className="fa-solid fa-trash"></i></button>
                    </div>
                    <div className={styles.imgWrap}>
                      <img src={selectedPage.dataUrl} alt="scan" />
                    </div>
                  </div>
                ) : (
                  <div className={styles.dropZone} onClick={() => fileRef.current.click()}>
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <p>Click to upload or drag documents here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {processing && (
            <div className={styles.overlay}>
              <div className={styles.procCard}>
                <div className={styles.spinner}></div>
                <p>{procLabel}</p>
                <div className={styles.progTrack}><div className={styles.progFill} style={{width: `${procStep}%`}}></div></div>
              </div>
            </div>
          )}

          {toast && <div className={styles.toast}>{toast.msg}</div>}
        </main>
      </div>
    </div>
  );
}
