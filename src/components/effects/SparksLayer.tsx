import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type Spark = {
    id: string;
    x: number;
    y: number; // 컨테이너 기준 px
    power: "perfect" | "good" | "okay" | "foul";
    bornAt: number;
};

export function SparksLayer({ sparks }: { sparks: Spark[] }) {
    const now = performance.now();
    const live = useMemo(() => sparks.filter(s => now - s.bornAt < 350), [sparks, now]);

    return (
        <div className="pointer-events-none absolute inset-0">
            <AnimatePresence>
                {live.map((s) => <SparkLine key={s.id} s={s} />)}
            </AnimatePresence>
        </div>
    );
}

function SparkLine({ s }: { s: Spark }) {
    const len = s.power === "perfect" ? 28 : s.power === "good" ? 22 : s.power === "okay" ? 16 : 12;
    const thick = s.power === "perfect" ? 3 : 2;
    const rot = hash(s.id) % 360;
    const life = 0.28;

    return (
        <motion.div
            initial={{ opacity: 0.95, scaleX: 0.2 }}
            animate={{ opacity: 0, scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: life, ease: "easeOut" }}
            style={{
                position: "absolute",
                left: s.x, top: s.y,
                width: len, height: thick,
                background: "linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,200,80,0.2))",
                boxShadow: "0 0 8px rgba(255,200,80,0.9)",
                transformOrigin: "0% 50%",
                rotate: `${rot}deg`,
                borderRadius: 999,
            }}
        />
    );
}

// 간단 해시
function hash(t: string){ let h=0; for (let i=0;i<t.length;i++) h=(h<<5)-h+t.charCodeAt(i)|0; return Math.abs(h); }
