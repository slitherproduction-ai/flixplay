package com.fastshot.slitherproduction.flixplay.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import org.json.JSONObject

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
    private const val PARENTAL_PIN_STATE_KEY = "parental_pin_state.v1"
    private const val DEFAULT_PARENTAL_PIN = "0000"
    private const val PIN_ITERATIONS = 210_000
    private const val PIN_KEY_LENGTH_BITS = 256
    private const val PIN_ATTEMPTS_BEFORE_LOCK = 5
    private const val PIN_INITIAL_LOCK_MS = 30_000L
    private const val PIN_MAX_LOCK_MS = 30 * 60_000L
  }

  private data class ParentalPinState(
    val salt: String,
    val hash: String,
    val failedAttempts: Int,
    val lockedUntil: Long,
  )

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

  private fun isValidPin(pin: String): Boolean = pin.matches(Regex("\\d{4,8}"))

  private fun hashPin(pin: String, salt: ByteArray): ByteArray {
    val spec = PBEKeySpec(pin.toCharArray(), salt, PIN_ITERATIONS, PIN_KEY_LENGTH_BITS)
    return try {
      SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    } finally {
      spec.clearPassword()
    }
  }

  private fun createPinState(pin: String): ParentalPinState {
    val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
    return ParentalPinState(
      salt = Base64.encodeToString(salt, Base64.NO_WRAP),
      hash = Base64.encodeToString(hashPin(pin, salt), Base64.NO_WRAP),
      failedAttempts = 0,
      lockedUntil = 0L,
    )
  }

  private fun readParentalPinState(): ParentalPinState? {
    val encrypted = preferences.getString(PARENTAL_PIN_STATE_KEY, null) ?: return null
    val json = JSONObject(decrypt(encrypted))
    return ParentalPinState(
      salt = json.getString("salt"),
      hash = json.getString("hash"),
      failedAttempts = json.optInt("failedAttempts", 0),
      lockedUntil = json.optLong("lockedUntil", 0L),
    )
  }

  private fun writeParentalPinState(state: ParentalPinState) {
    val value = JSONObject()
      .put("salt", state.salt)
      .put("hash", state.hash)
      .put("failedAttempts", state.failedAttempts)
      .put("lockedUntil", state.lockedUntil)
      .toString()
    if (!preferences.edit().putString(PARENTAL_PIN_STATE_KEY, encrypt(value)).commit()) {
      error("Parental PIN commit failed")
    }
  }

  private fun parentalResult(
    success: Boolean,
    failedAttempts: Int = 0,
    lockedUntil: Long = 0L,
  ) = Arguments.createMap().apply {
    // A missing stored state still means the default 0000 PIN is available.
    putBoolean("configured", true)
    putBoolean("success", success)
    putInt("failedAttempts", failedAttempts)
    putInt("remainingAttempts", maxOf(0, PIN_ATTEMPTS_BEFORE_LOCK - failedAttempts))
    putDouble("lockedUntil", lockedUntil.toDouble())
  }

  private fun lockDurationMs(failedAttempts: Int): Long {
    if (failedAttempts < PIN_ATTEMPTS_BEFORE_LOCK) return 0L
    val exponent = minOf(16, failedAttempts - PIN_ATTEMPTS_BEFORE_LOCK)
    return minOf(PIN_INITIAL_LOCK_MS * (1L shl exponent), PIN_MAX_LOCK_MS)
  }

  private fun verifyPin(pin: String): com.facebook.react.bridge.WritableMap {
    if (!isValidPin(pin)) throw IllegalArgumentException("O PIN deve conter de 4 a 8 números.")
    val now = System.currentTimeMillis()
    val state = readParentalPinState() ?: createPinState(DEFAULT_PARENTAL_PIN)
    if (state.lockedUntil > now) return parentalResult(false, state.failedAttempts, state.lockedUntil)

    val supplied = hashPin(pin, Base64.decode(state.salt, Base64.NO_WRAP))
    val expected = Base64.decode(state.hash, Base64.NO_WRAP)
    if (MessageDigest.isEqual(supplied, expected)) {
      if (state.failedAttempts != 0 || state.lockedUntil != 0L) {
        writeParentalPinState(state.copy(failedAttempts = 0, lockedUntil = 0L))
      }
      return parentalResult(true)
    }

    val attempts = state.failedAttempts + 1
    val duration = lockDurationMs(attempts)
    val lockedUntil = if (duration > 0) now + duration else 0L
    writeParentalPinState(state.copy(failedAttempts = attempts, lockedUntil = lockedUntil))
    return parentalResult(false, attempts, lockedUntil)
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

  /** The first parental access intentionally uses the documented default PIN 0000. */
  @ReactMethod
  fun getParentalPinStatus(promise: Promise) {
    try {
      val state = readParentalPinState()
      promise.resolve(parentalResult(false, state?.failedAttempts ?: 0, state?.lockedUntil ?: 0L))
    } catch (_: Exception) {
      promise.reject("PARENTAL_PIN_READ_FAILED", "Não foi possível ler o PIN parental seguro.")
    }
  }

  @ReactMethod
  fun verifyParentalPin(pin: String, promise: Promise) {
    try {
      promise.resolve(verifyPin(pin))
    } catch (error: Exception) {
      promise.reject("PARENTAL_PIN_VERIFY_FAILED", error.message ?: "Não foi possível validar o PIN parental.")
    }
  }

  @ReactMethod
  fun setParentalPin(pin: String, promise: Promise) {
    try {
      if (!isValidPin(pin)) throw IllegalArgumentException("O PIN deve conter de 4 a 8 números.")
      writeParentalPinState(createPinState(pin))
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("PARENTAL_PIN_WRITE_FAILED", error.message ?: "Não foi possível salvar o PIN parental.")
    }
  }

  /** Clears the custom value only after checking the supplied PIN; next access returns to 0000. */
  @ReactMethod
  fun clearParentalPin(pin: String, promise: Promise) {
    try {
      val result = verifyPin(pin)
      if (!result.getBoolean("success")) {
        promise.resolve(result)
        return
      }
      if (!preferences.edit().remove(PARENTAL_PIN_STATE_KEY).commit()) error("Parental PIN delete failed")
      promise.resolve(parentalResult(true))
    } catch (error: Exception) {
      promise.reject("PARENTAL_PIN_DELETE_FAILED", error.message ?: "Não foi possível restaurar o PIN padrão.")
    }
  }
}
