#include <Arduino.h>

namespace {

constexpr uint8_t MOTOR1_DIR_PIN = 21;
constexpr uint8_t MOTOR1_PWM_PIN = 0;
constexpr uint8_t MOTOR2_DIR_PIN = 10;
constexpr uint8_t MOTOR2_PWM_PIN = 1;

constexpr uint8_t MOTOR1_PWM_CHANNEL = 0;
constexpr uint8_t MOTOR2_PWM_CHANNEL = 1;
constexpr uint32_t PWM_FREQUENCY_HZ = 1000;
constexpr uint8_t PWM_RESOLUTION_BITS = 8;
constexpr uint8_t TEST_DUTY = 115;  // 45% din 255
constexpr uint8_t REVERSE_TEST_DUTY = 252;  // aproximativ 99%
constexpr uint32_t RUN_TIME_MS = 1000;
constexpr uint32_t STOP_TIME_MS = 1000;
constexpr uint32_t DIRECTION_DEAD_TIME_MS = 250;
constexpr uint8_t RAMP_STEP = 8;
constexpr uint32_t RAMP_STEP_TIME_MS = 20;

bool testRunning = false;

void stopMotors() {
  ledcWrite(MOTOR1_PWM_CHANNEL, 0);
  ledcWrite(MOTOR2_PWM_CHANNEL, 0);
}

bool waitWithEmergencyStop(uint32_t durationMs) {
  const uint32_t startMs = millis();

  while (millis() - startMs < durationMs) {
    while (Serial.available() > 0) {
      const char command = static_cast<char>(Serial.read());
      if (command == 'X' || command == 'x') {
        stopMotors();
        Serial.println("STOP DE URGENTA");
        return false;
      }
    }
    delay(5);
  }

  return true;
}

bool runMotor(uint8_t motorNumber, bool forward, uint8_t targetDuty) {
  const uint8_t dirPin =
      motorNumber == 1 ? MOTOR1_DIR_PIN : MOTOR2_DIR_PIN;
  const uint8_t pwmChannel =
      motorNumber == 1 ? MOTOR1_PWM_CHANNEL : MOTOR2_PWM_CHANNEL;

  ledcWrite(pwmChannel, 0);
  if (!waitWithEmergencyStop(DIRECTION_DEAD_TIME_MS)) {
    return false;
  }

  digitalWrite(dirPin, forward ? HIGH : LOW);
  if (!waitWithEmergencyStop(DIRECTION_DEAD_TIME_MS)) {
    return false;
  }

  for (uint16_t duty = RAMP_STEP; duty < targetDuty; duty += RAMP_STEP) {
    ledcWrite(pwmChannel, static_cast<uint8_t>(duty));
    if (!waitWithEmergencyStop(RAMP_STEP_TIME_MS)) {
      return false;
    }
  }

  ledcWrite(pwmChannel, targetDuty);
  return true;
}

void runMotor1ReverseTest() {
  if (testRunning) {
    return;
  }

  testRunning = true;
  stopMotors();
  Serial.println("MOTOR1 INAPOI: 99%, 2 secunde");
  if (runMotor(1, false, REVERSE_TEST_DUTY)) {
    waitWithEmergencyStop(2000);
  }
  stopMotors();
  testRunning = false;
  Serial.println("MOTOR1 OPRIT");
}

void runMotorOutputMeasurement(uint8_t motorNumber, bool forward) {
  if (testRunning) {
    return;
  }

  testRunning = true;
  stopMotors();
  Serial.printf("MASURARE MOTOR%u %s: 99%%, 10 secunde\n", motorNumber,
                forward ? "INAINTE" : "INAPOI");

  if (runMotor(motorNumber, forward, REVERSE_TEST_DUTY)) {
    waitWithEmergencyStop(10000);
  }

  stopMotors();
  testRunning = false;
  Serial.printf("MASURARE TERMINATA - MOTOR%u OPRIT\n", motorNumber);
}

bool testOneMotor(uint8_t motorNumber) {
  Serial.printf("MOTOR%u INAINTE: 45%%, 1 secunda\n", motorNumber);
  if (!runMotor(motorNumber, true, TEST_DUTY)) {
    return false;
  }
  if (!waitWithEmergencyStop(RUN_TIME_MS)) {
    return false;
  }
  stopMotors();
  Serial.printf("MOTOR%u STOP\n", motorNumber);
  if (!waitWithEmergencyStop(STOP_TIME_MS)) {
    return false;
  }

  Serial.printf("MOTOR%u INAPOI: 45%%, 1 secunda\n", motorNumber);
  if (!runMotor(motorNumber, false, TEST_DUTY)) {
    return false;
  }
  if (!waitWithEmergencyStop(RUN_TIME_MS)) {
    return false;
  }
  stopMotors();
  Serial.printf("MOTOR%u STOP\n", motorNumber);
  return waitWithEmergencyStop(STOP_TIME_MS);
}

void runTest() {
  if (testRunning) {
    return;
  }

  testRunning = true;
  stopMotors();
  Serial.println("TEST PORNIT");

  if (!testOneMotor(1) || !testOneMotor(2)) {
    stopMotors();
    testRunning = false;
    Serial.println("TEST ANULAT - AMBELE MOTOARE OPRITE");
    return;
  }

  stopMotors();
  testRunning = false;
  Serial.println("TEST TERMINAT - AMBELE MOTOARE OPRITE");
}

void runMotor1Diagnostic() {
  if (testRunning) {
    return;
  }

  testRunning = true;
  stopMotors();
  Serial.println("DIAGNOSTIC MOTOR1 PORNIT");

  Serial.println("MOTOR1 INAINTE: 45%, 3 secunde");
  if (!runMotor(1, true, TEST_DUTY)) {
    stopMotors();
    testRunning = false;
    Serial.println("DIAGNOSTIC ANULAT");
    return;
  }
  if (!waitWithEmergencyStop(3000)) {
    stopMotors();
    testRunning = false;
    Serial.println("DIAGNOSTIC ANULAT");
    return;
  }

  stopMotors();
  Serial.println("MOTOR1 STOP");
  if (!waitWithEmergencyStop(2000)) {
    stopMotors();
    testRunning = false;
    Serial.println("DIAGNOSTIC ANULAT");
    return;
  }

  Serial.println("MOTOR1 INAPOI: 45%, 3 secunde");
  if (!runMotor(1, false, TEST_DUTY)) {
    stopMotors();
    testRunning = false;
    Serial.println("DIAGNOSTIC ANULAT");
    return;
  }
  if (!waitWithEmergencyStop(3000)) {
    stopMotors();
    testRunning = false;
    Serial.println("DIAGNOSTIC ANULAT");
    return;
  }

  stopMotors();
  testRunning = false;
  Serial.println("DIAGNOSTIC MOTOR1 TERMINAT - MOTOARE OPRITE");
}

void runMotor2Diagnostic() {
  if (testRunning) {
    return;
  }

  testRunning = true;
  stopMotors();
  Serial.println("DIAGNOSTIC MOTOR2 PORNIT");

  Serial.println("MOTOR2 INAINTE: 45%, 3 secunde");
  if (!runMotor(2, true, TEST_DUTY) ||
      !waitWithEmergencyStop(3000)) {
    stopMotors();
    testRunning = false;
    Serial.println("DIAGNOSTIC ANULAT");
    return;
  }

  stopMotors();
  Serial.println("MOTOR2 STOP");
  if (!waitWithEmergencyStop(2000)) {
    stopMotors();
    testRunning = false;
    Serial.println("DIAGNOSTIC ANULAT");
    return;
  }

  Serial.println("MOTOR2 INAPOI: 45%, 3 secunde");
  if (!runMotor(2, false, TEST_DUTY) ||
      !waitWithEmergencyStop(3000)) {
    stopMotors();
    testRunning = false;
    Serial.println("DIAGNOSTIC ANULAT");
    return;
  }

  stopMotors();
  testRunning = false;
  Serial.println("DIAGNOSTIC MOTOR2 TERMINAT - MOTOARE OPRITE");
}

}  // namespace

void setup() {
  // Menține PWM la zero încă din primele momente după pornire.
  pinMode(MOTOR1_PWM_PIN, OUTPUT);
  pinMode(MOTOR2_PWM_PIN, OUTPUT);
  digitalWrite(MOTOR1_PWM_PIN, LOW);
  digitalWrite(MOTOR2_PWM_PIN, LOW);

  pinMode(MOTOR1_DIR_PIN, OUTPUT);
  pinMode(MOTOR2_DIR_PIN, OUTPUT);
  digitalWrite(MOTOR1_DIR_PIN, LOW);
  digitalWrite(MOTOR2_DIR_PIN, LOW);

  ledcSetup(MOTOR1_PWM_CHANNEL, PWM_FREQUENCY_HZ, PWM_RESOLUTION_BITS);
  ledcSetup(MOTOR2_PWM_CHANNEL, PWM_FREQUENCY_HZ, PWM_RESOLUTION_BITS);
  ledcAttachPin(MOTOR1_PWM_PIN, MOTOR1_PWM_CHANNEL);
  ledcAttachPin(MOTOR2_PWM_PIN, MOTOR2_PWM_CHANNEL);
  stopMotors();

  Serial.begin(115200);
  delay(1500);
  Serial.println();
  Serial.println("BESTEP ESP32-C3 READY");
  Serial.println("1/2=diag motor | F/B=masurare M1 | 3/4=masurare M2 | L/H=DIR1 | X=stop");
}

void loop() {
  while (Serial.available() > 0) {
    const char command = static_cast<char>(Serial.read());

    if (command == 'X' || command == 'x') {
      stopMotors();
      Serial.println("STOP DE URGENTA");
    } else if (command == 'T' || command == 't') {
      runTest();
    } else if (command == '1') {
      runMotor1Diagnostic();
    } else if (command == '2') {
      runMotor2Diagnostic();
    } else if (command == 'R' || command == 'r') {
      runMotor1ReverseTest();
    } else if (command == 'F' || command == 'f') {
      runMotorOutputMeasurement(1, true);
    } else if (command == 'B' || command == 'b') {
      runMotorOutputMeasurement(1, false);
    } else if (command == '3') {
      runMotorOutputMeasurement(2, true);
    } else if (command == '4') {
      runMotorOutputMeasurement(2, false);
    } else if (command == 'L' || command == 'l') {
      stopMotors();
      digitalWrite(MOTOR1_DIR_PIN, LOW);
      Serial.println("DIR1 = LOW (aprox. 0 V), PWM1 = 0");
    } else if (command == 'H' || command == 'h') {
      stopMotors();
      digitalWrite(MOTOR1_DIR_PIN, HIGH);
      Serial.println("DIR1 = HIGH (aprox. 3.3 V), PWM1 = 0");
    }
  }

  delay(5);
}
