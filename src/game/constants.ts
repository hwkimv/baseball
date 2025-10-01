/**
 * 게임 규칙/판정에 쓰는 상수값
 * - 한 곳에서 관리하면 튜닝이 쉬워집니다.
 */

/** 공이 플레이트에 도달하는 진행률 (0~1) */
export const CONTACT_PROGRESS = 0.86;

/** 타이밍 판정 임계값(진행률 차이) */
export const PERFECT = 0.010; // <= 1.0%p → 퍼펙트 컨택
export const GOOD    = 0.020; // <= 2.0%p
export const OKAY    = 0.035; // <= 3.5%p
export const FOUL    = 0.055; // <= 5.5%p → 이후는 헛스윙
