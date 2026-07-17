#include "rc522.h"

/* Registre MFRC522 */
#define REG_COMMAND 0x01
#define REG_COM_IRQ 0x04
#define REG_ERROR 0x06
#define REG_FIFO_DATA 0x09
#define REG_FIFO_LEVEL 0x0A
#define REG_CONTROL 0x0C
#define REG_BIT_FRAMING 0x0D
#define REG_MODE 0x11
#define REG_TX_CONTROL 0x14
#define REG_TX_ASK 0x15
#define REG_T_MODE 0x2A
#define REG_T_PRESCALER 0x2B
#define REG_T_RELOAD_H 0x2C
#define REG_T_RELOAD_L 0x2D
#define REG_VERSION 0x37

#define CMD_IDLE 0x00
#define CMD_TRANSCEIVE 0x0C
#define CMD_SOFT_RESET 0x0F

#define PICC_REQA 0x26
#define PICC_ANTICOLL 0x93

static void cs_low(rc522_t *d) {
  HAL_GPIO_WritePin(d->cs_port, d->cs_pin, GPIO_PIN_RESET);
}
static void cs_high(rc522_t *d) {
  HAL_GPIO_WritePin(d->cs_port, d->cs_pin, GPIO_PIN_SET);
}

static void reg_write(rc522_t *d, uint8_t reg, uint8_t val) {
  uint8_t tx[2] = {(uint8_t)((reg << 1) & 0x7E), val};
  cs_low(d);
  HAL_SPI_Transmit(d->hspi, tx, 2, 10);
  cs_high(d);
}

static uint8_t reg_read(rc522_t *d, uint8_t reg) {
  uint8_t tx[2] = {(uint8_t)(((reg << 1) & 0x7E) | 0x80), 0x00};
  uint8_t rx[2] = {0, 0};
  cs_low(d);
  HAL_SPI_TransmitReceive(d->hspi, tx, rx, 2, 10);
  cs_high(d);
  return rx[1];
}

static void reg_set_bits(rc522_t *d, uint8_t reg, uint8_t mask) {
  reg_write(d, reg, reg_read(d, reg) | mask);
}
static void reg_clear_bits(rc522_t *d, uint8_t reg, uint8_t mask) {
  reg_write(d, reg, reg_read(d, reg) & (uint8_t)~mask);
}

void rc522_init(rc522_t *dev) {
  cs_high(dev);
  /* Reset hardware prin pinul RST */
  HAL_GPIO_WritePin(dev->rst_port, dev->rst_pin, GPIO_PIN_RESET);
  HAL_Delay(10);
  HAL_GPIO_WritePin(dev->rst_port, dev->rst_pin, GPIO_PIN_SET);
  HAL_Delay(50);

  reg_write(dev, REG_COMMAND, CMD_SOFT_RESET);
  HAL_Delay(50);

  /* Timer intern: timeout ~25 ms pentru transceive */
  reg_write(dev, REG_T_MODE, 0x8D);
  reg_write(dev, REG_T_PRESCALER, 0x3E);
  reg_write(dev, REG_T_RELOAD_L, 30);
  reg_write(dev, REG_T_RELOAD_H, 0);
  reg_write(dev, REG_TX_ASK, 0x40);  /* 100% ASK */
  reg_write(dev, REG_MODE, 0x3D);    /* CRC preset 0x6363 */

  /* Antena pornita */
  if ((reg_read(dev, REG_TX_CONTROL) & 0x03) != 0x03) {
    reg_set_bits(dev, REG_TX_CONTROL, 0x03);
  }
}

uint8_t rc522_version(rc522_t *dev) { return reg_read(dev, REG_VERSION); }

/* Trimite si primeste prin comanda Transceive.
   tx_bits: numarul de biti valizi din ultimul octet (0 = toti). */
static bool transceive(rc522_t *d, const uint8_t *tx, uint8_t tx_len,
                       uint8_t tx_bits, uint8_t *rx, uint8_t *rx_len) {
  reg_write(d, REG_COMMAND, CMD_IDLE);
  reg_write(d, REG_COM_IRQ, 0x7F);           /* curata IRQ-urile */
  reg_set_bits(d, REG_FIFO_LEVEL, 0x80);     /* goleste FIFO */

  for (uint8_t i = 0; i < tx_len; i++) {
    reg_write(d, REG_FIFO_DATA, tx[i]);
  }
  reg_write(d, REG_COMMAND, CMD_TRANSCEIVE);
  reg_write(d, REG_BIT_FRAMING, (uint8_t)(0x80 | (tx_bits & 0x07)));

  /* Asteapta RxIRq sau IdleIRq; timeout-ul timerului intern seteaza TimerIRq */
  uint32_t start = HAL_GetTick();
  uint8_t irq;
  for (;;) {
    irq = reg_read(d, REG_COM_IRQ);
    if (irq & 0x30) {  /* RxIRq | IdleIRq */
      break;
    }
    if ((irq & 0x01) || (HAL_GetTick() - start > 40)) {
      return false;  /* timeout */
    }
  }
  reg_clear_bits(d, REG_BIT_FRAMING, 0x80);

  if (reg_read(d, REG_ERROR) & 0x13) {  /* BufferOvfl | ParityErr | ProtocolErr */
    return false;
  }

  uint8_t n = reg_read(d, REG_FIFO_LEVEL);
  if (n > *rx_len) {
    n = *rx_len;
  }
  for (uint8_t i = 0; i < n; i++) {
    rx[i] = reg_read(d, REG_FIFO_DATA);
  }
  *rx_len = n;
  return true;
}

bool rc522_read_uid(rc522_t *dev, uint8_t uid[4]) {
  uint8_t buf[8];
  uint8_t len;

  /* REQA: 7 biti, tagurile din camp raspund cu ATQA (2 octeti) */
  uint8_t reqa = PICC_REQA;
  len = sizeof(buf);
  if (!transceive(dev, &reqa, 1, 7, buf, &len) || len != 2) {
    return false;
  }

  /* Anticoliziune: primim UID (4 octeti) + BCC */
  uint8_t anticoll[2] = {PICC_ANTICOLL, 0x20};
  len = sizeof(buf);
  if (!transceive(dev, anticoll, 2, 0, buf, &len) || len != 5) {
    return false;
  }
  if ((uint8_t)(buf[0] ^ buf[1] ^ buf[2] ^ buf[3]) != buf[4]) {
    return false;  /* BCC gresit */
  }
  for (int i = 0; i < 4; i++) {
    uid[i] = buf[i];
  }
  return true;
}
