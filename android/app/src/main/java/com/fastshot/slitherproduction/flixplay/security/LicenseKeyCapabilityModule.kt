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
import java.security.KeyFactory
import java.security.spec.X509EncodedKeySpec
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
      result.putBoolean("supported", hasKey && Build.VERSION.SDK_INT >= 24)
      result.putBoolean("enrolled", hasKey)
      result.putString("reason", if (hasKey) "Stored P-256 key present; full signing needs device validation" else "No enrolled device key")
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

  /**
   * Verify server entitlements only when the Android crypto provider implements
   * Ed25519. On older API levels this explicitly returns false (never bypasses).
   */
  @ReactMethod
  fun inspectEd25519Verifier(promise: Promise) {
    val result = Arguments.createMap()
    result.putInt("apiLevel", Build.VERSION.SDK_INT)
    result.putString("algorithm", "Ed25519")
    try {
      KeyFactory.getInstance("Ed25519")
      Signature.getInstance("Ed25519")
      result.putBoolean("supported", true)
      result.putString("reason", "Platform crypto providers expose Ed25519 primitives; device verification still required")
    } catch (error: Exception) {
      result.putBoolean("supported", false)
      result.putString("reason", "Platform Ed25519 provider unavailable")
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun verifyEd25519(publicKeyPem: String, messageBase64: String, signatureBase64: String, promise: Promise) {
    try {
      val content = publicKeyPem
        .replace("-----BEGIN PUBLIC KEY-----", "")
        .replace("-----END PUBLIC KEY-----", "")
        .replace(Regex("""\s+"""), "")
      val publicBytes = Base64.decode(content, Base64.DEFAULT)
      val message = Base64.decode(messageBase64, Base64.NO_WRAP)
      val signatureBytes = Base64.decode(signatureBase64, Base64.NO_WRAP)
      if (publicBytes.size > 256 || message.isEmpty() || message.size > 4096 || signatureBytes.size != 64) {
        promise.resolve(false)
        return
      }
      val key = KeyFactory.getInstance("Ed25519").generatePublic(X509EncodedKeySpec(publicBytes))
      val verifier = Signature.getInstance("Ed25519")
      verifier.initVerify(key)
      verifier.update(message)
      promise.resolve(verifier.verify(signatureBytes))
    } catch (error: Exception) {
      promise.resolve(false)
    }
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
