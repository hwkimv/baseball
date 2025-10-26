import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 임팩트 순간 화면이 번쩍이는 효과.
 * strength: 0~1 (기본 0.6)
 */
export function ImpactFlash({
                                active,
                                strength = 0.6,
                                onDone,
                            }: { active: boolean; strength?: number; onDone?: () => void }) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (!active) return;
        setShow(true);
        const t = setTimeout(() => { setShow(false); onDone?.(); }, 120);
        return () => clearTimeout(t);
    }, [active, onDone]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: strength }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    className="pointer-events-none absolute inset-0 bg-white mix-blend-screen"
                />
            )}
        </AnimatePresence>
    );
}
