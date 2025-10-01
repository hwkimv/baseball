#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ==================== BLE 설정 ====================
// UUID는 반드시 프론트엔드(useBleSwing) 코드와 동일하게 맞춰야 함
#define SERVICE_UUID           "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define CHARACTERISTIC_UUID_TX "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // Notify용
#define CHARACTERISTIC_UUID_RX "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // 수신용(선택)

// ==================== 센서 객체 ====================
Adafruit_MPU6050 mpu;

// ==================== BLE 객체 ====================
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool deviceConnected = false;

// ==================== 파라미터 (튜닝) ====================
// 필요에 따라 바꿔가며 조정
float SWING_THRESHOLD = 18.0;    // 스윙 감지 가속도 임계값 (m/s^2)
int   DEBOUNCE_MS = 300;         // 스윙 후 최소 대기시간 (ms)
unsigned long lastSwingTime = 0; // 마지막 스윙 기록 시간

// ==================== 콜백 ====================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("✅ BLE Connected");
  }
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("❌ BLE Disconnected");
    pServer->startAdvertising(); // 자동 재광고
  }
};

// ==================== 초기화 ====================
void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 Swing Sensor Start...");

  // I2C 센서 초기화
  if (!mpu.begin()) {
    Serial.println("❌ MPU6050 not found, check wiring!");
    while (1) delay(10);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // BLE 초기화
  BLEDevice::init("ESP32-SWING"); // 블루투스 이름
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_TX,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->addDescriptor(new BLE2902());

  // RX(선택) - 앱에서 설정값을 보내고 싶을 때 사용
  BLECharacteristic* pRxChar = pService->createCharacteristic(
    CHARACTERISTIC_UUID_RX,
    BLECharacteristic::PROPERTY_WRITE
  );
  pRxChar->setCallbacks(new BLECharacteristicCallbacks());

  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("📡 BLE Advertising Started...");
}

// ==================== 루프 ====================
void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // 👉 가속도 크기 계산 (벡터 크기 = sqrt(x²+y²+z²))
  float accelMag = sqrt(a.acceleration.x * a.acceleration.x +
                        a.acceleration.y * a.acceleration.y +
                        a.acceleration.z * a.acceleration.z);

  unsigned long now = millis();

  // 스윙 감지
  if (accelMag > SWING_THRESHOLD && (now - lastSwingTime) > DEBOUNCE_MS) {
    lastSwingTime = now;
    Serial.printf("SWING detected! accel=%.2f\n", accelMag);

    if (deviceConnected) {
      // BLE로 "SWING" 신호 전송
      pCharacteristic->setValue("SWING");
      pCharacteristic->notify();
    }
  }

  delay(10); // 센서 폴링 주기 (10ms ≈ 100Hz)
}
