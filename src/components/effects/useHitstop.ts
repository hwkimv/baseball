import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 임팩트 순간 잠깐 '정지감'을 주기 위한 훅.
 * - hitstopActive가 true인 동안 게임 루프 업데이트를 스킵하세요.
 */
export function useHitstop() {
    const [hitstopActive, setActive] = useState(false);
    const timer = useRef<number | null>(null);

    const triggerHitstop = useCallback((ms: number) => {
        if (timer.current) window.clearTimeout(timer.current);
        setActive(true);
        timer.current = window.setTimeout(() => setActive(false), ms) as unknown as number;
    }, []);

    useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

    return { hitstopActive, triggerHitstop };
}
