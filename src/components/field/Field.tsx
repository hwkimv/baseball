import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { MiniDiamond } from "@/components/MiniDiamond";
import type { HitResult, Runners } from "@/game/types";

type Props = {
    inPlay: boolean;
    result: HitResult | null;
    runners: Runners;
    progress: number;
    kinematics: (fieldH: number) => { yToward: number; zScale: number; lateralX: number; ballOpacity: number; };
};

export const Field: React.FC<Props> = ({ inPlay, result, runners, progress, kinematics }) => {
    const fieldRef = useRef<HTMLDivElement>(null);
    const [fieldH, setFieldH] = useState(0);

    useEffect(() => {
        const el = fieldRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setFieldH(el.clientHeight));
        ro.observe(el);
        setFieldH(el.clientHeight);
        return () => ro.disconnect();
    }, []);

    const { yToward, zScale, lateralX, ballOpacity } = kinematics(fieldH);

    return (
        <div
            ref={fieldRef}
            className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-emerald-900/40 via-slate-900/40 to-slate-900 border border-slate-700"
            style={{ height: "min(72vh, 820px)" }}
        >
            {/* 미니 다이아 + 점수는 상위에서 별도 표기하고 싶으면 props로 넘겨 분리 가능 */}
            <div className="absolute right-3 top-3 z-20 pointer-events-none">
                <MiniDiamond runners={runners} size={200} />
            </div>

            {/* 가이드 라인 */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
                <div className="absolute left-0 right-0 top-[70%] h-px bg-white/5" />
                <div className="absolute left-0 right-0 top-[85%] h-px bg-white/5" />
            </div>

            {/* 투수 박스(시각효과) */}
            <motion.div
                className="absolute left-1/2 -translate-x-1/2 top-8 w-16 h-24 rounded-xl bg-sky-500/30 border border-sky-400/30 flex items-center justify-center text-xs"
                animate={inPlay ? { y: [0, -4, 0] } : { y: 0 }}
                transition={{ duration: 0.6, repeat: inPlay ? Infinity : 0, ease: "easeInOut" }}
            >
                투수
            </motion.div>

            {/* 홈 플레이트 / 힌트 */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-8 w-20 h-20 rotate-45 bg-white/10 border border-white/20" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-20 w-28 h-28 rounded-full border-2 border-amber-300/40" />

            {/* 공 */}
            <AnimatePresence>
                {inPlay && (
                    <motion.div
                        key="ball-wrap"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="absolute left-1/2 -translate-x-1/2 top-12"
                    >
                        <div
                            className="w-5 h-5 rounded-full bg-white"
                            style={{
                                transform: `translateX(${lateralX}px) translateY(${yToward}px) scale(${zScale})`,
                                opacity: ballOpacity,
                                boxShadow: "0 0 0 2px rgba(0,0,0,0.25), 0 2px 10px rgba(0,0,0,0.35)",
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 결과 배지 */}
            {/* 결과 배지 (화면 중앙 위쪽) */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        key="result-banner"
                        initial={{ opacity: 0, y: -40, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="
                        absolute
                        left-[43%]    /* ⬅️ 화면 가로 중앙 약간 왼쪽 (시각적 중앙 맞춤) */
                        top-[18%]       /* ⬅️ 화면 전체 높이의 약 20% 지점 (투수 위쪽 중앙) */
                        -translate-x-1/2
                        z-50
                      "
                    >
                        <div
                            className={`
                              px-10 py-6 rounded-3xl font-bold text-white text-4xl shadow-2xl
                              border-2 backdrop-blur-md 
                              ${
                                result.kind === "homerun"
                                    ? "bg-red-600/90 border-red-400 animate-bounce"
                                    : result.kind === "foul"
                                        ? "bg-amber-600/90 border-amber-400 animate-pulse"
                                        : result.kind === "strike"
                                            ? "bg-slate-800/90 border-red-500 animate-pulse"
                                            : result.kind === "single" || result.kind === "double" || result.kind === "triple"
                                                ? "bg-emerald-700/90 border-emerald-400 animate-bounce"
                                                : "bg-slate-700/90 border-slate-500"
                                }
                                      `}
                        >
                            {result.kind === "homerun" && "🔥 HOMERUN! 🎉"}
                            {result.kind === "triple" && "3루타!"}
                            {result.kind === "double" && "2루타!"}
                            {result.kind === "single" && "안타!"}
                            {result.kind === "foul" && "파울!"}
                            {result.kind === "strike" &&
                                (result.reason === "miss"
                                    ? "❌ 헛스윙!"
                                    : result.reason === "early"
                                        ? "⚠️ 너무 빠름!"
                                        : "⚠️ 너무 늦음!")}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};
