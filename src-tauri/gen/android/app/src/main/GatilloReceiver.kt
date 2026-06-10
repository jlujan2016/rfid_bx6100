package com.lujan.app_bx6100

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.view.KeyEvent

class GatilloReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        var keyCode = intent.getIntExtra("keyCode", 0)
        if (keyCode == 0) keyCode = intent.getIntExtra("keycode", 0)
        val keyDown = intent.getBooleanExtra("keydown", false)

        val extras = intent.extras?.keySet()
            ?.joinToString { k -> "$k=${intent.extras?.get(k)}" } ?: ""

        Log.d("RFID_TRIGGER", "GatilloReceiver: action=${intent.action} keyCode=$keyCode keyDown=$keyDown extras=$extras")
    }
}