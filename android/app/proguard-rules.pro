# Regras do R8 para o APK de release (ativado na 2.17.36).
# React Native, Expo, Media3/ExoPlayer, OkHttp e as bibliotecas da Software
# Mansion trazem as próprias regras; aqui ficam só as garantias extras.

# Nomes mantidos: o RN, o Expo e o Kotlin acham classes e métodos pelo nome.
# Sem renomear, o R8 ainda remove o que não é usado e otimiza o restante.
-dontobfuscate
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions

# Código nativo do próprio app (módulos chamados pelo JavaScript).
-keep class com.fastshot.slitherproduction.flixplay.** { *; }

# react-native-reanimated / worklets
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Módulos Expo e bibliotecas da comunidade registradas por reflexão.
-keep class expo.modules.** { *; }
-keep class com.reactnativecommunity.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.horcrux.svg.** { *; }

# WebView: métodos expostos ao JavaScript.
-keepclassmembers class * {
  @android.webkit.JavascriptInterface <methods>;
}

# Anotações e dependências opcionais que não existem no Android.
-dontwarn javax.annotation.**
-dontwarn com.google.errorprone.annotations.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn kotlinx.coroutines.debug.**
-dontwarn com.facebook.react.**
