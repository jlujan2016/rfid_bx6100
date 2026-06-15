package com.lujan.app_bx6100

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebView

class MainActivity : TauriActivity() {

    private var webViewRef: WebView? = null

    private val gatilloReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {

            // Así lo hace el SDK demo del BX6100
            var keyCode = intent.getIntExtra("keyCode", 0)
            if (keyCode == 0) keyCode = intent.getIntExtra("keycode", 0)
            val keyDown = intent.getBooleanExtra("keydown", false)

            Log.d("RFID_TRIGGER", "action=${intent.action} keyCode=$keyCode keyDown=$keyDown")

            // Solo cuando se SUELTA el gatillo
            if (!keyDown && keyCode != 0) {
                val esGatillo = keyCode == KeyEvent.KEYCODE_F3 ||
                                keyCode == KeyEvent.KEYCODE_F4 ||
                                keyCode == KeyEvent.KEYCODE_F7 ||
                                keyCode == 134 ||
                                keyCode == 137 ||
                                keyCode == 280

                if (esGatillo) {
                    Log.d("RFID_TRIGGER", "GATILLO detectado → keyCode=$keyCode")
                    notificarGatilloDown()
                } else if (keyCode != 0) {
                    // Log para descubrir el keycode real si no es ninguno de los anteriores
                    Log.d("RFID_TRIGGER", "Tecla no reconocida → keyCode=$keyCode")
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("RFID", "MainActivity iniciada")

        val filter = IntentFilter().apply {
            addAction("android.rfid.FUN_KEY")         
            addAction("android.intent.action.FUN_KEY")
            addAction("android.intent.action.KEY_DOWN")
            addAction("android.intent.action.KEY_UP")
            addAction("com.android.scanner.action.SCAN_START")
            addAction("com.android.scanner.action.SCAN_STOP")
            addAction("com.android.scanner.action.STATE_CHANGE")
            addAction("android.intent.action.TRIGGER_DOWN")
            addAction("android.intent.action.TRIGGER_UP")
            addAction("com.rscja.action.BARCODE_SCAN_BTN_DOWN")
            addAction("com.handheld.action.KEY_DOWN")
            addAction("android.intent.action.SCAN")
        }
        registerReceiver(gatilloReceiver, filter)
        Log.d("RFID_TRIGGER", "BroadcastReceiver registrado")
        try {
            com.handheld.uhfr.UHFRManager.getInstance()?.setCancleInventoryFilter()
            Log.d("RFID_TRIGGER", "setCancleInventoryFilter OK")
        } catch (e: Throwable) {
            Log.e("RFID_TRIGGER", "setCancleInventoryFilter error: ${e.message}")
        }


    }

    private fun notificarGatilloDown() {
        runOnUiThread {
            webViewRef?.evaluateJavascript(
                "window.__onGatilloDown && window.__onGatilloDown()", null
            )
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        webViewRef = webView
        webView.addJavascriptInterface(RFIDInterface(), "AndroidRFID")
        Log.d("RFID", "JavascriptInterface inyectado")
    }

// En MainActivity.kt — reemplaza onKeyDown por dispatchKeyEvent
override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    Log.d("RFID_TRIGGER", "dispatchKeyEvent: keyCode=${event.keyCode} action=${event.action}")
    
    if (event.action == KeyEvent.ACTION_UP) {
        val esGatillo = event.keyCode == KeyEvent.KEYCODE_F3 ||
                        event.keyCode == KeyEvent.KEYCODE_F4 ||
                        event.keyCode == KeyEvent.KEYCODE_F7 ||
                        event.keyCode == 134 ||
                        event.keyCode == 137 ||
                        event.keyCode == 280

        if (esGatillo) {
            Log.d("RFID_TRIGGER", "GATILLO via dispatchKeyEvent: ${event.keyCode}")
            notificarGatilloDown()
            return true
        }
    }
    return super.dispatchKeyEvent(event)
}

    override fun onDestroy() {
        super.onDestroy()
        try { unregisterReceiver(gatilloReceiver) }
        catch (e: Throwable) { Log.e("RFID_TRIGGER", "Error: ${e.message}") }
    }

    override fun onPause() {
        super.onPause()
        try { com.handheld.uhfr.UHFRManager.getInstance()?.close() }
        catch (e: Throwable) { Log.e("RFID", "Error cerrando UHF: ${e.message}") }
    }

    inner class RFIDInterface {

        @JavascriptInterface
        fun scanRFID(duration: Int): String = RFIDTest.scanTagsJson(duration)

        @JavascriptInterface
        fun scanRFIDWithSession(duration: Int, sessionId: String): String =
            RFIDTest.scanTagsJson(duration)

        @JavascriptInterface
        fun setPower(power: Int): String = RFIDTest.setPower(power)

        @JavascriptInterface
        fun getPower(): String = RFIDTest.getPower()

        @JavascriptInterface
        fun vibrar(duracionMs: Int) {
            try {
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(
                        VibrationEffect.createOneShot(
                            duracionMs.toLong(),
                            VibrationEffect.DEFAULT_AMPLITUDE
                        )
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(duracionMs.toLong())
                }
            } catch (e: Throwable) {
                Log.e("RFID", "Error vibrar: ${e.message}")
            }
        }

        @JavascriptInterface
        fun guardarArchivo(base64: String, nombreArchivo: String): String {
            return try {
                val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)

                val descargas = android.os.Environment.getExternalStoragePublicDirectory(
                    android.os.Environment.DIRECTORY_DOWNLOADS
                )
                descargas.mkdirs()

                val archivo = java.io.File(descargas, nombreArchivo)
                archivo.writeBytes(bytes)

                // CORRECCIÓN: Se cambia 'activity' por 'this@MainActivity'
                val uri = androidx.core.content.FileProvider.getUriForFile(
                    this@MainActivity,
                    "${this@MainActivity.packageName}.fileprovider",
                    archivo
                )

                android.util.Log.d("RFID", "Archivo guardado: ${archivo.absolutePath}")
                "{\"success\":true,\"ruta\":\"${archivo.absolutePath}\"}"
            } catch (e: Throwable) {
                android.util.Log.e("RFID", "Error guardando: ${e.message}")
                "{\"success\":false,\"error\":\"${e.message}\"}"
            }
        }

        @JavascriptInterface
        fun getBssidActual(): String {
            return try {
                val wifiManager = this@MainActivity.applicationContext
                    .getSystemService(android.content.Context.WIFI_SERVICE) as android.net.wifi.WifiManager

                @Suppress("DEPRECATION")
                val info = wifiManager.connectionInfo
                val bssid = info.bssid ?: ""

                "{\"success\":true,\"bssid\":\"$bssid\"}"
            } catch (e: Throwable) {
                "{\"success\":false,\"error\":\"${e.message}\"}"
            }
        }



        
    }
}