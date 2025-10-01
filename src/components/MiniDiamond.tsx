/**
 * MiniDiamond: 우상단 미니 야구 다이아몬드
 * - runners 상태에 따라 1/2/3루에 말(원형) 표시
 * - 순수 프레젠테이션 컴포넌트
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Runners } from "@/game/types";

export function MiniDiamond({ runners, size = 120 }: { runners: Runners; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 140 140" className="drop-shadow">
            {/* 잔디/내야 */}
            <rect x="0" y="0" width="140" height="140" fill="#1f7a2f" rx="10" />
            <rect x="20" y="20" width="100" height="100" fill="#d7a693" transform="rotate(45 70 70)" rx="8" />
            <circle cx="70" cy="70" r="16" fill="#2b7a3b" opacity="0.35" />
            {/* 베이스 */}
            <rect x="64" y="100" width="12" height="12" fill="#fff" transform="rotate(45 70 106)" />
            <rect x="100" y="64" width="12" height="12" fill="#fff" transform="rotate(45 106 70)" />
            <rect x="64" y="28" width="12" height="12" fill="#fff" transform="rotate(45 70 34)" />
            <rect x="28" y="64" width="12" height="12" fill="#fff" transform="rotate(45 34 70)" />
            {/* 라벨 */}
            <text x="70" y="22" fill="#111" fontSize="10" textAnchor="middle">2루</text>
            <text x="122" y="72" fill="#111" fontSize="10" textAnchor="middle">1루</text>
            <text x="70" y="132" fill="#111" fontSize="10" textAnchor="middle">홈</text>
            <text x="18" y="72" fill="#111" fontSize="10" textAnchor="middle">3루</text>

            {/* 주자 애니메이션 */}
            <AnimatePresence>
                {runners.on1 && (
                    <motion.circle key="r1" cx={110} cy={70} r={7} fill="#ffec99" stroke="#b45309" strokeWidth={2}
                                   initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} />
                )}
                {runners.on2 && (
                    <motion.circle key="r2" cx={70} cy={30} r={7} fill="#ffec99" stroke="#b45309" strokeWidth={2}
                                   initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} />
                )}
                {runners.on3 && (
                    <motion.circle key="r3" cx={30} cy={70} r={7} fill="#ffec99" stroke="#b45309" strokeWidth={2}
                                   initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} />
                )}
            </AnimatePresence>
        </svg>
    );
}
