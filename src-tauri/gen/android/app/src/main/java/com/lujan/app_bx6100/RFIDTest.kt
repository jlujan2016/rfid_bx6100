package com.lujan.app_bx6100

import android.util.Log
import com.handheld.uhfr.UHFRManager
import org.json.JSONArray
import org.json.JSONObject

object RFIDTest {

    fun scanTagsJson(duration: Int = 200): String {
        return try {
            val manager = UHFRManager.getInstance()
            // ✅ CORRECCIÓN: Convertir Int a Short
            val durationShort = duration.toShort()
            val result = manager.tagInventoryByTimer(durationShort)
            val tagsArray = JSONArray()
            
            result?.forEach { tag ->
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
                    val rssiRaw = rssiField.get(tag)
                    
                    // Convertir a Int de forma segura
                    val rssi = when (rssiRaw) {
                        is Int -> rssiRaw
                        is Short -> rssiRaw.toInt()
                        is Long -> rssiRaw.toInt()
                        else -> 0
                    }
                    
                    val tagObject = JSONObject().apply {
                        put("epc", epcHex)
                        put("rssi", rssi)
                    }
                    tagsArray.put(tagObject)
                    
                    Log.e("RFID_TAG", "EPC=$epcHex RSSI=$rssi")
                    
                } catch (e: Exception) {
                    Log.e("RFID_TEST", "Error procesando tag: ${e.message}")
                }
            }
            
            JSONObject().apply {
                put("success", true)
                put("tags", tagsArray)
                put("count", tagsArray.length())
            }.toString()
            
        } catch (e: Throwable) {
            Log.e("RFID_TEST", "❌ ERROR: ${e.message}")
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Error desconocido")
                put("tags", JSONArray())
                put("count", 0)
            }.toString()
        }
    }
}