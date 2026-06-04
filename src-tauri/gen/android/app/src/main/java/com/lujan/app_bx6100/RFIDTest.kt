package com.lujan.app_bx6100

import android.util.Log
import com.handheld.uhfr.UHFRManager

object RFIDTest {

    fun test() {

        try {

            val manager = UHFRManager.getInstance()

            Log.e("RFID_TEST", "manager = $manager")

            val result = manager.tagInventoryByTimer(200)

            Log.e("RFID_TEST", "RESULT = $result")

            if (result != null) {

                Log.e("RFID_TEST", "TOTAL TAGS = ${result.size}")

                for (tag in result) {

                    val cls = tag.javaClass

                    val epcField = cls.getDeclaredField("EpcId")
                    epcField.isAccessible = true

                    val epcBytes = epcField.get(tag) as ByteArray

                    val epcHex = epcBytes.joinToString("") {
                        String.format("%02X", it)
                    }

                    val rssiField = cls.getDeclaredField("RSSI")
                    rssiField.isAccessible = true

                    val rssi = rssiField.get(tag)

                    Log.e("RFID_TAG", "EPC=$epcHex RSSI=$rssi")
                }
            }

        } catch (e: Throwable) {

            Log.e("RFID_TEST", "ERROR", e)

        }
    }
}