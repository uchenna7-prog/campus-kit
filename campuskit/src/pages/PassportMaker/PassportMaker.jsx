import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { removeBackground } from "@imgly/background-removal";
import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./PassportMaker.module.css";

// \u2500\u2500 Constants \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const PRESETS = {
  ng: { w: 413, h: 531, label: "NG", dim: "35\u00d745mm" },
  us: { w: 600, h: 600, label: "US", dim: "51\u00d751mm" },
  uk: { w: 413, h: 531, label: "UK", dim: "35\u00d745mm" },
  eu: { w: 413, h: 531, label: "EU", dim: "35\u00d745mm" },
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

function drawChecker(ctx, w, h, size = 10) {
  for (let y = 0; y < h; y += size)
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#e8e8e5" : "#f4f4f2";
      ctx.fillRect(x, y, size, size);
    }
}

// \u2500\u2500 Component \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function PassportMaker() {
  const navigate = useNavigate();

  // \u2500\u2500 Step state: "upload" | "processing" | "editor"
  const [step, setStep] = useState("upload");
  const [stepNum, setStepNum] = useState(1);

  // \u2500\u2500 Processing state
  const [progress, setProgress] = useState(0);
  const [pTitle, setPTitle] = useState("Removing background\u2026");
  const [pSub, setPSub] = useState("Running in your browser \u2014 no upload needed.");

  // \u2500\u2500 Editor state
  const [showBg, setShowBg] = useState(true); // default true so colour is visible immediately
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