import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TagEscaneado, Joya, ResultadoTag } from "../types";
import { useGatillo } from "../hooks/useGatillo";

declare global {
  interface Window {
    AndroidRFID: {
      scanRFID: (duration: number) => string;
      setPower: (power: number) => string;
    };
  }
}

interface Props {
  onFinalizar: (tomaId: number, resultados: ResultadoTag[]) => void;
}

type Zona = "Tienda" | "Almacen";
type EstadoEscaneo = "idle" | "escaneando" | "pausado";

export default function Escanear({ onFinalizar }: Props) {
  const [estado, setEstado] = useState<EstadoEscaneo>("idle");
  const [zonaSeleccionada, setZonaSeleccionada] = useState<Zona>("Tienda");
  const [tags, setTags] = useState<Map<string, TagEscaneado>>(new Map());
  const [tomaId, setTomaId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rfidReady, setRfidReady] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Caché de joyas para no consultar DB en cada scan
  const joyasCache = useRef<Map<string, Joya>>(new Map());
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tomaIdRef = useRef<number | null>(null);
  const zonaRef = useRef<Zona>("Tienda");
  const estadoRef = useRef<EstadoEscaneo>("idle");
  const epcsGuardadosRef = useRef<Set<string>>(new Set());

  // Verificar hardware
  useEffect(() => {
    const check = setInterval(() => {
      if (window.AndroidRFID) {
        setRfidReady(true);
        clearInterval(check);
      }
    }, 300);
    return () => clearInterval(check);
  }, []);

  // Cargar joyas al iniciar para tener caché
  useEffect(() => {
    cargarJoyas();
  }, []);

  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  useGatillo(() => {
    if (estadoRef.current === "idle")            iniciarEscaneo();
    else if (estadoRef.current === "escaneando") pausar();
    else if (estadoRef.current === "pausado")    reanudar();
  });
  
  async function cargarJoyas() {
    try {
      const joyas = await invoke<Joya[]>("get_joyas", { categoria: null });
      const map = new Map<string, Joya>();
      joyas.forEach(j => {
        if (j.epc) map.set(j.epc, j);
      });
      joyasCache.current = map;
    } catch (e) {
      console.error("Error cargando joyas:", e);
    }
  }

  function buscarJoyaPorEpc(epc: string): Joya | null {
    return joyasCache.current.get(epc) ?? null;
  }

async function iniciarEscaneo() {
  if (!rfidReady) return;
  setError(null);

  try {
    // Crear toma en DB
    const id = await invoke<number>("crear_toma", {
      ubicacion: zonaSeleccionada,
    });
    setTomaId(id);
    tomaIdRef.current = id;
    zonaRef.current = zonaSeleccionada;
    setTags(new Map());
    epcsGuardadosRef.current = new Set(); // ← reiniciar set
    setEstado("escaneando");
    iniciarLoop();
  } catch (e) {
    setError("Error al crear toma: " + String(e));
  }
}

function iniciarLoop() {
  scanIntervalRef.current = setInterval(async () => {
    try {
      const raw = window.AndroidRFID.scanRFID(200);
      const data = JSON.parse(raw);

      if (!data.success || data.tags.length === 0) return;

      for (const tag of data.tags) {
        const joya = buscarJoyaPorEpc(tag.epc);

        // Guardar en DB
        if (tomaIdRef.current !== null) {
          await invoke("insertar_tag_toma", {
            tomaId: tomaIdRef.current,
            epc: tag.epc,
            rssi: tag.rssi,
          });
        }

        // Actualizar estado local
        setTags(prev => {
          const next = new Map(prev);
          const existing = next.get(tag.epc);
          next.set(tag.epc, {
            epc: tag.epc,
            rssi: tag.rssi,
            count: existing ? existing.count + 1 : 1,
            joya,
            zona: zonaRef.current,
            ultima_lectura: new Date().toLocaleTimeString(),
          });
          return next;
        });
      }
    } catch (e) {
      console.error("Error en scan:", e);
    }
  }, 300);
}

  function pausar() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setEstado("pausado");
  }

  function reanudar() {
    setEstado("escaneando");
    iniciarLoop();
  }

  async function finalizarYConciliar() {
    pausar();
    if (tomaId === null) return;
    setCargando(true);

    try {
      const resultados = await invoke<ResultadoTag[]>("conciliar_toma", {
        tomaId,
      });
      onFinalizar(tomaId, resultados);
    } catch (e) {
      setError("Error al conciliar: " + String(e));
    } finally {
      setCargando(false);
    }
  }

  // Contadores
  const tagList = Array.from(tags.values());
  const totalTienda = tagList.filter(t => t.zona === "Tienda").length;
  const totalAlmacen = tagList.filter(t => t.zona === "Almacen").length;
  const total = tagList.length;

  // Últimos 10 tags ordenados por última lectura
  const ultimosTags = [...tagList]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>
            {estado === "idle" ? "Escanear" : "Escaneando..."}
          </h2>
          {tomaId && (
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              Toma #{tomaId} — {new Date().toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Botón Pausar/Reanudar */}
        {estado === "escaneando" && (
          <button onClick={pausar} style={styles.btnPausar}>
            ⏸ Pausar
          </button>
        )}
        {estado === "pausado" && (
          <button onClick={reanudar} style={styles.btnReanudar}>
            ▶ Reanudar
          </button>
        )}
      </div>

      {/* Selector de zona — solo antes de iniciar */}
      {estado === "idle" && (
        <div style={styles.card}>
          <p style={{ margin: "0 0 12px", fontWeight: "bold" }}>
            Seleccionar zona
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {(["Tienda", "Almacen"] as Zona[]).map(zona => (
              <button
                key={zona}
                onClick={() => setZonaSeleccionada(zona)}
                style={{
                  ...styles.btnZona,
                  backgroundColor: zonaSeleccionada === zona ? "#6C63FF" : "#f0f0f0",
                  color: zonaSeleccionada === zona ? "white" : "#333",
                }}
              >
                {zona === "Tienda" ? "🏪" : "🏢"} {zona}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zona actual durante escaneo */}
      {estado !== "idle" && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#666" }}>Zona actual</span>
            <span style={{
              backgroundColor: "#e8f5e9",
              color: "#2e7d32",
              padding: "4px 12px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: "bold",
            }}>
              🟢 {zonaSeleccionada}
            </span>
          </div>
        </div>
      )}

      {/* Contadores */}
      {estado !== "idle" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ ...styles.contador, backgroundColor: "#e3f2fd" }}>
            <span style={{ fontSize: 28, fontWeight: "bold", color: "#1565c0" }}>
              {totalTienda}
            </span>
            <span style={{ fontSize: 12, color: "#666" }}>Tienda</span>
          </div>
          <div style={{ ...styles.contador, backgroundColor: "#e8f5e9" }}>
            <span style={{ fontSize: 28, fontWeight: "bold", color: "#2e7d32" }}>
              {totalAlmacen}
            </span>
            <span style={{ fontSize: 12, color: "#666" }}>Almacén</span>
          </div>
          <div style={{ ...styles.contador, backgroundColor: "#f3e5f5" }}>
            <span style={{ fontSize: 28, fontWeight: "bold", color: "#6a1b9a" }}>
              {total}
            </span>
            <span style={{ fontSize: 12, color: "#666" }}>Total</span>
          </div>
        </div>
      )}

      {/* Animación escaneando */}
      {estado === "escaneando" && (
        <div style={styles.cardEscaneando}>
          <p style={{ fontSize: 24, margin: "0 0 4px" }}>📡</p>
          <p style={{ margin: 0, fontWeight: "bold", color: "#6C63FF" }}>
            Leyendo tags...
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
            Mueve el lector lentamente
          </p>
        </div>
      )}

      {estado === "pausado" && (
        <div style={{ ...styles.cardEscaneando, backgroundColor: "#fff8e1" }}>
          <p style={{ fontSize: 24, margin: "0 0 4px" }}>⏸</p>
          <p style={{ margin: 0, fontWeight: "bold", color: "#f57f17" }}>
            Pausado
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {/* Botón iniciar */}
      {estado === "idle" && (
        <button
          onClick={iniciarEscaneo}
          disabled={!rfidReady}
          style={styles.btnIniciar}
        >
          {rfidReady ? "▶ Iniciar escaneo" : "⏳ Iniciando hardware..."}
        </button>
      )}

      {/* Últimos tags */}
      {ultimosTags.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", fontWeight: "bold", fontSize: 14 }}>
            Últimos tags capturados
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ultimosTags.map(tag => (
              <div key={tag.epc} style={styles.tagCard}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontFamily: "monospace", fontSize: 12, fontWeight: "bold" }}>
                    {tag.epc}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
                    {tag.zona} · RSSI {tag.rssi} dBm · {tag.count}x
                  </p>
                  {tag.joya && (
                    <p style={{ margin: 0, fontSize: 11, color: "#444" }}>
                      {tag.joya.nombre}
                    </p>
                  )}
                </div>
                <span style={{
                  ...styles.badge,
                  backgroundColor: tag.joya ? "#e8f5e9" : "#fff3e0",
                  color: tag.joya ? "#2e7d32" : "#e65100",
                }}>
                  {tag.joya ? "OK" : "No esperado"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón finalizar */}
      {estado !== "idle" && (
        <button
          onClick={finalizarYConciliar}
          disabled={cargando || total === 0}
          style={styles.btnFinalizar}
        >
          {cargando ? "⏳ Procesando..." : "✓ Finalizar y conciliar"}
        </button>
      )}
    </div>
  );
}

// ============ ESTILOS ============

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "white",
  },
  cardEscaneando: {
    border: "1px solid #e0d7ff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    backgroundColor: "#f5f3ff",
    textAlign: "center",
  },
  contador: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  btnZona: {
    flex: 1,
    padding: "10px 0",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  btnIniciar: {
    width: "100%",
    padding: 16,
    backgroundColor: "#6C63FF",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: 16,
  },
  btnPausar: {
    padding: "8px 16px",
    backgroundColor: "#ff9800",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  btnReanudar: {
    padding: "8px 16px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  btnFinalizar: {
    width: "100%",
    padding: 16,
    backgroundColor: "#1a1a2e",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 16,
  },
  tagCard: {
    border: "1px solid #eee",
    borderRadius: 8,
    padding: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "white",
  },
  badge: {
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  error: {
    backgroundColor: "#ffebee",
    color: "#c62828",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 13,
  },
};