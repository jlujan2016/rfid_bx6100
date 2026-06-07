package com.lujan.app_bx6100

import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView

class MainActivity : TauriActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("RFID", "MainActivity iniciada")
    }

    // Tauri 2 expone este método para acceder al WebView interno
    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        // Aquí inyectamos nuestra interfaz sobre el WebView de Tauri
        webView.addJavascriptInterface(RFIDInterface(), "AndroidRFID")
        Log.d("RFID", "JavascriptInterface inyectado en WebView de Tauri")
    }

    override fun onPause() {
        super.onPause()
        try {
            com.handheld.uhfr.UHFRManager.getInstance()?.close()
        } catch (e: Throwable) {
            Log.e("RFID", "Error cerrando UHF: ${e.message}")
        }
    }

inner class RFIDInterface {

    @JavascriptInterface
    fun scanRFID(duration: Int): String {
        return RFIDTest.scanTagsJson(duration)
    }

    @JavascriptInterface
    fun scanRFIDWithSession(duration: Int, sessionId: String): String {
        return RFIDTest.scanTagsJson(duration)
    }

    @JavascriptInterface
    fun setPower(power: Int): String {
        return RFIDTest.setPower(power)
    }

    @JavascriptInterface
    fun getPower(): String {
        return RFIDTest.getPower()
    }
}
}