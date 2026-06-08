package com.lujan.app_bx6100

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebView

class MainActivity : TauriActivity() {

    private var webViewRef: WebView? = null

    private val gatilloReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            Log.d("RFID_TRIGGER", "Broadcast recibido: ${intent.action}")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("RFID", "MainActivity iniciada")

        val filter = IntentFilter().apply {
            addAction("com.android.scanner.action.SCAN_START")
            addAction("com.android.scanner.action.SCAN_STOP")
            addAction("android.intent.action.TRIGGER_DOWN")
            addAction("android.intent.action.TRIGGER_UP")
            addAction("com.rscja.action.BARCODE_SCAN_BTN_DOWN")
            addAction("com.handheld.action.KEY_DOWN")
            addAction("android.intent.action.SCAN")
        }
        registerReceiver(gatilloReceiver, filter)
        Log.d("RFID_TRIGGER", "BroadcastReceiver registrado")
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        webViewRef = webView
        webView.addJavascriptInterface(RFIDInterface(), "AndroidRFID")
        Log.d("RFID", "JavascriptInterface inyectado en WebView de Tauri")
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        Log.d("RFID_TRIGGER", "KeyDown: $keyCode")
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(gatilloReceiver)
        } catch (e: Throwable) {
            Log.e("RFID_TRIGGER", "Error unregister: ${e.message}")
        }
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
        fun scanRFID(duration: Int): String = RFIDTest.scanTagsJson(duration)

        @JavascriptInterface
        fun scanRFIDWithSession(duration: Int, sessionId: String): String =
            RFIDTest.scanTagsJson(duration)

        @JavascriptInterface
        fun setPower(power: Int): String = RFIDTest.setPower(power)

        @JavascriptInterface
        fun getPower(): String = RFIDTest.getPower()
    }
}