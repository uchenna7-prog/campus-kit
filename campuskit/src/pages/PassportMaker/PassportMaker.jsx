import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./PassportMaker.module.css";

// ── Constants ──────────────────────────────────────────────────
const PRESETS = {
  ng: { w: 413, h: 531, label: "NG", dim: "35×45mm" },
  us: { w: 600, h: 600, label: "US", dim: "51×51mm" },
  uk: { w: 413, h: 531, label: "UK", dim: "35×45mm" },
  eu: { w: 413, h: 531, label: "EU", dim: "35×45mm" },
};

const BG_SWATCHES = [
  { c: "#ffffff", dark: false, border: true },
  { c: "#c8d8f0", dark: false },
  { c: "#d1fae5", dark: false },
  { c: "#fef9c3", dark: false },
  { c: "#ede9fe", dark: false },
  { c: "#fce7f3", dark: false },
  { c: "#1e3a5f", dark: true },
  { c: "#14532d", dark: true },
  { c: "#4c1d95", dark: true },
  { c: "#7f1d1d", dark: true },
  { c: "#1a1a18", dark: true },
  { c: "#f4f4f2", dark: false, border: true },
];

function formatBytes(b) {
  return b > 1048576 ? (b / 1048576).toFixed(1) + "MB" : (b / 1024).toFixed(0) + "KB";
}
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function drawChecker(ctx, w, h, size = 10) {
  for (let y = 0; y < h; y += size)
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#e8e8e5" : "#f4f4f2";
      ctx.fillRect(x, y, size, size);
    }
}

// ── Component ──────────────────────────────────────────────────
function PassportMaker() {
  const navigate = useNavigate();

  // ── Step state: "upload" | "processing" | "editor"
  const [step, setStep] = useState("upload");
  const [stepNum, setStepNum] = useState(1);

  // ── Processing state
  const [progress, setProgress] = useState(0);
  const [pTitle, setPTitle] = useState("Loading AI model…");
  const [pSub, setPSub] = useState("Runs entirely in your browser. First load downloads the model.");

  // ── Editor state
  const [showBg, setShowBg] = useState(false);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [activeSwatch, setActiveSwatch] = useState("#ffffff");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [preset, setPreset] = useState("ng");
  const [qty, setQty] = useState(4);
  const [sliders, setSliders] = useState({ brt: 100, con: 100, shr: 0 });
  const [previewSub, setPreviewSub] = useState("Background removed");
  const [outputVisible, setOutputVisible] = useState(false);
  const [outputSub, setOutputSub] = useState("Ready to download");
  const [outputThumbs, setOutputThumbs] = useState([]);

  // ── Refs
  const fileInputRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const workCanvasRef = useRef(null);
  const outputCardRef = useRef(null);
  const pipeRef = useRef(null);
  const origImgRef = useRef(null);
  const fgCanvasRef = useRef(null);
  const urlRef = useRef(null);
  const uploadZoneRef = useRef(null);

  // ── Step helpers ──────────────────────────────────────────────
  function goStep(n) {
    setStepNum(n);
    if (n === 1) setStep("upload");
    if (n === 2) setStep("processing");
    if (n === 3) setStep("editor");
  }

  function setP(pct, title, sub) {
    setProgress(pct);
    setPTitle(title);
    setPSub(sub);
  }

  // ── Render preview canvas ─────────────────────────────────────
  const renderPreview = useCallback(
    (overrideBg, overrideBgColor, overridePreset, overrideSliders) => {
      const canvas = previewCanvasRef.current;
      if (!canvas || !fgCanvasRef.current) return;
      const p = PRESETS[overridePreset ?? preset];
      const dispH = 280,
        dispW = Math.round((dispH * p.w) / p.h);
      canvas.width = dispW;
      canvas.height = dispH;
      const ctx = canvas.getContext("2d");
      const useBg = overrideBg ?? showBg;
      const useColor = overrideBgColor ?? bgColor;
      const useSliders = overrideSliders ?? sliders;

      if (useBg) {
        ctx.fillStyle = useColor;
        ctx.fillRect(0, 0, dispW, dispH);
      } else {
        drawChecker(ctx, dispW, dispH);
      }
      ctx.filter = `brightness(${useSliders.brt}%) contrast(${useSliders.con}%)`;
      const fg = fgCanvasRef.current;
      const scale = Math.min(dispW / fg.width, dispH / fg.height);
      const dw = fg.width * scale,
        dh = fg.height * scale;
      ctx.drawImage(fg, (dispW - dw) / 2, (dispH - dh) / 2, dw, dh);
      ctx.filter = "none";
    },
    [showBg, bgColor, preset, sliders]
  );

  useEffect(() => {
    if (step === "editor" && fgCanvasRef.current) renderPreview();
  }, [showBg, bgColor, preset, sliders, step, renderPreview]);

  // ── Upload handling ───────────────────────────────────────────
  function handleFileChange(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        origImgRef.current = img;
        doRemoval();
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  }

  // ── Drag and drop ─────────────────────────────────────────────
  function onDragOver(e) {
    e.preventDefault();
    uploadZoneRef.current?.classList.add(styles.dragOver);
  }
  function onDragLeave() {
    uploadZoneRef.current?.classList.remove(styles.dragOver);
  }
  function onDrop(e) {
    e.preventDefault();
    uploadZoneRef.current?.classList.remove(styles.dragOver);
    if (e.dataTransfer.files[0]) handleFileChange(e.dataTransfer.files[0]);
  }

  // ── Background removal ────────────────────────────────────────
  async function doRemoval() {
    goStep(2);
    try {
      const { pipeline, env } = await import(
        "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2/dist/transformers.min.js"
      );
      env.allowLocalModels = false;

      if (!pipeRef.current) {
        setP(5, "Loading AI model…", "Downloading once, runs offline after that");
        pipeRef.current = await pipeline(
          "image-segmentation",
          "Xenova/segformer-b2-finetuned-ade-512-512",
          {
            progress_callback: (p) => {
              if (p.status === "downloading") {
                const pct = p.total ? Math.round((p.loaded / p.total) * 60) : 10;
                setP(pct, "Downloading model…", formatBytes(p.loaded || 0));
              }
            },
          }
        );
      }

      setP(65, "Analysing photo…", "Finding person in image");
      const result = await pipeRef.current(origImgRef.current.src);
      setP(85, "Removing background…", "Applying segmentation mask");
      fgCanvasRef.current = buildFgCanvas(result);
      setP(100, "Done!", "");
      await delay(350);
      setPreviewSub("Background removed");
      goStep(3);
    } catch (err) {
      console.warn("Segmentation failed, using original:", err);
      const c = document.createElement("canvas");
      const orig = origImgRef.current;
      c.width = orig.naturalWidth;
      c.height = orig.naturalHeight;
      c.getContext("2d").drawImage(orig, 0, 0);
      fgCanvasRef.current = c;
      setPreviewSub("Background removal failed — choose a colour to overlay");
      goStep(3);
    }
  }

  function buildFgCanvas(segments) {
    const orig = origImgRef.current;
    const c = document.createElement("canvas");
    c.width = orig.naturalWidth;
    c.height = orig.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(orig, 0, 0);

    const fg =
      segments.find(
        (s) => s.label === "person" || s.label === "skin" || s.label === "hair"
      ) ||
      segments.reduce(
        (a, b) => ((a.score || 0) > (b.score || 0) ? a : b),
        segments[0]
      );

    if (!fg || !fg.mask) return c;

    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const mCanvas = document.createElement("canvas");
    mCanvas.width = fg.mask.width;
    mCanvas.height = fg.mask.height;
    mCanvas.getContext("2d").putImageData(fg.mask, 0, 0);

    const scaled = document.createElement("canvas");
    scaled.width = c.width;
    scaled.height = c.height;
    const sCtx = scaled.getContext("2d");
    sCtx.drawImage(mCanvas, 0, 0, c.width, c.height);
    const maskData = sCtx.getImageData(0, 0, c.width, c.height);

    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i + 3] = maskData.data[i];
    }
    ctx.putImageData(imgData, 0, 0);
    return c;
  }

  // ── Generate sheet ────────────────────────────────────────────
  function generateSheet() {
    if (!fgCanvasRef.current) return;
    const p = PRESETS[preset];
    const sc = document.createElement("canvas");
    sc.width = p.w;
    sc.height = p.h;
    const ctx = sc.getContext("2d");
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, p.w, p.h);
    ctx.filter = `brightness(${sliders.brt}%) contrast(${sliders.con}%)`;
    const fg = fgCanvasRef.current;
    const s = Math.min(p.w / fg.width, p.h / fg.height);
    const dw = fg.width * s,
      dh = fg.height * s;
    ctx.drawImage(fg, (p.w - dw) / 2, (p.h - dh) / 2, dw, dh);
    ctx.filter = "none";
    urlRef.current = sc.toDataURL("image/jpeg", 0.95);

    const tH = 108,
      tW = Math.round((p.w / p.h) * tH);
    const thumbs = Array.from({ length: qty }, (_, i) => ({
      id: i,
      src: urlRef.current,
      w: tW,
      h: tH,
    }));
    setOutputThumbs(thumbs);
    setOutputSub(`${qty} copies · ${p.w}×${p.h}px`);
    setOutputVisible(true);
    setTimeout(() => {
      outputCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  // ── Download ──────────────────────────────────────────────────
  function downloadSheet() {
    if (!urlRef.current) return;
    const p = PRESETS[preset];
    const n = qty;
    const cols = Math.min(n, 4),
      rows = Math.ceil(n / cols),
      gap = 14;
    const sheet = document.createElement("canvas");
    sheet.width = cols * p.w + (cols + 1) * gap;
    sheet.height = rows * p.h + (rows + 1) * gap;
    const ctx = sheet.getContext("2d");
    ctx.fillStyle = "#efefef";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    const img = new Image();
    img.onload = () => {
      for (let i = 0; i < n; i++) {
        const c = i % cols,
          r = Math.floor(i / cols);
        ctx.drawImage(
          img,
          gap + c * (p.w + gap),
          gap + r * (p.h + gap),
          p.w,
          p.h
        );
      }
      const a = document.createElement("a");
      a.download = "passport-photo.jpg";
      a.href = sheet.toDataURL("image/jpeg", 0.95);
      a.click();
    };
    img.src = urlRef.current;
  }

  function printSheet() {
    if (!urlRef.current) return;
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Print</title><style>
      body{margin:8mm;display:flex;flex-wrap:wrap;gap:4mm}
      img{width:35mm;height:45mm;object-fit:cover}
      @media print{@page{size:A4;margin:8mm}}
    </style></head><body>
      ${Array(qty).fill(`<img src="${urlRef.current}"/>`).join("")}
      <script>window.onload=()=>{window.print();window.close()}<\/script>
    </body></html>`);
    win.document.close();
  }

  function resetAll() {
    origImgRef.current = null;
    fgCanvasRef.current = null;
    urlRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowBg(false);
    setOutputVisible(false);
    setOutputThumbs([]);
    setSliders({ brt: 100, con: 100, shr: 0 });
    setBgColor("#ffffff");
    setActiveSwatch("#ffffff");
    setCustomColor("#ffffff");
    setPreset("ng");
    setQty(4);
    goStep(1);
  }

  // ── Step indicator helper ─────────────────────────────────────
  function StepIndicator() {
    const steps = [
      { n: 1, label: "Upload" },
      { n: 2, label: "Remove BG" },
      { n: 3, label: "Customise" },
    ];
    return (
      <div className={styles.steps}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? "1" : "0" }}>
            <div className={`${styles.step} ${stepNum === s.n ? styles.active : ""} ${stepNum > s.n ? styles.done : ""}`}>
              <div className={styles.stepNum}>
                {stepNum > s.n ? (
                  <i className="fa-solid fa-check" style={{ fontSize: "9px" }}></i>
                ) : (
                  s.n
                )}
              </div>
              <span className={styles.stepLabel}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={styles.stepLine}></div>}
          </div>
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={styles.homeContainer}>
      <SideBar />
      <div className={styles.mainWrapper}>
        <Header />
        <main className={styles.mainContent}>
          <div className={styles.page}>

            {/* Page Header */}
            <div className={styles.pageHeader}>
              <div className={styles.pageEyebrow}>Student Utilities</div>
              <div className={styles.pageTitle}>
                Passport <em>Maker</em>
              </div>
            </div>

            {/* Steps */}
            <StepIndicator />

            {/* ── Step 1: Upload ── */}
            {step === "upload" && (
              <div className={styles.card} style={{ animation: "rise .4s .06s ease both" }}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>Upload Your Photo</div>
                    <div className={styles.cardSub}>
                      Front-facing portrait · JPG or PNG · Max 10MB
                    </div>
                  </div>
                </div>
                <div
                  className={styles.uploadZone}
                  ref={uploadZoneRef}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <div className={styles.uploadIcon}>
                    <i className="fa-solid fa-user-large"></i>
                  </div>
                  <div className={styles.uploadTitle}>Drop your photo here</div>
                  <div className={styles.uploadHint}>
                    Clear, well-lit, front-facing photos give the best results
                  </div>
                  <button
                    className={styles.uploadCta}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <i className="fa-solid fa-arrow-up-from-bracket" style={{ fontSize: "10px", marginRight: "5px" }}></i>
                    Choose Photo
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
              </div>
            )}

            {/* ── Step 2: Processing ── */}
            {step === "processing" && (
              <div className={styles.card} style={{ animation: "rise .3s ease both" }}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>Removing Background</div>
                </div>
                <div className={styles.processingWrap}>
                  <div className={styles.spinner}></div>
                  <div className={styles.processingTitle}>{pTitle}</div>
                  <div className={styles.processingSub}>{pSub}</div>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Editor ── */}
            {step === "editor" && (
              <div className={styles.editorLayout}>

                {/* Left: preview + output */}
                <div>
                  <div className={styles.card} style={{ animation: "rise .35s ease both" }}>
                    <div className={styles.cardHeader}>
                      <div>
                        <div className={styles.cardTitle}>Preview</div>
                        <div className={styles.cardSub}>{previewSub}</div>
                      </div>
                      <button
                        className={`${styles.btn} ${styles.ghost}`}
                        style={{ flex: 0, padding: "5px 10px", fontSize: "11px" }}
                        onClick={resetAll}
                      >
                        <i className="fa-solid fa-rotate-left"></i> New Photo
                      </button>
                    </div>
                    <div className={`${styles.previewArea} ${styles.checker}`}>
                      <canvas ref={previewCanvasRef} className={styles.resultCanvas}></canvas>
                    </div>
                    <div className={styles.previewBar}>
                      <button
                        className={`${styles.btn} ${styles.ghost}`}
                        onClick={() => setShowBg((v) => !v)}
                      >
                        <i className={showBg ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}></i>
                        <span>{showBg ? "Hide BG" : "Show BG"}</span>
                      </button>
                      <button
                        className={`${styles.btn} ${styles.primary}`}
                        onClick={generateSheet}
                      >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Generate Photos
                      </button>
                    </div>
                  </div>

                  {/* Output card */}
                  {outputVisible && (
                    <div
                      className={styles.card}
                      ref={outputCardRef}
                      style={{ marginTop: "14px", animation: "rise .35s ease both" }}
                    >
                      <div className={styles.cardHeader}>
                        <div>
                          <div className={styles.cardTitle}>Photo Sheet</div>
                          <div className={styles.cardSub}>{outputSub}</div>
                        </div>
                      </div>
                      <div className={styles.outputGrid}>
                        {outputThumbs.length === 0 ? (
                          <div className={styles.emptyMsg}>
                            <i className="fa-regular fa-id-card"></i>
                            Photos appear here after generating
                          </div>
                        ) : (
                          outputThumbs.map((t) => (
                            <div
                              key={t.id}
                              className={styles.pthumb}
                              style={{ width: `${t.w}px`, height: `${t.h}px` }}
                            >
                              <img src={t.src} alt="" />
                            </div>
                          ))
                        )}
                      </div>
                      <div className={styles.dlBar}>
                        <button className={`${styles.btn} ${styles.primary}`} onClick={downloadSheet}>
                          <i className="fa-solid fa-download"></i> Download
                        </button>
                        <button className={`${styles.btn} ${styles.ghost}`} onClick={printSheet}>
                          <i className="fa-solid fa-print"></i> Print
                        </button>
                        <button className={`${styles.btn} ${styles.ghost}`} onClick={generateSheet}>
                          <i className="fa-solid fa-arrows-rotate"></i> Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: settings */}
                <div style={{ animation: "rise .35s .05s ease both" }}>

                  {/* Background Colour */}
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitle}>Background Colour</div>
                    </div>
                    <div className={styles.settingBlock}>
                      <div className={styles.swatchGrid}>
                        {BG_SWATCHES.map((sw) => (
                          <div
                            key={sw.c}
                            className={`${styles.swatch} ${sw.dark ? styles.onDark : ""} ${activeSwatch === sw.c ? styles.active : ""}`}
                            style={{
                              background: sw.c,
                              ...(sw.border ? { border: "1.5px solid #ddd" } : {}),
                            }}
                            onClick={() => {
                              setBgColor(sw.c);
                              setActiveSwatch(sw.c);
                              setCustomColor(sw.c);
                            }}
                          ></div>
                        ))}
                      </div>
                      <div className={styles.customColorRow}>
                        <label htmlFor="customColor" className={styles.customLabel}>Custom:</label>
                        <input
                          type="color"
                          id="customColor"
                          value={customColor}
                          className={styles.customColorInput}
                          onInput={(e) => {
                            setBgColor(e.target.value);
                            setCustomColor(e.target.value);
                            setActiveSwatch(null);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Size & Quantity */}
                  <div className={styles.card} style={{ marginTop: "12px" }}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitle}>Size & Quantity</div>
                    </div>
                    <div className={styles.settingBlock}>
                      <div className={styles.sLabel}>Passport Standard</div>
                      <div className={styles.presetRow}>
                        {Object.entries(PRESETS).map(([key, p]) => (
                          <div
                            key={key}
                            className={`${styles.ptab} ${preset === key ? styles.active : ""}`}
                            onClick={() => setPreset(key)}
                          >
                            <div className={styles.ptabName}>{p.label}</div>
                            <div className={styles.ptabDim}>{p.dim}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={styles.settingBlock}>
                      <div className={styles.qtyRow}>
                        <div className={styles.sLabel} style={{ marginBottom: 0 }}>
                          Copies on sheet
                        </div>
                        <div className={styles.qtyCtl}>
                          <button
                            className={styles.qbtn}
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                          >
                            −
                          </button>
                          <span className={styles.qval}>{qty}</span>
                          <button
                            className={styles.qbtn}
                            onClick={() => setQty((q) => Math.min(16, q + 1))}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Adjustments */}
                  <div className={styles.card} style={{ marginTop: "12px" }}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitle}>Adjustments</div>
                    </div>
                    <div className={styles.settingBlock}>
                      {[
                        { key: "brt", label: "Brightness", min: 50, max: 160, suffix: "%" },
                        { key: "con", label: "Contrast", min: 50, max: 160, suffix: "%" },
                        { key: "shr", label: "Sharpness", min: 0, max: 10, suffix: "" },
                      ].map((sl) => (
                        <div className={styles.slRow} key={sl.key}>
                          <div className={styles.slHead}>
                            <span>{sl.label}</span>
                            <strong>{sliders[sl.key]}{sl.suffix}</strong>
                          </div>
                          <input
                            type="range"
                            min={sl.min}
                            max={sl.max}
                            value={sliders[sl.key]}
                            onChange={(e) =>
                              setSliders((prev) => ({
                                ...prev,
                                [sl.key]: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

export default PassportMaker;
