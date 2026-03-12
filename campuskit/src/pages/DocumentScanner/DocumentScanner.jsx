import { useState, useRef, useCallback, useEffect } from "react";
import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./DocumentScanner.module.css";

// ── Helpers ────────────────────────────────────────────────────
function autoEnhance(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Find min/max for auto-levels
  let min = 255, max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  const range = max - min || 1;

  for (let i = 0; i < data.length; i += 4) {
    // Auto-levels stretch
    data[i]     = Math.min(255, ((data[i]     - min) / range) * 255 * 1.05);
    data[i + 1] = Math.min(255, ((data[i + 1] - min) / range) * 255 * 1.05);
    data[i + 2] = Math.min(255, ((data[i + 2] - min) / range) * 255 * 1.05);
    // Slight contrast boost
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] / 255;
      data[i + c] = Math.min(255, Math.max(0, (v - 0.5) * 1.15 + 0.5) * 255);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function fileToCanvas(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Cap size for performance
        const MAX = 2000;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX || h > MAX) {
          const ratio = Math.min(MAX / w, MAX / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
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

function canvasToDataUrl(canvas) {
  return canvas.toDataURL("image/jpeg", 0.92);
}

let idCounter = 0;
function makeId() { return ++idCounter; }

// ── Component ──────────────────────────────────────────────────
export default function DocumentScanner() {
  const [pages, setPages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editMode, setEditMode] = useState(null); // null | "enhance" | "crop"
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Enhance sliders state per selected page
  const [enhanceVals, setEnhanceVals] = useState({ brt: 100, con: 110, sat: 95, sharpen: 1 });

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const dragSrcIndex = useRef(null);

  const selectedPage = pages.find((p) => p.id === selectedId) || null;

  // ── Toast ─────────────────────────────────────────────────────
  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  // ── Add pages from files ──────────────────────────────────────
  async function handleFiles(files) {
    if (!files?.length) return;
    setIsProcessing(true);
    const arr = Array.from(files);
    for (let i = 0; i < arr.length; i++) {
      setProcessingLabel(`Processing page ${i + 1} of ${arr.length}…`);
      const canvas = await fileToCanvas(arr[i]);
      autoEnhance(canvas);
      const dataUrl = canvasToDataUrl(canvas);
      const page = {
        id: makeId(),
        dataUrl,
        originalDataUrl: dataUrl,
        name: arr[i].name || `Page ${pages.length + i + 1}`,
        canvas,
      };
      setPages((prev) => [...prev, page]);
    }
    setIsProcessing(false);
    setProcessingLabel("");
    showToast(`${arr.length} page${arr.length > 1 ? "s" : ""} added`);
  }

  // ── Camera ────────────────────────────────────────────────────
  async function openCamera() {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      showToast("Camera access denied", "error");
      setCameraOpen(false);
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function captureCamera() {
    const video = videoRef.current;
    if (!video) return;
    setIsProcessing(true);
    setProcessingLabel("Enhancing capture…");
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    autoEnhance(c);
    const dataUrl = canvasToDataUrl(c);
    const page = {
      id: makeId(),
      dataUrl,
      originalDataUrl: dataUrl,
      name: `Scan ${pages.length + 1}`,
      canvas: c,
    };
    setPages((prev) => [...prev, page]);
    setIsProcessing(false);
    setProcessingLabel("");
    showToast("Page captured");
  }

  // ── Delete ────────────────────────────────────────────────────
  function deletePage(id) {
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) { setSelectedId(null); setEditMode(null); }
    showToast("Page removed");
  }

  // ── Drag & drop reorder ───────────────────────────────────────
  function onDragStart(e, id, index) {
    dragSrcIndex.current = index;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e, id) {
    e.preventDefault();
    setDragOverId(id);
  }
  function onDrop(e, targetIndex) {
    e.preventDefault();
    const src = dragSrcIndex.current;
    if (src === null || src === targetIndex) { setDragOverId(null); return; }
    setPages((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(src, 1);
      arr.splice(targetIndex, 0, moved);
      return arr;
    });
    setDragOverId(null);
    setDragId(null);
    dragSrcIndex.current = null;
  }
  function onDragEnd() {
    setDragOverId(null);
    setDragId(null);
  }

  // ── Enhance apply ─────────────────────────────────────────────
  function applyEnhance() {
    if (!selectedPage) return;
    const orig = new Image();
    orig.onload = () => {
      const c = document.createElement("canvas");
      c.width = orig.naturalWidth; c.height = orig.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.filter = `brightness(${enhanceVals.brt}%) contrast(${enhanceVals.con}%) saturate(${enhanceVals.sat}%)`;
      ctx.drawImage(orig, 0, 0);
      ctx.filter = "none";
      const dataUrl = canvasToDataUrl(c);
      setPages((prev) =>
        prev.map((p) => p.id === selectedId ? { ...p, dataUrl, canvas: c } : p)
      );
      showToast("Enhancements applied");
      setEditMode(null);
    };
    orig.src = selectedPage.originalDataUrl;
  }

  function resetEnhance() {
    if (!selectedPage) return;
    setPages((prev) =>
      prev.map((p) =>
        p.id === selectedId ? { ...p, dataUrl: p.originalDataUrl } : p
      )
    );
    setEnhanceVals({ brt: 100, con: 110, sat: 95, sharpen: 1 });
    showToast("Reset to original");
  }

  // ── Export PDF ────────────────────────────────────────────────
  async function exportPDF() {
    if (!pages.length) return;
    setExportMenuOpen(false);
    setIsProcessing(true);
    setProcessingLabel("Building PDF…");

    // Load jsPDF from CDN
    await new Promise((resolve, reject) => {
      if (window.jspdf) return resolve();
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });

    const { jsPDF } = window.jspdf;

    for (let i = 0; i < pages.length; i++) {
      setProcessingLabel(`Adding page ${i + 1} of ${pages.length}…`);
      const img = new Image();
      await new Promise((res) => {
        img.onload = res;
        img.src = pages[i].dataUrl;
      });
      const pw = img.naturalWidth, ph = img.naturalHeight;
      const orientation = pw > ph ? "landscape" : "portrait";
      if (i === 0) {
        var pdf = new jsPDF({ orientation, unit: "px", format: [pw, ph] });
      } else {
        pdf.addPage([pw, ph], orientation);
      }
      pdf.addImage(pages[i].dataUrl, "JPEG", 0, 0, pw, ph);
    }

    pdf.save("scanned-document.pdf");
    setIsProcessing(false);
    setProcessingLabel("");
    showToast("PDF downloaded!");
  }

  // ── Export Images ZIP ─────────────────────────────────────────
  async function exportImages() {
    if (!pages.length) return;
    setExportMenuOpen(false);
    setIsProcessing(true);
    setProcessingLabel("Preparing images…");

    // Load JSZip
    await new Promise((resolve, reject) => {
      if (window.JSZip) return resolve();
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });

    const zip = new window.JSZip();
    pages.forEach((p, i) => {
      const base64 = p.dataUrl.split(",")[1];
      zip.file(`page-${String(i + 1).padStart(3, "0")}.jpg`, base64, { base64: true });
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scanned-pages.zip";
    a.click();
    setIsProcessing(false);
    setProcessingLabel("");
    showToast("Images downloaded!");
  }

  // ── Drop zone on page ─────────────────────────────────────────
  function onPageDrop(e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  // Close export menu on outside click
  useEffect(() => {
    function handle(e) {
      if (!e.target.closest(`.${styles.exportWrap}`)) setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Sync enhance sliders when page selected
  useEffect(() => {
    setEnhanceVals({ brt: 100, con: 110, sat: 95, sharpen: 1 });
  }, [selectedId]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={styles.homeContainer}>
      <SideBar />
      <div className={styles.mainWrapper}>
        <Header />
        <main
          className={styles.mainContent}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onPageDrop}
        >
          <div className={styles.page}>

            {/* Page header */}
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.pageEyebrow}>Student Utilities</div>
                <div className={styles.pageTitle}>Document <em>Scanner</em></div>
              </div>
              {pages.length > 0 && (
                <div className={styles.exportWrap}>
                  <button
                    className={`${styles.btn} ${styles.primary}`}
                    onClick={() => setExportMenuOpen((v) => !v)}
                  >
                    <i className="fa-solid fa-file-export"></i>
                    Export
                    <i className={`fa-solid fa-chevron-down ${styles.chevron}`}></i>
                  </button>
                  {exportMenuOpen && (
                    <div className={styles.exportMenu}>
                      <button onClick={exportPDF}>
                        <i className="fa-solid fa-file-pdf"></i>
                        Save as PDF
                        <span>All {pages.length} pages combined</span>
                      </button>
                      <button onClick={exportImages}>
                        <i className="fa-solid fa-images"></i>
                        Save as Images
                        <span>ZIP of JPG files</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Main layout */}
            <div className={styles.layout}>

              {/* ── Left: page strip ── */}
              <div className={styles.strip}>
                <div className={styles.stripHeader}>
                  <span>Pages</span>
                  <span className={styles.pageCount}>{pages.length}</span>
                </div>

                <div className={styles.stripScroll}>
                  {pages.length === 0 && (
                    <div className={styles.stripEmpty}>
                      <i className="fa-regular fa-file-image"></i>
                      <p>No pages yet</p>
                    </div>
                  )}
                  {pages.map((p, i) => (
                    <div
                      key={p.id}
                      className={`${styles.thumb}
                        ${selectedId === p.id ? styles.thumbActive : ""}
                        ${dragOverId === p.id ? styles.thumbDragOver : ""}
                        ${dragId === p.id ? styles.thumbDragging : ""}
                      `}
                      draggable
                      onDragStart={(e) => onDragStart(e, p.id, i)}
                      onDragOver={(e) => onDragOver(e, p.id)}
                      onDrop={(e) => onDrop(e, i)}
                      onDragEnd={onDragEnd}
                      onClick={() => { setSelectedId(p.id); setEditMode(null); }}
                    >
                      <div className={styles.thumbNum}>{i + 1}</div>
                      <img src={p.dataUrl} alt={`Page ${i + 1}`} />
                      <div className={styles.thumbOverlay}>
                        <button
                          className={styles.thumbDelete}
                          onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}
                          title="Delete page"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      <div className={styles.thumbDragHandle}>
                        <i className="fa-solid fa-grip-vertical"></i>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add buttons */}
                <div className={styles.addButtons}>
                  <button
                    className={`${styles.btn} ${styles.addBtn}`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="fa-solid fa-arrow-up-from-bracket"></i>
                    Upload
                  </button>
                  <button
                    className={`${styles.btn} ${styles.addBtn}`}
                    onClick={openCamera}
                  >
                    <i className="fa-solid fa-camera"></i>
                    Camera
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
              </div>

              {/* ── Right: viewer / editor ── */}
              <div className={styles.viewer}>
                {!selectedPage ? (
                  <div
                    className={styles.dropZone}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                  >
                    <div className={styles.dropIcon}>
                      <i className="fa-solid fa-scanner-image"></i>
                    </div>
                    <div className={styles.dropTitle}>Drop documents here</div>
                    <div className={styles.dropSub}>
                      or click to upload · JPG, PNG, HEIC · multiple files supported
                    </div>
                    <div className={styles.dropActions}>
                      <button
                        className={`${styles.btn} ${styles.primary}`}
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      >
                        <i className="fa-solid fa-arrow-up-from-bracket"></i> Choose Files
                      </button>
                      <button
                        className={`${styles.btn} ${styles.ghost}`}
                        onClick={(e) => { e.stopPropagation(); openCamera(); }}
                      >
                        <i className="fa-solid fa-camera"></i> Use Camera
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.editorWrap}>
                    {/* Toolbar */}
                    <div className={styles.toolbar}>
                      <div className={styles.toolbarLeft}>
                        <span className={styles.pageName}>{selectedPage.name}</span>
                        <span className={styles.pageIndex}>
                          Page {pages.findIndex((p) => p.id === selectedId) + 1} of {pages.length}
                        </span>
                      </div>
                      <div className={styles.toolbarRight}>
                        <button
                          className={`${styles.toolBtn} ${editMode === "enhance" ? styles.toolBtnActive : ""}`}
                          onClick={() => setEditMode(editMode === "enhance" ? null : "enhance")}
                        >
                          <i className="fa-solid fa-sliders"></i> Enhance
                        </button>
                        <button
                          className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
                          onClick={() => deletePage(selectedId)}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    {/* Enhance panel */}
                    {editMode === "enhance" && (
                      <div className={styles.enhancePanel}>
                        {[
                          { key: "brt", label: "Brightness", min: 50, max: 200, suffix: "%" },
                          { key: "con", label: "Contrast",   min: 50, max: 200, suffix: "%" },
                          { key: "sat", label: "Saturation", min: 0,  max: 200, suffix: "%" },
                        ].map((sl) => (
                          <div className={styles.sliderRow} key={sl.key}>
                            <span className={styles.slLabel}>{sl.label}</span>
                            <input
                              type="range"
                              min={sl.min}
                              max={sl.max}
                              value={enhanceVals[sl.key]}
                              onChange={(e) =>
                                setEnhanceVals((v) => ({ ...v, [sl.key]: Number(e.target.value) }))
                              }
                            />
                            <span className={styles.slVal}>{enhanceVals[sl.key]}{sl.suffix}</span>
                          </div>
                        ))}
                        <div className={styles.enhanceActions}>
                          <button className={`${styles.btn} ${styles.ghost} ${styles.btnSm}`} onClick={resetEnhance}>
                            Reset
                          </button>
                          <button className={`${styles.btn} ${styles.primary} ${styles.btnSm}`} onClick={applyEnhance}>
                            Apply
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Image preview */}
                    <div
                      className={styles.imageWrap}
                      style={editMode === "enhance" ? {
                        filter: `brightness(${enhanceVals.brt}%) contrast(${enhanceVals.con}%) saturate(${enhanceVals.sat}%)`
                      } : {}}
                    >
                      <img src={selectedPage.dataUrl} alt="Selected page" />
                    </div>

                    {/* Nav arrows */}
                    <div className={styles.navBar}>
                      <button
                        className={styles.navBtn}
                        disabled={pages.findIndex((p) => p.id === selectedId) === 0}
                        onClick={() => {
                          const idx = pages.findIndex((p) => p.id === selectedId);
                          if (idx > 0) { setSelectedId(pages[idx - 1].id); setEditMode(null); }
                        }}
                      >
                        <i className="fa-solid fa-chevron-left"></i> Prev
                      </button>
                      <span className={styles.navDots}>
                        {pages.map((p, i) => (
                          <span
                            key={p.id}
                            className={`${styles.dot} ${p.id === selectedId ? styles.dotActive : ""}`}
                            onClick={() => { setSelectedId(p.id); setEditMode(null); }}
                          />
                        ))}
                      </span>
                      <button
                        className={styles.navBtn}
                        disabled={pages.findIndex((p) => p.id === selectedId) === pages.length - 1}
                        onClick={() => {
                          const idx = pages.findIndex((p) => p.id === selectedId);
                          if (idx < pages.length - 1) { setSelectedId(pages[idx + 1].id); setEditMode(null); }
                        }}
                      >
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
            <div className={styles.modalOverlay}>
              <div className={styles.cameraModal}>
                <div className={styles.cameraHeader}>
                  <span>Camera</span>
                  <button className={styles.closeBtn} onClick={closeCamera}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div className={styles.cameraBody}>
                  <video ref={videoRef} className={styles.cameraVideo} playsInline muted />
                  <div className={styles.cameraGuide} />
                </div>
                <div className={styles.cameraFooter}>
                  <button className={styles.captureBtn} onClick={captureCamera}>
                    <span className={styles.captureRing} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Processing overlay ── */}
          {isProcessing && (
            <div className={styles.processingOverlay}>
              <div className={styles.processingCard}>
                <div className={styles.spinner} />
                <div className={styles.processingLabel}>{processingLabel}</div>
              </div>
            </div>
          )}

          {/* ── Toast ── */}
          {toast && (
            <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
              <i className={`fa-solid ${toast.type === "error" ? "fa-circle-xmark" : "fa-circle-check"}`}></i>
              {toast.msg}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
