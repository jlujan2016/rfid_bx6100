package com.lujan.app_bx6100

import android.os.Bundle
import android.util.Log
import android.widget.Toast

class MainActivity : TauriActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.e("RFID_TEST", "MAIN ACTIVITY EJECUTADA")

        Toast.makeText(
            this,
            "MAIN ACTIVITY EJECUTADA",
            Toast.LENGTH_LONG
        ).show()

        RFIDTest.test()
    }
}