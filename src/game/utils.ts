/**
 * 순수 함수 유틸 모음 (상태/DOM에 의존하지 않음)
 * - 테스트/재사용이 쉬워집니다.
 */
import type { PitchType, Runners } from "./types";

/** clamp: 값 v를 [lo, hi] 범위로 제한 */
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** lerp: 선형보간 a→b, 보간계수 t(0~1) */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** rand: [a, b] 범위 난수 */
export const rand = (a: number, b: number) => lerp(a, b, Math.random());

/**
 * 구속(mph)을 플레이트까지 걸리는 시간(ms)으로 근사
 * - 70mph ≈ 600ms, 100mph ≈ 400ms 로 선형 매핑
 * - 실제물리와 1:1 대응은 아니고, 게임 난이도용 스케일러
 */
export function plateTimeMsFromMph(mph: number) {
    return lerp(2000, 400, clamp((mph - 20) / (100 - 20), 0, 1));
}

/**
 * 타구 비거리 간단 근사
 * - 투사체 거리: v^2 * sin(2θ) / g 에 감쇄 상수 적용
 * - 공기저항/회전/환경은 무시한 모형값 (게임 피드백용)
 */
export function estimateDistance(exitVelo: number, launchDeg: number) {
    const g = 9.81;
    const v = exitVelo;
    const theta = (launchDeg * Math.PI) / 180;
    const raw = (v * v * Math.sin(2 * theta)) / g;
    const drag = 0.82; // 감쇄 스케일
    return Math.max(0, raw * drag);
}

/**
 * 구종별 궤적 보정
 * - slider: 좌우 흔들림
 * - curve : 반대 방향 휘어짐
 * - sinker: 하강 성분 (y축 보조)
 */
export function curveOffset(p: PitchType, xProgress: number) {
    switch (p) {
        case "slider": return Math.sin(xProgress * Math.PI) * 18;
        case "curve":  return Math.sin(xProgress * Math.PI) * -14;
        case "sinker": return Math.pow(xProgress, 2) * 24;
        default:       return 0;
    }
}

/**
 * 주자/타자 진루 계산
 * @param state 현재 베이스 점유 상태
 * @param n     진루 수(1:안타, 2:2루타, 3:3루타, 4+:홈런 처리)
 * @returns next 다음 베이스 상태, scored 홈 밟은 주자 수
 */
export function advanceBases(state: Runners, n: number): { next: Runners; scored: number } {
    const arr = [state.on1, state.on2, state.on3];

    // 홈런: 모든 주자 + 타자 득점 후 베이스 비움
    if (n >= 4) {
        const scored = arr.filter(Boolean).length + 1;
        return { next: { on1: false, on2: false, on3: false }, scored };
    }

    const nextArr = [false, false, false];
    let scored = 0;

    // 3루→1루 순으로 뒤에서 앞으로 이동 계산 (겹침 방지)
    for (let i = 2; i >= 0; i--) {
        if (!arr[i]) continue;
        const j = i + n; // 이동 후 인덱스
        if (j >= 3) scored += 1; // 홈인
        else nextArr[j] = true;  // 해당 루 점유
    }

    // 타자 배치
    const batterIndex = n - 1;
    if (batterIndex >= 3) scored += 1; else nextArr[batterIndex] = true;

    return { next: { on1: nextArr[0], on2: nextArr[1], on3: nextArr[2] }, scored };
}
