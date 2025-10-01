import React from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import ScreenBaseballTiming from "./baseball"; // 너가 올린 그 파일 이름이 baseball.tsx 라고 가정

const root = createRoot(document.getElementById("root")!);
root.render(<ScreenBaseballTiming />);
