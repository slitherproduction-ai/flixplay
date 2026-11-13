package com.fastshot.slitherproduction.flixplay.device

import android.content.Context

/**
 * Guarda o último erro fatal do app (Java ou JavaScript) antes de o processo
 * cair, para o Diagnóstico mostrar a causa na próxima abertura.
 *
 * Grava só o tipo do erro, a mensagem (cortada) e as primeiras linhas da
 * pilha, de forma síncrona (`commit`), e repassa o erro ao tratador anterior.
 * O texto passa pelo `sanitize` do JS antes de aparecer na tela ou no
 * relatório (endereços e credenciais são removidos lá).
 */
object CrashRecorder {
  private const val PREFS = "elvanoq_crash"
  private const val KEY_AT = "at"
  private const val KEY_TEXT = "text"
  private const val MAX_TEXT = 1800
  @Volatile private var installed = false

  fun install(context: Context) {
    if (installed) return
    installed = true
    val app = context.applicationContext
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
          .putLong(KEY_AT, System.currentTimeMillis())
          .putString(KEY_TEXT, describe(thread, error))
          .commit()
      } catch (_: Throwable) {
      }
      previous?.uncaughtException(thread, error)
    }
  }

  /** Lê e apaga o último erro guardado. */
  fun consume(context: Context): Pair<Long, String>? {
    val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val at = prefs.getLong(KEY_AT, 0L)
    val text = prefs.getString(KEY_TEXT, null)
    if (at == 0L || text.isNullOrEmpty()) return null
    prefs.edit().clear().apply()
    return at to text
  }

  private fun describe(thread: Thread, error: Throwable): String {
    val builder = StringBuilder()
    var current: Throwable? = error
    var depth = 0
    while (current != null && depth < 3) {
      if (depth > 0) builder.append("\nCausa: ")
      builder.append(current.javaClass.name)
      current.message?.let { builder.append(": ").append(it.take(400)) }
      current.stackTrace.take(if (depth == 0) 10 else 4).forEach { frame ->
        builder.append("\n  at ").append(frame.className).append('.').append(frame.methodName)
        if (frame.lineNumber > 0) builder.append(':').append(frame.lineNumber)
      }
      current = current.cause
      depth += 1
    }
    builder.append("\nThread: ").append(thread.name)
    return builder.toString().take(MAX_TEXT)
  }
}
