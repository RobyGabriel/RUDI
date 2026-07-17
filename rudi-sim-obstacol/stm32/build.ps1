# Build headless pentru rudi-stm32-sim (STM32F769NI, Cortex-M7).
# Cauta singur toolchain-ul: arm-none-eabi-gcc din PATH sau din STM32CubeIDE.
$ErrorActionPreference = "Stop"

function Find-Gcc {
  $inPath = Get-Command arm-none-eabi-gcc -ErrorAction SilentlyContinue
  if ($inPath) { return (Split-Path $inPath.Source) }
  foreach ($ide in (Get-Item "C:\ST\STM32CubeIDE*" -ErrorAction SilentlyContinue)) {
    $plugins = Get-ChildItem "$($ide.FullName)\STM32CubeIDE\plugins" -Directory -Filter "com.st.stm32cube.ide.mcu.externaltools.gnu-tools-for-stm32*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($plugins) { return "$($plugins.FullName)\tools\bin" }
  }
  throw "Nu gasesc arm-none-eabi-gcc. Instaleaza STM32CubeIDE sau GNU Arm Embedded Toolchain."
}

function Find-Repo {
  $candidates = @("$env:USERPROFILE\STM32Cube\Repository", "C:\Users\Public\STM32Cube\Repository")
  foreach ($c in $candidates) {
    $fw = Get-ChildItem $c -Directory -Filter "STM32Cube_FW_F7_*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($fw) { return $fw.FullName }
  }
  throw "Nu gasesc STM32Cube_FW_F7 (pachetul HAL F7). Deschide CubeMX si descarca firmware F7, sau descarca STM32CubeF7 de pe github.com/STMicroelectronics/STM32CubeF7."
}

$GCCBIN = Find-Gcc
$GCC = "$GCCBIN\arm-none-eabi-gcc.exe"
$OBJCOPY = "$GCCBIN\arm-none-eabi-objcopy.exe"
$SIZE = "$GCCBIN\arm-none-eabi-size.exe"
$REPO = (New-Object System.IO.DirectoryInfo (Find-Repo)).FullName
# cale scurta 8.3, ca sa evitam spatiile in argumente
$fso = New-Object -ComObject Scripting.FileSystemObject
$REPO = $fso.GetFolder($REPO).ShortPath
$HALSRC = "$REPO\Drivers\STM32F7xx_HAL_Driver\Src"

Write-Output "GCC: $GCCBIN"
Write-Output "HAL: $REPO"

Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path build | Out-Null

$CFLAGS = @(
  "-mcpu=cortex-m7", "-mthumb", "-mfpu=fpv5-d16", "-mfloat-abi=hard",
  "-O2", "-g", "-Wall", "-ffunction-sections", "-fdata-sections",
  "-DSTM32F769xx", "-DUSE_HAL_DRIVER",
  "-Isrc",
  "-I$REPO\Drivers\STM32F7xx_HAL_Driver\Inc",
  "-I$REPO\Drivers\CMSIS\Device\ST\STM32F7xx\Include",
  "-I$REPO\Drivers\CMSIS\Include"
)

$SOURCES = @(
  "src\main.c", "src\rc522.c", "src\stm32f7xx_it.c", "src\syscalls.c",
  "src\sysmem.c", "src\system_stm32f7xx.c",
  "$HALSRC\stm32f7xx_hal.c",
  "$HALSRC\stm32f7xx_hal_cortex.c",
  "$HALSRC\stm32f7xx_hal_rcc.c",
  "$HALSRC\stm32f7xx_hal_rcc_ex.c",
  "$HALSRC\stm32f7xx_hal_gpio.c",
  "$HALSRC\stm32f7xx_hal_pwr.c",
  "$HALSRC\stm32f7xx_hal_pwr_ex.c",
  "$HALSRC\stm32f7xx_hal_uart.c",
  "$HALSRC\stm32f7xx_hal_i2c.c",
  "$HALSRC\stm32f7xx_hal_i2c_ex.c",
  "$HALSRC\stm32f7xx_hal_spi.c",
  "$HALSRC\stm32f7xx_hal_dma.c",
  "$HALSRC\stm32f7xx_hal_tim.c",
  "$HALSRC\stm32f7xx_hal_tim_ex.c"
)

$objs = @()
foreach ($s in $SOURCES) {
  $o = "build\" + [IO.Path]::GetFileNameWithoutExtension($s) + ".o"
  & $GCC @CFLAGS -c $s -o $o
  if ($LASTEXITCODE -ne 0) { throw "compilare esuata: $s" }
  $objs += $o
}

& $GCC @CFLAGS -x assembler-with-cpp -c "startup_stm32f769nihx.s" -o "build\startup.o"
if ($LASTEXITCODE -ne 0) { throw "startup esuat" }
$objs += "build\startup.o"

& $GCC @CFLAGS -T "STM32F769NIHX_FLASH.ld" "-Wl,--gc-sections" `
  "--specs=nano.specs" -u _printf_float "-Wl,-Map=build\firmware.map" `
  $objs -o "build\firmware.elf"
if ($LASTEXITCODE -ne 0) { throw "link esuat" }

& $OBJCOPY -O ihex "build\firmware.elf" "build\firmware.hex"
& $OBJCOPY -O binary "build\firmware.elf" "build\firmware.bin"
& $SIZE "build\firmware.elf"
Write-Output "BUILD OK -> build\firmware.hex si build\firmware.bin"
