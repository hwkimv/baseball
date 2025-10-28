// src/components/field/PitcherFrameSequence.tsx
import React, { useMemo } from "react";

type Props = {
    inPlay: boolean;            // 투구 중 여부
    progress: number;           // 0~1 (엔진에서 올라오는 값)
    frameCount?: number;        // 전체 프레임 수 (기본 40 → 0~39)
    pathPrefix?: string;        // public 기준 경로
    top?: number;               // 화면 상단 여백
    z?: number;                 // z-index
};

/**
 * 엔진 progress(0→1)에 맞춰 프레임 인덱스를 계산해 표시.
 * - inPlay=false면 idle(0번 프레임) 고정
 * - inPlay=true면 progress*[frameCount-1]로 프레임 진행
 */
export default function PitcherFrameSequence({
                                                 inPlay,
                                                 progress,
                                                 frameCount = 40,
                                                 pathPrefix = "/assets/pitcher",
                                                 top = 64,
                                                 z = 25,
                                             }: Props) {
    // 0~(frameCount-1) 정수 인덱스
    const frameIdx = useMemo(() => {
        if (!inPlay) return 0; // idle은 0번 프레임
        const idx = Math.round(progress * (frameCount - 1));
        return Math.min(Math.max(idx, 0), frameCount - 1);
    }, [inPlay, progress, frameCount]);

    const src = `${pathPrefix}/frame_${String(frameIdx).padStart(5, "0")}.jpg`;

    return (
        <div
            className="
            pointer-events-none
            absolute inset-0
            flex items-center
            justify-center"
            style={{ top, zIndex: z }}
            aria-hidden
        >
            <img
                src={src}
                alt="투수 모션"
                className="
                w-full
                h-full
                object-contain
                opacity-95"
                draggable={false}
            />
        </div>
    );
}
