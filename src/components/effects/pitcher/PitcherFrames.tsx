// src/components/effects/pitcher/PitcherFrames.tsx
import React, { useEffect, useRef, useState } from "react";

interface PitcherFramesProps {
    playing: boolean;       // true일 때만 애니메이션 재생
    frameCount?: number;    // 전체 프레임 수 (기본 40)
    fps?: number;           // 초당 프레임 수 (기본 24)
    pathPrefix?: string;    // public 기준 경로 (기본 "/assets/pitcher")
    idleFrame?: number;     // 정지 시 기본 프레임 번호 (기본 1)
    zIndex?: number;        // 화면 위 겹침 우선순위 (기본 25)
    topOffset?: number;     // 화면 상단으로부터 위치(px, 기본 64)
}

/**
 * PitcherFrames
 * - 기본 화면에서는 idleFrame(정지 프레임)을 표시
 * - playing=true일 때 1~frameCount까지 순서대로 재생
 * - 끝나면 다시 idleFrame으로 복귀
 */
export function PitcherFrames({
                                  playing,
                                  frameCount = 40,
                                  fps = 24,
                                  pathPrefix = "/assets/pitcher",
                                  idleFrame = 1,
                                  zIndex = 25,
                                  topOffset = 64,
                              }: PitcherFramesProps) {
    // 현재 표시 중인 프레임 번호
    const [frame, setFrame] = useState(idleFrame);

    // 애니메이션 제어용 참조값
    const rafRef = useRef<number | null>(null);   // requestAnimationFrame ID
    const startRef = useRef<number | null>(null); // 시작 시간 저장

    /** frame 번호를 실제 이미지 경로로 변환 */
    const frameToSrc = (f: number) =>
        `${pathPrefix}/frame_${String(f - 1).padStart(5, "0")}.jpg`;

    /** 첫 프레임(정지 이미지) 미리 로드 */
    useEffect(() => {
        const img = new Image();
        img.src = frameToSrc(idleFrame);
    }, [pathPrefix, idleFrame]);

    /**
     * playing=true일 때 애니메이션 재생
     * - requestAnimationFrame으로 부드럽게 프레임 전환
     * - 끝나면 idleFrame으로 복귀
     */
    useEffect(() => {
        if (!playing) return;

        // 초기화
        setFrame(1);
        startRef.current = null;

        // 전체 애니메이션 길이 (ms)
        const durationMs = (frameCount / fps) * 1000;

        /** 매 프레임 호출되는 함수 */
        const step = (timestamp: number) => {
            if (startRef.current == null) startRef.current = timestamp;
            const elapsed = timestamp - startRef.current;
            const progress = Math.min(1, elapsed / durationMs);

            // 현재 진행도에 따라 프레임 번호 계산
            const f = Math.floor(progress * (frameCount - 1)) + 1;
            setFrame(f);

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                // 애니메이션 종료 → idle 상태로 복귀
                setFrame(idleFrame);
            }
        };

        rafRef.current = requestAnimationFrame(step);

        // 언마운트 또는 재시작 시 이전 루프 중단
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [playing, frameCount, fps, idleFrame]);

    return (
        <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{ top: topOffset, zIndex }}
            aria-hidden
        >
            <img
                src={frameToSrc(frame)}
                alt="투수 애니메이션"
                className="w-[22vw] max-w-[360px] h-auto opacity-95"
                draggable={false}
            />
        </div>
    );
}
