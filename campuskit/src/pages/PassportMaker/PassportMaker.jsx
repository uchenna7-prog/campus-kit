import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { removeBackground } from "@imgly/background-removal";

import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";

import styles from "./PassportMaker.module.css";

const PRESETS = {
  ng: { w: 413, h: 531, label: "NG", dim: "35×45mm" },
  us: { w: 600, h: 600, label: "US", dim: "51×51mm" },
  uk: { w: 413, h: 531, label: "UK", dim: "35×45mm" },
  eu: { w: 413, h: 531, label: "EU", dim: "35×45mm" },
};

function PassportMaker() {

  const navigate = useNavigate();

  const [step,setStep] = useState("upload");
  const [progress,setProgress] = useState(0);

  const [bgColor,setBgColor] = useState("#ffffff");
  const [showBg,setShowBg] = useState(true);

  const [preset,setPreset] = useState("ng");
  const [qty,setQty] = useState(4);

  const [sliders,setSliders] = useState({
    brt:100,
    con:100
  });

  const fileInputRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const fgCanvasRef = useRef(null);
  const urlRef = useRef(null);

  const origImgRef = useRef(null);

  function goStep(s){
    setStep(s);
  }

  // ---------- Background Removal ----------

  async function doRemoval(file){

    goStep("processing");

    setProgress(20);

    try{

      const resultBlob = await removeBackground(file);

      setProgress(80);

      const url = URL.createObjectURL(resultBlob);

      const img = new Image();

      img.onload = ()=>{

        const c = document.createElement("canvas");

        c.width = img.width;
        c.height = img.height;

        const ctx = c.getContext("2d");

        ctx.drawImage(img,0,0);

        fgCanvasRef.current = c;

        URL.revokeObjectURL(url);

        setProgress(100);

        setTimeout(()=>{

          goStep("editor");

        },300);

      };

      img.src = url;

    }
    catch(err){

      console.error(err);

      alert("Background removal failed");

      goStep("upload");

    }

  }

  // ---------- File Upload ----------

  function handleFileChange(file){

    if(!file) return;

    const reader = new FileReader();

    reader.onload = e=>{

      const img = new Image();

      img.onload = ()=>{

        origImgRef.current = img;

      };

      img.src = e.target.result;

    };

    reader.readAsDataURL(file);

    doRemoval(file);

  }

  // ---------- Preview Renderer ----------

  const renderPreview = useCallback(()=>{

    const canvas = previewCanvasRef.current;

    if(!canvas || !fgCanvasRef.current) return;

    const p = PRESETS[preset];

    const dispH = 280;

    const dispW = Math.round((dispH * p.w) / p.h);

    canvas.width = dispW;
    canvas.height = dispH;

    const ctx = canvas.getContext("2d");

    if(showBg){

      ctx.fillStyle = bgColor;

      ctx.fillRect(0,0,dispW,dispH);

    }

    ctx.filter = `brightness(${sliders.brt}%) contrast(${sliders.con}%)`;

    const fg = fgCanvasRef.current;

    const scale = Math.min(dispW/fg.width,dispH/fg.height);

    const dw = fg.width * scale;
    const dh = fg.height * scale;

    ctx.drawImage(fg,(dispW-dw)/2,(dispH-dh)/2,dw,dh);

    ctx.filter="none";

  },[bgColor,showBg,preset,sliders]);

  useEffect(()=>{

    if(step==="editor"){

      renderPreview();

    }

  },[renderPreview,step]);

  // ---------- Generate Photos ----------

  function generateSheet(){

    if(!fgCanvasRef.current) return;

    const p = PRESETS[preset];

    const sc = document.createElement("canvas");

    sc.width = p.w;
    sc.height = p.h;

    const ctx = sc.getContext("2d");

    ctx.fillStyle = bgColor;

    ctx.fillRect(0,0,p.w,p.h);

    ctx.filter = `brightness(${sliders.brt}%) contrast(${sliders.con}%)`;

    const fg = fgCanvasRef.current;

    const scale = Math.min(p.w/fg.width,p.h/fg.height);

    const dw = fg.width * scale;
    const dh = fg.height * scale;

    ctx.drawImage(fg,(p.w-dw)/2,(p.h-dh)/2,dw,dh);

    ctx.filter="none";

    urlRef.current = sc.toDataURL("image/jpeg",0.95);

    downloadSheet();

  }

  // ---------- Download ----------

  function downloadSheet(){

    const p = PRESETS[preset];

    const n = qty;

    const cols = Math.min(n,4);
    const rows = Math.ceil(n/cols);

    const gap = 14;

    const sheet = document.createElement("canvas");

    sheet.width = cols*p.w + (cols+1)*gap;
    sheet.height = rows*p.h + (rows+1)*gap;

    const ctx = sheet.getContext("2d");

    ctx.fillStyle="#efefef";

    ctx.fillRect(0,0,sheet.width,sheet.height);

    const img = new Image();

    img.onload = ()=>{

      for(let i=0;i<n;i++){

        const c = i % cols;
        const r = Math.floor(i/cols);

        ctx.drawImage(
          img,
          gap + c*(p.w+gap),
          gap + r*(p.h+gap),
          p.w,
          p.h
        );

      }

      const a = document.createElement("a");

      a.download="passport-photo.jpg";

      a.href = sheet.toDataURL("image/jpeg",0.95);

      a.click();

    };

    img.src = urlRef.current;

  }

  // ---------- UI ----------

  return(

    <div className={styles.homeContainer}>

      <SideBar/>

      <div className={styles.mainWrapper}>

        <Header/>

        <main className={styles.mainContent}>

          {step==="upload" && (

            <div className={styles.uploadBox}>

              <h2>Upload Photo</h2>

              <button
                onClick={()=>fileInputRef.current.click()}
              >
                Choose Photo
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{display:"none"}}
                onChange={(e)=>handleFileChange(e.target.files[0])}
              />

            </div>

          )}

          {step==="processing" && (

            <div>

              <h2>Removing Background</h2>

              <p>{progress}%</p>

            </div>

          )}

          {step==="editor" && (

            <div>

              <canvas
                ref={previewCanvasRef}
                style={{border:"1px solid #ddd"}}
              />

              <br/>

              <button onClick={generateSheet}>
                Generate Passport Photos
              </button>

            </div>

          )}

        </main>

      </div>

    </div>

  );

}

export default PassportMaker;
