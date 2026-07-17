#ifndef RC522_H
#define RC522_H

#include "stm32f7xx_hal.h"
#include <stdbool.h>
#include <stdint.h>

typedef struct {
  SPI_HandleTypeDef *hspi;
  GPIO_TypeDef *cs_port;
  uint16_t cs_pin;
  GPIO_TypeDef *rst_port;
  uint16_t rst_pin;
} rc522_t;

void rc522_init(rc522_t *dev);
uint8_t rc522_version(rc522_t *dev);
/* Cauta un tag in camp; daca gaseste, umple uid[4] si intoarce true. */
bool rc522_read_uid(rc522_t *dev, uint8_t uid[4]);

#endif
