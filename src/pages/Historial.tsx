import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Toma } from "../types";

export default function Historial() {
  const [tomas, setTomas] = useState<Toma[]>([]);
  const [filtro, setFiltro] = useState<"Todas" | "Tienda" | "Almacen">("Todas");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarTomas();
  }, []);

  async function cargarTomas() {
    try {
      const t = await invoke<Toma[]>("get_tomas");
      setTomas(t);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  const tomasFiltradas = tomas.filter(t =>
    filtro === "Todas" ? true : t.ubicacion === filtro
  );

  function porcentaje(toma: Toma): number {
    if (toma.total_escaneadas === 0) return 0;
    return Math.round((toma.total_ok / toma.total_escaneadas) * 100);
  }

  function colorPorcentaje(pct: number): string {
    if (pct >= 95) return "#2e7d32";
    if (pct >= 80) return "#f57f17";
    return "#c62828";
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Historial</h2>
        <span style={{ fontSize: 13, color: "#666" }}>Tomas anteriores</span>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["Todas", "Tienda", "Almacen"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: filtro === f ? "none" : "1px solid #ddd",
              backgroundColor: filtro === f ? "#1a1a2e" : "white",
              color: filtro === f ? "white" : "#333",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {cargando && (
        <p style={{ textAlign: "center" }}>⏳ Cargando...</p>
      )}

      {!cargando && tomasFiltradas.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "#999" }}>
          <p style={{ fontSize: 32 }}>📋</p>
          <p>No hay tomas registradas</p>
        </div>
      )}

      {tomasFiltradas.map(toma => {
        const pct = porcentaje(toma);
        const esHoy = new Date(toma.fecha).toDateString() === new Date().toDateString();

        return (
          <div key={toma.id} style={styles.tomaCard}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: 15 }}>
                  Toma #{toma.numero} — {esHoy ? "hoy" : new Date(toma.fecha).toLocaleDateString("es-PE")}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                  {toma.total_escaneadas} escaneadas · {toma.duracion_min} min · {toma.ubicacion}
                </p>
              </div>
              <span style={{
                fontSize: 18,
                fontWeight: "bold",
                color: colorPorcentaje(pct),
              }}>
                {pct}%
              </span>
            </div>

            {/* Barra progreso */}
            <div style={{ backgroundColor: "#f5f5f5", borderRadius: 4, height: 6, marginBottom: 8 }}>
              <div style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 4,
                backgroundColor: colorPorcentaje(pct),
                transition: "width 0.3s",
              }} />
            </div>

            {/* Contadores */}
            <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 12 }}>
                <strong style={{ color: "#2e7d32" }}>{toma.total_ok}</strong>
                <span style={{ color: "#666" }}> OK</span>
              </span>
              <span style={{ fontSize: 12 }}>
                <strong style={{ color: "#c62828" }}>{toma.total_faltantes}</strong>
                <span style={{ color: "#666" }}> Faltan</span>
              </span>
              <span style={{ fontSize: 12 }}>
                <strong style={{ color: "#e65100" }}>{toma.total_no_esperadas}</strong>
                <span style={{ color: "#666" }}> Extra</span>
              </span>
            </div>

            <span style={{
              padding: "3px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: "bold",
              backgroundColor: toma.estado === "Enviado" ? "#e8f5e9" : "#f5f5f5",
              color: toma.estado === "Enviado" ? "#2e7d32" : "#666",
            }}>
              {toma.estado}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tomaCard: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "white",
  },
};