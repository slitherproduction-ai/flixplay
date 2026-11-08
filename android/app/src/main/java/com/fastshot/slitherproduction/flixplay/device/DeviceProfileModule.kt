package com.fastshot.slitherproduction.flixplay.device

import android.app.ActivityManager
import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Perfil do aparelho (memória, TV) lido uma vez na abertura, para o app ajustar
 * buffer, imagens e EPG ao que o aparelho aguenta, e controle de tela ligada só
 * durante a reprodução.
 */
class DeviceProfileModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = "ElvanoqDeviceProfile"

  override fun getConstants(): Map<String, Any> {
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
    val memory = ActivityManager.MemoryInfo()
    activityManager?.getMemoryInfo(memory)
    val uiMode = context.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
    return mapOf(
      "totalMemMb" to (memory.totalMem / (1024 * 1024)).toDouble(),
      "lowRam" to (activityManager?.isLowRamDevice ?: false),
      "memoryClassMb" to (activityManager?.memoryClass ?: 0).toDouble(),
      "isTv" to (uiMode?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION),
    )
  }

  /** Mantém a tela ligada enquanto o vídeo toca; desliga ao pausar ou sair do player. */
  @ReactMethod
  fun setKeepScreenOn(enabled: Boolean) {
    UiThreadUtil.runOnUiThread {
      val window = context.currentActivity?.window ?: return@runOnUiThread
      if (enabled) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }
}
