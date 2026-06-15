import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Inventario from "./pages/Inventario";
import Escanear from "./pages/Escanear";
import Resultados from "./pages/Resultados";
import Historial from "./pages/Historial";
import Joyas from "./pages/Joyas";
import { ResultadoTag } from "./types";
import Localizar from "./pages/Localizar";
import Resumen from "./pages/Resumen";
import Ajustes from "./pages/Ajustes";

type Tab = "inventario" | "escanear" | "joyas" | "historial" | "localizar" | "resumen" | "ajustes";
type Pantalla = "main" | "resultados";

export default function App() {
  const [tab, setTab] = useState<Tab>("inventario");
  const [pantalla, setPantalla] = useState<Pantalla>("main");
  const [tomaId, setTomaId] = useState(0);
  const [resultados, setResultados] = useState<ResultadoTag[]>([]);
  const [msgDev, setMsgDev] = useState("");

  async function cargarPrueba() {
    try {
      const msg = await invoke<string>("insertar_datos_prueba");
      setMsgDev("✅ " + msg);
    } catch (e) {
      setMsgDev("❌ " + String(e));
    }
    setTimeout(() => setMsgDev(""), 3000);
  }

  function handleFinalizar(id: number, res: ResultadoTag[]) {
    setTomaId(id);
    setResultados(res);
    setPantalla("resultados");
  }

  // Resultados ocupa pantalla completa sin tab bar
  if (pantalla === "resultados") {
    return (
      <div style={{ backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
        <Resultados
          tomaId={tomaId}
          resultados={resultados}
          onVolver={() => {
            setPantalla("main");
            setTab("inventario");
          }}
        />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "inventario", label: "Inventario", icon: "📋" },
    { id: "escanear",   label: "Escanear",   icon: "📡" },
    { id: "joyas",      label: "Joyas",      icon: "💎" },
    { id: "historial",  label: "Historial",  icon: "🕐" },
    { id: "localizar",  label: "Localizar",  icon: "🎯" },
    { id: "resumen",    label: "Resumen",    icon: "📊" },
    { id: "ajustes",    label: "Ajustes",    icon: "⚙️" },
  ];

  return (
    <div style={{ backgroundColor: "#f5f5f5", minHeight: "100vh", paddingBottom: 70 }}>

      {/* Barra DEV */}
      <div style={{
        backgroundColor: "#1a1a2e",
        padding: "6px 16px",
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}>
        <span style={{ color: "#444", fontSize: 10 }}>DEV</span>
        <button
          onClick={cargarPrueba}
          style={{
            padding: "3px 10px",
            backgroundColor: "#6C63FF",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontSize: 11,
            cursor: "pointer",
          }}>
          Cargar prueba
        </button>
        {msgDev && (
          <span style={{ color: "white", fontSize: 11 }}>{msgDev}</span>
        )}
      </div>

      {/* Contenido según tab activo */}
      {tab === "inventario" && (
        <Inventario onIniciarToma={() => setTab("escanear")} />
      )}
      {tab === "escanear" && (
        <Escanear onFinalizar={handleFinalizar} />
      )}
      {tab === "joyas" && (
        <Joyas />
      )}
      {tab === "historial" && (
        <Historial />
      )}
      {tab === "localizar" && <Localizar />}
      {tab === "resumen" && <Resumen />}
      {tab === "ajustes" && <Ajustes />}

      {/* Tab bar fijo abajo */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "white",
        borderTop: "1px solid #eee",
        display: "flex",
        zIndex: 100,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{
              fontSize: 10,
              color: tab === t.id ? "#6C63FF" : "#999",
              fontWeight: tab === t.id ? "bold" : "normal",
            }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}