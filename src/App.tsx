import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";  // ← Esta es la correcta
import "./App.css";

interface RFIDTag {
  epc: string;
  rssi: number;
}

declare global {
  interface Window {
    AndroidRFID: {
      scanRFID: (timeout: number) => string;
    };
    __TAURI__?: any;
    __TAURI_INTERNALS__?: any;
  }
}

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [rfidTags, setRfidTags] = useState<RFIDTag[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [rfidError, setRfidError] = useState<string | null>(null);
  const [tauriReady, setTauriReady] = useState(false);
  const [androidRfidReady, setAndroidRfidReady] = useState(false);

  // Verificar disponibilidad de las APIs
  useEffect(() => {
    const checkAPIs = async () => {
      // Verificar Tauri (para greet)
      try {
        // Verificar si estamos en entorno Tauri
        const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
        
        if (isTauri) {
          // Probar invoke con una función simple
          const testInvoke = typeof invoke !== 'undefined';
          if (testInvoke) {
            setTauriReady(true);
            console.log("✅ Tauri está listo");
          } else {
            console.warn("⚠️ Tauri detectado pero invoke no disponible");
          }
        } else {
          console.warn("⚠️ Tauri no detectado en este entorno");
          setTauriReady(false);
        }
      } catch (error) {
        console.warn("⚠️ Error detectando Tauri:", error);
        setTauriReady(false);
      }
      
      // Verificar AndroidRFID (para escáner)
      if (window.AndroidRFID && typeof window.AndroidRFID.scanRFID === 'function') {
        setAndroidRfidReady(true);
        console.log("✅ AndroidRFID está listo");
      } else {
        console.warn("⚠️ AndroidRFID no disponible");
      }
    };
    
    checkAPIs();
  }, []);

  // Función greet usando Tauri
  async function greet() {
    if (!tauriReady) {
      setGreetMsg("⚠️ Tauri no está disponible. Verifica la instalación.");
      console.error("Tauri no está listo para usar invoke");
      return;
    }
    
    if (!name.trim()) {
      setGreetMsg("Por favor ingresa un nombre");
      return;
    }
    
    try {
      console.log("Llamando a greet con nombre:", name);
      const message = await invoke("greet", { name });
      setGreetMsg(message as string);
      console.log("Respuesta de greet:", message);
    } catch (error) {
      console.error("Error en greet:", error);
      setGreetMsg(`Error: ${error}`);
    }
  }

  // Función para escanear RFID (usando Android directamente)
  async function scanRFID() {
    if (!androidRfidReady) {
      setRfidError("AndroidRFID no está disponible");
      return;
    }
    
    setIsScanning(true);
    setRfidError(null);
    
    try {
      const result = window.AndroidRFID.scanRFID(200);
      console.log("Resultado RFID:", result);
      
      const data = JSON.parse(result);
      
      if (data.success) {
        setRfidTags(data.tags);
        console.log(`✅ Encontrados ${data.count} tags`);
      } else {
        setRfidError(data.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error en scanRFID:", error);
      setRfidError(error as string);
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri + React + RFID</h1>

      <div className="status">
        <p>🔷 Estado Tauri: {tauriReady ? "✅ Conectado" : "⏳ No disponible"}</p>
        <p>📡 Estado RFID: {androidRfidReady ? "✅ Listo" : "⏳ No disponible"}</p>
      </div>

      {/* Sección Greet */}
      <form className="row" onSubmit={(e) => { e.preventDefault(); greet(); }}>
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
          value={name}
        />
        <button type="submit" disabled={!tauriReady}>
          Greet
        </button>
      </form>
      {greetMsg && <p className="greet-message">{greetMsg}</p>}

      {/* Sección RFID */}
      <div style={{ marginTop: "40px", borderTop: "2px solid #ccc", paddingTop: "20px" }}>
        <h2>📡 Escáner RFID</h2>
        
        <button 
          onClick={scanRFID} 
          disabled={isScanning || !androidRfidReady}
          style={{
            backgroundColor: isScanning ? "#ccc" : "#4CAF50",
            color: "white",
            padding: "10px 20px",
            margin: "10px 0",
            border: "none",
            borderRadius: "4px",
            cursor: isScanning ? "not-allowed" : "pointer"
          }}
        >
          {isScanning ? "🔍 Escaneando..." : "🔘 Escanear RFID"}
        </button>

        {rfidError && (
          <div style={{ backgroundColor: "#ff4444", color: "white", padding: "10px", borderRadius: "4px", margin: "10px 0" }}>
            ❌ Error: {rfidError}
          </div>
        )}

        {rfidTags.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <h3>📋 Tags Encontrados ({rfidTags.length})</h3>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f2f2f2", position: "sticky", top: 0 }}>
                    <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>#</th>
                    <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>EPC (Hex)</th>
                    <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>RSSI (dBm)</th>
                  </tr>
                </thead>
                <tbody>
                  {rfidTags.map((tag, index) => (
                    <tr key={index}>
                      <td style={{ border: "1px solid #ddd", padding: "8px" }}>{index + 1}</td>
                      <td style={{ border: "1px solid #ddd", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
                        {tag.epc}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>
                        {tag.rssi}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default App;