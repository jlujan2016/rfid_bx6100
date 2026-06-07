package com.lujan.app_bx6100

import android.util.Log
import com.handheld.uhfr.UHFRManager
import org.json.JSONArray
import org.json.JSONObject

object RFIDTest {

    // Potencia actual (rango 5-30 dBm)
    private var currentPower = 30

    fun setPower(power: Int): String {
        return try {
            val p = power.coerceIn(5, 30)
            val manager = UHFRManager.getInstance()
                ?: return JSONObject().apply {
                    put("success", false)
                    put("error", "Manager no disponible")
                }.toString()

            manager.setPower(p, p)
            currentPower = p
            Log.d("RFID", "Potencia configurada: $p dBm")

            JSONObject().apply {
                put("success", true)
                put("power", p)
            }.toString()

        } catch (e: Throwable) {
            Log.e("RFID", "Error setPower: ${e.message}")
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Error desconocido")
            }.toString()
        }
    }

    fun getPower(): String {
        return try {
            val manager = UHFRManager.getInstance()
                ?: return JSONObject().apply {
                    put("success", false)
                    put("error", "Manager no disponible")
                }.toString()

            val powers = manager.getPower()
            JSONObject().apply {
                put("success", true)
                put("readPower", powers?.getOrNull(0) ?: currentPower)
                put("writePower", powers?.getOrNull(1) ?: currentPower)
            }.toString()

        } catch (e: Throwable) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Error desconocido")
            }.toString()
        }
    }

    fun scanTagsJson(duration: Int = 200): String {
        return try {
            val manager = UHFRManager.getInstance()
                ?: return JSONObject().apply {
                    put("success", false)
                    put("error", "UHFRManager.getInstance() retornó null")
                    put("tags", JSONArray())
                    put("count", 0)
                }.toString()

            val result = manager.tagInventoryByTimer(duration.toShort())

            if (result == null || result.isEmpty()) {
                return JSONObject().apply {
                    put("success", true)
                    put("tags", JSONArray())
                    put("count", 0)
                }.toString()
            }

            val tagsArray = JSONArray()

            for (tag in result) {
                try {
                    val cls = tag.javaClass

                    val epcField = cls.getDeclaredField("EpcId")
                    epcField.isAccessible = true
                    val epcBytes = epcField.get(tag) as ByteArray
                    val epcHex = epcBytes.joinToString("") {
                        String.format("%02X", it)
                    }

                    val rssiField = cls.getDeclaredField("RSSI")
                    rssiField.isAccessible = true
                    val rssi = (rssiField.get(tag) as? Int) ?: 0

                    tagsArray.put(JSONObject().apply {
                        put("epc", epcHex)
                        put("rssi", rssi)
                    })

                } catch (e: Throwable) {
                    Log.e("RFID", "Error parseando tag: ${e.message}")
                }
            }

            JSONObject().apply {
                put("success", true)
                put("tags", tagsArray)
                put("count", tagsArray.length())
            }.toString()

        } catch (e: Throwable) {
            Log.e("RFID", "Error: ${e.message}")
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Error desconocido")
                put("tags", JSONArray())
                put("count", 0)
            }.toString()
        }
    }
}