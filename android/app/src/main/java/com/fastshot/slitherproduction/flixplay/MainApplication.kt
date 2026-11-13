package com.fastshot.slitherproduction.flixplay

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import com.fastshot.slitherproduction.flixplay.security.SecureStoragePackage
import com.fastshot.slitherproduction.flixplay.update.UpdateIntegrityPackage
import com.fastshot.slitherproduction.flixplay.data.CatalogDatabasePackage
import com.fastshot.slitherproduction.flixplay.device.DeviceProfilePackage

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // The credential/PIN vault is an in-app native module and is not
          // autolinked as an external library.
          add(SecureStoragePackage())
          // Streams update APK checksums off the JS heap on low-memory TV devices.
          add(UpdateIntegrityPackage())
          // Cache local do catálogo (SQLite): o app abre com a lista salva sem
          // baixar tudo de novo a cada inicialização.
          add(CatalogDatabasePackage())
          // Perfil do aparelho (RAM/TV) e tela ligada só durante a reprodução.
          add(DeviceProfilePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Primeiro de tudo: um erro fatal daqui em diante fica registrado para o Diagnóstico.
    com.fastshot.slitherproduction.flixplay.device.CrashRecorder.install(this)
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
