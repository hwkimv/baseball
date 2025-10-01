/**
 * 게임에서 쓰는 공용 타입 정의 모음
 * - UI/로직 파일 어디서든 import 해서 재사용합니다.
 */

export type PitchType = "straight" | "slider" | "curve" | "sinker";

/** 루상의 주자 상태 */
export type Runners = { on1: boolean; on2: boolean; on3: boolean };

/**
 * 타격 결과
 * - strike: 스윙 타이밍 실패/헛스윙 등
 * - foul:   컨택했지만 파울
 * - 단타~홈런: 컨택 성공 시 상세 메타 포함
 */
export type HitResult =
    | { kind: "strike"; reason: "early" | "late" | "miss" }
    | { kind: "foul"; timingDelta: number }
    | {
    kind: "single" | "double" | "triple" | "homerun";
    timingDelta: number; // CONTACT 타이밍과의 오차(진행률)
    exitVelo: number;    // 타구 속도 (모형 값, m/s 가정)
    launchDeg: number;   // 발사 각도 (deg)
    distance: number;    // 비거리 (모형 값, m)
};
