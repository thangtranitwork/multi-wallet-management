const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHARE_MODULE_KOTLIN = `package com.thang.multiwallet

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream

class ShareIntentModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        instance = this
    }

    override fun getName(): String = "ShareIntentModule"

    @ReactMethod
    fun getInitialSharedImage(promise: Promise) {
        try {
            val uri = initialSharedUri
            initialSharedUri = null
            promise.resolve(uri)
        } catch (e: Exception) {
            promise.reject("ERROR_GET_SHARED_IMAGE", e.message, e)
        }
    }

    @ReactMethod
    fun clearSharedImage(promise: Promise) {
        initialSharedUri = null
        promise.resolve(true)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for React Native event emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for React Native event emitter
    }

    companion object {
        private const val EVENT_NAME = "onSharedImageReceived"
        var initialSharedUri: String? = null
        var instance: ShareIntentModule? = null

        fun processIntent(context: Context, intent: Intent?) {
            if (intent == null) return
            val action = intent.action
            val type = intent.type ?: ""

            if (Intent.ACTION_SEND == action && type.startsWith("image/")) {
                val streamUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                }

                if (streamUri != null) {
                    val localUri = copyUriToInternalCache(context, streamUri)
                    if (localUri != null) {
                        initialSharedUri = localUri
                        instance?.sendEvent(localUri)
                    }
                }
            }
        }

        private fun copyUriToInternalCache(context: Context, sourceUri: Uri): String? {
            return try {
                val resolver = context.contentResolver
                val inputStream = resolver.openInputStream(sourceUri) ?: return null
                val cacheDir = context.cacheDir
                val file = File(cacheDir, "shared_bank_receipt_\${System.currentTimeMillis()}.jpg")
                val outputStream = FileOutputStream(file)

                inputStream.use { input ->
                    outputStream.use { output ->
                        input.copyTo(output)
                    }
                }

                "file://\${file.absolutePath}"
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    private fun sendEvent(uri: String) {
        if (reactApplicationContext.hasActiveReactInstance()) {
            val params = Arguments.createMap().apply {
                putString("uri", uri)
            }
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_NAME, params)
        }
    }
}
`;

const SHARE_PACKAGE_KOTLIN = `package com.thang.multiwallet

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ShareIntentPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(ShareIntentModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

function withShareIntent(config) {
  // 1. AndroidManifest: thêm intent-filter cho SEND image
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication?.activity) {
      const mainActivity = mainApplication.activity.find(
        (a) => a.$?.['android:name'] === '.MainActivity'
      );
      if (mainActivity) {
        if (!mainActivity['intent-filter']) {
          mainActivity['intent-filter'] = [];
        }

        const hasSendFilter = mainActivity['intent-filter'].some((f) =>
          f.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.SEND')
        );

        if (!hasSendFilter) {
          mainActivity['intent-filter'].push({
            action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [{ $: { 'android:mimeType': 'image/*' } }],
          });
        }
      }
    }
    return config;
  });

  // 2. DangerousMod: tạo các file Kotlin và đăng ký vào MainApplication/MainActivity nếu cần
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageDir = path.join(
        projectRoot,
        'android/app/src/main/java/com/thang/multiwallet'
      );

      if (fs.existsSync(packageDir)) {
        // Ghi file module
        fs.writeFileSync(
          path.join(packageDir, 'ShareIntentModule.kt'),
          SHARE_MODULE_KOTLIN,
          'utf-8'
        );
        // Ghi file package
        fs.writeFileSync(
          path.join(packageDir, 'ShareIntentPackage.kt'),
          SHARE_PACKAGE_KOTLIN,
          'utf-8'
        );

        // Chèn vào MainApplication.kt nếu chưa có
        const mainAppPath = path.join(packageDir, 'MainApplication.kt');
        if (fs.existsSync(mainAppPath)) {
          let mainAppContent = fs.readFileSync(mainAppPath, 'utf-8');
          if (!mainAppContent.includes('ShareIntentPackage()')) {
            mainAppContent = mainAppContent.replace(
              'PackageList(this).packages.apply {',
              'PackageList(this).packages.apply {\n          add(ShareIntentPackage())'
            );
            fs.writeFileSync(mainAppPath, mainAppContent, 'utf-8');
          }
        }

        // Chèn vào MainActivity.kt nếu chưa có
        const mainActivityPath = path.join(packageDir, 'MainActivity.kt');
        if (fs.existsSync(mainActivityPath)) {
          let mainActivityContent = fs.readFileSync(mainActivityPath, 'utf-8');
          if (!mainActivityContent.includes('ShareIntentModule.processIntent')) {
            if (!mainActivityContent.includes('import android.content.Intent')) {
              mainActivityContent = mainActivityContent.replace(
                'package com.thang.multiwallet\n',
                'package com.thang.multiwallet\n\nimport android.content.Intent'
              );
            }
            mainActivityContent = mainActivityContent.replace(
              'super.onCreate(null)',
              'super.onCreate(null)\n    ShareIntentModule.processIntent(this, intent)'
            );
            mainActivityContent = mainActivityContent.replace(
              'class MainActivity : ReactActivity() {',
              `class MainActivity : ReactActivity() {\n  override fun onNewIntent(intent: Intent) {\n    super.onNewIntent(intent)\n    setIntent(intent)\n    ShareIntentModule.processIntent(this, intent)\n  }`
            );
            fs.writeFileSync(mainActivityPath, mainActivityContent, 'utf-8');
          }
        }
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withShareIntent;
