import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Toma } from "../types";

interface CategoriaStats {
  categoria: string;
  total: number;
  porcentaje: number;
}

interface ResumenData {
  total_joyas: number;
  con_tag: number;
  sin_tag: number;
  valor_total: number;
  por_categoria: CategoriaStats[];
  ultimas_tomas: Toma[];
}

const COLORES_CATEGORIA: Record<string, string> = {
  Anillo: "#6C63FF",
  Collar: "#2e7d32",
  Aretes: "#e65100",
  Pulsera: "#1565c0",
  Dije: "#c62828",
};

export default function Resumen() {
  const [data, setData] = useState<ResumenData | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      const res = await invoke<ResumenData>("get_resumen");
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  if (cargando) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p>⏳ Cargando...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#999" }}>
        <p>No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Resumen</h2>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            {new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Stats principales */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={styles.statCard}>
          <span style={styles.statNum}>{data.total_joyas}</span>
          <span style={styles.statLabel}>Total piezas</span>
        </div>
        <div style={{ ...styles.statCard, backgroundColor: "#e8f5e9" }}>
          <span style={{ ...styles.statNum, color: "#2e7d32" }}>{data.con_tag}</span>
          <span style={styles.statLabel}>Con tag RFID</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={styles.statCard}>
          <span style={{ ...styles.statNum, fontSize: 22 }}>
            S/ {data.valor_total >= 1000
              ? (data.valor_total / 1000).toFixed(1) + "k"
              : data.valor_total.toFixed(0)}
          </span>
          <span style={styles.statLabel}>Valor total</span>
        </div>
        <div style={{ ...styles.statCard, backgroundColor: data.sin_tag > 0 ? "#fff3e0" : "#f5f5f5" }}>
          <span style={{ ...styles.statNum, color: data.sin_tag > 0 ? "#e65100" : "#1a1a2e" }}>
            {data.sin_tag}
          </span>
          <span style={styles.statLabel}>Sin tag aún</span>
        </div>
      </div>

      {/* Por categoría */}
      <div style={styles.card}>
        <p style={{ margin: "0 0 12px", fontWeight: "bold", fontSize: 14 }}>
          Por categoría
        </p>
        {data.por_categoria.length === 0 && (
          <p style={{ color: "#999", fontSize: 13, margin: 0 }}>Sin datos</p>
        )}
        {data.por_categoria.map(cat => (
          <div key={cat.categoria} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>{cat.categoria}</span>
              <span style={{ fontSize: 13, fontWeight: "bold" }}>
                {cat.porcentaje.toFixed(0)}%
              </span>
            </div>
            <div style={{ backgroundColor: "#f5f5f5", borderRadius: 4, height: 6 }}>
              <div style={{
                width: `${cat.porcentaje}%`,
                height: "100%",
                borderRadius: 4,
                backgroundColor: COLORES_CATEGORIA[cat.categoria] ?? "#999",
                transition: "width 0.3s",
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Últimas sesiones */}
      <div style={styles.card}>
        <p style={{ margin: "0 0 12px", fontWeight: "bold", fontSize: 14 }}>
          Últimas sesiones
        </p>
        {data.ultimas_tomas.length === 0 && (
          <p style={{ color: "#999", fontSize: 13, margin: 0 }}>Sin tomas registradas</p>
        )}
        {data.ultimas_tomas.map((toma, i) => {
          const esHoy = new Date(toma.fecha).toDateString() === new Date().toDateString();
          return (
            <div key={toma.id} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: i < data.ultimas_tomas.length - 1 ? "1px solid #f5f5f5" : "none",
            }}>
              <span style={{ fontSize: 13 }}>
                {esHoy ? "Hoy" : new Date(toma.fecha).toLocaleDateString("es-PE")}
              </span>
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#6C63FF" }}>
                +{toma.total_escaneadas} tags · sesión #{toma.numero}
              </span>
            </div>
          );
        })}
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
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
};