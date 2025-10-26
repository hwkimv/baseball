// src/components/field/PitcherFrameSequence.tsx
import React, { useEffect, useState } from "react";

type Props = {
    playing: boolean;     // true면 한 번 재생
    frameCount?: number;  // 전체 프레임 수
    fps?: number;         // 초당 프레임 (기본 24)
};

export default function PitcherFrameSequence({
                                                 playing,
                                                 frameCount = 40,
                                                 fps = 24,
                                             }: Props) {
    const [frame, setFrame] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!playing) return;

        setVisible(true);
        setFrame(0);

        const interval = 1000 / fps;
        let current = 0;

        const timer = setInterval(() => {
            current++;
            if (current >= frameCount) {
                clearInterval(timer);
                setVisible(false); // 끝나면 숨김
            } else {
                setFrame(current);
            }
        }, interval);

        return () => clearInterval(timer);
    }, [playing, frameCount, fps]);

    if (!visible) return null;

    return (
        <div
            className="
        pointer-events-none
        absolute left-1/2 -translate-x-1/2
        top-[64px]
        z-[25]
      "
        >
            <img
                src={`/assets/pitcher/frame_${String(frame).padStart(5, "0")}.jpg`}
                alt="투수 애니메이션"
                className="w-[22vw] max-w-[360px] h-auto opacity-95"
                draggable={false}
            />
        </div>
    );
}
