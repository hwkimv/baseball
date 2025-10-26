import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
    pitches: number;
    strikes: number;
    outs: number;
    runs: number;
    resultMeta?: {
        timingDelta?: number;
        exitVelo?: number;
        launchDeg?: number;
        distance?: number;
        kind?: string;
        reason?: string;
    } | null;
};

export const Scoreboard: React.FC<Props> = ({ pitches, strikes, outs, runs, resultMeta }) => (
    <Card className="bg-slate-900/60 border-slate-700">
        <CardHeader className="pb-2"><CardTitle className="text-lg text-white">스코어보드</CardTitle></CardHeader>
        <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700">
                    <div className="text-xs text-slate-400">PITCHES</div>
                    <div className="text-2xl font-semibold">{pitches}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700">
                    <div className="text-xs text-slate-400">STRIKES</div>
                    <div className="text-2xl font-semibold">{strikes}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700">
                    <div className="text-xs text-slate-400">OUTS</div>
                    <div className="text-2xl font-semibold">{outs}</div>
                </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-900/30 border border-emerald-700/40">
                <div className="text-xs text-emerald-300/90">RUNS</div>
                <div className="text-2xl font-semibold text-emerald-200">{runs}</div>
            </div>

            <div className="text-sm text-slate-300">
                {resultMeta?.kind && ["single","double","triple","homerun"].includes(resultMeta.kind) && (
                    <div className="space-y-1">
                        {resultMeta.timingDelta != null && <div>타이밍 오차: {(resultMeta.timingDelta * 100).toFixed(1)}%p</div>}
                        {resultMeta.exitVelo != null && <div>타구 속도(모형): {resultMeta.exitVelo.toFixed(1)} m/s</div>}
                        {resultMeta.launchDeg != null && <div>발사 각도: {resultMeta.launchDeg.toFixed(1)}°</div>}
                        {resultMeta.distance != null && <div>예상 비거리: {resultMeta.distance.toFixed(1)} m</div>}
                    </div>
                )}
                {resultMeta?.kind === "foul" && resultMeta.timingDelta != null && (
                    <div>파울 · 타이밍 오차 {(resultMeta.timingDelta * 100).toFixed(1)}%p</div>
                )}
                {resultMeta?.kind === "strike" && (
                    <div>스트라이크 · {resultMeta.reason === "miss" ? "스윙 없음/미스" : resultMeta.reason === "early" ? "너무 빠른 스윙" : "너무 늦은 스윙"}</div>
                )}
            </div>
        </CardContent>
    </Card>
);
