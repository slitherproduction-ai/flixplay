package com.fastshot.slitherproduction.flixplay.security

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/** Persistent non-exportable P-256 key, generated only in AndroidKeyStore. */
class LicenseKeyCapabilityModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "ELVANOQLicenseKeyCapability"
  private val alias = "elvanoq_license_es256_v1"

  private fun keyStore(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  private fun publicKeyDer(): ByteArray {
    val entry = keyStore().getEntry(alias, null) as? KeyStore.PrivateKeyEntry
      ?: throw IllegalStateException("Device key not enrolled")
    return entry.certificate.publicKey.encoded
  }

  @ReactMethod
  fun inspect(promise: Promise) {
    try {
      val hasKey = keyStore().containsAlias(alias)
      val result = Arguments.createMap()
      result.putInt("apiLevel", Build.VERSION.SDK_INT)
      result.putString("platform", "android")
      result.putString("algorithm", "ES256")
      result.putBoolean("supported", Build.VERSION.SDK_INT >= 24)
      result.putBoolean("enrolled", hasKey)
      result.putString("reason", if (Build.VERSION.SDK_INT >= 24) "P-256 AndroidKeyStore available for enrollment attempt" else "Android API 24 required")
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("LICENSE_KEY_CAPABILITY_FAILED", error)
    }
  }

  @ReactMethod
  fun enroll(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < 24) throw IllegalStateException("Android API 24 required")
      if (!keyStore().containsAlias(alias)) {
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
          .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
          .setDigests(KeyProperties.DIGEST_SHA256)
          .setUserAuthenticationRequired(false)
          .build()
        generator.initialize(spec)
        generator.generateKeyPair()
      }
      promise.resolve(pemPublicKey())
    } catch (error: Exception) {
      promise.reject("LICENSE_KEY_ENROLL_FAILED", error)
    }
  }

  private fun pemPublicKey(): String {
    val encoded = Base64.encodeToString(publicKeyDer(), Base64.NO_WRAP)
    return "-----BEGIN PUBLIC KEY-----\n" + encoded.chunked(64).joinToString("\n") + "\n-----END PUBLIC KEY-----\n"
  }

  @ReactMethod
  fun publicKeyPem(promise: Promise) {
    try { promise.resolve(pemPublicKey()) }
    catch (error: Exception) { promise.reject("LICENSE_KEY_MISSING", error) }
  }

  @ReactMethod
  fun sign(messageBase64: String, promise: Promise) {
    try {
      val entry = keyStore().getEntry(alias, null) as? KeyStore.PrivateKeyEntry
        ?: throw IllegalStateException("Device key not enrolled")
      val payload = Base64.decode(messageBase64, Base64.NO_WRAP)
      if (payload.isEmpty() || payload.size > 2048) throw IllegalArgumentException("Invalid signing payload")
      val signer = Signature.getInstance("SHA256withECDSA")
      signer.initSign(entry.privateKey)
      signer.update(payload)
      promise.resolve(Base64.encodeToString(signer.sign(), Base64.NO_WRAP))
    } catch (error: Exception) {
      promise.reject("LICENSE_KEY_SIGN_FAILED", error)
    }
  }
}
