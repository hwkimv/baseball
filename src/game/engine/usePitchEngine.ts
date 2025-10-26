import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HitResult, PitchType, Runners } from "@/game/types";
import { CONTACT_PROGRESS, PERFECT, GOOD, OKAY, FOUL } from "@/game/constants";
import { clamp, lerp, rand, estimateDistance, plateTimeMsFromMph, curveOffset, advanceBases } from "@/game/utils";

type EngineOptions = {
    initialMph?: number;
    initialPitchGapMs?: number;
    initialAutoPitch?: boolean;
    initialPitchType?: PitchType;
    initialMaxPitches?: number;
};

export function usePitchEngine(opts: EngineOptions = {}) {
    /* ------- 설정 ------- */
    const [mph, setMph] = useState(opts.initialMph ?? 85);
    const [pitchGapMs, setPitchGapMs] = useState(opts.initialPitchGapMs ?? 1200);
    const [autoPitch, setAutoPitch] = useState(opts.initialAutoPitch ?? true);
    const [pitchType, setPitchType] = useState<PitchType>(opts.initialPitchType ?? "straight");
    const [assistBar, setAssistBar] = useState(true);

    /* ------- 게임 상태 ------- */
    const [inPlay, setInPlay] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<HitResult | null>(null);
    const [strikes, setStrikes] = useState(0);
    const [outs, setOuts] = useState(0);
    const [runs, setRuns] = useState(0);
    const [pitches, setPitches] = useState(0);
    const [maxPitches, setMaxPitches] = useState(opts.initialMaxPitches ?? 5);
    const [gameOver, setGameOver] = useState(false);
    const [runners, setRunners] = useState<Runners>({ on1: false, on2: false, on3: false });

    /* ------- 내부 핸들 ------- */
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

    /* ------- 결과 정산 ------- */
    const settleResult = useCallback((r: HitResult) => {
        setResult(r);

        if (r.kind === "strike") {
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
            setStrikes(s => (s < 2 ? s + 1 : 2));
            setMaxPitches(prev => prev + 1); // 파울 시 투구수 +1 (요구사항)
            return;
        }

        // 안타/장타/홈런
        if (r.kind === "homerun") {
            const runnersNow = (runners.on1 ? 1 : 0) + (runners.on2 ? 1 : 0) + (runners.on3 ? 1 : 0);
            setRuns(ru => ru + 5 + runnersNow);
            setRunners({ on1: false, on2: false, on3: false });
        } else {
            setRuns(ru => ru + 1);
            const bases = r.kind === "single" ? 1 : r.kind === "double" ? 2 : 3;
            setRunners(prev => {
                const { next, scored } = advanceBases(prev, bases);
                setRuns(ru => ru + scored);
                return next;
            });
        }
        setStrikes(0);
    }, [runners]);

    /* ------- 투구 시작 ------- */
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
                if (!swingAtRef.current) {
                    settleResult({ kind: "strike", reason: "miss" });
                } else {
                    const d = Math.abs(swingAtRef.current - CONTACT_PROGRESS);
                    if (d > FOUL) settleResult({ kind: "strike", reason: swingAtRef.current < CONTACT_PROGRESS ? "early" : "late" });
                }
                cancelRaf();
                setInPlay(false);
            }
        };

        rafRef.current = requestAnimationFrame(step);
        setPitches(p => p + 1);
    }, [inPlay, plateTime, settleResult]);

    /* ------- 스윙 ------- */
    const doSwing = useCallback(() => {
        if (!inPlay) return;
        const t = progress;
        swingAtRef.current = t;

        const delta = Math.abs(t - CONTACT_PROGRESS);
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
        }
    }, [inPlay, progress, settleResult]);

    /* ------- 이닝/오토/게임오버/클린업 ------- */
    useEffect(() => {
        if (outs >= 3) {
            setOuts(0);
            setStrikes(0);
            setRunners({ on1: false, on2: false, on3: false });
        }
    }, [outs]);

    useEffect(() => {
        if (pitches >= maxPitches) {
            setInPlay(false);
            setGameOver(true);
        }
    }, [pitches, maxPitches]);

    useEffect(() => {
        if (!autoPitch || gameOver || inPlay) return;
        const id = setTimeout(startPitch, pitchGapMs);
        return () => clearTimeout(id);
    }, [autoPitch, gameOver, inPlay, pitchGapMs, startPitch]);

    useEffect(() => () => cancelRaf(), []);

    const resetAll = useCallback(() => {
        setStrikes(0); setOuts(0); setRuns(0); setPitches(0); setResult(null);
        setInPlay(false); setProgress(0);
        setRunners({ on1: false, on2: false, on3: false });
        setGameOver(false);
        setMaxPitches(5); // 게임 재시작 시 초기화
    }, []);

    /* ------- 공 위치/스케일 (필드에서 사용) ------- */
    const kinematics = (fieldH: number) => {
        const startYOffset = 0;
        const endYOffset = Math.max(0, fieldH * 0.78 - 48);
        const yPx = lerp(startYOffset, endYOffset, progress);
        const zScale = lerp(0.6, 1.4, progress);
        const yToward = yPx + (pitchType === "sinker" ? curveOffset("sinker", progress) : 0);
        const lateralX = (pitchType === "straight" || pitchType === "sinker") ? 0 : curveOffset(pitchType, progress);
        const ballOpacity = progress < 0.85 ? 1 : Math.max(0, 1 - (progress - 0.85) / 0.15);
        return { yToward, zScale, lateralX, ballOpacity };
    };

    return {
        // 상태
        mph, setMph,
        pitchGapMs, setPitchGapMs,
        autoPitch, setAutoPitch,
        pitchType, setPitchType,
        assistBar, setAssistBar,

        inPlay, progress, result,
        strikes, outs, runs,
        pitches, maxPitches, gameOver, runners,

        // 액션
        startPitch, doSwing, resetAll,

        // 내부/계산
        kinematics,
    };
}
