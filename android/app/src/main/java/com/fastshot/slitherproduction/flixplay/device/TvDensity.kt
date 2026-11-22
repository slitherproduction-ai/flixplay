package com.fastshot.slitherproduction.flixplay.device

import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import com.facebook.react.uimanager.DisplayMetricsHolder
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Tela lógica única na TV: 960×540 dp, como em todo Fire TV.
 *
 * Fire TV usa sempre 960×540 dp (720p, 1080p e 4K), e o layout do app foi
 * desenhado nessa medida. Muitas TVs e boxes Android/Google TV informam outra
 * densidade (1280×720 ou 1920×1080 dp), e aí textos, botões e menus ficam de
 * 25% a 50% menores. Aqui a densidade é ajustada para que a largura seja
 * sempre 960 dp; no Fire TV o cálculo dá a densidade do próprio aparelho e
 * nada muda. Só vale em modo televisão; celulares e tablets não são tocados.
 *
 * O React Native mede o layout pela densidade de DisplayMetricsHolder (que
 * lê a densidade física da tela) e o tamanho da janela pelos recursos do app:
 * os dois recebem a mesma densidade. Reaplicado ao criar a Activity, ao
 * voltar para ela e a cada mudança de configuração (o Android e o RN
 * recalculam as medidas nesses momentos).
 */
object TvDensity {
  private const val TAG = "ElvanoqTvDensity"
  private const val DESIGN_WIDTH_DP = 960f

  fun isTv(context: Context): Boolean {
    val mode = context.resources.configuration.uiMode and Configuration.UI_MODE_TYPE_MASK
    return mode == Configuration.UI_MODE_TYPE_TELEVISION
  }

  @Suppress("DEPRECATION")
  private fun realMetrics(context: Context): DisplayMetrics {
    val real = DisplayMetrics()
    real.setTo(context.resources.displayMetrics)
    try {
      (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.getRealMetrics(real)
    } catch (_: Throwable) {
      // Contexto sem janela: fica com as medidas dos recursos.
    }
    return real
  }

  /** Densidade-alvo (largura de 960 dp), ou null quando a do aparelho já serve. */
  private fun target(real: DisplayMetrics): Float? {
    val widthPx = max(real.widthPixels, real.heightPixels)
    if (widthPx <= 0) return null
    val density = (widthPx / DESIGN_WIDTH_DP).coerceIn(0.75f, 6f)
    val physical = Resources.getSystem().displayMetrics.density.takeIf { it > 0f } ?: real.density
    return if (abs(density - physical) / physical < 0.03f) null else density
  }

  /** Aplica no contexto (Application ou Activity). Devolve true se a TV foi ajustada. */
  @Suppress("DEPRECATION")
  fun apply(context: Context): Boolean {
    return try {
      if (!isTv(context)) return false
      val real = realMetrics(context)
      val density = target(real) ?: return false
      val fontScale = context.resources.configuration.fontScale.takeIf { it > 0f } ?: 1f
      set(context.resources.displayMetrics, density, fontScale)
      val app = context.applicationContext ?: context
      if (app !== context) set(app.resources.displayMetrics, density, fontScale)

      // Medidas do React Native: janela = recursos do app (já ajustados);
      // tela = tamanho físico com a mesma densidade.
      DisplayMetricsHolder.initDisplayMetrics(app)
      set(real, density, fontScale)
      DisplayMetricsHolder.setScreenDisplayMetrics(real)
      true
    } catch (error: Throwable) {
      Log.w(TAG, "TV density not applied", error)
      false
    }
  }

  @Suppress("DEPRECATION")
  private fun set(metrics: DisplayMetrics, density: Float, fontScale: Float) {
    metrics.density = density
    metrics.scaledDensity = density * fontScale
    metrics.densityDpi = (density * DisplayMetrics.DENSITY_DEFAULT).roundToInt()
  }
}
