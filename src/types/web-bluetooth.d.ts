// 최소 Web Bluetooth 타입 선언 (필요한 것만)
// 브라우저 지원 런타임을 전제로 컴파일 오류만 제거합니다.

type BluetoothServiceUUID = number | string;
type BluetoothCharacteristicUUID = number | string;

interface BluetoothLEScanFilter {
    services?: BluetoothServiceUUID[];
    name?: string;
    namePrefix?: string;
    // 필요하면 manufacturerData/serviceData 추가
}

interface BluetoothRemoteGATTServer {
    readonly connected: boolean;
    device: BluetoothDevice;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    uuid: string;
    value?: DataView;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    writeValue(data: BufferSource): Promise<void>;
    addEventListener(
        type: "characteristicvaluechanged",
        listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => any
    ): void;
    removeEventListener(
        type: "characteristicvaluechanged",
        listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => any
    ): void;
}

interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
}

interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[];
    optionalServices?: BluetoothServiceUUID[];
    acceptAllDevices?: boolean;
}

interface Bluetooth {
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
    bluetooth: Bluetooth;
}
