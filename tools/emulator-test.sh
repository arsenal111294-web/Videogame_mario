#!/usr/bin/env bash
# Проверка APK в эмуляторе: установка, запуск, немного игры, скриншоты и поиск ошибок JS в logcat.
set -u
PKG=com.apsny.anakopia
mkdir -p emu
fail=0
for apk in anakopia-gradle.apk dist/anakopia.apk; do
  [ -f "$apk" ] || { echo "нет $apk"; continue; }
  name=$(basename "$apk" .apk)
  echo "=== $name ==="
  adb uninstall "$PKG" >/dev/null 2>&1 || true
  adb install -r "$apk" || { echo "УСТАНОВКА НЕ УДАЛАСЬ: $apk"; fail=1; continue; }
  adb logcat -c
  adb shell am start -W -n "$PKG/.MainActivity"
  sleep 12
  adb exec-out screencap -p > "emu/$name-1-title.png"
  adb shell input keyevent KEYCODE_ENTER          # «Новая игра»
  sleep 3
  adb exec-out screencap -p > "emu/$name-2-story.png"
  for i in $(seq 1 14); do adb shell input keyevent KEYCODE_ENTER; sleep 0.4; done
  sleep 3
  for i in $(seq 1 6); do adb shell input keyevent KEYCODE_DPAD_RIGHT KEYCODE_DPAD_RIGHT KEYCODE_SPACE; done
  sleep 1
  adb exec-out screencap -p > "emu/$name-3-play.png"
  adb shell input keyevent KEYCODE_BACK           # пауза
  sleep 1
  adb exec-out screencap -p > "emu/$name-4-pause.png"
  adb logcat -d > "emu/$name-logcat.txt"
  if ! adb shell pidof "$PKG" >/dev/null; then echo "ПРИЛОЖЕНИЕ НЕ ЗАПУЩЕНО: $apk"; fail=1; fi
  if grep -E "Uncaught|FATAL EXCEPTION" "emu/$name-logcat.txt"; then echo "ОШИБКИ В LOGCAT: $apk"; fail=1; fi
  grep -i "chromium" "emu/$name-logcat.txt" | tail -20 || true
done
exit $fail
