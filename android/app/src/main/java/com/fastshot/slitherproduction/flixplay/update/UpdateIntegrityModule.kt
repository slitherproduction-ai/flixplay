package com.fastshot.slitherproduction.flixplay.update

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.security.MessageDigest

/** Streams an APK through SHA-256 without loading it into the JS heap. */
class UpdateIntegrityModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = "ElvanoqUpdateIntegrity"

  @ReactMethod
  fun sha256(uriValue: String, promise: Promise) {
    try {
      val uri = Uri.parse(uriValue)
      val stream: InputStream = when (uri.scheme) {
        "content" -> context.contentResolver.openInputStream(uri)
        "file", null -> FileInputStream(File(uri.path ?: uriValue))
        else -> throw IllegalArgumentException("Unsupported update file URI")
      } ?: throw IllegalArgumentException("Update file not found")

      stream.use { input ->
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val count = input.read(buffer)
          if (count <= 0) break
          digest.update(buffer, 0, count)
        }
        promise.resolve(digest.digest().joinToString("") { "%02x".format(it) })
      }
    } catch (_: Exception) {
      promise.reject("UPDATE_HASH_FAILED", "Não foi possível validar a integridade da atualização.")
    }
  }
}
