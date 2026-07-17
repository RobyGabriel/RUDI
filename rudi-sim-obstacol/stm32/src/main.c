/* RUDI — simulare livrare cu evitare de obstacol (STM32F769I-DISCO)
 *
 * Cablaj (header Arduino) — vezi README:
 *   Driver motoare: PWM1=D3(PF6,TIM10_CH1) DIR1=D4(PJ0)
 *                   PWM2=D6(PF7,TIM11_CH1) DIR2=D7(PJ3), +5V, GND
 *   HC-SR04:  TRIG=D2(PJ1), ECHO=D5(PC8, divizor 1k/2k), VCC=5V
 *   MPU6050:  SCL=D15(PB8), SDA=D14(PB9), VCC=3V3
 *   RC522:    SCK=D13(PA12) MISO=D12(PB14) MOSI=D11(PB15)
 *             CS=D10(PA11) RST=D8(PJ4), VCC=3V3
 *   ESP32:    D0(PC7)=RX <- ESP GPIO4(TX), D1(PC6)=TX -> ESP GPIO5(RX)
 *
 * Comenzi (text + newline, pe USART6/ESP sau pe consola ST-Link):
 *   DEMO - misiune ghidata: mers -> operatorul pune obstacol -> stop ->
 *          ocolire cu giroscop -> sosire -> confirmare RFID
 *   GO   - la fel ca DEMO dar fara mesajele de ghidare pas cu pas
 *   MOT  - puls scurt ambele motoare inainte (verificare sens)
 *   S    - status senzori o singura data
 *   X    - STOP DE URGENTA (functioneaza oricand)
 */

#include "stm32f7xx_hal.h"
#include "rc522.h"
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

/* ================= CONFIG (de ajustat la nevoie) ================= */
#define CRUISE_DUTY 450        /* 45% din 1000 — mers normal */
#define TURN_DUTY 400          /* 40% — viraje pe loc */
#define RAMP_STEP 40           /* pas rampa (din 1000) la fiecare 20 ms */
#define OBSTACLE_STOP_CM 25    /* sub atat = obstacol, oprire */
#define AVOID_TURN_DEG 80.0f   /* unghi viraj ocolire */
#define BYPASS_DRIVE_MS 1500   /* avans lateral in timpul ocolirii */
#define FINAL_DRIVE_MS 3000    /* mers dupa ocolire pana la "destinatie" */
#define OBSTACLE_WAIT_MS 60000 /* cat astept obstacolul in DEMO */
#define RFID_WAIT_MS 60000     /* cat astept scanarea la sosire */
#define TURN_TIMEOUT_MS 5000   /* limita de siguranta pentru un viraj */

/* Sensuri — daca robotul merge invers la comanda MOT, schimba 1<->0.
   Daca virajul "dreapta" iese stanga, schimba TURN_RIGHT_SIGN in -1. */
#define M1_DIR_FORWARD 1 /* nivel pe DIR1 pentru "inainte" */
#define M2_DIR_FORWARD 1
#define TURN_RIGHT_SIGN 1
/* ================================================================== */

#define TRIG_PORT GPIOJ
#define TRIG_PIN GPIO_PIN_1
#define ECHO_PORT GPIOC
#define ECHO_PIN GPIO_PIN_8

#define MPU_ADDR (0x68 << 1)

static UART_HandleTypeDef huart1; /* consola ST-Link */
static UART_HandleTypeDef huart6; /* legatura ESP32  */
static I2C_HandleTypeDef hi2c1;
static SPI_HandleTypeDef hspi2;
static TIM_HandleTypeDef htim10;
static TIM_HandleTypeDef htim11;
static rc522_t rfid;

static bool mpu_ok = false;
static float gyro_bias_z = 0.0f;
static volatile bool estop = false;

/* ---------- iesire pe AMBELE seriale ---------- */
static void print_both(const char *fmt, ...) {
  char buf[160];
  va_list ap;
  va_start(ap, fmt);
  int n = vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  if (n < 0) {
    return;
  }
  if (n > (int)sizeof(buf) - 1) {
    n = sizeof(buf) - 1;
  }
  HAL_UART_Transmit(&huart1, (uint8_t *)buf, (uint16_t)n, 50);
  HAL_UART_Transmit(&huart6, (uint8_t *)buf, (uint16_t)n, 50);
}

int __io_putchar(int ch) {
  uint8_t c = (uint8_t)ch;
  HAL_UART_Transmit(&huart1, &c, 1, 10);
  return ch;
}

/* ---------- ceas 216 MHz ---------- */
static void SystemClock_Config(void) {
  RCC_OscInitTypeDef osc = {0};
  RCC_ClkInitTypeDef clk = {0};
  __HAL_RCC_PWR_CLK_ENABLE();
  __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);
  osc.OscillatorType = RCC_OSCILLATORTYPE_HSE | RCC_OSCILLATORTYPE_HSI;
  osc.HSEState = RCC_HSE_ON;
  osc.HSIState = RCC_HSI_ON;
  osc.PLL.PLLState = RCC_PLL_ON;
  osc.PLL.PLLSource = RCC_PLLSOURCE_HSE;
  osc.PLL.PLLM = 25;
  osc.PLL.PLLN = 432;
  osc.PLL.PLLP = RCC_PLLP_DIV2;
  osc.PLL.PLLQ = 9;
  if (HAL_RCC_OscConfig(&osc) != HAL_OK) {
    for (;;) {
    }
  }
  HAL_PWREx_EnableOverDrive();
  clk.ClockType = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK |
                  RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
  clk.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  clk.AHBCLKDivider = RCC_SYSCLK_DIV1;
  clk.APB1CLKDivider = RCC_HCLK_DIV4;
  clk.APB2CLKDivider = RCC_HCLK_DIV2;
  if (HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_7) != HAL_OK) {
    for (;;) {
    }
  }
}

/* ---------- microsecunde pe DWT ---------- */
static void dwt_init(void) {
  CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
  DWT->LAR = 0xC5ACCE55;
  DWT->CYCCNT = 0;
  DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;
}
static inline uint32_t micros(void) {
  return DWT->CYCCNT / (SystemCoreClock / 1000000U);
}
static inline void delay_us(uint32_t us) {
  uint32_t s = DWT->CYCCNT, t = us * (SystemCoreClock / 1000000U);
  while (DWT->CYCCNT - s < t) {
  }
}

/* ---------- GPIO + periferice ---------- */
static void gpio_init(void) {
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_GPIOB_CLK_ENABLE();
  __HAL_RCC_GPIOC_CLK_ENABLE();
  __HAL_RCC_GPIOF_CLK_ENABLE();
  __HAL_RCC_GPIOJ_CLK_ENABLE();

  GPIO_InitTypeDef g = {0};

  /* USART1 PA9/PA10 (VCP) */
  g.Pin = GPIO_PIN_9 | GPIO_PIN_10;
  g.Mode = GPIO_MODE_AF_PP;
  g.Pull = GPIO_PULLUP;
  g.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
  g.Alternate = GPIO_AF7_USART1;
  HAL_GPIO_Init(GPIOA, &g);

  /* USART6 PC6 TX / PC7 RX (ESP32) */
  g.Pin = GPIO_PIN_6 | GPIO_PIN_7;
  g.Alternate = GPIO_AF8_USART6;
  HAL_GPIO_Init(GPIOC, &g);

  /* I2C1 PB8/PB9 */
  g.Pin = GPIO_PIN_8 | GPIO_PIN_9;
  g.Mode = GPIO_MODE_AF_OD;
  g.Pull = GPIO_NOPULL;
  g.Speed = GPIO_SPEED_FREQ_HIGH;
  g.Alternate = GPIO_AF4_I2C1;
  HAL_GPIO_Init(GPIOB, &g);

  /* SPI2 PB14/PB15 + PA12 */
  g.Pin = GPIO_PIN_14 | GPIO_PIN_15;
  g.Mode = GPIO_MODE_AF_PP;
  g.Alternate = GPIO_AF5_SPI2;
  HAL_GPIO_Init(GPIOB, &g);
  g.Pin = GPIO_PIN_12;
  HAL_GPIO_Init(GPIOA, &g);

  /* PWM: PF6 TIM10_CH1, PF7 TIM11_CH1 */
  g.Pin = GPIO_PIN_6;
  g.Mode = GPIO_MODE_AF_PP;
  g.Alternate = GPIO_AF3_TIM10;
  HAL_GPIO_Init(GPIOF, &g);
  g.Pin = GPIO_PIN_7;
  g.Alternate = GPIO_AF3_TIM11;
  HAL_GPIO_Init(GPIOF, &g);

  /* Iesiri: CS RC522 (PA11), RST RC522 (PJ4), TRIG (PJ1), DIR1 (PJ0), DIR2 (PJ3) */
  g.Mode = GPIO_MODE_OUTPUT_PP;
  g.Pull = GPIO_NOPULL;
  g.Speed = GPIO_SPEED_FREQ_HIGH;
  g.Pin = GPIO_PIN_11;
  HAL_GPIO_Init(GPIOA, &g);
  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_11, GPIO_PIN_SET);
  g.Pin = GPIO_PIN_4 | GPIO_PIN_1 | GPIO_PIN_0 | GPIO_PIN_3;
  HAL_GPIO_Init(GPIOJ, &g);
  HAL_GPIO_WritePin(GPIOJ, GPIO_PIN_4, GPIO_PIN_SET);
  HAL_GPIO_WritePin(GPIOJ, GPIO_PIN_1 | GPIO_PIN_0 | GPIO_PIN_3,
                    GPIO_PIN_RESET);

  /* ECHO PC8 intrare */
  g.Pin = ECHO_PIN;
  g.Mode = GPIO_MODE_INPUT;
  HAL_GPIO_Init(ECHO_PORT, &g);
}

static void uart_init_one(UART_HandleTypeDef *h, USART_TypeDef *inst) {
  h->Instance = inst;
  h->Init.BaudRate = 115200;
  h->Init.WordLength = UART_WORDLENGTH_8B;
  h->Init.StopBits = UART_STOPBITS_1;
  h->Init.Parity = UART_PARITY_NONE;
  h->Init.Mode = UART_MODE_TX_RX;
  h->Init.HwFlowCtl = UART_HWCONTROL_NONE;
  h->Init.OverSampling = UART_OVERSAMPLING_16;
  HAL_UART_Init(h);
}

static void periph_init(void) {
  __HAL_RCC_USART1_CLK_ENABLE();
  __HAL_RCC_USART6_CLK_ENABLE();
  uart_init_one(&huart1, USART1);
  uart_init_one(&huart6, USART6);
  /* receptie pe intreruperi */
  HAL_NVIC_SetPriority(USART1_IRQn, 5, 0);
  HAL_NVIC_EnableIRQ(USART1_IRQn);
  HAL_NVIC_SetPriority(USART6_IRQn, 5, 0);
  HAL_NVIC_EnableIRQ(USART6_IRQn);
  SET_BIT(USART1->CR1, USART_CR1_RXNEIE);
  SET_BIT(USART6->CR1, USART_CR1_RXNEIE);

  __HAL_RCC_I2C1_CONFIG(RCC_I2C1CLKSOURCE_HSI);
  __HAL_RCC_I2C1_CLK_ENABLE();
  hi2c1.Instance = I2C1;
  hi2c1.Init.Timing = 0x30420F13;
  hi2c1.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  HAL_I2C_Init(&hi2c1);

  __HAL_RCC_SPI2_CLK_ENABLE();
  hspi2.Instance = SPI2;
  hspi2.Init.Mode = SPI_MODE_MASTER;
  hspi2.Init.Direction = SPI_DIRECTION_2LINES;
  hspi2.Init.DataSize = SPI_DATASIZE_8BIT;
  hspi2.Init.CLKPolarity = SPI_POLARITY_LOW;
  hspi2.Init.CLKPhase = SPI_PHASE_1EDGE;
  hspi2.Init.NSS = SPI_NSS_SOFT;
  hspi2.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_16;
  hspi2.Init.FirstBit = SPI_FIRSTBIT_MSB;
  HAL_SPI_Init(&hspi2);

  /* TIM10/TIM11: PWM 1 kHz, rezolutie 1000 (ceas timere APB2 = 216 MHz) */
  __HAL_RCC_TIM10_CLK_ENABLE();
  __HAL_RCC_TIM11_CLK_ENABLE();
  TIM_OC_InitTypeDef oc = {0};
  oc.OCMode = TIM_OCMODE_PWM1;
  oc.Pulse = 0;
  oc.OCPolarity = TIM_OCPOLARITY_HIGH;

  htim10.Instance = TIM10;
  htim10.Init.Prescaler = 215;
  htim10.Init.CounterMode = TIM_COUNTERMODE_UP;
  htim10.Init.Period = 999;
  HAL_TIM_PWM_Init(&htim10);
  HAL_TIM_PWM_ConfigChannel(&htim10, &oc, TIM_CHANNEL_1);
  HAL_TIM_PWM_Start(&htim10, TIM_CHANNEL_1);

  htim11.Instance = TIM11;
  htim11.Init.Prescaler = 215;
  htim11.Init.CounterMode = TIM_COUNTERMODE_UP;
  htim11.Init.Period = 999;
  HAL_TIM_PWM_Init(&htim11);
  HAL_TIM_PWM_ConfigChannel(&htim11, &oc, TIM_CHANNEL_1);
  HAL_TIM_PWM_Start(&htim11, TIM_CHANNEL_1);
}

/* ---------- motoare ---------- */
static void motor_set(int motor, int forward, uint32_t duty) {
  if (duty > 999) {
    duty = 999;
  }
  if (motor == 1) {
    int level = forward ? M1_DIR_FORWARD : !M1_DIR_FORWARD;
    HAL_GPIO_WritePin(GPIOJ, GPIO_PIN_0,
                      level ? GPIO_PIN_SET : GPIO_PIN_RESET);
    __HAL_TIM_SET_COMPARE(&htim10, TIM_CHANNEL_1, duty);
  } else {
    int level = forward ? M2_DIR_FORWARD : !M2_DIR_FORWARD;
    HAL_GPIO_WritePin(GPIOJ, GPIO_PIN_3,
                      level ? GPIO_PIN_SET : GPIO_PIN_RESET);
    __HAL_TIM_SET_COMPARE(&htim11, TIM_CHANNEL_1, duty);
  }
}

static void motors_stop(void) {
  __HAL_TIM_SET_COMPARE(&htim10, TIM_CHANNEL_1, 0);
  __HAL_TIM_SET_COMPARE(&htim11, TIM_CHANNEL_1, 0);
}

/* ---------- senzori (ca in testul validat) ---------- */
static bool mpu_write(uint8_t reg, uint8_t val) {
  return HAL_I2C_Mem_Write(&hi2c1, MPU_ADDR, reg, 1, &val, 1, 100) == HAL_OK;
}
static bool mpu_read(uint8_t reg, uint8_t *buf, uint16_t len) {
  return HAL_I2C_Mem_Read(&hi2c1, MPU_ADDR, reg, 1, buf, len, 100) == HAL_OK;
}
static bool mpu_read_gz_raw(int16_t *out) {
  uint8_t b[2];
  if (!mpu_read(0x47, b, 2)) {
    return false;
  }
  *out = (int16_t)((b[0] << 8) | b[1]);
  return true;
}
static float mpu_gz_dps(void) {
  int16_t raw;
  if (!mpu_read_gz_raw(&raw)) {
    return 0.0f;
  }
  return ((float)raw - gyro_bias_z) / 131.0f;
}

static void mpu_init(void) {
  uint8_t who = 0;
  if (!mpu_read(0x75, &who, 1)) {
    print_both("MPU6050: absent!\r\n");
    return;
  }
  mpu_write(0x6B, 0x00);
  HAL_Delay(50);
  mpu_write(0x1A, 0x03);
  mpu_write(0x1B, 0x00);
  HAL_Delay(50);
  int32_t sum = 0;
  int good = 0;
  for (int i = 0; i < 200; i++) {
    int16_t raw;
    if (mpu_read_gz_raw(&raw)) {
      sum += raw;
      good++;
    }
    HAL_Delay(2);
  }
  if (good > 100) {
    gyro_bias_z = (float)sum / (float)good;
    mpu_ok = true;
  }
  print_both("MPU6050: WHO_AM_I=0x%02X, bias=%.1f, %s\r\n", who, gyro_bias_z,
             mpu_ok ? "OK" : "EROARE CALIBRARE");
}

static int32_t hcsr04_mm(void) {
  HAL_GPIO_WritePin(TRIG_PORT, TRIG_PIN, GPIO_PIN_SET);
  delay_us(10);
  HAL_GPIO_WritePin(TRIG_PORT, TRIG_PIN, GPIO_PIN_RESET);
  uint32_t t0 = micros();
  while (HAL_GPIO_ReadPin(ECHO_PORT, ECHO_PIN) == GPIO_PIN_RESET) {
    if (micros() - t0 > 30000) {
      return -1;
    }
  }
  uint32_t rise = micros();
  while (HAL_GPIO_ReadPin(ECHO_PORT, ECHO_PIN) == GPIO_PIN_SET) {
    if (micros() - rise > 30000) {
      return -1;
    }
  }
  return (int32_t)((micros() - rise) * 10 / 58);
}

/* mediana pe 3 masuratori rapide, robusta la un outlier */
static int32_t distance_mm(void) {
  int32_t a = hcsr04_mm();
  HAL_Delay(15);
  int32_t b = hcsr04_mm();
  HAL_Delay(15);
  int32_t c = hcsr04_mm();
  if (a < 0 && b < 0 && c < 0) {
    return -1;
  }
  /* inlocuieste timeout-urile cu o valoare mare, apoi mediana */
  int32_t big = 999999;
  int32_t x = a < 0 ? big : a, y = b < 0 ? big : b, z = c < 0 ? big : c;
  int32_t lo = x < y ? (x < z ? x : z) : (y < z ? y : z);
  int32_t hi = x > y ? (x > z ? x : z) : (y > z ? y : z);
  int32_t med = x + y + z - lo - hi;
  return med == big ? -1 : med;
}

/* ---------- intrare seriala pe intreruperi (USART-urile F7 nu au FIFO;
   polling-ul pierdea al doilea octet din rafala prin overrun) ---------- */
#define RB_SIZE 128
static volatile uint8_t rb1_buf[RB_SIZE], rb6_buf[RB_SIZE];
static volatile uint8_t rb1_head = 0, rb1_tail = 0;
static volatile uint8_t rb6_head = 0, rb6_tail = 0;

void USART1_IRQHandler(void) {
  if (USART1->ISR & USART_ISR_RXNE) {
    uint8_t c = (uint8_t)USART1->RDR;
    uint8_t next = (uint8_t)((rb1_head + 1) % RB_SIZE);
    if (next != rb1_tail) {
      rb1_buf[rb1_head] = c;
      rb1_head = next;
    }
  }
  USART1->ICR = USART_ICR_ORECF | USART_ICR_FECF | USART_ICR_NCF;
}

void USART6_IRQHandler(void) {
  if (USART6->ISR & USART_ISR_RXNE) {
    uint8_t c = (uint8_t)USART6->RDR;
    uint8_t next = (uint8_t)((rb6_head + 1) % RB_SIZE);
    if (next != rb6_tail) {
      rb6_buf[rb6_head] = c;
      rb6_head = next;
    }
  }
  USART6->ICR = USART_ICR_ORECF | USART_ICR_FECF | USART_ICR_NCF;
}

static bool rb1_pop(uint8_t *out) {
  if (rb1_head == rb1_tail) {
    return false;
  }
  *out = rb1_buf[rb1_tail];
  rb1_tail = (uint8_t)((rb1_tail + 1) % RB_SIZE);
  return true;
}

static bool rb6_pop(uint8_t *out) {
  if (rb6_head == rb6_tail) {
    return false;
  }
  *out = rb6_buf[rb6_tail];
  rb6_tail = (uint8_t)((rb6_tail + 1) % RB_SIZE);
  return true;
}

static char line1[32], line6[32];
static int len1 = 0, len6 = 0;

static const char *poll_uart(UART_HandleTypeDef *h, char *line, int *len) {
  uint8_t c;
  bool is_vcp = (h == &huart1);
  while (is_vcp ? rb1_pop(&c) : rb6_pop(&c)) {
    if (c == '\r' || c == '\n') {
      if (*len > 0) {
        line[*len] = 0;
        *len = 0;
        return line;
      }
    } else if (*len < 31) {
      line[(*len)++] = (char)(c >= 'a' && c <= 'z' ? c - 32 : c);
    }
  }
  return NULL;
}

/* Intoarce comanda completa (linie) daca exista, de pe oricare port. */
static const char *poll_command(void) {
  const char *cmd = poll_uart(&huart1, line1, &len1);
  if (cmd) {
    return cmd;
  }
  return poll_uart(&huart6, line6, &len6);
}

/* Verifica X/STOP; de apelat des in orice bucla activa. */
static bool check_estop(void) {
  const char *cmd = poll_command();
  if (cmd && (strcmp(cmd, "X") == 0 || strcmp(cmd, "STOP") == 0)) {
    motors_stop();
    estop = true;
    print_both("STOP DE URGENTA\r\n");
    return true;
  }
  return false;
}

/* asteptare cu estop; intoarce false daca s-a cerut oprirea */
static bool wait_ms(uint32_t ms) {
  uint32_t start = HAL_GetTick();
  while (HAL_GetTick() - start < ms) {
    if (check_estop()) {
      return false;
    }
    HAL_Delay(5);
  }
  return true;
}

/* rampa ambelor motoare la duty tinta, inainte */
static bool ramp_forward(uint32_t target) {
  for (uint32_t d = RAMP_STEP; d < target; d += RAMP_STEP) {
    motor_set(1, 1, d);
    motor_set(2, 1, d);
    if (!wait_ms(20)) {
      return false;
    }
  }
  motor_set(1, 1, target);
  motor_set(2, 1, target);
  return true;
}

/* viraj pe loc cu integrarea giroscopului; sign: +1 dreapta, -1 stanga */
static bool gyro_turn(float degrees, int sign) {
  sign *= TURN_RIGHT_SIGN;
  float angle = 0.0f;
  uint32_t last = HAL_GetTick();
  uint32_t start = last;

  motor_set(1, sign > 0 ? 1 : 0, TURN_DUTY);
  motor_set(2, sign > 0 ? 0 : 1, TURN_DUTY);

  while (HAL_GetTick() - start < TURN_TIMEOUT_MS) {
    if (check_estop()) {
      return false;
    }
    HAL_Delay(5);
    uint32_t now = HAL_GetTick();
    float dt = (float)(now - last) / 1000.0f;
    last = now;
    if (mpu_ok) {
      float gz = mpu_gz_dps();
      angle += gz * dt;
      if (angle < 0) {
        /* lucram cu modulul */
      }
      float a = angle < 0 ? -angle : angle;
      if (a >= degrees) {
        break;
      }
    } else if (now - start > 900) {
      break; /* fara giroscop: viraj pe timp, ~0.9 s */
    }
  }
  motors_stop();
  print_both("VIRAJ: %+.1f grade masurate\r\n", (double)angle);
  return wait_ms(300);
}

/* mers inainte cu supraveghere HC-SR04; se opreste la obstacol sau dupa ms.
   Intoarce: 1=parcurs complet, 0=obstacol intalnit, -1=estop */
static int drive_forward_watch(uint32_t ms, bool stop_on_obstacle) {
  if (!ramp_forward(CRUISE_DUTY)) {
    return -1;
  }
  uint32_t start = HAL_GetTick();
  while (ms == 0 || HAL_GetTick() - start < ms) {
    if (check_estop()) {
      return -1;
    }
    int32_t mm = distance_mm();
    if (stop_on_obstacle && mm >= 0 && mm < OBSTACLE_STOP_CM * 10) {
      motors_stop();
      print_both("OBSTACOL la %ld.%ld cm — STOP!\r\n", mm / 10, mm % 10);
      return 0;
    }
    HAL_Delay(20);
  }
  motors_stop();
  return 1;
}

/* ---------- misiunea ---------- */
static void mission(bool guided) {
  estop = false;
  print_both("\r\n=== MISIUNE PORNITA (%s) ===\r\n",
             guided ? "DEMO ghidat" : "GO");

  if (guided) {
    print_both(">>> Robotul porneste inainte la %d%%.\r\n", CRUISE_DUTY / 10);
    print_both(">>> OPERATOR: cand vrei, PUNE UN OBIECT la sub %d cm in fata "
               "senzorului ultrasonic!\r\n",
               OBSTACLE_STOP_CM);
  }

  /* Faza 1: mers pana la obstacol (sau timeout) */
  uint32_t phase_start = HAL_GetTick();
  int r = drive_forward_watch(OBSTACLE_WAIT_MS, true);
  if (r < 0) {
    return;
  }
  if (r == 1) {
    print_both("Nu a aparut niciun obstacol in %lu s — misiune anulata.\r\n",
               (unsigned long)(OBSTACLE_WAIT_MS / 1000));
    return;
  }
  (void)phase_start;

  if (!wait_ms(800)) {
    return;
  }

  /* Faza 2: ocolire — dreapta, avans, stanga, revenire pe traseu */
  if (guided) {
    print_both(">>> Ocolesc obstacolul: viraj dreapta ~%.0f grade...\r\n",
               (double)AVOID_TURN_DEG);
  }
  if (!gyro_turn(AVOID_TURN_DEG, +1)) {
    return;
  }

  if (guided) {
    print_both(">>> Avansez pe langa obstacol...\r\n");
  }
  r = drive_forward_watch(BYPASS_DRIVE_MS, false);
  if (r < 0) {
    return;
  }
  if (!wait_ms(300)) {
    return;
  }

  if (guided) {
    print_both(">>> Viraj stanga ~%.0f grade — revin pe directia initiala.\r\n",
               (double)AVOID_TURN_DEG);
  }
  if (!gyro_turn(AVOID_TURN_DEG, -1)) {
    return;
  }

  /* Faza 3: ultimii metri pana la destinatie */
  if (guided) {
    print_both(">>> Continui spre destinatie...\r\n");
  }
  r = drive_forward_watch(FINAL_DRIVE_MS, true);
  if (r < 0) {
    return;
  }
  if (r == 0) {
    print_both("Alt obstacol pe final — ma opresc aici.\r\n");
  }

  motors_stop();
  print_both("=== AM AJUNS LA DESTINATIE ===\r\n");
  print_both(">>> OPERATOR: scaneaza tagul RFID pentru confirmarea "
             "livrarii!\r\n");

  /* Faza 4: confirmare RFID */
  uint32_t start = HAL_GetTick();
  while (HAL_GetTick() - start < RFID_WAIT_MS) {
    if (check_estop()) {
      return;
    }
    uint8_t uid[4];
    if (rc522_read_uid(&rfid, uid)) {
      print_both("=== LIVRARE CONFIRMATA — UID=%02X:%02X:%02X:%02X ===\r\n",
                 uid[0], uid[1], uid[2], uid[3]);
      return;
    }
    HAL_Delay(100);
  }
  print_both("Nimeni nu a confirmat in %lu s — misiune incheiata fara "
             "confirmare.\r\n",
             (unsigned long)(RFID_WAIT_MS / 1000));
}

static void motor_sanity_pulse(void) {
  print_both("MOT: ambele motoare INAINTE 40%% pentru 0.7 s — verifica "
             "sensul!\r\n");
  motor_set(1, 1, 400);
  motor_set(2, 1, 400);
  wait_ms(700);
  motors_stop();
  print_both("MOT: stop. Daca vreun motor a mers invers, schimba "
             "M1_DIR_FORWARD/M2_DIR_FORWARD in main.c.\r\n");
}

static void status_once(void) {
  int32_t mm = distance_mm();
  float gz = mpu_ok ? mpu_gz_dps() : 0.0f;
  uint8_t uid[4];
  bool tag = rc522_read_uid(&rfid, uid);
  if (mm >= 0) {
    print_both("DIST=%ld.%ld cm", mm / 10, mm % 10);
  } else {
    print_both("DIST=---");
  }
  print_both(" | GZ=%+.1f dps | MPU=%s | RC522 ver=0x%02X | TAG=%s\r\n",
             (double)gz, mpu_ok ? "OK" : "ERR", rc522_version(&rfid),
             tag ? "DA" : "--");
}

int main(void) {
  HAL_Init();
  SystemClock_Config();
  dwt_init();
  gpio_init();
  periph_init();
  motors_stop();

  print_both("\r\n=== RUDI SIM EVITARE OBSTACOL — F769I-DISCO ===\r\n");
  mpu_init();
  rfid.hspi = &hspi2;
  rfid.cs_port = GPIOA;
  rfid.cs_pin = GPIO_PIN_11;
  rfid.rst_port = GPIOJ;
  rfid.rst_pin = GPIO_PIN_4;
  rc522_init(&rfid);
  print_both("RC522: VersionReg=0x%02X\r\n", rc522_version(&rfid));
  print_both("Comenzi: DEMO | GO | MOT | S | X\r\n");

  for (;;) {
    const char *cmd = poll_command();
    if (cmd) {
      if (strcmp(cmd, "DEMO") == 0) {
        mission(true);
      } else if (strcmp(cmd, "GO") == 0) {
        mission(false);
      } else if (strcmp(cmd, "MOT") == 0) {
        motor_sanity_pulse();
      } else if (strcmp(cmd, "S") == 0) {
        status_once();
      } else if (strcmp(cmd, "X") == 0 || strcmp(cmd, "STOP") == 0) {
        motors_stop();
        print_both("STOP (nimic activ)\r\n");
      } else {
        print_both("Comanda necunoscuta: '%s'\r\n", cmd);
      }
      print_both("Gata de comanda: DEMO | GO | MOT | S | X\r\n");
    }
    HAL_Delay(10);
  }
}
