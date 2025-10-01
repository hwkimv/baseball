/**
 * Web Bluetooth(BLE)로 ESP32가 notify하는 "SWING" 신호를 받아
 * onSwing()을 호출하는 React 훅.
 *
 * - HTTPS(또는 localhost) + 사용자 제스처에서만 연결 가능
 * - ESP32는 지정한 Service/Characteristic UUID에 대해 notify 전송
 * - 페이로드는 TextEncoder로 인코딩된 "SWING\n" 같은 텍스트라고 가정
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type BleStatus =
    | "unsupported"
    | "idle"
    | "requesting"
    | "connecting"
    | "connected"
    | "disconnected"
    | "error";

export interface UseBleSwingOptions {
    /** GATT Service UUID (예: Nordic UART Service) */
    serviceUUID: BluetoothServiceUUID;
    /** Notify를 받을 Characteristic UUID (예: NUS의 TX) */
    characteristicUUID: BluetoothCharacteristicUUID;
    /** 디바이스 검색 필터 (선택, namePrefix 등) */
    filters?: BluetoothLEScanFilter[];
    /** SWING 토큰 문자열 (기본 "SWING") */
    swingToken?: string;
    /** 연속 스윙 디바운스(ms) (기본 250) */
    debounceMs?: number;
    /** 콘솔 로그 */
    verbose?: boolean;
}

export function useBleSwing(onSwing: () => void, opts: UseBleSwingOptions) {
    const {
        serviceUUID,
        characteristicUUID,
        filters,
        swingToken = "SWING",
        debounceMs = 250,
        verbose = false,
    } = opts;

    const [status, setStatus] = useState<BleStatus>(() =>
        typeof navigator !== "undefined" && "bluetooth" in navigator ? "idle" : "unsupported"
    );
    const [error, setError] = useState<string | null>(null);
    const [deviceName, setDeviceName] = useState<string>("");
    const [lastMessage, setLastMessage] = useState<string>("");

    const deviceRef = useRef<BluetoothDevice | null>(null);
    const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
    const lastSwingAtRef = useRef<number>(0);

    const log = (...a: any[]) => verbose && console.log("[ble]", ...a);

    const handleNotify = useCallback((ev: Event) => {
        const c = ev.target as BluetoothRemoteGATTCharacteristic;
        const v = c.value;
        if (!v) return;

        // 수신 버퍼 → 문자열
        const bytes = new Uint8Array(v.buffer);
        const text = new TextDecoder().decode(bytes).trim();
        setLastMessage(text);
        log("RX:", text);

        if (text.toUpperCase().includes(swingToken.toUpperCase())) {
            const now = performance.now();
            if (now - lastSwingAtRef.current >= debounceMs) {
                lastSwingAtRef.current = now;
                onSwing();
            } else {
                log("debounced swing");
            }
        }
    }, [debounceMs, onSwing, swingToken]);

    const connect = useCallback(async () => {
        if (!("bluetooth" in navigator)) {
            setStatus("unsupported");
            return;
        }
        setError(null);
        setStatus("requesting");
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: filters && filters.length ? filters : undefined,
                optionalServices: [serviceUUID], // 서비스 UUID는 반드시 포함
                acceptAllDevices: !filters || filters.length === 0,
            });

            deviceRef.current = device;
            setDeviceName(device.name ?? "ESP32");

            // 연결
            setStatus("connecting");
            const server = await device.gatt!.connect();
            const service = await server.getPrimaryService(serviceUUID);
            const char = await service.getCharacteristic(characteristicUUID);
            charRef.current = char;

            // notify 수신
            await char.startNotifications();
            char.addEventListener("characteristicvaluechanged", handleNotify);

            // 연결 끊김 핸들러
            device.addEventListener("gattserverdisconnected", () => {
                setStatus("disconnected");
                log("disconnected");
            });

            setStatus("connected");
            log("connected:", device.name);
        } catch (e: any) {
            setError(String(e?.message ?? e));
            setStatus("error");
            log("connect error:", e);
        }
    }, [filters, serviceUUID, characteristicUUID, handleNotify, log]);

    const disconnect = useCallback(async () => {
        setError(null);
        try {
            const d = deviceRef.current;
            const c = charRef.current;
            if (c) {
                try { await c.stopNotifications(); } catch {}
                c.removeEventListener("characteristicvaluechanged", handleNotify);
            }
            if (d?.gatt?.connected) d.gatt.disconnect();
            charRef.current = null;
            deviceRef.current = null;
            setStatus("disconnected");
            log("closed");
        } catch (e: any) {
            setError(String(e?.message ?? e));
            setStatus("error");
            log("disconnect error:", e);
        }
    }, [handleNotify, log]);

    // 언마운트 클린업
    useEffect(() => {
        return () => { disconnect().catch(() => {}); };
    }, [disconnect]);

    return useMemo(() => ({
        status, error, deviceName, lastMessage, connect, disconnect,
        supported: typeof navigator !== "undefined" && "bluetooth" in navigator,
    }), [status, error, deviceName, lastMessage, connect, disconnect]);
}
