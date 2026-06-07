package com.lujan.app_bx6100

import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.e("RFID_TEST", "MAIN ACTIVITY EJECUTADA")

        Toast.makeText(
            this,
            "Iniciando aplicación...",
            Toast.LENGTH_LONG
        ).show()

        // Crear WebView manualmente
        webView = WebView(this)
        webView.webViewClient = WebViewClient()
        webView.settings.javaScriptEnabled = true
        
        // Agregar interfaz RFID
        webView.addJavascriptInterface(RFIDInterface(), "AndroidRFID")
        
        setContentView(webView)
        
        // Cargar la aplicación Tauri
        webView.loadUrl("http://192.168.100.95:1420")
        
        Log.e("RFID_TEST", "✅ WebView configurada correctamente")
    }

    inner class RFIDInterface {
        
        @JavascriptInterface
        fun scanRFID(duration: Int = 200): String {
            Log.e("RFID_TEST", "📡 Escaneando RFID desde JavaScript...")
            return try {
                val result = RFIDTest.scanTagsJson(duration)
                Log.e("RFID_TEST", "📦 Resultado: $result")
                result
            } catch (e: Exception) {
                Log.e("RFID_TEST", "❌ Error: ${e.message}")
                "{\"success\":false,\"error\":\"${e.message}\",\"tags\":[],\"count\":0}"
            }
        }
    }
}