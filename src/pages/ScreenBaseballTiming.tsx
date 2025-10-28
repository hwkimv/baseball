import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { TimerReset } from "lucide-react";
import { usePitchEngine } from "@/game/engine/usePitchEngine";
import { Field } from "@/components/field/Field";
import { TimingBar } from "@/components/hud/TimingBar";
import { Controls } from "@/components/hud/Controls";
import { Scoreboard } from "@/components/hud/Scoreboard";
import { useBleSwing } from "@/io/ble";
import PitcherFrameSequence from "@/components/field/PitcherFrameSequence";


export default function ScreenBaseballTimingPage() {
    // 엔진 훅 (상태/판정/루프)
    const eng = usePitchEngine();

    // BLE 훅 (bat → swing)
    const ble = useBleSwing(eng.doSwing, {
        serviceUUID: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        characteristicUUID: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
        swingToken: "SWING",
        debounceMs: 250,
        verbose: false,
    });

    // 투수 모션 효과
    const [pitchFx, setPitchFx] = useState(false);

    // 투구 + 애니메이션 트리거
    const startPitchWithFx = () => {
        setPitchFx(true);          // 애니메이션 시작
        eng.startPitch();          // 기존 투구 로직
        // 다음 투구에서 다시 true로 줄 수 있게 한 틱 뒤에 false로 리셋
        setTimeout(() => setPitchFx(false), 0);
    };

    // 키 바인딩
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === "Space") { e.preventDefault(); eng.doSwing(); }
            else if (e.code === "Enter") { e.preventDefault(); startPitchWithFx(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [eng]);

    return (
        <div className="w-screen h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-100 p-6 overflow-hidden">
            <div className="w-full h-full grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* 좌: 필드/배팅 */}
                <Card className="xl:col-span-8 bg-slate-900/60 border-slate-700 shadow-2xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xl flex items-center gap-2 text-white">⚾ 스크린 야구 — 타이밍 배팅</CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-emerald-600/20 text-emerald-200 border border-emerald-500/30">{eng.mph} mph</Badge>
                            <Badge variant="outline" className="border-slate-600 text-slate-200">{eng.pitchType}</Badge>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="relative">
                            {/* ★ 엔진 상태를 그대로 넘김 → 속도/구종 변화 자동 반영 */}
                            <PitcherFrameSequence
                                inPlay={eng.inPlay}
                                progress={eng.progress}        // 0~1
                                frameCount={40}
                                pathPrefix="/assets/pitcher"   // public/assets/pitcher
                                top={64}
                                z={25}
                            />

                            <Field
                                inPlay={eng.inPlay}
                                result={eng.result}
                                runners={eng.runners}
                                progress={eng.progress}
                                kinematics={eng.kinematics}
                            />
                        </div>

                            <TimingBar
                                progress={eng.progress}
                                assistBar={eng.assistBar}
                                setAssistBar={eng.setAssistBar}
                            />

                            <Controls
                                inPlay={eng.inPlay}
                                startPitch={startPitchWithFx}
                                doSwing={eng.doSwing}
                                resetAll={eng.resetAll}
                                ble={ble}
                            />
                    </CardContent>
                </Card>

                {/* 우: 스코어/설정 */}
                <div className="xl:col-span-4 space-y-6">
                    <Scoreboard
                        pitches={eng.pitches}
                        strikes={eng.strikes}
                        outs={eng.outs}
                        runs={eng.runs}
                        resultMeta={eng.result ? {
                            kind: eng.result.kind,
                            reason: (eng.result as any).reason,
                            timingDelta: (eng.result as any).timingDelta,
                            exitVelo: (eng.result as any).exitVelo,
                            launchDeg: (eng.result as any).launchDeg,
                            distance: (eng.result as any).distance,
                        } : null}
                    />

                    <Card className="bg-slate-900/60 border-slate-700">
                        <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2 text-white"><TimerReset className="w-4 h-4" /> 설정</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            {/* 구속 */}
                            <div>
                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-white">구속 (mph)</span><span className="text-slate-400">{eng.mph}</span>
                                </div>
                                <Slider value={[eng.mph]} min={20} max={100} step={1} onValueChange={v => eng.setMph(v[0])} />
                            </div>

                            {/* 투구 간격/오토 */}
                            <div>
                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-white">연속 투구 간격 (ms)</span><span className="text-slate-400">{eng.pitchGapMs}</span>
                                </div>
                                <Slider value={[eng.pitchGapMs]} min={600} max={2400} step={100} onValueChange={v => eng.setPitchGapMs(v[0])} />
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" className="accent-emerald-400" checked={eng.autoPitch} onChange={e => eng.setAutoPitch(e.target.checked)} />
                                        <span className="text-white">오토 투구</span>
                                    </label>
                                </div>
                            </div>

                            {/* 구종 */}
                            <div className="text-sm">
                                <div className="mb-2 text-white">구종</div>
                                <div className="grid grid-cols-4 gap-2">
                                    {(["straight", "slider", "curve", "sinker"] as const).map(pt => (
                                        <button
                                            key={pt}
                                            onClick={() => eng.setPitchType(pt)}
                                            className={`px-3 py-2 rounded-xl border ${eng.pitchType === pt ? "bg-emerald-600/30 border-emerald-500" : "bg-slate-800/70 border-slate-700"}`}
                                        >
                                            {pt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 도움말 */}
                            <div className="text-xs text-slate-400 leading-relaxed">
                                <p className="mb-1">조작: <b>Enter</b> 투구 / <b>Space</b> 스윙</p>
                                <p>진행 막대가 가운데 하얀 선(CONTACT)에 겹칠 때 스윙하면 좋은 타구가 됩니다.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* 게임 종료 모달 */}
            {eng.gameOver && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
                        <div className="text-xl font-bold text-white mb-2">게임 종료</div>
                        <div className="text-slate-300 mb-4">최종 점수 <span className="text-emerald-300 font-semibold">{eng.runs}</span> 점</div>
                        <div className="flex justify-center">
                            <button className="rounded-xl bg-emerald-600 px-4 py-2 text-white" onClick={eng.resetAll}>다시 시작</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
