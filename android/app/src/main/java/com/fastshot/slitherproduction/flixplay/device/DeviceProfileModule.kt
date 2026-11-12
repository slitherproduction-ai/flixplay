package com.fastshot.slitherproduction.flixplay.device

import android.app.ActivityManager
import android.app.UiModeManager
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.Debug
import android.os.Process
import android.os.SystemClock
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
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

  // Avisos do sistema de pouca memória com o app aberto (Diagnóstico → Desempenho).
  @Volatile private var trimCount = 0
  @Volatile private var lastTrimLevel = 0
  @Volatile private var lastTrimAt = 0L

  private val trimCallbacks = object : ComponentCallbacks2 {
    override fun onTrimMemory(level: Int) {
      // Só os níveis "RUNNING_*": o app está na tela e o sistema já está apertado.
      if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_MODERATE &&
        level <= ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL) {
        record(level)
      }
    }

    override fun onConfigurationChanged(newConfig: Configuration) = Unit

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onLowMemory() = record(ComponentCallbacks2.TRIM_MEMORY_COMPLETE)
  }

  private fun record(level: Int) {
    trimCount += 1
    lastTrimLevel = level
    lastTrimAt = System.currentTimeMillis()
    // A partir de "baixo": devolve ao sistema o cache de páginas do SQLite
    // (catálogo). As imagens o próprio Glide já libera nesses avisos.
    if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) {
      try { android.database.sqlite.SQLiteDatabase.releaseMemory() } catch (_: Exception) {}
    }
  }

  // O módulo vive enquanto o app vive (release não recarrega o JS), então o
  // registro único no contexto da aplicação não vaza.
  init {
    try { context.applicationContext.registerComponentCallbacks(trimCallbacks) } catch (_: Exception) {}
  }

  private fun mb(bytes: Long): Double = bytes / (1024.0 * 1024.0)

  /**
   * Sair de verdade, como no Roku: fecha a tela, tira o app da lista de
   * recentes e encerra o processo — nada fica ocupando memória em segundo
   * plano e a próxima abertura começa do zero.
   */
  @ReactMethod
  fun exitApp() {
    UiThreadUtil.runOnUiThread {
      try {
        val activity = context.currentActivity
        if (activity != null) activity.finishAndRemoveTask()
      } catch (_: Exception) {
      }
      android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
        Process.killProcess(Process.myPid())
      }, EXIT_DELAY_MS)
    }
  }

  /** Memória do aparelho e do app agora (leitura barata, sem PSS). */
  @ReactMethod
  fun getMemorySnapshot(promise: Promise) {
    try {
      val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      val memory = ActivityManager.MemoryInfo()
      activityManager?.getMemoryInfo(memory)
      val runtime = Runtime.getRuntime()
      val result = Arguments.createMap()
      result.putDouble("availMemMb", mb(memory.availMem))
      result.putDouble("totalMemMb", mb(memory.totalMem))
      result.putDouble("thresholdMb", mb(memory.threshold))
      result.putBoolean("lowMemory", memory.lowMemory)
      result.putDouble("javaHeapUsedMb", mb(runtime.totalMemory() - runtime.freeMemory()))
      result.putDouble("javaHeapMaxMb", mb(runtime.maxMemory()))
      result.putDouble("nativeHeapMb", mb(Debug.getNativeHeapAllocatedSize()))
      val uptime = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime()
      } else -1L
      result.putDouble("processUptimeMs", uptime.toDouble())
      result.putInt("trimCount", trimCount)
      result.putInt("lastTrimLevel", lastTrimLevel)
      result.putDouble("lastTrimAt", lastTrimAt.toDouble())
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("memory_snapshot", error)
    }
  }

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

  private companion object {
    /** Tempo para a tela fechar e o registro de saída limpa ser gravado. */
    const val EXIT_DELAY_MS = 300L
  }
}
