import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Escanear from "./pages/Escanear";
import Resultados from "./pages/Resultados";
import { ResultadoTag } from "./types";

type Pantalla = "escanear" | "resultados";

export default function App() {
  const [pantalla, setPantalla] = useState<Pantalla>("escanear");
  const [tomaId, setTomaId] = useState<number>(0);
  const [resultados, setResultados] = useState<ResultadoTag[]>([]);
  const [msgPrueba, setMsgPrueba] = useState("");

  async function cargarDatosPrueba() {
    try {
      const msg = await invoke<string>("insertar_datos_prueba");
      setMsgPrueba("✅ " + msg);
    } catch (e) {
      setMsgPrueba("❌ " + String(e));
    }
    setTimeout(() => setMsgPrueba(""), 3000);
  }

  function handleFinalizar(id: number, res: ResultadoTag[]) {
    setTomaId(id);
    setResultados(res);
    setPantalla("resultados");
  }

  return (
    <div style={{ backgroundColor: "#f5f5f5", minHeight: "100vh" }}>

      {/* Barra de desarrollo — quitar en producción */}
      <div style={{
        backgroundColor: "#1a1a2e",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12
      }}>
        <span style={{ color: "#666", fontSize: 11 }}>DEV</span>
        <button
          onClick={cargarDatosPrueba}
          style={{
            padding: "4px 12px",
            backgroundColor: "#6C63FF",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontSize: 12,
            cursor: "pointer",
          }}>
          Cargar joyas de prueba
        </button>
        {msgPrueba && (
          <span style={{ color: "white", fontSize: 12 }}>{msgPrueba}</span>
        )}
      </div>

      {pantalla === "escanear" && (
        <Escanear onFinalizar={handleFinalizar} />
      )}
      {pantalla === "resultados" && (
        <Resultados
          tomaId={tomaId}
          resultados={resultados}
          onVolver={() => setPantalla("escanear")}
        />
      )}
    </div>
  );

}