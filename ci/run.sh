set -x
UI="python3 tools-ci/ci/ui.py"
APK=$(find app/android/app/build/outputs/apk/release -name "*.apk" | head -1)
adb install -r "$APK" || exit 0
PKG=com.fastshot.slitherproduction.flixplay
adb logcat -c
adb shell monkey -p $PKG -c android.intent.category.LEANBACK_LAUNCHER 1 || adb shell monkey -p $PKG 1
sleep 30
$UI labels
$UI tap "Xtream por Host"; sleep 3; $UI tap "Xtream por Host"; sleep 2; $UI labels
$UI tap "SERVIDOR" || $UI tap "Ex.: http://servidor.com:8080"; $UI type "https://demo.elvanoqplay.app"
$UI tap "USUÁRIO" || $UI tap "Seu usuário"; $UI type demo
$UI tap "SENHA" || $UI tap "Sua senha"; $UI type demo
sleep 1; $UI labels
$UI tap "Conectar"
sleep 25; $UI labels; $UI focused
$UI tap "Filmes"; sleep 12; $UI labels; $UI focused
k() { adb shell input keyevent $1; sleep ${2:-1.5}; $UI focused; }
k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_DOWN
k KEYCODE_DPAD_CENTER 8
k KEYCODE_BACK 1
sleep 2; $UI focused
k KEYCODE_DPAD_RIGHT
echo "== segunda volta"
k KEYCODE_DPAD_CENTER 8
k KEYCODE_BACK 3
grep -n "FATAL EXCEPTION" -A20 <(adb logcat -d) | head -40
exit 0
