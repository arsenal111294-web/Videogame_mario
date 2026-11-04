#!/usr/bin/env bash
# Проверка APK в эмуляторе: установка, запуск, немного игры, скриншоты и поиск ошибок JS в logcat.
set -u
PKG=com.apsny.anakopia
mkdir -p emu
fail=0
resumed() { adb shell dumpsys activity activities | grep -m1 -E "mResumedActivity|ResumedActivity" | sed 's/^ *//'; }
gamelog() { adb logcat -d -s chromium:I | grep -F "[anakopia]" | sed 's/.*\[anakopia\]/  игра:/' | tail -n "${1:-5}"; }
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
  echo "после запуска:"; gamelog 3; resumed
  adb shell input keyevent KEYCODE_ENTER          # «Новая игра»
  sleep 3
  adb exec-out screencap -p > "emu/$name-2-story.png"
  echo "после Enter:"; gamelog 3
  for i in $(seq 1 16); do adb shell input keyevent KEYCODE_ENTER; done
  sleep 3
  echo "после пролистывания сказания:"; gamelog 3
  for i in $(seq 1 4); do adb shell input keyevent KEYCODE_DPAD_RIGHT KEYCODE_SPACE KEYCODE_DPAD_RIGHT; done
  adb exec-out screencap -p > "emu/$name-3-play.png"
  adb shell input keyevent KEYCODE_BACK           # пауза
  sleep 2
  adb exec-out screencap -p > "emu/$name-4-pause.png"
  echo "после «Назад»:"; gamelog 3; resumed
  if ! resumed | grep -q "$PKG"; then echo "ИГРА НЕ НА ЭКРАНЕ ПОСЛЕ «НАЗАД»: $apk"; fail=1; fi
  adb logcat -d > "emu/$name-logcat.txt"
  if ! adb shell pidof "$PKG" >/dev/null; then echo "ПРИЛОЖЕНИЕ НЕ ЗАПУЩЕНО: $apk"; fail=1; fi
  if grep -E "Uncaught|FATAL EXCEPTION|crash detected" "emu/$name-logcat.txt"; then echo "ОШИБКИ В LOGCAT: $apk"; fail=1; fi
done
exit $fail
