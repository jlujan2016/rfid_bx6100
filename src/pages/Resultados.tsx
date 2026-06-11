import { ResultadoTag } from "../types";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";



interface Props {
  tomaId: number;
  resultados: ResultadoTag[];
  onVolver: () => void;
}
declare global {
  interface Window {
    AndroidRFID: {
      scanRFID: (duration: number) => string;
      guardarArchivo: (base64: string, nombreArchivo: string) => string;
    };
  }
}

export default function Resultados({ tomaId, resultados, onVolver }: Props) {
  const ok = resultados.filter(r => r.estado_conciliacion === "OK");
  const faltantes = resultados.filter(r => r.estado_conciliacion === "Faltante");
  const noEsperados = resultados.filter(r => r.estado_conciliacion === "No esperado");
  
  const [exportando, setExportando] = useState(false);
  const [msgExport, setMsgExport] = useState<string | null>(null);
  
async function exportar() {
  setExportando(true);
  setMsgExport(null);
  try {
    const bytes = await invoke<number[]>("exportar_inventario", {
      tomaId: tomaId > 0 ? tomaId : null,
    });

    const nombreArchivo = `inventario_toma${tomaId}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // Convertir bytes a base64
    const uint8 = new Uint8Array(bytes);
    let binary = "";
    uint8.forEach(b => binary += String.fromCharCode(b));
    const base64 = btoa(binary);

    // Guardar via Android
    if (window.AndroidRFID && (window.AndroidRFID as any).guardarArchivo) {
      const resultado = JSON.parse(
        (window.AndroidRFID as any).guardarArchivo(base64, nombreArchivo)
      );

      if (resultado.success) {
        setMsgExport(`✅ Guardado en Descargas/${nombreArchivo}`);
      } else {
        setMsgExport(`❌ ${resultado.error}`);
      }
      return;
    }

    // Fallback web
    const blob = new Blob([uint8], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMsgExport("✅ Reporte exportado");

  } catch (e) {
    setMsgExport("❌ " + String(e));
  } finally {
    setExportando(false);
    setTimeout(() => setMsgExport(null), 5000);
  }
}

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onVolver}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>
          ←
        </button>
        <div>
          <h2 style={{ margin: 0 }}>Resultados</h2>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Toma #{tomaId}</p>
        </div>
      </div>

      {/* Resumen */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ ...styles.resumen, backgroundColor: "#e8f5e9" }}>
          <span style={{ fontSize: 28, fontWeight: "bold", color: "#2e7d32" }}>{ok.length}</span>
          <span style={{ fontSize: 12, color: "#666" }}>Encontradas</span>
        </div>
        <div style={{ ...styles.resumen, backgroundColor: "#ffebee" }}>
          <span style={{ fontSize: 28, fontWeight: "bold", color: "#c62828" }}>{faltantes.length}</span>
          <span style={{ fontSize: 12, color: "#666" }}>Faltantes</span>
        </div>
        <div style={{ ...styles.resumen, backgroundColor: "#fff3e0" }}>
          <span style={{ fontSize: 28, fontWeight: "bold", color: "#e65100" }}>{noEsperados.length}</span>
          <span style={{ fontSize: 12, color: "#666" }}>No esperadas</span>
        </div>
      </div>

      {/* Faltantes */}
      {faltantes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontWeight: "bold", color: "#c62828" }}>
            ⚠ Faltantes ({faltantes.length})
          </p>
          {faltantes.map(r => (
            <div key={r.epc} style={styles.itemCard}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: 14 }}>
                  {r.nombre ?? "Sin nombre"}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#666", fontFamily: "monospace" }}>
                  EPC {r.epc.slice(0, 8)}...{r.epc.slice(-4)}
                </p>
                {r.ubicacion && (
                  <p style={{ margin: 0, fontSize: 11, color: "#999" }}>{r.ubicacion}</p>
                )}
              </div>
              <span style={{ ...styles.badge, backgroundColor: "#ffebee", color: "#c62828" }}>
                Faltante
              </span>
            </div>
          ))}
        </div>
      )}

      {/* No esperados */}
      {noEsperados.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontWeight: "bold", color: "#e65100" }}>
            ⚠ No esperadas ({noEsperados.length})
          </p>
          {noEsperados.map(r => (
            <div key={r.epc} style={styles.itemCard}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontFamily: "monospace", fontSize: 12 }}>{r.epc}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#999" }}>No está en el sistema</p>
              </div>
              <span style={{ ...styles.badge, backgroundColor: "#fff3e0", color: "#e65100" }}>
                Sin registro
              </span>
            </div>
          ))}
        </div>
      )}

      {/* OK */}
      {ok.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontWeight: "bold", color: "#2e7d32" }}>
            ✓ Encontradas ({ok.length})
          </p>
          {ok.map(r => (
            <div key={r.epc} style={styles.itemCard}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: 14 }}>
                  {r.nombre ?? "Sin nombre"}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#666" }}>{r.ubicacion}</p>
              </div>
              <span style={{ ...styles.badge, backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                OK
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Botones */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <button style={styles.btnEnviar}>
          ↑ Enviar al sistema web
        </button>
        <button
            onClick={exportar}
            disabled={exportando}
            style={{
              ...styles.btnExportar,
              opacity: exportando ? 0.6 : 1,
            }}
          >
            {exportando ? "⏳ Generando..." : "⬇ Exportar reporte"}
          </button>

          {msgExport && (
            <div style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: msgExport.startsWith("✅") ? "#e8f5e9" : "#ffebee",
              color: msgExport.startsWith("✅") ? "#2e7d32" : "#c62828",
              fontSize: 13,
              textAlign: "center",
            }}>
              {msgExport}
            </div>
          )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  resumen: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  itemCard: {
    border: "1px solid #eee",
    borderRadius: 8,
    padding: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "white",
    marginBottom: 8,
  },
  badge: {
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  btnEnviar: {
    width: "100%",
    padding: 14,
    backgroundColor: "#6C63FF",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnExportar: {
    width: "100%",
    padding: 14,
    backgroundColor: "white",
    color: "#333",
    border: "1px solid #ddd",
    borderRadius: 12,
    fontSize: 15,
    cursor: "pointer",
  },
};