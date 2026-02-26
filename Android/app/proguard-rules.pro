# Proguard rules for OC Universe Admin
# Keep the NativeBridge class accessible from JavaScript
-keepclassmembers class com.ocuniverse.admin.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
