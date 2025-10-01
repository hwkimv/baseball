import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, RotateCcw, Sparkles, Gauge, TimerReset } from "lucide-react";

/**
 * 스크린 야구 — 타이밍 배팅 연습
 * 단일 파일 React 컴포넌트 (Canvas 없이 DOM + Framer Motion 애니메이션)
 * - Space 키 또는 "스윙" 버튼으로 타이밍에 맞춰 배트를 휘두르면 타구 결과가 달라집니다.
 * - 난이도(구속/변화), 피칭 간격, 타격 판정 범위 등을 슬라이더로 조절할 수 있습니다.
 * - UI: shadcn/ui, 아이콘: lucide-react, 애니메이션: framer-motion, 스타일: Tailwind
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// 결과 타입
type HitResult =
  | { kind: "strike"; reason: "early" | "late" | "miss" }
  | { kind: "foul"; timingDelta: number }
  | { kind: "single" | "double" | "triple" | "homerun"; timingDelta: number; exitVelo: number; launchDeg: number; distance: number };

// 랜덤 유틸
const rand = (a: number, b: number) => lerp(a, b, Math.random());

// 타구 비거리 근사(아주 단순화)
function estimateDistance(exitVelo: number, launchDeg: number) {
  // 간단한 투사체 근사: v^2 * sin(2θ) / g 스케일링 + 공기저항 감쇄 상수
  const g = 9.81; // m/s^2
  const v = exitVelo; // m/s 가정(내부 스케일)
  const theta = (launchDeg * Math.PI) / 180;
  const raw = (v * v * Math.sin(2 * theta)) / g;
  const drag = 0.82; // 감쇄 스케일
  return Math.max(0, raw * drag);
}

// 타이밍 윈도우 설정
const CONTACT_PROGRESS = 0.86; // 공이 플레이트에 도달하기 직전 (0~1 진행률)

// 판정 임계값 (진행률 차이)
const PERFECT = 0.010; // <= 1.0%p → 퍼펙트 컨택
const GOOD = 0.020; // <= 2.0%p
const OKAY = 0.035; // <= 3.5%p
const FOUL = 0.055; // <= 5.5%p (이후는 헛스윙)

// 속도 스케일: 진행률 0→1 소요 ms (Plate Time)
function plateTimeMsFromMph(mph: number) {
  // 홈까지 약 18.44 m, 발사 후 유효 구간 ~0.4초(100mph)~0.6초(70mph) 근사
  // mph를 0.4~0.6초로 매핑 (조절 가능)
  const t = lerp(600, 400, clamp((mph - 70) / (100 - 70), 0, 1));
  return t;
}

// 구종 간단 모델 (시각 효과만)
type PitchType = "straight" | "slider" | "curve" | "sinker";
function curveOffset(p: PitchType, xProgress: number) {
  // xProgress: 0~1 (투구 진행률)
  switch (p) {
    case "slider":
      return Math.sin(xProgress * Math.PI) * 18; // 좌우 흔들림(px)
    case "curve":
      return Math.sin(xProgress * Math.PI) * -14; // 반대 방향 휘어짐
    case "sinker":
      return Math.pow(xProgress, 2) * 24; // 아래로 가라앉음 (y축)
    default:
      return 0;
  }
}

type Runners = { on1: boolean; on2: boolean; on3: boolean };

function advanceBases(state: Runners, n: number): { next: Runners; scored: number } {
  const arr = [state.on1, state.on2, state.on3];
  if (n >= 4) {
    const scored = arr.filter(Boolean).length + 1;
    return { next: { on1: false, on2: false, on3: false }, scored };
  }
  const nextArr = [false, false, false];
  let scored = 0;
  for (let i = 2; i >= 0; i--) {
    if (!arr[i]) continue;
    const j = i + n;
    if (j >= 3) scored += 1; else nextArr[j] = true;
  }
  const batterIndex = n - 1;
  if (batterIndex >= 3) scored += 1; else nextArr[batterIndex] = true;
  return { next: { on1: nextArr[0], on2: nextArr[1], on3: nextArr[2] }, scored };
}

function MiniDiamond({ runners, size = 120 }: { runners: Runners; size?: number }) {
  const b1 = { x: 110, y: 70 }, b2 = { x: 70, y: 30 }, b3 = { x: 30, y: 70 };
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" className="drop-shadow">
      <rect x="0" y="0" width="140" height="140" fill="#1f7a2f" rx="10" />
      <rect x="20" y="20" width="100" height="100" fill="#d7a693" transform="rotate(45 70 70)" rx="8" />
      <circle cx="70" cy="70" r="16" fill="#2b7a3b" opacity="0.35" />
      <rect x="64" y="100" width="12" height="12" fill="#fff" transform="rotate(45 70 106)" />
      <rect x="100" y="64" width="12" height="12" fill="#fff" transform="rotate(45 106 70)" />
      <rect x="64" y="28" width="12" height="12" fill="#fff" transform="rotate(45 70 34)" />
      <rect x="28" y="64" width="12" height="12" fill="#fff" transform="rotate(45 34 70)" />
      <text x="70" y="22" fill="#111" fontSize="10" textAnchor="middle">2루</text>
      <text x="122" y="72" fill="#111" fontSize="10" textAnchor="middle">1루</text>
      <text x="70" y="132" fill="#111" fontSize="10" textAnchor="middle">홈</text>
      <text x="18" y="72" fill="#111" fontSize="10" textAnchor="middle">3루</text>
      <AnimatePresence>
        {runners.on1 && (
          <motion.circle key="r1" cx={b1.x} cy={b1.y} r={7} fill="#ffec99" stroke="#b45309" strokeWidth={2}
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} />
        )}
        {runners.on2 && (
          <motion.circle key="r2" cx={b2.x} cy={b2.y} r={7} fill="#ffec99" stroke="#b45309" strokeWidth={2}
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} />
        )}
        {runners.on3 && (
          <motion.circle key="r3" cx={b3.x} cy={b3.y} r={7} fill="#ffec99" stroke="#b45309" strokeWidth={2}
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} />
        )}
      </AnimatePresence>
    </svg>
  );
}

export default function ScreenBaseballTiming() {
  // 설정 상태
  const [mph, setMph] = useState(85); // 구속
  const [pitchGapMs, setPitchGapMs] = useState(1200); // 투구 간격(연속 투구 모드)
  const [autoPitch, setAutoPitch] = useState(true);
  const [pitchType, setPitchType] = useState<PitchType>("straight");

  // 게임/세션 상태
  const [inPlay, setInPlay] = useState(false); // 공이 현재 날아가는 중인지
  const [progress, setProgress] = useState(0); // 0~1
  const [result, setResult] = useState<HitResult | null>(null);
  const [strikes, setStrikes] = useState(0);
  const [outs, setOuts] = useState(0);
  const [runs, setRuns] = useState(0);
  const [pitches, setPitches] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [runners, setRunners] = useState<Runners>({ on1: false, on2: false, on3: false });

  const [assistBar, setAssistBar] = useState(true); // 타이밍 보조바 표시

    const swingAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number | null>(null);

  const cancelRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const plateTime = useMemo(() => plateTimeMsFromMph(mph), [mph]);

  // 투구 시작
  const startPitch = useCallback(() => {
    if (inPlay) return;
    cancelRaf();
    setResult(null);
    setInPlay(true);
    setProgress(0);
    swingAtRef.current = null;
    startTsRef.current = performance.now();

    const step = () => {
      const now = performance.now();
      const elapsed = now - (startTsRef.current || now);
      const t = clamp(elapsed / plateTime, 0, 1);
      setProgress(t);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        // 미스 판정(스윙 없거나 타이밍 실패)
        if (!swingAtRef.current) {
          settleResult({ kind: "strike", reason: "miss" });
        } else {
          // 스윙했지만 컨택 실패 → 스트라이크로 처리(너무 이르거나 늦음)
          const d = Math.abs(swingAtRef.current - CONTACT_PROGRESS);
          if (d > FOUL) settleResult({ kind: "strike", reason: swingAtRef.current < CONTACT_PROGRESS ? "early" : "late" });
        }
        cancelRaf();
        setInPlay(false);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    setPitches((p) => p + 1);
  }, [inPlay, plateTime]);

  // 결과 정산
  const settleResult = (r: HitResult) => {
    setResult(r);
    if (r.kind === "strike") {
      setStrikes((s) => {
        const ns = s + 1;
        if (ns >= 3) {
          setOuts((o) => o + 1);
          return 0; // 삼진 → 아웃 증가, 스트라이크 초기화
        }
        return ns;
      });
    } else if (r.kind === "foul") {
      // 파울은 스트 증가하되 2스트 이후에는 유지 (간단화: 2스트 이후 증가 X)
      setStrikes((s) => (s < 2 ? s + 1 : 2));
    } else {
      // 점수 규칙
      // - 안타: +1 (1/2/3루타 동일) + 주자가 홈 밟은 수만큼 +1
      // - 홈런: +5 (타자 점수는 +5에 포함) + 현재 주자 수만큼 추가 득점, 이후 베이스 비움
      if (r.kind === "homerun") {
        const runnersNow = (runners.on1 ? 1 : 0) + (runners.on2 ? 1 : 0) + (runners.on3 ? 1 : 0);
        setRuns((ru) => ru + 5 + runnersNow);
        setRunners({ on1: false, on2: false, on3: false });
      } else {
        // 안타(1/2/3루타 모두 +1)
        setRuns((ru) => ru + 1);
        const bases = r.kind === "single" ? 1 : r.kind === "double" ? 2 : 3;
        setRunners((prev) => {
          const { next, scored } = advanceBases(prev, bases);
          // 홈을 밟은 주자 수 만큼 +1
          setRuns((ru) => ru + scored);
          return next;
        });
      }
      setStrikes(0);
    }
  };

  // 스윙 처리
  const doSwing = useCallback(() => {
    if (!inPlay) return; // 공이 날아갈 때만 스윙 가능
    const t = progress; // 현재 진행률
    swingAtRef.current = t;

    const delta = Math.abs(t - CONTACT_PROGRESS);
    if (delta <= PERFECT) {
      const exitV = rand(43, 50); // m/s (약 155~180 km/h 상상치)
      const launch = rand(24, 32); // 도
      const dist = estimateDistance(exitV, launch);
      settleResult({ kind: "homerun", timingDelta: delta, exitVelo: exitV, launchDeg: launch, distance: dist });
      setInPlay(false);
    } else if (delta <= GOOD) {
      const exitV = rand(38, 46);
      const launch = rand(18, 28);
      const dist = estimateDistance(exitV, launch);
      settleResult({ kind: "double", timingDelta: delta, exitVelo: exitV, launchDeg: launch, distance: dist });
      setInPlay(false);
    } else if (delta <= OKAY) {
      const exitV = rand(32, 42);
      const launch = rand(10, 22);
      const dist = estimateDistance(exitV, launch);
      // OKAY 중 상단이면 2루타, 아니면 1루타
      const kind = delta < (OKAY * 0.6) ? "double" : "single";
      settleResult({ kind, timingDelta: delta, exitVelo: exitV, launchDeg: launch, distance: dist });
      setInPlay(false);
    } else if (delta <= FOUL) {
      settleResult({ kind: "foul", timingDelta: delta });
      setInPlay(false);
    } else {
      // 컨택 실패 → 스트라이크 판정은 애니메이션 종료 시 처리됨
    }
  }, [inPlay, progress]);

  // 키보드 (Space = 스윙, Enter = 투구)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        doSwing();
      } else if (e.code === "Enter") {
        e.preventDefault();
        startPitch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSwing, startPitch]);

  // 3아웃 시 이닝 교체 간단 처리: 주자 초기화 & 아웃 카운트 리셋
  useEffect(() => {
    if (outs >= 3) {
      setOuts(0);
      setStrikes(0);
      setRunners({ on1: false, on2: false, on3: false });
    }
  }, [outs]);

  // 언마운트 시 RAF 취소
  useEffect(() => {
    return () => cancelRaf();
  }, []);

  // 네 번 시도 후 게임오버 플래그만 세움 (오토투구는 유지)
  useEffect(() => {
    if (pitches >= 5) {
      setInPlay(false);
      setGameOver(true);
    }
  }, [pitches]);

  // 오토 피치 모드
  useEffect(() => {
    if (!autoPitch || gameOver) return;
    if (inPlay) return;
    const id = setTimeout(() => startPitch(), pitchGapMs);
    return () => clearTimeout(id);
  }, [autoPitch, inPlay, startPitch, pitchGapMs, result, gameOver]);

  // 진행률에 따라 공 위치/스케일 계산
  const yPx = useMemo(() => lerp(0, 320, progress), [progress]);
  const zScale = useMemo(() => lerp(0.6, 1.4, progress), [progress]);
  const yToward = useMemo(() => {
    const base = yPx; // 위(원근) → 아래(플레이어) 방향
    const extraY = pitchType === "sinker" ? curveOffset("sinker", progress) : 0;
    return base + extraY;
  }, [yPx, progress, pitchType]);
  const lateralX = useMemo(() => {
    if (pitchType === "straight" || pitchType === "sinker") return 0;
    return curveOffset(pitchType, progress);
  }, [progress, pitchType]);

  // 진행 막대 (보조 UI)

  // 리셋
  const resetAll = () => {
    setStrikes(0); setOuts(0); setRuns(0); setPitches(0); setResult(null); setInPlay(false); setProgress(0);
    setRunners({ on1: false, on2: false, on3: false });
    setGameOver(false);
  };

  return (
    <div className="w-full min-h-[720px] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 좌측: 필드/배팅 뷰 */}
        <Card className="xl:col-span-8 bg-slate-900/60 border-slate-700 shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl flex items-center gap-2 text-white">⚾ 스크린 야구 — 타이밍 배팅</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-600/20 text-emerald-200 border border-emerald-500/30">{mph} mph</Badge>
              <Badge variant="outline" className="border-slate-600 text-slate-200">{pitchType}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* 필드 씬 */}

            {/* 루타 표시 (우측 상단) */}
            <div className="hidden">
              <MiniDiamond runners={runners} />
            </div>
            <div className="relative w-full h-[420px] rounded-2xl overflow-hidden bg-gradient-to-b from-emerald-900/40 via-slate-900/40 to-slate-900 border border-slate-700">
              {/* 미니 다이아몬드: 필드 우상단 고정 */}
              <div className="absolute right-3 top-3 z-20 pointer-events-none">
                <MiniDiamond runners={runners} size={96} />
                <div className="mt-2 flex justify-center">
                  <div className="px-2 py-0.5 rounded-full bg-emerald-600/80 text-white font-semibold text-sm shadow">{runs} 점</div>
                </div>
              </div>
              {/* 그라운드 가이드 라인 */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
                <div className="absolute left-0 right-0 top-[70%] h-px bg-white/5" />
                <div className="absolute left-0 right-0 top-[85%] h-px bg-white/5" />
              </div>

              {/* 투수 */}
              <motion.div className="absolute left-1/2 -translate-x-1/2 top-8 w-16 h-24 rounded-xl bg-sky-500/30 border border-sky-400/30 flex items-center justify-center text-xs"
                animate={inPlay ? { y: [0, -4, 0] } : { y: 0 }}
                transition={{ duration: 0.6, repeat: inPlay ? Infinity : 0, ease: "easeInOut" }}>
                투수
              </motion.div>

              {/* 홈플레이트 */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-8 w-20 h-20 rotate-45 bg-white/10 border border-white/20" />

              {/* 타격 존 시각 힌트 */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-20 w-28 h-28 rounded-full border-2 border-amber-300/40" />

              {/* 공 */}
              <AnimatePresence>
                {inPlay && (
                  <motion.div
                    key="ball"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{
                      opacity: 1,
                      x: lateralX,
                      y: yToward,
                      scale: zScale,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "tween",ease: "linear", duration: Math.max(plateTime / 1000, 0.01) }}
                    className="absolute left-1/2 -translate-x-1/2 top-12 w-5 h-5 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.3)]"
                    style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.25), 0 2px 10px rgba(0,0,0,0.35)" }}
                  />
                )}
              </AnimatePresence>

              {/* 스윙 애니메이션 (시각 효과) */}
              <AnimatePresence>
                {swingAtRef.current != null && inPlay && (
                  <motion.div
                    key="swing"
                    initial={{ opacity: 0, rotate: -25, scale: 0.6 }}
                    animate={{ opacity: 1, rotate: 20, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute left-1/2 -translate-x-1/2 bottom-14 w-40 h-8 rounded-full bg-amber-300/30 border border-amber-200/40"
                  />
                )}
              </AnimatePresence>

              {/* 결과 플로팅 배지 */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="absolute left-1/2 -translate-x-1/2 top-6"
                  >
                    <Badge className={
                      result.kind === "homerun"
                        ? "bg-red-600/80 text-white text-lg px-4 py-2 shadow-xl"
                        : result.kind === "triple" || result.kind === "double" || result.kind === "single"
                        ? "bg-emerald-600/80 text-white text-lg px-4 py-2 shadow-xl"
                        : result.kind === "foul"
                        ? "bg-amber-600/80 text-white px-4 py-2 shadow"
                        : "bg-slate-700/90 text-white px-4 py-2"
                    }>
                      {result.kind === "homerun" && "HOMERUN! 🎉"}
                      {result.kind === "triple" && "3루타!"}
                      {result.kind === "double" && "2루타!"}
                      {result.kind === "single" && "안타!"}
                      {result.kind === "foul" && "파울"}
                      {result.kind === "strike" && (result.reason === "miss" ? "헛스윙" : result.reason === "early" ? "너무 빠름" : "너무 늦음")}
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 타이밍 보조 바 */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2 text-sm text-slate-300">
                <div className="flex items-center gap-2"><Gauge className="w-4 h-4"/> 타이밍 게이지</div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" className="accent-emerald-400" checked={assistBar} onChange={(e) => setAssistBar(e.target.checked)} /> 보조 표시
                </label>
              </div>
              <div className="relative h-3 rounded-full bg-slate-700 overflow-hidden">
                {/* 진행 마커 */}
                <div className="absolute top-0 bottom-0 left-0" style={{ width: `${progress * 100}%` }}>
                  <div className="h-full bg-emerald-500/70" />
                </div>
                {/* 퍼펙트/굿/오케이 존 시각화 */}
                {assistBar && (
                  <>
                    <div className="absolute top-[-4px] h-[11px] rounded bg-red-500/70" style={{ left: `${(CONTACT_PROGRESS - PERFECT) * 100}%`, width: `${(PERFECT * 2) * 100}%` }} />
                    <div className="absolute top-[-2px] h-[7px] rounded bg-emerald-500/70" style={{ left: `${(CONTACT_PROGRESS - GOOD) * 100}%`, width: `${(GOOD * 2) * 100}%` }} />
                    <div className="absolute top-0 h-[3px] bg-amber-400/70" style={{ left: `${(CONTACT_PROGRESS - OKAY) * 100}%`, width: `${(OKAY * 2) * 100}%` }} />
                  </>
                )}
                {/* 컨택 중앙선 */}
                <div className="absolute top-[-6px] bottom-[-6px] w-[2px] bg-white/70" style={{ left: `${CONTACT_PROGRESS * 100}%` }} />
              </div>
              <div className="mt-2 text-xs text-slate-400">빨강: 퍼펙트 · 초록: 굿 · 노랑: 오케이 / 진행 막대를 CONTACT 선에 맞춰 스윙(스페이스바)</div>
            </div>

            {/* 컨트롤 버튼 */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={startPitch} disabled={inPlay} className="rounded-2xl">
                <Play className="w-4 h-4 mr-2"/> 투구
              </Button>
              <Button variant="secondary" onClick={doSwing} disabled={!inPlay} className="rounded-2xl">
                <Sparkles className="w-4 h-4 mr-2"/> 스윙 (Space)
              </Button>
              <Button variant="outline" onClick={resetAll} className="rounded-2xl">
                <RotateCcw className="w-4 h-4 mr-2"/> 리셋
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 우측: 스코어/설정 */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white">스코어보드</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700">
                  <div className="text-xs text-slate-400">PITCHES</div>
                  <div className="text-2xl font-semibold">{pitches}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700">
                  <div className="text-xs text-slate-400">STRIKES</div>
                  <div className="text-2xl font-semibold">{strikes}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700">
                  <div className="text-xs text-slate-400">OUTS</div>
                  <div className="text-2xl font-semibold">{outs}</div>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-900/30 border border-emerald-700/40">
                <div className="text-xs text-emerald-300/90">RUNS</div>
                <div className="text-2xl font-semibold text-emerald-200">{runs}</div>
              </div>

              <div className="text-sm text-slate-300">
                {result && (result.kind === "single" || result.kind === "double" || result.kind === "triple" || result.kind === "homerun") && (
                  <div className="space-y-1">
                    <div>타이밍 오차: {(result.timingDelta * 100).toFixed(1)}%p</div>
                    <div>타구 속도(모형): {result.exitVelo.toFixed(1)} m/s</div>
                    <div>발사 각도: {result.launchDeg.toFixed(1)}°</div>
                    <div>예상 비거리: {result.distance.toFixed(1)} m</div>
                  </div>
                )}
                {result && result.kind === "foul" && (
                  <div>파울 · 타이밍 오차 {(result.timingDelta * 100).toFixed(1)}%p</div>
                )}
                {result && result.kind === "strike" && (
                  <div>스트라이크 · {result.reason === "miss" ? "스윙 없음/미스" : result.reason === "early" ? "너무 빠른 스윙" : "너무 늦은 스윙"}</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-white"><TimerReset className="w-4 h-4"/> 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 구속 */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2"><span className="text-white">구속 (mph)</span><span className="text-slate-400">{mph}</span></div>
                <Slider value={[mph]} min={70} max={100} step={1} onValueChange={(v) => setMph(v[0])} />
              </div>
              {/* 투구 간격 */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2"><span className="text-white">연속 투구 간격 (ms)</span><span className="text-slate-400">{pitchGapMs}</span></div>
                <Slider value={[pitchGapMs]} min={600} max={2400} step={100} onValueChange={(v) => setPitchGapMs(v[0])} />
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="accent-emerald-400" checked={autoPitch} onChange={(e) => setAutoPitch(e.target.checked)} /> <span className="text-white">오토 투구</span>
                  </label>
                </div>
              </div>
              {/* 구종 */}
              <div className="text-sm">
                <div className="mb-2 text-white">구종</div>
                <div className="grid grid-cols-4 gap-2">
                  {(["straight", "slider", "curve", "sinker"] as PitchType[]).map((pt) => (
                    <button
                      key={pt}
                      onClick={() => setPitchType(pt)}
                      className={`px-3 py-2 rounded-xl border ${pitchType === pt ? "bg-emerald-600/30 border-emerald-500" : "bg-slate-800/70 border-slate-700"}`}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>
              {/* 도움말 */}
              <div className="text-xs text-slate-400 leading-relaxed">
                <p className="mb-1">조작: <b>Enter</b> 투구 / <b>Space</b> 스윙</p>
                <p>진행 막대가 가운데 하얀 선(CONTACT)에 겹칠 때 스윙하면 좋은 타구가 됩니다.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* 게임 종료 모달 */}
      {gameOver && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="text-xl font-bold text-white mb-2">게임 종료</div>
            <div className="text-slate-300 mb-4">최종 점수 <span className="text-emerald-300 font-semibold">{runs}</span> 점</div>
            <div className="flex justify-center">
              <Button className="rounded-xl" onClick={resetAll}>다시 시작</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
