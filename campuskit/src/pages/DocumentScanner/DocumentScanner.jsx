import { useState, useRef, useEffect } from "react";
import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./DocumentScanner.module.css";

// ─────────────────────────────────────────────────────────────
//  CANVAS UTILITIES
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

// ── Canny-like edge detection (simplified) ──
function edgeDetect(grey, w, h) {
  const edges = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -grey[(y-1)*w+(x-1)] - 2*grey[y*w+(x-1)] - grey[(y+1)*w+(x-1)] +
         grey[(y-1)*w+(x+1)] + 2*grey[y*w+(x+1)] + grey[(y+1)*w+(x+1)];
      const gy =
        -grey[(y-1)*w+(x-1)] - 2*grey[(y-1)*w+x] - grey[(y-1)*w+(x+1)] +
         grey[(y+1)*w+(x-1)] + 2*grey[(y+1)*w+x] + grey[(y+1)*w+(x+1)];
      const mag = Math.sqrt(gx*gx + gy*gy);
      edges[y * w + x] = mag > 30 ? 255 : 0;
    }
  }
  return edges;
}

// ── Find the largest rectangular contour (document boundary) ──
// Uses a simplified approach: scan edges to find extreme corners of the document
function findDocumentCorners(edges, w, h) {
  // Sample points along the border of the image inward to find the document edge
  // Strategy: for each of the 4 sides, find the furthest strong-edge row/col
  const margin = Math.round(Math.min(w, h) * 0.05);

  let top = margin, bottom = h - margin, left = margin, right = w - margin;

  // Find top edge: scan rows from top, find first row with significant edges
  for (let y = margin; y < h / 2; y++) {
    let edgeCount = 0;
    for (let x = margin; x < w - margin; x++) {
      if (edges[y * w + x] > 0) edgeCount++;
    }
    if (edgeCount > (w - 2 * margin) * 0.15) { top = y; break; }
  }
  // Find bottom edge
  for (let y = h - margin; y > h / 2; y--) {
    let edgeCount = 0;
    for (let x = margin; x < w - margin; x++) {
      if (edges[y * w + x] > 0) edgeCount++;
    }
    if (edgeCount > (w - 2 * margin) * 0.15) { bottom = y; break; }
  }
  // Find left edge
  for (let x = margin; x < w / 2; x++) {
    let edgeCount = 0;
    for (let y = margin; y < h - margin; y++) {
      if (edges[y * w + x] > 0) edgeCount++;
    }
    if (edgeCount > (h - 2 * margin) * 0.15) { left = x; break; }
  }
  // Find right edge
  for (let x = w - margin; x > w / 2; x--) {
    let edgeCount = 0;
    for (let y = margin; y < h - margin; y++) {
      if (edges[y * w + x] > 0) edgeCount++;
    }
    if (edgeCount > (h - 2 * margin) * 0.15) { right = x; break; }
  }

  // Add small padding inside detected boundary
  const pad = Math.round(Math.min(w, h) * 0.01);
  return {
    topLeft:     { x: left + pad,  y: top + pad },
    topRight:    { x: right - pad, y: top + pad },
    bottomRight: { x: right - pad, y: bottom - pad },
    bottomLeft:  { x: left + pad,  y: bottom - pad },
  };
}

// ── Perspective transform (4-point → rectangle) ──
function perspectiveTransform(srcCanvas, corners) {
  const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = corners;

  const outW = Math.round(Math.max(
    Math.hypot(tr.x - tl.x, tr.y - tl.y),
    Math.hypot(br.x - bl.x, br.y - bl.y)
  ));
  const outH = Math.round(Math.max(
    Math.hypot(bl.x - tl.x, bl.y - tl.y),
    Math.hypot(br.x - tr.x, br.y - tr.y)
  ));

  if (outW < 50 || outH < 50) return null;

  const dst = document.createElement("canvas");
  dst.width = outW; dst.height = outH;
  const ctx = dst.getContext("2d");

  // Bilinear sampling from source
  const srcCtx = srcCanvas.getContext("2d");
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
  const dstData = ctx.createImageData(outW, outH);
  const dd = dstData.data;
  const sw = srcCanvas.width, sh = srcCanvas.height;

  for (let y = 0; y < outH; y++) {
    const fy = y / outH;
    for (let x = 0; x < outW; x++) {
      const fx = x / outW;
      // Bilinear interpolation of source coordinates
      const sx = (1-fx)*(1-fy)*tl.x + fx*(1-fy)*tr.x + fx*fy*br.x + (1-fx)*fy*bl.x;
      const sy = (1-fx)*(1-fy)*tl.y + fx*(1-fy)*tr.y + fx*fy*br.y + (1-fx)*fy*bl.y;

      const ix = Math.min(Math.max(Math.round(sx), 0), sw - 1);
      const iy = Math.min(Math.max(Math.round(sy), 0), sh - 1);
      const si = (iy * sw + ix) * 4;
      const di = (y * outW + x) * 4;
      dd[di]   = srcData[si];
      dd[di+1] = srcData[si+1];
      dd[di+2] = srcData[si+2];
      dd[di+3] = 255;
    }
  }
  ctx.putImageData(dstData, 0, 0);
  return dst;
}

// ── Adaptive threshold (CamScanner B&W) ──
function applyBW(canvas) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    grey[i] = 0.299 * d[p] + 0.587 * d[p+1] + 0.114 * d[p+2];
  }
  const r = Math.max(10, Math.round(Math.min(w, h) * 0.06));
  const mean = boxBlur(grey, w, h, r);
  const out = ctx.createImageData(w, h);
  const od = out.data;
  for (let i = 0; i < w * h; i++) {
    const v = grey[i] < mean[i] - 12 ? 0 : 255;
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
  let rMn=255,rMx=0,gMn=255,gMx=0,bMn=255,bMx=0;
  for (let i = 0; i < d.length; i += 4) {
    if(d[i]<rMn)rMn=d[i]; if(d[i]>rMx)rMx=d[i];
    if(d[i+1]<gMn)gMn=d[i+1]; if(d[i+1]>gMx)gMx=d[i+1];
    if(d[i+2]<bMn)bMn=d[i+2]; if(d[i+2]>bMx)bMx=d[i+2];
  }
  const rR=rMx-rMn||1, gR=gMx-gMn||1, bR=bMx-bMn||1;
  for (let i = 0; i < d.length; i += 4) {
    d[i]  =clamp(((d[i]  -rMn)/rR)*265);
    d[i+1]=clamp(((d[i+1]-gMn)/gR)*265);
    d[i+2]=clamp(((d[i+2]-bMn)/bR)*265);
  }
  ctx.putImageData(id, 0, 0);
}

// ── Main smart scan pipeline ──────────────────────────────────
// 1. Detect document boundary via edge detection
// 2. Crop & perspective-correct to just the document
// 3. Apply chosen colour mode
function smartScan(rawCanvas, mode) {
  const w = rawCanvas.width, h = rawCanvas.height;
  const ctx = rawCanvas.getContext("2d");
  const d = ctx.getImageData(0, 0, w, h).data;

  // Greyscale for edge detection
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    grey[i] = 0.299*d[p] + 0.587*d[p+1] + 0.114*d[p+2];
  }

  // Blur slightly before edge detection to reduce noise
  const blurred = boxBlur(grey, w, h, 2);
  const edges = edgeDetect(blurred, w, h);
  const corners = findDocumentCorners(edges, w, h);

  // Check if detected crop is meaningfully different from the full image
  // (if corners are too close to the image edge, skip perspective warp)
  const marginThresh = Math.min(w, h) * 0.06;
  const isMeaningfulCrop =
    corners.topLeft.x > marginThresh ||
    corners.topLeft.y > marginThresh ||
    corners.bottomRight.x < w - marginThresh ||
    corners.bottomRight.y < h - marginThresh;

  let result;
  if (isMeaningfulCrop) {
    const warped = perspectiveTransform(rawCanvas, corners);
    result = warped ?? (() => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(rawCanvas, 0, 0);
      return c;
    })();
  } else {
    result = document.createElement("canvas");
    result.width = w; result.height = h;
    result.getContext("2d").drawImage(rawCanvas, 0, 0);
  }

  // Apply colour mode
  if (mode === "bw")         applyBW(result);
  else if (mode === "grey")  applyGrey(result);
  else if (mode === "colour") applyColour(result);

  return result;
}

// ── Precise bilinear perspective warp ──────────────────────────
// Given 4 source corners (tl, tr, br, bl) on rawCanvas,
// produce a rectangularly-corrected output canvas.
function perspectiveWarp(srcCanvas, tl, tr, br, bl) {
  const outW = Math.round(Math.max(
    Math.hypot(tr.x - tl.x, tr.y - tl.y),
    Math.hypot(br.x - bl.x, br.y - bl.y)
  ));
  const outH = Math.round(Math.max(
    Math.hypot(bl.x - tl.x, bl.y - tl.y),
    Math.hypot(br.x - tr.x, br.y - tr.y)
  ));
  if (outW < 60 || outH < 60) return null;

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
      // Bilinear interpolation of the 4 corners
      const sx = (1-fx)*(1-fy)*tl.x + fx*(1-fy)*tr.x + fx*fy*br.x + (1-fx)*fy*bl.x;
      const sy = (1-fx)*(1-fy)*tl.y + fx*(1-fy)*tr.y + fx*fy*br.y + (1-fx)*fy*bl.y;
      const ix = Math.min(Math.max(Math.round(sx), 0), srcCanvas.width  - 1);
      const iy = Math.min(Math.max(Math.round(sy), 0), srcCanvas.height - 1);
      const si = (iy * sw + ix) * 4;
      const di = (y  * outW + x) * 4;
      od[di] = sd[si]; od[di+1] = sd[si+1]; od[di+2] = sd[si+2]; od[di+3] = 255;
    }
  }
  dctx.putImageData(id, 0, 0);
  return dst;
}

// ── AI enhancement — Claude finds exact document corners ───────
async function aiEnhance(rawCanvas, mode) {
  // Always have a local fallback ready
  const fallback = smartScan(rawCanvas, mode);

  try {
    // Downscale for API (keeps cost low, still enough detail)
    const API_MAX = 1120;
    const scaleW = rawCanvas.width, scaleH = rawCanvas.height;
    const scale  = Math.min(API_MAX / scaleW, API_MAX / scaleH, 1);
    const apiW   = Math.round(scaleW * scale);
    const apiH   = Math.round(scaleH * scale);
    const small  = document.createElement("canvas");
    small.width = apiW; small.height = apiH;
    small.getContext("2d").drawImage(rawCanvas, 0, 0, apiW, apiH);
    const base64 = small.toDataURL("image/jpeg", 0.88).split(",")[1];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: `You are a document scanning AI like CamScanner. Your job is to find the exact corners of the physical document (notebook/paper) in the image and return them as pixel coordinates relative to the image dimensions provided.

Return ONLY valid JSON, no markdown, no explanation:
{
  "imageW": <the width you received>,
  "imageH": <the height you received>,
  "corners": {
    "tl": {"x": <top-left x>,  "y": <top-left y>},
    "tr": {"x": <top-right x>, "y": <top-right y>},
    "br": {"x": <bottom-right x>, "y": <bottom-right y>},
    "bl": {"x": <bottom-left x>,  "y": <bottom-left y>}
  },
  "brightness": <70-155, 100=neutral, increase for dark images>,
  "contrast":   <80-190, 100=neutral, increase for flat images>,
  "mode": <"bw" for text/diagrams, "grey" for mixed, "colour" for photos>
}

Rules for corners:
- Find the outermost edges of the physical paper/notebook page, NOT the content
- If the image shows a notebook on a background (desk, bed, floor), the corners should be the 4 corners of the notebook page itself
- If the image is already a clean scan with no background, corners = near the image edges (small margin ~10px)
- Coordinates must be within [0, imageW] and [0, imageH]
- tl = top-left, tr = top-right, br = bottom-right, bl = bottom-left, going clockwise`,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: `Image dimensions: ${apiW}x${apiH}. Find the document corners and return JSON.` }
          ]
        }]
      })
    });

    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    const raw  = (data.content?.[0]?.text ?? "").replace(/```json|```/g, "").trim();
    const p    = JSON.parse(raw);

    // Scale corners back up to original canvas size
    const upX = rawCanvas.width  / (p.imageW || apiW);
    const upY = rawCanvas.height / (p.imageH || apiH);
    const c   = p.corners;
    const tl  = { x: c.tl.x * upX, y: c.tl.y * upY };
    const tr  = { x: c.tr.x * upX, y: c.tr.y * upY };
    const br  = { x: c.br.x * upX, y: c.br.y * upY };
    const bl  = { x: c.bl.x * upX, y: c.bl.y * upY };

    // Apply brightness/contrast to the raw canvas before warping
    const adjusted = document.createElement("canvas");
    adjusted.width = rawCanvas.width; adjusted.height = rawCanvas.height;
    const actx = adjusted.getContext("2d");
    actx.filter = `brightness(${p.brightness ?? 100}%) contrast(${p.contrast ?? 100}%)`;
    actx.drawImage(rawCanvas, 0, 0);
    actx.filter = "none";

    // Warp to rectangle using the AI-identified corners
    const warped = perspectiveWarp(adjusted, tl, tr, br, bl);
    if (!warped) return fallback;

    // Apply colour mode to the warped result
    const effectiveMode = p.mode ?? mode;
    if (effectiveMode === "bw")         applyBW(warped);
    else if (effectiveMode === "grey")  applyGrey(warped);
    else if (effectiveMode === "colour") applyColour(warped);

    return warped;

  } catch (e) {
    console.warn("AI corner detection failed, using local pipeline:", e.message);
    return fallback;
  }
}

function fileToCanvas(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 2600;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w=Math.round(w*r); h=Math.round(h*r); }
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
  const [pages,       setPages]       = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [editMode,    setEditMode]    = useState(null);
  const [cameraOpen,  setCameraOpen]  = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragIdx,     setDragIdx]     = useState(null);
  const [processing,  setProcessing]  = useState(false);
  const [procLabel,   setProcLabel]   = useState("");
  const [procStep,    setProcStep]    = useState(0);
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

  function startProgress(label) {
    setProcLabel(label); setProcessing(true); setProcStep(0);
    let v = 0;
    timerRef.current = setInterval(() => {
      v += Math.random() * 10; if (v >= 88) v = 88;
      setProcStep(Math.round(v));
    }, 300);
  }

  function finishProgress() {
    clearInterval(timerRef.current);
    setProcStep(100);
    setTimeout(() => { setProcessing(false); setProcStep(0); }, 350);
  }

  // ── Add files ──────────────────────────────────────────────
  async function handleFiles(files) {
    if (!files?.length) return;
    const arr = Array.from(files);
    for (let i = 0; i < arr.length; i++) {
      startProgress(useAI
        ? `AI scanning page ${i+1} of ${arr.length}…`
        : `Scanning page ${i+1} of ${arr.length}…`);
      const raw = await fileToCanvas(arr[i]);
      const processed = useAI ? await aiEnhance(raw, scanMode) : smartScan(raw, scanMode);
      const pageId = uid();
      const p = {
        id: pageId, dataUrl: toJpeg(processed), rawCanvas: raw,
        mode: scanMode, aiEnhanced: useAI,
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
    startProgress(useAI ? "AI processing scan…" : "Processing scan…");
    const raw = document.createElement("canvas");
    raw.width = video.videoWidth; raw.height = video.videoHeight;
    raw.getContext("2d").drawImage(video, 0, 0);
    const processed = useAI ? await aiEnhance(raw, scanMode) : smartScan(raw, scanMode);
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
    const page = pages.find((p) => p.id === id); if (!page) return;
    startProgress(useAI ? "AI reprocessing…" : "Reprocessing…");
    const processed = useAI ? await aiEnhance(page.rawCanvas, mode) : smartScan(page.rawCanvas, mode);
    finishProgress();
    setPages((prev) => prev.map((p) => p.id === id ? { ...p, dataUrl: toJpeg(processed), mode, aiEnhanced: useAI } : p));
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
    startProgress("Building PDF…");
    await new Promise((res, rej) => {
      if (window.jspdf) return res();
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    const { jsPDF } = window.jspdf;
    let pdf;
    for (let i = 0; i < pages.length; i++) {
      setProcLabel(`Adding page ${i+1} of ${pages.length}…`);
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
    startProgress("Zipping images…");
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

            {/* ── Controls bar (below title, not in header) ── */}
            <div className={styles.controlsBar}>
              <div className={styles.controlsLeft}>
                {/* AI toggle */}
                <button
                  className={`${styles.aiToggle} ${useAI ? styles.aiToggleOn : ""}`}
                  onClick={() => setUseAI((v) => !v)}
                >
                  <span className={styles.aiDot} />
                  {useAI ? "AI Enhance: On" : "AI Enhance: Off"}
                </button>

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
                      <i className={m.icon}></i><span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Export — fixed to bottom right of page, not inline */}
              {pages.length > 0 && (
                <div className={styles.exportWrap}>
                  <button className={`${styles.btn} ${styles.btnInk}`} onClick={() => setExportOpen((v) => !v)}>
                    <i className="fa-solid fa-file-export"></i> Export
                    <i className="fa-solid fa-chevron-down" style={{ fontSize: 9, marginLeft: 2 }}></i>
                  </button>
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
                      JPG · PNG · HEIC · multiple files<br />
                      {useAI ? "Claude AI detects & crops the document automatically" : "Smart edge detection crops the document automatically"}
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

          {/* ── Export panel — fixed bottom right, always above everything ── */}
          {exportOpen && pages.length > 0 && (
            <>
              <div className={styles.exportBackdrop} onClick={() => setExportOpen(false)} />
              <div className={styles.exportPanel}>
                <div className={styles.exportPanelTitle}>Export Document</div>
                <button className={styles.exportOption} onClick={exportPDF}>
                  <div className={styles.exportOptionIcon}><i className="fa-solid fa-file-pdf"></i></div>
                  <div className={styles.exportOptionText}>
                    <span>Save as PDF</span>
                    <small>{pages.length} page{pages.length > 1 ? "s" : ""} combined into one file</small>
                  </div>
                </button>
                <button className={styles.exportOption} onClick={exportZip}>
                  <div className={styles.exportOptionIcon}><i className="fa-solid fa-images"></i></div>
                  <div className={styles.exportOptionText}>
                    <span>Save as Images</span>
                    <small>ZIP archive of JPG files</small>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* ── Camera modal ── */}
          {cameraOpen && (
            <div className={styles.overlay}>
              <div className={styles.camModal}>
                <div className={styles.camHead}>
                  <span>Camera — point at document</span>
                  <button className={styles.camClose} onClick={closeCamera}><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className={styles.camBody}>
                  <video ref={videoRef} className={styles.camVideo} playsInline muted />
                  <div className={styles.camGuide} />
                  <div className={styles.camHint}>Align document within the guide</div>
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
