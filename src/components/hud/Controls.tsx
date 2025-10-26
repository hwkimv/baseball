// src/components/hud/Controls.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Sparkles } from "lucide-react";

type BleShape = {
    supported: boolean;
    status: string;
    deviceName?: string | null;
    connect: () => void;
    disconnect: () => void;
};

type Props = {
    inPlay: boolean;
    startPitch: () => void;
    doSwing: () => void;
    resetAll: () => void;
    ble?: BleShape | null;
};

export const Controls: React.FC<Props> = ({ inPlay, startPitch, doSwing, resetAll, ble }) => (
    <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={startPitch} disabled={inPlay} className="rounded-2xl">
            <Play className="w-4 h-4 mr-2" /> 투구
        </Button>
        <Button variant="secondary" onClick={doSwing} disabled={!inPlay} className="rounded-2xl">
            <Sparkles className="w-4 h-4 mr-2" /> 스윙 (Space)
        </Button>
        <Button variant="outline" onClick={resetAll} className="rounded-2xl">
            <RotateCcw className="w-4 h-4 mr-2" /> 리셋
        </Button>

        {/* BLE 상태 */}
        {ble ? (
            ble.supported ? (
                <>
                    <Button
                        variant="outline"
                        onClick={ble.connect}
                        disabled={ble.status === "requesting" || ble.status === "connecting" || ble.status === "connected"}
                        className="rounded-2xl"
                    >
                        {ble.status === "requesting" || ble.status === "connecting" ? "BLE 연결 중..." : "ESP32 BLE 연결"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={ble.disconnect}
                        disabled={ble.status !== "connected"}
                        className="rounded-2xl"
                    >
                        BLE 해제
                    </Button>
                    <span className={`ml-2 text-xs px-2 py-1 rounded-full border ${
                        ble.status === "connected"
                            ? "bg-emerald-600/70 border-emerald-500 text-white"
                            : "bg-slate-700/80 border-slate-600 text-slate-200"
                    }`}>
            {ble.status}{ble.deviceName ? ` · ${ble.deviceName}` : ""}
          </span>
                </>
            ) : (
                <span className="ml-2 text-xs px-2 py-1 rounded-full border bg-red-700/70 border-red-600 text-white">
          Web Bluetooth 미지원
        </span>
            )
        ) : null}
    </div>
);
