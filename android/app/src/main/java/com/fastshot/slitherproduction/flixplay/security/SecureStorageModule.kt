package com.fastshot.slitherproduction.flixplay.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Small Android-only credential vault backed by AndroidKeyStore.
 *
 * The AES key is non-exportable and the encrypted payload is kept in private
 * SharedPreferences. No plaintext credential is ever written to disk.
 */
class SecureStorageModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  companion object {
    private const val MODULE_NAME = "FlixPlaySecureStorage"
    private const val KEY_ALIAS = "flixplay.credentials.v1"
    private const val KEYSTORE = "AndroidKeyStore"
    private const val PREFS = "flixplay_secure_storage"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val TAG_LENGTH_BITS = 128
  }

  override fun getName(): String = MODULE_NAME

  private val preferences by lazy {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  }

  private fun secretKey(): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .build(),
    )
    return generator.generateKey()
  }

  private fun encrypt(value: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, secretKey())
    val iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
    val encrypted = Base64.encodeToString(
      cipher.doFinal(value.toByteArray(Charsets.UTF_8)),
      Base64.NO_WRAP,
    )
    return "$iv:$encrypted"
  }

  private fun decrypt(value: String): String {
    val separator = value.indexOf(':')
    require(separator > 0 && separator < value.lastIndex) { "Invalid secure value" }
    val iv = Base64.decode(value.substring(0, separator), Base64.NO_WRAP)
    val encrypted = Base64.decode(value.substring(separator + 1), Base64.NO_WRAP)
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(TAG_LENGTH_BITS, iv))
    return cipher.doFinal(encrypted).toString(Charsets.UTF_8)
  }

  @ReactMethod
  fun getItem(key: String, promise: Promise) {
    try {
      val encrypted = preferences.getString(key, null)
      promise.resolve(encrypted?.let(::decrypt))
    } catch (_: Exception) {
      promise.reject("SECURE_STORAGE_READ_FAILED", "Não foi possível ler o armazenamento seguro.")
    }
  }

  @ReactMethod
  fun setItem(key: String, value: String, promise: Promise) {
    try {
      val committed = preferences.edit().putString(key, encrypt(value)).commit()
      if (!committed) error("Secure storage commit failed")
      promise.resolve(null)
    } catch (_: Exception) {
      promise.reject("SECURE_STORAGE_WRITE_FAILED", "Não foi possível gravar no armazenamento seguro.")
    }
  }

  @ReactMethod
  fun removeItem(key: String, promise: Promise) {
    try {
      preferences.edit().remove(key).apply()
      promise.resolve(null)
    } catch (_: Exception) {
      promise.reject("SECURE_STORAGE_DELETE_FAILED", "Não foi possível apagar o armazenamento seguro.")
    }
  }
}
