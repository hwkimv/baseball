import React from "react";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "lucide-react";
import { CONTACT_PROGRESS, PERFECT, GOOD, OKAY } from "@/game/constants";

type Props = {
    progress: number;
    assistBar: boolean;
    setAssistBar: (v: boolean) => void;
};

export const TimingBar: React.FC<Props> = ({ progress, assistBar, setAssistBar }) => (
    <div className="mt-5">
        <div className="flex items-center justify-between mb-2 text-sm text-slate-300">
            <div className="flex items-center gap-2"><Gauge className="w-4 h-4" /> 타이밍 게이지</div>
            <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="accent-emerald-400" checked={assistBar} onChange={e => setAssistBar(e.target.checked)} /> 보조 표시
            </label>
        </div>

        <div className="relative h-3 rounded-full bg-slate-700 overflow-hidden">
            <div className="absolute top-0 bottom-0 left-0" style={{ width: `${progress * 100}%` }}>
                <div className="h-full bg-emerald-500/70" />
            </div>
            {assistBar && (
                <>
                    <div className="absolute top-[-4px] h-[11px] rounded bg-red-500/70"
                         style={{ left: `${(CONTACT_PROGRESS - PERFECT) * 100}%`, width: `${(PERFECT * 2) * 100}%` }} />
                    <div className="absolute top-[-2px] h-[7px] rounded bg-emerald-500/70"
                         style={{ left: `${(CONTACT_PROGRESS - GOOD) * 100}%`, width: `${(GOOD * 2) * 100}%` }} />
                    <div className="absolute top-0 h-[3px] bg-amber-400/70"
                         style={{ left: `${(CONTACT_PROGRESS - OKAY) * 100}%`, width: `${(OKAY * 2) * 100}%` }} />
                </>
            )}
            <div className="absolute top-[-6px] bottom-[-6px] w-[2px] bg-white/70" style={{ left: `${CONTACT_PROGRESS * 100}%` }} />
        </div>
    </div>
);
