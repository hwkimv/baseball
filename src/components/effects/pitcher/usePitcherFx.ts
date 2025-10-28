// src/components/effects/pitcher/usePitcherFx.ts
import { useState } from "react";

/**
 * usePitcherFx
 * 투수 모션 애니메이션을 제어하기 위한 커스텀 훅
 * - trigger() 호출 시 playing이 true → 지정된 프레임 길이만큼 유지 후 자동 false
 * - FPS와 프레임 수에 따라 지속시간을 자동 계산
 */
export function usePitcherFx(frameCount = 40, fps = 24) {
    // 현재 애니메이션 재생 중인지 여부
    const [playing, setPlaying] = useState(false);

    /**
     * trigger()
     * - playing을 true로 설정하여 애니메이션을 재생시킴
     * - 프레임 총 길이에 따라 자동으로 playing을 false로 되돌림
     */
    const trigger = () => {
        if (playing) return; // 이미 재생 중이라면 무시
        setPlaying(true);

        // 전체 프레임에 따른 애니메이션 지속 시간 (ms)
        const duration = (frameCount / fps) * 1000;

        // 지정된 시간 뒤에 자동으로 종료
        setTimeout(() => setPlaying(false), duration + 50);
    };

    // 외부에서 playing 상태와 trigger 함수 사용
    return { playing, trigger };
}
