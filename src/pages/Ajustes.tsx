import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    AndroidRFID: {
      getBssidActual: () => string;
      setPower: (power: number) => string;
      getPower: () => string;
    };
  }
}

interface ZonaWifi {
  id: number;
  zona: string;
  bssid: string;
  activo: boolean;
}

export default function Ajustes() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [probando, setProbando] = useState(false);
  const [msgConexion, setMsgConexion] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msgGuardar, setMsgGuardar] = useState<string | null>(null);

  const [zonas, setZonas] = useState<ZonaWifi[]>([]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState<"Tienda" | "Almacen">("Tienda");

  const [potencia, setPotencia] = useState(30);
  const [msgPotencia, setMsgPotencia] = useState<string | null>(null);

  useEffect(() => {
    cargarConfig();
    cargarZonas();
    cargarPotencia();

    invoke<any>("debug_config").then(info => {
    console.log("📂 DB path:", info.db_path);
    console.log("📋 Config:", info.config);
  });
  }, []);

async function cargarConfig() {
  try {
    const cfg = await invoke<{ url: string; token: string }>("get_config_api");
    console.log("Configuración recuperada de Rust:", cfg); // Agrega este log para comprobarlo
    
    if (cfg) {
      setUrl(cfg.url || "");
      setToken(cfg.token || ""); // 👈 Asegúrate de que diga EXACTAMENTE .token
    }
  } catch (e) {
    console.error("Error al cargar configuración:", e);
  }
}


  async function cargarZonas() {
    try {
      const z = await invoke<ZonaWifi[]>("get_zonas_wifi");
      setZonas(z);
    } catch (e) {
      console.error(e);
    }
  }

  async function guardarConfig() {
    setGuardando(true);
    setMsgGuardar(null);
    try {
      await invoke("set_config_api", { url, token });
      setMsgGuardar("✅ Configuración guardada");
    } catch (e) {
      setMsgGuardar("❌ " + String(e));
    } finally {
      setGuardando(false);
      setTimeout(() => setMsgGuardar(null), 3000);
    }
  }

  async function probarConexion() {
    if (!url || !token) {
      setMsgConexion({ ok: false, texto: "Completa URL y token primero" });
      return;
    }
    setProbando(true);
    setMsgConexion(null);
    try {
      const resultado = await invoke<string>("probar_conexion", { url, token });
      setMsgConexion({ ok: true, texto: resultado });
    } catch (e) {
      setMsgConexion({ ok: false, texto: String(e) });
    } finally {
      setProbando(false);
    }
  }

  async function capturarBssid() {
    if (!window.AndroidRFID?.getBssidActual) {
      alert("Función no disponible");
      return;
    }
    try {
      const raw = window.AndroidRFID.getBssidActual();
      const data = JSON.parse(raw);

      if (!data.success || !data.bssid || data.bssid === "02:00:00:00:00:00") {
        alert("No se pudo obtener el BSSID. Verifica que el WiFi esté conectado y los permisos de ubicación otorgados.");
        return;
      }

      await invoke("agregar_zona_wifi", { zona: zonaSeleccionada, bssid: data.bssid });
      await cargarZonas();
    } catch (e) {
      alert("Error: " + String(e));
    }
  }

  async function eliminarZona(id: number) {
    try {
      await invoke("eliminar_zona_wifi", { id });
      await cargarZonas();
    } catch (e) {
      console.error(e);
    }
  }

  function cargarPotencia() {
  try {
    if (!window.AndroidRFID?.getPower) return;
    const raw = JSON.parse(window.AndroidRFID.getPower());
    if (raw.success) setPotencia(raw.readPower);
  } catch (e) {
    console.error("Error leyendo potencia:", e);
  }
}

function aplicarPotencia(valor: number) {
  try {
    const raw = JSON.parse(window.AndroidRFID.setPower(valor));
    if (raw.success) {
      setPotencia(raw.power);
      setMsgPotencia(`✅ Potencia aplicada: ${raw.power} dBm`);
    } else {
      setMsgPotencia(`❌ ${raw.error}`);
    }
  } catch (e) {
    setMsgPotencia("❌ " + String(e));
  }
  setTimeout(() => setMsgPotencia(null), 3000);
}

function colorPotencia(p: number): string {
  if (p <= 15) return "#2e7d32";
  if (p <= 23) return "#f57f17";
  return "#c62828";
}

const [sincronizando, setSincronizando] = useState(false);
const [msgSync, setMsgSync] = useState<string | null>(null);

async function sincronizarJoyas() {
  setSincronizando(true);
  setMsgSync(null);
  try {
    const msg = await invoke<string>("sync_joyas_a_api");
    setMsgSync(msg);
  } catch (e) {
    setMsgSync("❌ " + String(e));
  } finally {
    setSincronizando(false);
    setTimeout(() => setMsgSync(null), 5000);
  }
}

  const zonasTienda = zonas.filter(z => z.zona === "Tienda");
  const zonasAlmacen = zonas.filter(z => z.zona === "Almacen");

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

      <h2 style={{ margin: "0 0 16px" }}>Ajustes</h2>
      <p style={{ margin: "-12px 0 16px", fontSize: 12, color: "#666" }}>
        Zonas y conexión
      </p>

      {/* Sistema Web */}
      <div style={styles.card}>
        <p style={styles.sectionTitle}>SISTEMA WEB</p>

        <label style={styles.label}>URL de la API</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://mitienda.com/api"
          style={styles.input}
        />

        <label style={{ ...styles.label, marginTop: 12 }}>Token de acceso</label>
        <input
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Token JWT"
          type="password"
          style={styles.input}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={guardarConfig}
            disabled={guardando}
            style={{ ...styles.btnPrimario, flex: 1 }}
          >
            {guardando ? "Guardando..." : "💾 Guardar"}
          </button>
          <button
            onClick={probarConexion}
            disabled={probando}
            style={{ ...styles.btnSecundario, flex: 1 }}
          >
            {probando ? "Probando..." : "↻ Probar conexión"}
          </button>
        </div>

        {msgGuardar && (
          <p style={{ fontSize: 12, color: msgGuardar.startsWith("✅") ? "#2e7d32" : "#c62828", marginTop: 8 }}>
            {msgGuardar}
          </p>
        )}

        {msgConexion && (
          <div style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            backgroundColor: msgConexion.ok ? "#e8f5e9" : "#ffebee",
            color: msgConexion.ok ? "#2e7d32" : "#c62828",
            fontSize: 13,
          }}>
            {msgConexion.ok ? "✅" : "❌"} {msgConexion.texto}
          </div>
        )}
      </div>

      {/* Zonas WiFi */}
      <div style={styles.card}>
        <p style={styles.sectionTitle}>ZONAS WIFI</p>
        <p style={{ fontSize: 12, color: "#666", marginTop: -4, marginBottom: 12 }}>
          Asocia el BSSID del router de cada ubicación para detección automática de zona.
        </p>

        {/* Selector zona para capturar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["Tienda", "Almacen"] as const).map(z => (
            <button
              key={z}
              onClick={() => setZonaSeleccionada(z)}
              style={{
                flex: 1,
                padding: "8px 0",
                border: "none",
                borderRadius: 8,
                backgroundColor: zonaSeleccionada === z ? "#6C63FF" : "#f0f0f0",
                color: zonaSeleccionada === z ? "white" : "#333",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {z === "Tienda" ? "🏪" : "🏢"} {z}
            </button>
          ))}
        </div>

        <button onClick={capturarBssid} style={styles.btnCapturar}>
          📡 + Capturar BSSID actual para {zonaSeleccionada}
        </button>

        {/* Lista Tienda */}
        <div style={{ marginTop: 16 }}>
          <p style={styles.zonaLabel}>🏪 Tienda</p>
          {zonasTienda.length === 0 && (
            <p style={styles.sinDatos}>Sin redes registradas</p>
          )}
          {zonasTienda.map(z => (
            <div key={z.id} style={styles.zonaItem}>
              <span style={{ fontFamily: "monospace", fontSize: 13 }}>{z.bssid}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={styles.badgeActivo}>activo</span>
                <button onClick={() => eliminarZona(z.id)} style={styles.btnEliminarMini}>✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Lista Almacén */}
        <div style={{ marginTop: 12 }}>
          <p style={styles.zonaLabel}>🏢 Almacén</p>
          {zonasAlmacen.length === 0 && (
            <p style={styles.sinDatos}>Sin redes registradas</p>
          )}
          {zonasAlmacen.map(z => (
            <div key={z.id} style={styles.zonaItem}>
              <span style={{ fontFamily: "monospace", fontSize: 13 }}>{z.bssid}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={styles.badgeActivo}>activo</span>
                <button onClick={() => eliminarZona(z.id)} style={styles.btnEliminarMini}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

       {/* Potencia del lector */}
        <div style={styles.card}>
        <p style={styles.sectionTitle}>POTENCIA DEL LECTOR</p>
        <p style={{ fontSize: 12, color: "#666", marginTop: -4, marginBottom: 12 }}>
            Ajusta el alcance de lectura RFID. Mayor potencia = mayor alcance pero más consumo de batería.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: "bold" }}>Potencia actual</span>
            <span style={{ fontSize: 22, fontWeight: "bold", color: colorPotencia(potencia) }}>
            {potencia} dBm
            </span>
        </div>

        {/* Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "#666" }}>5</span>
            <input
            type="range"
            min={5}
            max={30}
            value={potencia}
            onChange={e => setPotencia(Number(e.target.value))}
            style={{ flex: 1 }}
            />
            <span style={{ fontSize: 12, color: "#666" }}>30</span>
        </div>

        {/* Botones rápidos */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[15, 20, 25, 30].map(p => (
            <button
                key={p}
                onClick={() => { setPotencia(p); aplicarPotencia(p); }}
                style={{
                flex: 1,
                padding: "8px 0",
                border: "none",
                borderRadius: 8,
                backgroundColor: potencia === p ? colorPotencia(p) : "#f0f0f0",
                color: potencia === p ? "white" : "#333",
                fontSize: 13,
                fontWeight: potencia === p ? "bold" : "normal",
                cursor: "pointer",
                }}
            >
                {p} dBm
            </button>
            ))}
        </div>

        <button onClick={() => aplicarPotencia(potencia)} style={styles.btnPrimario}>
            Aplicar potencia
        </button>

        {msgPotencia && (
            <p style={{
            fontSize: 12,
            color: msgPotencia.startsWith("✅") ? "#2e7d32" : "#c62828",
            marginTop: 8,
            marginBottom: 0,
            }}>
            {msgPotencia}
            </p>
        )}
        </div>   
     {/* Sección Sincronización */}
        <div style={styles.card}>
        <p style={styles.sectionTitle}>SINCRONIZACIÓN</p>
        <p style={{ fontSize: 12, color: "#666", marginTop: -4, marginBottom: 12 }}>
            Envía el catálogo local al sistema web.
        </p>

        <button
            onClick={sincronizarJoyas}
            disabled={sincronizando}
            style={{
            ...styles.btnPrimario,
            width: "100%",
            opacity: sincronizando ? 0.6 : 1,
            }}
        >
            {sincronizando ? "⏳ Sincronizando..." : "↑ Sincronizar joyas al servidor"}
        </button>

        {msgSync && (
            <div style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            backgroundColor: msgSync.startsWith("✅") ? "#e8f5e9" : "#ffebee",
            color: msgSync.startsWith("✅") ? "#2e7d32" : "#c62828",
            fontSize: 13,
            }}>
            {msgSync}
            </div>
        )}
        </div>   
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "white",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#999",
    letterSpacing: 1,
    margin: "0 0 12px",
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "white",
  },
  btnPrimario: {
    padding: 12,
    backgroundColor: "#1a1a2e",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnSecundario: {
    padding: 12,
    backgroundColor: "white",
    color: "#1a1a2e",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  btnCapturar: {
    width: "100%",
    padding: 12,
    backgroundColor: "#f5f3ff",
    color: "#6C63FF",
    border: "1px solid #e0d7ff",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: "bold",
    cursor: "pointer",
  },
  zonaLabel: {
    fontSize: 13,
    fontWeight: "bold",
    margin: "0 0 8px",
  },
  zonaItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #f5f5f5",
  },
  badgeActivo: {
    fontSize: 11,
    color: "#2e7d32",
    backgroundColor: "#e8f5e9",
    padding: "2px 8px",
    borderRadius: 6,
  },
  btnEliminarMini: {
    background: "none",
    border: "none",
    color: "#c62828",
    fontSize: 14,
    cursor: "pointer",
    padding: "0 4px",
  },
  sinDatos: {
    fontSize: 12,
    color: "#999",
    margin: 0,
  },
};

