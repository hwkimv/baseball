import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { MiniDiamond } from "@/components/MiniDiamond";
import { Play, RotateCcw, Sparkles, Gauge, TimerReset } from "lucide-react";
import { useBleSwing } from "@/io/ble";


// 게임 도메인 모듈
import type { HitResult, PitchType, Runners } from "@/game/types";
import { CONTACT_PROGRESS, PERFECT, GOOD, OKAY, FOUL } from "@/game/constants";
import { clamp, lerp, rand, estimateDistance, plateTimeMsFromMph, curveOffset, advanceBases } from "@/game/utils";

/**
 * ScreenBaseballTiming
 * - 타이밍 배팅 연습 화면 (DOM + Framer Motion)
 * - 상태/로직(투구 루프, 판정)과 프레젠테이션(UI)을 한 컴포넌트에서 관리
 *   → 이후 규모가 커지면 usePitchEngine 훅으로 상태를 분리해도 좋습니다.
 */
export default function ScreenBaseballTiming() {
    /* ----------------------------- 설정 상태 ------------------------------ */
    const [mph, setMph] = useState(85);            // 구속
    const [pitchGapMs, setPitchGapMs] = useState(1200); // 오토 투구 간격
    const [autoPitch, setAutoPitch] = useState(true);
    const [pitchType, setPitchType] = useState<PitchType>("straight");

    /* ----------------------------- 게임 상태 ------------------------------ */
    const [inPlay, setInPlay] = useState(false);          // 공 비행 중 여부
    const [progress, setProgress] = useState(0);          // 투구 진행률(0~1)
    const [result, setResult] = useState<HitResult | null>(null);
    const [strikes, setStrikes] = useState(0);
    const [outs, setOuts] = useState(0);
    const [runs, setRuns] = useState(0);
    const [pitches, setPitches] = useState(0);  // 현재 투구 수
    const [maxPitches, setMaxPitches] = useState(5);    // 최대 투구 제한
    const [gameOver, setGameOver] = useState(false);
    const [runners, setRunners] = useState<Runners>({ on1: false, on2: false, on3: false });

    const [assistBar, setAssistBar] = useState(true);     // 타이밍 보조바 표시

    /* --------------------------- 내부 참조 핸들 --------------------------- */
    const swingAtRef = useRef<number | null>(null); // 스윙 시점의 진행률
    const rafRef = useRef<number | null>(null);     // requestAnimationFrame id
    const startTsRef = useRef<number | null>(null); // 투구 시작 타임스탬프

    // RAF 취소 유틸
    const cancelRaf = () => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    // mph → 플레이트 도달 시간(ms)
    const plateTime = useMemo(() => plateTimeMsFromMph(mph), [mph]);

    /* ----------------------------- 투구 시작 ------------------------------ */
    const startPitch = useCallback(() => {
        if (inPlay) return;          // 이미 투구 중이면 무시
        cancelRaf();                 // 이전 루프 클린업

        setResult(null);
        setInPlay(true);
        setProgress(0);
        swingAtRef.current = null;
        startTsRef.current = performance.now();

        // RAF 루프: 진행률 업데이트
        const step = () => {
            const now = performance.now();
            const elapsed = now - (startTsRef.current || now);
            const t = clamp(elapsed / plateTime, 0, 1);
            setProgress(t);

            if (t < 1) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                // 공이 도달했는데 컨택이 없었다면 → 미스
                if (!swingAtRef.current) {
                    settleResult({ kind: "strike", reason: "miss" });
                } else {
                    // 스윙은 했지만 컨택 실패: 너무 빠르거나 늦음
                    const d = Math.abs(swingAtRef.current - CONTACT_PROGRESS);
                    if (d > FOUL) settleResult({ kind: "strike", reason: swingAtRef.current < CONTACT_PROGRESS ? "early" : "late" });
                }
                cancelRaf();
                setInPlay(false);
            }
        };

        rafRef.current = requestAnimationFrame(step);
        setPitches(p => p + 1);
    }, [inPlay, plateTime]);

    /* ----------------------------- 결과 정산 ------------------------------ */
    const settleResult = (r: HitResult) => {
        setResult(r);

        if (r.kind === "strike") {
            // 3스트 → 아웃 + 스트라이크 리셋
            setStrikes(s => {
                const ns = s + 1;
                if (ns >= 3) {
                    setOuts(o => o + 1);
                    return 0;
                }
                return ns;
            });
            return;
        }

        if (r.kind === "foul") {
            // 파울: 2스트 미만일 때만 스트 증가
            setStrikes(s => (s < 2 ? s + 1 : 2));
            setMaxPitches((prev) => prev + 1);
            return;
        }

        // 안타/장타/홈런
        if (r.kind === "homerun") {
            // 홈런: 타자+주자 모두 득점, 베이스 비움
            const runnersNow = (runners.on1 ? 1 : 0) + (runners.on2 ? 1 : 0) + (runners.on3 ? 1 : 0);
            setRuns(ru => ru + 5 + runnersNow);
            setRunners({ on1: false, on2: false, on3: false });
        } else {
            // 단/2/3루타: 기본 +1점, 진루 결과로 추가 득점 반영
            setRuns(ru => ru + 1);
            const bases = r.kind === "single" ? 1 : r.kind === "double" ? 2 : 3;
            setRunners(prev => {
                const { next, scored } = advanceBases(prev, bases);
                setRuns(ru => ru + scored);
                return next;
            });
        }
        setStrikes(0);
    };

    /* ----------------------------- 스윙 처리 ------------------------------ */
    const doSwing = useCallback(() => {
        if (!inPlay) return;                 // 공 비행 중에만 유효
        const t = progress;
        swingAtRef.current = t;

        const delta = Math.abs(t - CONTACT_PROGRESS);
        // 타이밍 판정에 따라 결과 결정
        if (delta <= PERFECT) {
            const exitV = rand(43, 50), launch = rand(24, 32);
            settleResult({ kind: "homerun", timingDelta: delta, exitVelo: exitV, launchDeg: launch, distance: estimateDistance(exitV, launch) });
            setInPlay(false);
        } else if (delta <= GOOD) {
            const exitV = rand(38, 46), launch = rand(18, 28);
            settleResult({ kind: "double", timingDelta: delta, exitVelo: exitV, launchDeg: launch, distance: estimateDistance(exitV, launch) });
            setInPlay(false);
        } else if (delta <= OKAY) {
            const exitV = rand(32, 42), launch = rand(10, 22);
            const kind = delta < (OKAY * 0.6) ? "double" : "single";
            settleResult({ kind, timingDelta: delta, exitVelo: exitV, launchDeg: launch, distance: estimateDistance(exitV, launch) });
            setInPlay(false);
        } else if (delta <= FOUL) {
            settleResult({ kind: "foul", timingDelta: delta });
            setInPlay(false);
        } else {
            // 컨택 실패 시: 투구 종료 시 스트라이크 처리됨
        }
    }, [inPlay, progress]);

    /* ------------------------- ESP32 BLE 연결 훅 ------------------------- */
    const ble = useBleSwing(doSwing, {
        // 기본값(NUS)이라 옵션을 생략가능.
        serviceUUID: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        characteristicUUID: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
        // writeCharacteristicUUID: "6e400002-b5a3-f393-e0a9-e50e24dcca9e", // 필요시
        // filters: [{ namePrefix: "ESP32" }], // 장치명 필터 원하면 사용
        swingToken: "SWING",
        debounceMs: 250,
        verbose: false,
    });

    /* ------------------------------ 키 바인딩 ----------------------------- */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === "Space") { e.preventDefault(); doSwing(); }
            else if (e.code === "Enter") { e.preventDefault(); startPitch(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [doSwing, startPitch]);

    /* ------------------------------- 이닝 처리 ---------------------------- */
    useEffect(() => {
        if (outs >= 3) {
            // 3아웃 시 간단 리셋 (주자/스트 초기화)
            setOuts(0);
            setStrikes(0);
            setRunners({ on1: false, on2: false, on3: false });
        }
    }, [outs]);

    /* ------------------------------ 클린업 ------------------------------- */
    useEffect(() => () => cancelRaf(), []);

    /* ------------------------------ 게임오버 ------------------------------ */
    useEffect(() => {
        if (pitches >= maxPitches) {
            setInPlay(false);
            setGameOver(true);
        }
    }, [pitches]);

    /* ------------------------------ 오토 투구 ---------------------------- */
    useEffect(() => {
        if (!autoPitch || gameOver || inPlay) return;
        const id = setTimeout(startPitch, pitchGapMs);
        return () => clearTimeout(id);
    }, [autoPitch, gameOver, inPlay, pitchGapMs, startPitch]);

    /* ------------------------- 공 위치/스케일 계산 ------------------------ */
    const yPx = useMemo(() => lerp(0, 320, progress), [progress]);     // 원근감 y
    const zScale = useMemo(() => lerp(0.6, 1.4, progress), [progress]); // 스케일
    const yToward = useMemo(() => {
        const base = yPx;
        const extraY = pitchType === "sinker" ? curveOffset("sinker", progress) : 0;
        return base + extraY;
    }, [yPx, progress, pitchType]);
    const lateralX = useMemo(() => {
        if (pitchType === "straight" || pitchType === "sinker") return 0;
        return curveOffset(pitchType, progress); // 좌우 흔들림
    }, [progress, pitchType]);

    /* ------------------------------- 리셋 -------------------------------- */
    const resetAll = () => {
        setStrikes(0); setOuts(0); setRuns(0); setPitches(0); setResult(null);
        setInPlay(false); setProgress(0);
        setRunners({ on1: false, on2: false, on3: false });
        setGameOver(false);
    };

    /* ------------------------------- 렌더 -------------------------------- */
    return (
        <div className="w-screen h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-100 p-6 overflow-hidden">
            <div className="w-full h-full grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* 좌: 필드/배팅 */}
                <Card className="xl:col-span-8 bg-slate-900/60 border-slate-700 shadow-2xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xl flex items-center gap-2 text-white">⚾ 스크린 야구 — 타이밍 배팅</CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-emerald-600/20 text-emerald-200 border border-emerald-500/30">{mph} mph</Badge>
                            <Badge variant="outline" className="border-slate-600 text-slate-200">{pitchType}</Badge>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {/* 필드 캔버스 영역 */}
                        <div className="relative w-full h-[420px] rounded-2xl overflow-hidden bg-gradient-to-b from-emerald-900/40 via-slate-900/40 to-slate-900 border border-slate-700">

                            {/* 우상단 미니 다이아몬드 & 점수 */}
                            <div className="absolute right-3 top-3 z-20 pointer-events-none">
                                <MiniDiamond runners={runners} size={96} />
                                <div className="mt-2 flex justify-center">
                                    <div className="px-2 py-0.5 rounded-full bg-emerald-600/80 text-white font-semibold text-sm shadow">{runs} 점</div>
                                </div>
                            </div>

                            {/* 가이드 라인 */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
                                <div className="absolute left-0 right-0 top-[70%] h-px bg-white/5" />
                                <div className="absolute left-0 right-0 top-[85%] h-px bg-white/5" />
                            </div>

                            {/* 투수 박스(시각 효과만) */}
                            <motion.div
                                className="absolute left-1/2 -translate-x-1/2 top-8 w-16 h-24 rounded-xl bg-sky-500/30 border border-sky-400/30 flex items-center justify-center text-xs"
                                animate={inPlay ? { y: [0, -4, 0] } : { y: 0 }}
                                transition={{ duration: 0.6, repeat: inPlay ? Infinity : 0, ease: "easeInOut" }}
                            >
                                투수
                            </motion.div>

                            {/* 홈 플레이트 / 타격 존 힌트 */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-8 w-20 h-20 rotate-45 bg-white/10 border border-white/20" />
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-20 w-28 h-28 rounded-full border-2 border-amber-300/40" />

                            {/* 공: 직선(tween+linear) 이동 + 원근 스케일 */}
                            <AnimatePresence>
                                {inPlay && (
                                    <motion.div
                                        key="ball"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, x: lateralX, y: yToward, scale: zScale }}
                                        exit={{ opacity: 0 }}
                                        transition={{ type: "tween", ease: "linear", duration: Math.max(plateTime / 1000, 0.01) }}
                                        className="absolute left-1/2 -translate-x-1/2 top-12 w-5 h-5 rounded-full bg-white"
                                        style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.25), 0 2px 10px rgba(0,0,0,0.35)" }}
                                    />
                                )}
                            </AnimatePresence>

                            {/* 스윙 이펙트 */}
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

                            {/* 결과 배지 */}
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
                                            result.kind === "homerun" ? "bg-red-600/80 text-white text-lg px-4 py-2 shadow-xl" :
                                                (result.kind === "triple" || result.kind === "double" || result.kind === "single") ? "bg-emerald-600/80 text-white text-lg px-4 py-2 shadow-xl" :
                                                    result.kind === "foul" ? "bg-amber-600/80 text-white px-4 py-2 shadow" :
                                                        "bg-slate-700/90 text-white px-4 py-2"
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
                                <div className="flex items-center gap-2"><Gauge className="w-4 h-4" /> 타이밍 게이지</div>
                                <label className="flex items-center gap-2 text-xs">
                                    <input type="checkbox" className="accent-emerald-400" checked={assistBar} onChange={e => setAssistBar(e.target.checked)} /> 보조 표시
                                </label>
                            </div>

                            {/* 진행/판정 구역 시각화 */}
                            <div className="relative h-3 rounded-full bg-slate-700 overflow-hidden">
                                <div className="absolute top-0 bottom-0 left-0" style={{ width: `${progress * 100}%` }}>
                                    <div className="h-full bg-emerald-500/70" />
                                </div>
                                {assistBar && (
                                    <>
                                        <div className="absolute top-[-4px] h-[11px] rounded bg-red-500/70"
                                             style={{ left: `${(CONTACT_PROGRESS - PERFECT) * 100}%`, width: `${(PERFECT * 2) * 100}%` }} />
                                        <div className="absolute top-[-2px] h-[7px] rounded bg-emerald-500/70"
                                             style={{ left: `${(CONTACT_PROGRESS - GOOD) * 100}%`, width: `${(GOOD * 2) * 100}%` }} />
                                        <div className="absolute top-0 h-[3px] bg-amber-400/70"
                                             style={{ left: `${(CONTACT_PROGRESS - OKAY) * 100}%`, width: `${(OKAY * 2) * 100}%` }} />
                                    </>
                                )}
                                <div className="absolute top-[-6px] bottom-[-6px] w-[2px] bg-white/70" style={{ left: `${CONTACT_PROGRESS * 100}%` }} />
                            </div>

                            {/* 컨트롤 버튼 */}
                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                <Button onClick={startPitch} disabled={inPlay} className="rounded-2xl">
                                    <Play className="w-4 h-4 mr-2" /> 투구
                                </Button>
                                <Button variant="secondary" onClick={doSwing} disabled={!inPlay} className="rounded-2xl">
                                    <Sparkles className="w-4 h-4 mr-2" /> 스윙 (Space)
                                </Button>
                                <Button variant="outline" onClick={resetAll} className="rounded-2xl">
                                    <RotateCcw className="w-4 h-4 mr-2" /> 리셋
                                </Button>

                                {/* ---- ESP32 BLE 연결/해제 & 상태 뱃지 ---- */}
                                {ble.supported ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={ble.connect}
                                            disabled={ble.status === "requesting" || ble.status === "connecting" || ble.status === "connected"}
                                            className="rounded-2xl"
                                        >
                                            {ble.status === "requesting" || ble.status === "connecting" ? "BLE 연결 중..." : "ESP32 BLE 연결"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={ble.disconnect}
                                            disabled={ble.status !== "connected"}
                                            className="rounded-2xl"
                                        >
                                            BLE 해제
                                        </Button>
                                        <Badge className={`ml-1 ${ble.status === "connected"
                                            ? "bg-emerald-600/70 border-emerald-500 text-white"
                                            : "bg-slate-700/80 border-slate-600 text-slate-200"}`}>
                                            {ble.status}{ble.deviceName ? ` · ${ble.deviceName}` : ""}
                                        </Badge>
                                        {/* 디버그로 최근 수신 텍스트 보고 싶으면: */}
                                        {/* <span className="text-xs text-slate-400 ml-2">{ble.lastMessage}</span> */}
                                    </>
                                ) : (
                                    <Badge className="bg-red-700/70 border-red-600 text-white">Web Bluetooth 미지원</Badge>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 우: 스코어/설정 */}
                <div className="xl:col-span-4 space-y-6">
                    {/* 스코어보드 */}
                    <Card className="bg-slate-900/60 border-slate-700">
                        <CardHeader className="pb-2"><CardTitle className="text-lg text-white">스코어보드</CardTitle></CardHeader>
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

                            {/* 타구 메타 정보 */}
                            <div className="text-sm text-slate-300">
                                {result && (result.kind === "single" || result.kind === "double" || result.kind === "triple" || result.kind === "homerun") && (
                                    <div className="space-y-1">
                                        <div>타이밍 오차: {(result.timingDelta * 100).toFixed(1)}%p</div>
                                        <div>타구 속도(모형): {result.exitVelo.toFixed(1)} m/s</div>
                                        <div>발사 각도: {result.launchDeg.toFixed(1)}°</div>
                                        <div>예상 비거리: {result.distance.toFixed(1)} m</div>
                                    </div>
                                )}
                                {result && result.kind === "foul" && <div>파울 · 타이밍 오차 {(result.timingDelta * 100).toFixed(1)}%p</div>}
                                {result && result.kind === "strike" && (
                                    <div>스트라이크 · {result.reason === "miss" ? "스윙 없음/미스" : result.reason === "early" ? "너무 빠른 스윙" : "너무 늦은 스윙"}</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 설정 패널 */}
                    <Card className="bg-slate-900/60 border-slate-700">
                        <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2 text-white"><TimerReset className="w-4 h-4" /> 설정</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            {/* 구속 */}
                            <div>
                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-white">구속 (mph)</span><span className="text-slate-400">{mph}</span>
                                </div>
                                <Slider value={[mph]} min={70} max={100} step={1} onValueChange={v => setMph(v[0])} />
                            </div>

                            {/* 투구 간격/오토 */}
                            <div>
                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-white">연속 투구 간격 (ms)</span><span className="text-slate-400">{pitchGapMs}</span>
                                </div>
                                <Slider value={[pitchGapMs]} min={600} max={2400} step={100} onValueChange={v => setPitchGapMs(v[0])} />
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" className="accent-emerald-400" checked={autoPitch} onChange={e => setAutoPitch(e.target.checked)} />
                                        <span className="text-white">오토 투구</span>
                                    </label>
                                </div>
                            </div>

                            {/* 구종 */}
                            <div className="text-sm">
                                <div className="mb-2 text-white">구종</div>
                                <div className="grid grid-cols-4 gap-2">
                                    {(["straight", "slider", "curve", "sinker"] as PitchType[]).map(pt => (
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
