#!/usr/bin/env bash
# Build headless pentru rudi-stm32-sim (STM32F769NI, Cortex-M7) pe Linux.
set -e

# 1. Căutare compiler arm-none-eabi-gcc
find_gcc() {
    if command -v arm-none-eabi-gcc &>/dev/null; then
        echo "$(dirname "$(which arm-none-eabi-gcc")")"
        return
    fi
    # Căutare în directorul stm32cubeide din home
    local ide_path
    ide_path=$(find "$HOME" -maxdepth 5 -type d -name "com.st.stm32cube.ide.mcu.externaltools.gnu-tools-for-stm32*" 2>/dev/null | head -n 1)
    if [ -n "$ide_path" ] && [ -d "$ide_path/tools/bin" ]; then
        echo "$ide_path/tools/bin"
        return
    fi
    echo "ERROR"
}

# 2. Căutare pachet firmware STM32CubeF7 (HAL)
find_repo() {
    # Căutare în locațiile standard ale STM32CubeIDE/Repository
    local repo_path
    repo_path=$(find "$HOME" -maxdepth 4 -type d -name "STM32Cube_FW_F7_*" 2>/dev/null | sort -V | tail -n 1)
    if [ -n "$repo_path" ]; then
        echo "$repo_path"
        return
    fi
    # Căutare locală în rudi-sim-obstacol sau directorul părinte
    if [ -d "../STM32CubeF7" ]; then
        echo "../STM32CubeF7"
        return
    fi
    echo "ERROR"
}

GCCBIN=$(find_gcc)
if [ "$GCCBIN" = "ERROR" ]; then
    echo "✗ Nu s-a găsit arm-none-eabi-gcc."
    echo "Instalează gcc-arm-none-eabi folosind managerul de pachete (ex: sudo apt install gcc-arm-none-eabi) sau instalează STM32CubeIDE."
    exit 1
fi

REPO=$(find_repo)
if [ "$REPO" = "ERROR" ]; then
    echo "✗ Nu s-a găsit pachetul firmware STM32Cube_FW_F7 (HAL Driver)."
    echo "Descarcă-l din CubeMX/STM32CubeIDE sau clonează repository-ul direct în folderul părinte:"
    echo "  git clone https://github.com/STMicroelectronics/STM32CubeF7.git ~/STM32Cube/Repository/STM32Cube_FW_F7_V1.17.0"
    exit 1
fi

GCC="$GCCBIN/arm-none-eabi-gcc"
OBJCOPY="$GCCBIN/arm-none-eabi-objcopy"
SIZE="$GCCBIN/arm-none-eabi-size"
HALSRC="$REPO/Drivers/STM32F7xx_HAL_Driver/Src"

echo "Using GCC: $GCC"
echo "Using HAL: $REPO"

mkdir -p build

CFLAGS=(
  "-mcpu=cortex-m7" "-mthumb" "-mfpu=fpv5-d16" "-mfloat-abi=hard"
  "-O2" "-g" "-Wall" "-ffunction-sections" "-fdata-sections"
  "-DSTM32F769xx" "-DUSE_HAL_DRIVER"
  "-Isrc"
  "-I$REPO/Drivers/STM32F7xx_HAL_Driver/Inc"
  "-I$REPO/Drivers/CMSIS/Device/ST/STM32F7xx/Include"
  "-I$REPO/Drivers/CMSIS/Include"
)

SOURCES=(
  "src/main.c" "src/rc522.c" "src/stm32f7xx_it.c" "src/syscalls.c"
  "src/sysmem.c" "src/system_stm32f7xx.c"
  "$HALSRC/stm32f7xx_hal.c"
  "$HALSRC/stm32f7xx_hal_cortex.c"
  "$HALSRC/stm32f7xx_hal_rcc.c"
  "$HALSRC/stm32f7xx_hal_rcc_ex.c"
  "$HALSRC/stm32f7xx_hal_gpio.c"
  "$HALSRC/stm32f7xx_hal_pwr.c"
  "$HALSRC/stm32f7xx_hal_pwr_ex.c"
  "$HALSRC/stm32f7xx_hal_uart.c"
  "$HALSRC/stm32f7xx_hal_i2c.c"
  "$HALSRC/stm32f7xx_hal_i2c_ex.c"
  "$HALSRC/stm32f7xx_hal_spi.c"
  "$HALSRC/stm32f7xx_hal_dma.c"
  "$HALSRC/stm32f7xx_hal_tim.c"
  "$HALSRC/stm32f7xx_hal_tim_ex.c"
)

objs=()
for s in "${SOURCES[@]}"; do
  filename=$(basename "$s" .c)
  o="build/${filename}.o"
  echo "Compiling $s..."
  "$GCC" "${CFLAGS[@]}" -c "$s" -o "$o"
  objs+=("$o")
done

echo "Assembling startup..."
"$GCC" "${CFLAGS[@]}" -x assembler-with-cpp -c "startup_stm32f769nihx.s" -o "build/startup.o"
objs+=("build/startup.o")

echo "Linking..."
"$GCC" "${CFLAGS[@]}" -T "STM32F769NIHX_FLASH.ld" "-Wl,--gc-sections" \
  "--specs=nano.specs" -u _printf_float "-Wl,-Map=build/firmware.map" \
  "${objs[@]}" -o "build/firmware.elf"

"$OBJCOPY" -O ihex "build/firmware.elf" "build/firmware.hex"
"$OBJCOPY" -O binary "build/firmware.elf" "build/firmware.bin"
"$SIZE" "build/firmware.elf"

echo "BUILD OK -> build/firmware.hex și build/firmware.bin"
