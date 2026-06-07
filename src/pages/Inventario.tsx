import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Joya, Toma } from "../types";

interface Props {
  onIniciarToma: () => void;
}

export default function Inventario({ onIniciarToma }: Props) {
  const [joyas, setJoyas] = useState<Joya[]>([]);
  const [tomas, setTomas] = useState<Toma[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      const [j, t] = await Promise.all([
        invoke<Joya[]>("get_joyas", { categoria: null }),
        invoke<Toma[]>("get_tomas"),
      ]);
      setJoyas(j);
      setTomas(t);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  const ultimaToma = tomas[0] ?? null;
  const totalJoyas = joyas.length;
  const tienda = joyas.filter(j => j.ubicacion === "Tienda" || j.ubicacion === "Ambos");
  const almacen = joyas.filter(j => j.ubicacion === "Almacen" || j.ubicacion === "Ambos");
  const ubicaciones = [...new Set(joyas.map(j => j.ubicacion))].length;

  if (cargando) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p>⏳ Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Inventario general</h2>
          {ultimaToma && (
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              Última toma: {new Date(ultimaToma.fecha).toLocaleDateString("es-PE")}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={styles.statCard}>
          <span style={styles.statNum}>{totalJoyas}</span>
          <span style={styles.statLabel}>Joyas en sistema</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statNum}>{ubicaciones}</span>
          <span style={styles.statLabel}>Ubicaciones</span>
        </div>
      </div>

      {/* Ubicaciones */}
      <p style={{ margin: "0 0 8px", fontWeight: "bold", fontSize: 14 }}>
        Ubicaciones a inventariar
      </p>

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>🏪</span>
            <div>
              <p style={{ margin: 0, fontWeight: "bold" }}>Tienda</p>
              <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
                Vitrinas A, B, C · Mostrador principal
              </p>
            </div>
          </div>
          <span style={styles.badgeUbic}>{tienda.length} joyas</span>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>🏢</span>
            <div>
              <p style={{ margin: 0, fontWeight: "bold" }}>Almacén</p>
              <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
                Estantes 1–4 · Caja fuerte
              </p>
            </div>
          </div>
          <span style={styles.badgeUbic}>{almacen.length} joyas</span>
        </div>
      </div>

      {/* Configuración */}
      <div style={{ ...styles.card, marginTop: 8 }}>
        <p style={{ margin: "0 0 12px", fontWeight: "bold", fontSize: 14 }}>
          Configuración de toma
        </p>
        <div style={styles.configRow}>
          <span style={styles.configLabel}>Detección de zona</span>
          <span style={styles.configVal}>Manual</span>
        </div>
        <div style={styles.configRow}>
          <span style={styles.configLabel}>Comparar contra</span>
          <span style={styles.configVal}>Sistema local</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={styles.configLabel}>Modo lectura</span>
          <span style={styles.configVal}>Continuo</span>
        </div>
      </div>

      {/* Botón iniciar */}
      <button onClick={onIniciarToma} style={styles.btnIniciar}>
        ▶ Iniciar toma de inventario
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    backgroundColor: "white",
  },
  statCard: {
    flex: 1,
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "white",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  statNum: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  badgeUbic: {
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "bold",
  },
  configRow: {
    display: "flex",
    justifyContent: "space-between",
    paddingBottom: 8,
    marginBottom: 8,
    borderBottom: "1px solid #f5f5f5",
  },
  configLabel: {
    fontSize: 13,
    color: "#666",
  },
  configVal: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  btnIniciar: {
    width: "100%",
    padding: 16,
    backgroundColor: "#1a1a2e",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 8,
  },
};