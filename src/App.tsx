import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RFIDTag {
  epc: string;
  rssi: number;
  count: number;
}

declare global {
  interface Window {
    AndroidRFID: {
      scanRFID: (duration: number) => string;
      setPower: (power: number) => string;
      getPower: () => string;
    };
  }
}

function App() {
  const [rustMsg, setRustMsg] = useState("");
  const [rfidTags, setRfidTags] = useState<Map<string, RFIDTag>>(new Map());
  const [rfidMsg, setRfidMsg] = useState("");
  const [rfidReady, setRfidReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [power, setPower] = useState(30);
  const [powerMsg, setPowerMsg] = useState("");
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = setInterval(() => {
      if (window.AndroidRFID) {
        setRfidReady(true);
        clearInterval(check);
        // Leer potencia actual al iniciar
        loadCurrentPower();
      }
    }, 300);
    return () => clearInterval(check);
  }, []);

  function loadCurrentPower() {
    try {
      const raw = JSON.parse(window.AndroidRFID.getPower());
      if (raw.success) setPower(raw.readPower);
    } catch (e) {
      console.error("Error leyendo potencia:", e);
    }
  }

  function applyPower(value: number) {
    try {
      const raw = JSON.parse(window.AndroidRFID.setPower(value));
      if (raw.success) {
        setPower(raw.power);
        setPowerMsg(`✅ Potencia aplicada: ${raw.power} dBm`);
      } else {
        setPowerMsg(`❌ ${raw.error}`);
      }
    } catch (e) {
      setPowerMsg("Error: " + String(e));
    }
    setTimeout(() => setPowerMsg(""), 3000);
  }

  async function probarRust() {
    try {
      const resp = await invoke<string>("ping");
      setRustMsg(resp);
    } catch (e) {
      setRustMsg("Error: " + String(e));
    }
  }

  function startScan() {
    if (!rfidReady) return;
    setIsScanning(true);
    setRfidMsg("");

    scanIntervalRef.current = setInterval(() => {
      try {
        const raw = window.AndroidRFID.scanRFID(200);
        const data = JSON.parse(raw);

        if (data.success && data.tags.length > 0) {
          setRfidTags(prev => {
            const next = new Map(prev);
            for (const tag of data.tags) {
              const existing = next.get(tag.epc);
              next.set(tag.epc, {
                epc: tag.epc,
                rssi: tag.rssi,
                count: existing ? existing.count + 1 : 1,
              });
            }
            return next;
          });
        } else if (!data.success) {
          setRfidMsg(`❌ ${data.error}`);
        }
      } catch (e) {
        setRfidMsg("Error: " + String(e));
      }
    }, 300);
  }

  function stopScan() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
    setRfidMsg(`✅ Detenido — ${rfidTags.size} tags únicos`);
  }

  function clearTags() {
    setRfidTags(new Map());
    setRfidMsg("");
  }

  const tagList = Array.from(rfidTags.values())
    .sort((a, b) => b.count - a.count);

  // Color según nivel de potencia
  function powerColor(p: number) {
    if (p <= 10) return "#4CAF50";
    if (p <= 20) return "#FF9800";
    return "#f44336";
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ textAlign: "center" }}>📡 Lector UHF-RFID BX6100</h1>

      {/* Test Rust */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <button onClick={probarRust}
          style={{ padding: "10px 20px", fontSize: 14 }}>
          🦀 Test Rust
        </button>
        {rustMsg && <p style={{ color: "green" }}>{rustMsg}</p>}
      </div>

      {/* Control de potencia */}
      <div style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
        marginBottom: 24
      }}>
        <h3 style={{ margin: "0 0 12px" }}>
          ⚡ Potencia de lectura
          <span style={{
            marginLeft: 12,
            color: powerColor(power),
            fontWeight: "bold"
          }}>
            {power} dBm
          </span>
        </h3>

        {/* Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "#666" }}>5</span>
          <input
            type="range"
            min={5}
            max={30}
            value={power}
            onChange={e => setPower(Number(e.target.value))}
            disabled={isScanning}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: "#666" }}>30</span>
          <button
            onClick={() => applyPower(power)}
            disabled={isScanning}
            style={{
              padding: "6px 14px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: 4,
            }}>
            Aplicar
          </button>
        </div>

        {/* Botones rápidos */}
        <div style={{ display: "flex", gap: 8 }}>
          {[10, 15, 20, 25, 30].map(p => (
            <button
              key={p}
              onClick={() => { setPower(p); applyPower(p); }}
              disabled={isScanning}
              style={{
                flex: 1,
                padding: "6px 0",
                backgroundColor: power === p ? powerColor(p) : "#f0f0f0",
                color: power === p ? "white" : "#333",
                border: "none",
                borderRadius: 4,
                fontWeight: power === p ? "bold" : "normal",
                fontSize: 13,
              }}>
              {p}
            </button>
          ))}
        </div>

        {powerMsg && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "green" }}>
            {powerMsg}
          </p>
        )}
      </div>

      {/* Controles de escaneo */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
        <button
          onClick={startScan}
          disabled={isScanning || !rfidReady}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: 4,
            opacity: isScanning ? 0.5 : 1,
          }}>
          ▶ Iniciar
        </button>

        <button
          onClick={stopScan}
          disabled={!isScanning}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: 4,
            opacity: !isScanning ? 0.5 : 1,
          }}>
          ⏹ Detener
        </button>

        <button
          onClick={clearTags}
          disabled={isScanning}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            border: "1px solid #ccc",
            borderRadius: 4,
            opacity: isScanning ? 0.5 : 1,
          }}>
          🗑 Limpiar
        </button>
      </div>

      {isScanning && (
        <p style={{ textAlign: "center", color: "#2196F3" }}>
          🔍 Escaneando a {power} dBm — {rfidTags.size} tags únicos
        </p>
      )}

      {rfidMsg && (
        <p style={{ textAlign: "center" }}>{rfidMsg}</p>
      )}

      {/* Tabla de tags */}
      {tagList.length > 0 && (
        <div style={{ maxHeight: 400, overflowY: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f2f2f2", position: "sticky", top: 0 }}>
                <th style={{ border: "1px solid #ddd", padding: 8 }}>#</th>
                <th style={{ border: "1px solid #ddd", padding: 8 }}>EPC</th>
                <th style={{ border: "1px solid #ddd", padding: 8 }}>RSSI</th>
                <th style={{ border: "1px solid #ddd", padding: 8 }}>Lecturas</th>
              </tr>
            </thead>
            <tbody>
              {tagList.map((tag, i) => (
                <tr key={tag.epc}
                  style={{ backgroundColor: i % 2 === 0 ? "white" : "#fafafa" }}>
                  <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "center" }}>
                    {i + 1}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: 8, fontFamily: "monospace", fontSize: 12 }}>
                    {tag.epc}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "center" }}>
                    {tag.rssi}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "center", fontWeight: "bold", color: "#2196F3" }}>
                    {tag.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;