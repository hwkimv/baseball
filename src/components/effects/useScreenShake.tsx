import {AnimationSequence, motion, useAnimate} from "framer-motion";
import React, { useCallback } from "react";

/**
 * 화면 컨테이너를 짧게 흔들어 타격감을 주는 훅.
 * - ShakeWrapper로 감싸고 triggerShake(px, ms) 호출.
 */
export function useScreenShake() {
    const [scope, animate] = useAnimate();

    const triggerShake = useCallback(async (intensity = 8, duration = 120) => {
        const seg = duration / 4;
        const seq: AnimationSequence = [
            [scope.current, { x:  intensity, y: -intensity }, { duration: seg / 1000 }],
            [scope.current, { x: -intensity, y:  intensity }, { duration: seg / 1000 }],
            [scope.current, { x:  intensity/2, y: -intensity/2 }, { duration: (seg * 0.8) / 1000 }],
            [scope.current, { x: 0, y: 0 }, { duration: (seg * 0.8) / 1000 }],
        ];
        await animate(seq);
    }, [animate, scope]);

    const ShakeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <motion.div ref={scope} className="will-change-transform">{children}</motion.div>
);

    return { triggerShake, ShakeWrapper };
}
