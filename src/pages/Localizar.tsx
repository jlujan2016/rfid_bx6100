import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Joya } from "../types";

declare global {
  interface Window {
    AndroidRFID: {
      scanRFID: (duration: number) => string;
      vibrar: (duracionMs: number) => void;
      vibrarPatron: (patron: string) => void;
    };
  }
}

interface TagRadar {
  epc: string;
  rssi: number;
  lecturas: number;
}

// Convierte RSSI a distancia estimada en metros
function rssiADistancia(rssi: number): number {
  // Fórmula path loss: d = 10^((txPower - rssi) / (10 * n))
  // txPower ≈ -40 dBm a 1 metro, n = 2.5 (entorno típico)
  const txPower = -40;
  const n = 2.5;
  return Math.pow(10, (txPower - rssi) / (10 * n));
}

// Convierte RSSI a proximidad 0-1 (1 = muy cerca)
function rssiAProximidad(rssi: number): number {
  const min = -90;
  const max = -30;
  return Math.max(0, Math.min(1, (rssi - min) / (max - min)));
}

// Color según proximidad
function colorProximidad(proximidad: number): string {
  if (proximidad > 0.7) return "#2e7d32";
  if (proximidad > 0.4) return "#f57f17";
  return "#6C63FF";
}

export default function Localizar() {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Joya[]>([]);
  const [joyaBuscada, setJoyaBuscada] = useState<Joya | null>(null);
  const [tagRadar, setTagRadar] = useState<TagRadar | null>(null);
  const [otrosTags, setOtrosTags] = useState<TagRadar[]>([]);
  const [escaneando, setEscaneando] = useState(false);
  const [rfidReady, setRfidReady] = useState(false);

  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rssiAnteriorRef = useRef<number>(-100);
  const tagsCercaRef = useRef<Map<string, TagRadar>>(new Map());

  useEffect(() => {
    const check = setInterval(() => {
      if (window.AndroidRFID) {
        setRfidReady(true);
        clearInterval(check);
      }
    }, 300);
    return () => {
      clearInterval(check);
      detener();
    };
  }, []);

  async function buscar(texto: string) {
    setQuery(texto);
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    try {
      const joyas = await invoke<Joya[]>("buscar_joya", { query: texto });
      setResultados(joyas);
    } catch (e) {
      console.error(e);
    }
  }

  function seleccionarJoya(joya: Joya) {
    setJoyaBuscada(joya);
    setResultados([]);
    setQuery(joya.nombre);
    setTagRadar(null);
    iniciarRadar(joya.epc ?? "");
  }

  function iniciarRadar(epcObjetivo: string) {
    detener();
    if (!rfidReady) return;
    setEscaneando(true);
    tagsCercaRef.current = new Map();

    scanRef.current = setInterval(() => {
      try {
        const raw = window.AndroidRFID.scanRFID(200);
        const data = JSON.parse(raw);
        if (!data.success) return;

        const nuevosOtros: TagRadar[] = [];

        for (const tag of data.tags) {
          const existente = tagsCercaRef.current.get(tag.epc);
          const actualizado: TagRadar = {
            epc: tag.epc,
            rssi: tag.rssi,
            lecturas: existente ? existente.lecturas + 1 : 1,
          };
          tagsCercaRef.current.set(tag.epc, actualizado);

          if (tag.epc === epcObjetivo || (epcObjetivo === "" && !joyaBuscada)) {
            // Tag objetivo encontrado
            setTagRadar(actualizado);

            // Vibración según proximidad
            const proximidad = rssiAProximidad(tag.rssi);
            if (proximidad > 0.7 && tag.rssi > rssiAnteriorRef.current + 3) {
              window.AndroidRFID?.vibrar(100);
            } else if (proximidad > 0.4 && tag.rssi > rssiAnteriorRef.current + 5) {
              window.AndroidRFID?.vibrar(50);
            }
            rssiAnteriorRef.current = tag.rssi;
          } else {
            nuevosOtros.push(actualizado);
          }
        }

        setOtrosTags(nuevosOtros.slice(0, 3));
      } catch (e) {
        console.error("Error radar:", e);
      }
    }, 300);
  }

  function detener() {
    if (scanRef.current) {
      clearInterval(scanRef.current);
      scanRef.current = null;
    }
    setEscaneando(false);
  }

  function limpiar() {
    detener();
    setJoyaBuscada(null);
    setTagRadar(null);
    setOtrosTags([]);
    setQuery("");
    setResultados([]);
    rssiAnteriorRef.current = -100;
    tagsCercaRef.current = new Map();
  }

  const proximidad = tagRadar ? rssiAProximidad(tagRadar.rssi) : 0;
  const distancia = tagRadar ? rssiADistancia(tagRadar.rssi) : 0;
  const color = colorProximidad(proximidad);

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Localizar joya</h2>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            Digita o escanea el EPC
          </p>
        </div>
        <span style={{
          padding: "4px 12px",
          borderRadius: 12,
          fontSize: 12,
          backgroundColor: rfidReady ? "#e8f5e9" : "#f5f5f5",
          color: rfidReady ? "#2e7d32" : "#999",
        }}>
          {rfidReady ? "@ RFID activo" : "⏳ Iniciando..."}
        </span>
      </div>

      {/* Buscador */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <input
          value={query}
          onChange={e => buscar(e.target.value)}
          placeholder="EPC o nombre de joya..."
          style={{
            width: "100%",
            padding: "12px 16px 12px 40px",
            border: "1px solid #ddd",
            borderRadius: 12,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            backgroundColor: "white",
          }}
        />
        <span style={{ position: "absolute", left: 12, top: 13, fontSize: 16 }}>🔍</span>
        {query && (
          <button
            onClick={limpiar}
            style={{
              position: "absolute",
              right: 12,
              top: 10,
              background: "none",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              color: "#999",
            }}
          >✕</button>
        )}
      </div>

      {/* Resultados de búsqueda */}
      {resultados.length > 0 && (
        <div style={{
          border: "1px solid #eee",
          borderRadius: 12,
          backgroundColor: "white",
          marginBottom: 12,
          overflow: "hidden",
        }}>
          {resultados.map(joya => (
            <div
              key={joya.id}
              onClick={() => seleccionarJoya(joya)}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #f5f5f5",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: 14 }}>{joya.nombre}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
                  {joya.metal} · {joya.ubicacion}
                </p>
              </div>
              {joya.epc ? (
                <span style={{ fontSize: 11, color: "#2e7d32", fontFamily: "monospace" }}>
                  {joya.epc.slice(0, 8)}...
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#e65100" }}>Sin tag</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Accesos rápidos cuando no hay búsqueda */}
      {!joyaBuscada && !query && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>Accesos rápidos</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["E200 1234...ABCD", "E200 9ABC...1122", "E200 3344...7788"].map(epc => (
              <button
                key={epc}
                onClick={() => buscar(epc)}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 20,
                  backgroundColor: "white",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {epc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botones de acción cuando no hay joya seleccionada */}
      {!joyaBuscada && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => iniciarRadar("")}
            disabled={!rfidReady || escaneando}
            style={styles.btnPrimario}
          >
            📡 Escanear EPC con el lector
          </button>
          <p style={{ textAlign: "center", fontSize: 12, color: "#999", margin: 0 }}>
            Puedes escribir el EPC completo, parcial, o el nombre de la joya
          </p>
        </div>
      )}

      {/* RADAR — aparece cuando hay joya seleccionada */}
      {joyaBuscada && (
        <>
          {/* Info joya buscada */}
          <div style={styles.card}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#666" }}>Buscando</p>
            <p style={{ margin: 0, fontWeight: "bold" }}>{joyaBuscada.nombre}</p>
            {joyaBuscada.epc && (
              <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#666" }}>
                {joyaBuscada.epc}
              </p>
            )}
          </div>

          {/* Radar visual */}
          <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
            <RadarVisual
              proximidad={proximidad}
              color={color}
              activo={escaneando}
              encontrado={!!tagRadar}
            />
          </div>

          {/* Métricas */}
          {tagRadar ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={styles.metrica}>
                <span style={{ fontSize: 22, fontWeight: "bold", color }}>{tagRadar.rssi}</span>
                <span style={{ fontSize: 11, color: "#666" }}>dBm</span>
              </div>
              <div style={styles.metrica}>
                <span style={{ fontSize: 22, fontWeight: "bold", color }}>
                  {distancia < 10 ? distancia.toFixed(1) : ">10"}m
                </span>
                <span style={{ fontSize: 11, color: "#666" }}>distancia</span>
              </div>
              <div style={styles.metrica}>
                <span style={{ fontSize: 22, fontWeight: "bold", color: "#1a1a2e" }}>
                  {tagRadar.lecturas}
                </span>
                <span style={{ fontSize: 11, color: "#666" }}>lecturas</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 16, color: "#999" }}>
              <p style={{ margin: 0 }}>
                {escaneando ? "🔍 Buscando tag..." : "Presiona escanear"}
              </p>
            </div>
          )}

          {/* Otros tags cercanos */}
          {otrosTags.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                Otros tags detectados
              </p>
              {otrosTags.map(tag => (
                <div key={tag.epc} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #f5f5f5",
                }}>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "#666" }}>
                    {tag.epc.slice(0, 16)}...
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: Math.max(20, rssiAProximidad(tag.rssi) * 60),
                      height: 4,
                      backgroundColor: colorProximidad(rssiAProximidad(tag.rssi)),
                      borderRadius: 2,
                    }} />
                    <span style={{ fontSize: 11, color: "#999" }}>{tag.rssi}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Botones control */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={escaneando ? detener : () => iniciarRadar(joyaBuscada.epc ?? "")}
              style={{
                flex: 1,
                padding: 14,
                backgroundColor: escaneando ? "#f44336" : "#6C63FF",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {escaneando ? "⏹ Detener" : "▶ Escanear"}
            </button>
            <button
              onClick={limpiar}
              style={{
                padding: 14,
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: 12,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              🔄
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============ COMPONENTE RADAR VISUAL ============

interface RadarProps {
  proximidad: number;
  color: string;
  activo: boolean;
  encontrado: boolean;
}

function RadarVisual({ proximidad, color, activo, encontrado }: RadarProps) {
  const size = 220;
  const centro = size / 2;
  const radioMax = centro - 10;

  // Posición del punto según proximidad
  // proximidad 0 = borde exterior, 1 = centro
  const radioActual = radioMax * (1 - proximidad);
  const angulo = useRef(Math.PI / 4); // ángulo fijo para simplicidad

  // El punto está en el ángulo diagonal
  const px = centro + radioActual * Math.cos(angulo.current);
  const py = centro + radioActual * Math.sin(angulo.current);

  return (
    <div style={{ position: "relative" }}>
      <svg width={size} height={size}>
        {/* Círculos del radar */}
        {[1, 0.66, 0.33].map((factor, i) => (
          <circle
            key={i}
            cx={centro}
            cy={centro}
            r={radioMax * factor}
            fill="none"
            stroke={activo ? color : "#ddd"}
            strokeWidth={1}
            strokeDasharray={i > 0 ? "4 4" : "none"}
            opacity={0.4 + i * 0.2}
          />
        ))}

        {/* Líneas de referencia */}
        <line x1={centro} y1={10} x2={centro} y2={size - 10}
          stroke="#eee" strokeWidth={1} />
        <line x1={10} y1={centro} x2={size - 10} y2={centro}
          stroke="#eee" strokeWidth={1} />

        {/* Barrido animado si está activo */}
        {activo && (
          <line
            x1={centro}
            y1={centro}
            x2={centro + radioMax}
            y2={centro}
            stroke={color}
            strokeWidth={2}
            opacity={0.3}
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${centro} ${centro}`}
              to={`360 ${centro} ${centro}`}
              dur="2s"
              repeatCount="indefinite"
            />
          </line>
        )}

        {/* Punto del tag objetivo */}
        {encontrado && (
          <>
            {/* Pulso */}
            <circle cx={px} cy={py} r={12} fill={color} opacity={0.2}>
              <animate attributeName="r" values="8;16;8" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0;0.3" dur="1s" repeatCount="indefinite" />
            </circle>
            {/* Punto principal */}
            <circle cx={px} cy={py} r={8} fill={color} />
          </>
        )}

        {/* Centro */}
        <circle cx={centro} cy={centro} r={4} fill="#1a1a2e" />
      </svg>

      {/* Label proximidad */}
      {encontrado && (
        <div style={{
          position: "absolute",
          bottom: -8,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 12,
          color,
          fontWeight: "bold",
          whiteSpace: "nowrap",
        }}>
          {proximidad > 0.7 ? "🟢 Muy cerca" : proximidad > 0.4 ? "🟡 Cerca" : "🔵 Lejos"}
        </div>
      )}
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
  metrica: {
    flex: 1,
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "white",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  btnPrimario: {
    width: "100%",
    padding: 14,
    backgroundColor: "#1a1a2e",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: "bold",
    cursor: "pointer",
  },
};