set -x
mkdir -p out
APK=$(find apk -name "*.apk" | head -1)
adb install -r "$APK" || exit 0
PKG=$(aapt dump badging "$APK" 2>/dev/null | sed -n "s/package: name='\([^']*\)'.*/\1/p"); [ -z "$PKG" ] && PKG=com.fastshot.slitherproduction.flixplay
adb logcat -c
(adb logcat -v threadtime > out/logcat.txt) &
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1
sleep 25
python3 ci/ui.py labels | tee out/labels0.txt
python3 ci/ui.py tap "Xtream por Host" || python3 ci/ui.py tap "Xtream*"
sleep 3; python3 ci/ui.py labels | tee out/labels1.txt
python3 ci/ui.py tap "Ex.: http://servidor.com:8080" || python3 ci/ui.py tap "SERVIDOR"
python3 ci/ui.py type "https://demo.elvanoqplay.app"
python3 ci/ui.py tap "Seu usuário" && python3 ci/ui.py type demo
python3 ci/ui.py tap "Sua senha" && python3 ci/ui.py type demo
adb shell input keyevent 111
sleep 1
python3 ci/ui.py tap "Conectar"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do sleep 5; adb shell pidof $PKG || echo "PROCESS GONE at $i"; done
adb exec-out screencap -p > out/after.png
python3 ci/ui.py labels | tee out/labels2.txt
sleep 2
kill %1
adb shell dumpsys activity exit-info $PKG > out/exitinfo.txt 2>&1
grep -n -A40 "FATAL EXCEPTION\|F DEBUG\|Abort message\|signal 11\|SIGSEGV\|SIGABRT" out/logcat.txt | head -200
grep -n -A6 "ReactNativeJS\|E AndroidRuntime" out/logcat.txt | grep -v "^--$" | tail -60
exit 0
