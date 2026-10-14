package com.fastshot.slitherproduction.flixplay.security

import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

/**
 * Checkpoint 16: capability gate only. No private key is generated or exported.
 * Ed25519 support in Android Keystore cannot be assumed on API 24 or Fire TV.
 * Return unsupported until actual StrongBox/Keystore Ed25519 and server protocol tests pass.
 */
class LicenseKeyCapabilityModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "ELVANOQLicenseKeyCapability"

  @ReactMethod
  fun inspect(promise: Promise) {
    try {
      val result = com.facebook.react.bridge.Arguments.createMap()
      result.putInt("apiLevel", Build.VERSION.SDK_INT)
      result.putString("platform", "android")
      result.putString("algorithm", "Ed25519")
      result.putBoolean("supported", false)
      result.putString("reason", "Android Keystore Ed25519 signing has not been verified on this device. No insecure fallback is permitted.")
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("LICENSE_KEY_CAPABILITY_FAILED", error)
    }
  }
}
