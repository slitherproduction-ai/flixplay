set -x
UI="python3 tools-ci/ci/ui.py"
APK=$(find app/android/app/build/outputs/apk/release -name "*.apk" | head -1)
adb install -r "$APK" || exit 0
PKG=com.fastshot.slitherproduction.flixplay
adb logcat -c
(adb logcat -v threadtime > /tmp/logcat.txt) &
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1
sleep 30
$UI labels
$UI tap "Atualizar mais tarde" || true
sleep 3
adb shell pidof $PKG || echo "PROCESS GONE AT START"
$UI tap "Xtream por Host"
sleep 3; $UI labels
$UI tap "SERVIDOR" || $UI tap "Ex.: http://servidor.com:8080"
$UI type "https://demo.elvanoqplay.app"
$UI tap "USUÁRIO" || $UI tap "Seu usuário"; $UI type demo
$UI tap "SENHA" || $UI tap "Sua senha"; $UI type demo
adb shell input keyevent 111; sleep 1
$UI labels
$UI tap "Conectar"
for i in $(seq 1 16); do sleep 3; adb shell pidof $PKG >/dev/null || echo "PROCESS GONE at $((i*3))s"; done
$UI labels
kill %1
echo "===== FATAL ====="
grep -n -B2 -A60 "FATAL EXCEPTION\|F DEBUG\|Abort message\|SIGSEGV\|SIGABRT\|Fatal signal" /tmp/logcat.txt | grep -v PackageManager | head -260
echo "===== JS ====="
grep -n "ReactNativeJS\|ElvanoqCrash\|ReactNative\b\|FATAL EXCEPTION" /tmp/logcat.txt | tail -80
echo "===== EXIT INFO ====="
adb shell dumpsys activity exit-info $PKG | head -60
exit 0
