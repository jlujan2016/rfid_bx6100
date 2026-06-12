import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Joya, JoyaInput } from "../types";

declare global {
  interface Window {
    AndroidRFID: {
      scanRFID: (duration: number) => string;
    };
  }
}

export default function Joyas() {
  const [joyas, setJoyas] = useState<Joya[]>([]);
  const [filtro, setFiltro] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<"lista" | "form" | "detalle">("lista");
  const [joyaEditando, setJoyaEditando] = useState<Joya | null>(null);
  const [joyaDetalle, setJoyaDetalle] = useState<Joya | null>(null);
  const [escaneandoEpc, setEscaneandoEpc] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [msgImport, setMsgImport] = useState<string | null>(null);

  const categorias = ["Todas", "Anillo", "Collar", "Aretes", "Pulsera", "Dije"];

  const formVacio: JoyaInput = {
    nombre: "",
    categoria: "Anillo",
    metal: "",
    peso_g: 0,
    precio: 0,
    ubicacion: "Tienda",
    estado: "En stock",
    epc: null,
    foto: null,
  };

  const [form, setForm] = useState<JoyaInput>(formVacio);

  useEffect(() => {
    cargarJoyas();
  }, []);

  async function cargarJoyas() {
    try {
      const j = await invoke<Joya[]>("get_joyas", { categoria: null });
      setJoyas(j);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  async function importarExcel() {
    setImportando(true);
    setMsgImport(null);
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx";

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          setImportando(false);
          return;
        }

        try {
          const arrayBuffer = await file.arrayBuffer();
          const bytes = Array.from(new Uint8Array(arrayBuffer));

          const result = await invoke<{
            insertadas: number;
            duplicadas: number;
            errores: string[];
          }>("importar_excel_bytes", { bytes });

          let msg = `✅ ${result.insertadas} joyas importadas`;
          if (result.duplicadas > 0) {
            msg += ` · ⚠️ ${result.duplicadas} EPC duplicados`;
          }
          setMsgImport(msg);

          if (result.errores.length > 0) {
            console.warn("Errores:", result.errores);
          }

          await cargarJoyas();
        } catch (err) {
          setMsgImport("❌ " + String(err));
        } finally {
          setImportando(false);
          setTimeout(() => setMsgImport(null), 5000);
        }
      };

      input.oncancel = () => setImportando(false);
      input.click();

    } catch (e) {
      setMsgImport("❌ " + String(e));
      setImportando(false);
    }
  }

  function abrirForm(joya?: Joya) {
    if (joya) {
      setJoyaEditando(joya);
      setForm({
        nombre: joya.nombre,
        categoria: joya.categoria,
        metal: joya.metal,
        peso_g: joya.peso_g,
        precio: joya.precio,
        ubicacion: joya.ubicacion,
        estado: joya.estado,
        epc: joya.epc,
        foto: joya.foto,
      });
    } else {
      setJoyaEditando(null);
      setForm(formVacio);
    }
    setError(null);
    setVista("form");
  }

  function abrirDetalle(joya: Joya) {
    setJoyaDetalle(joya);
    setVista("detalle");
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    try {
      if (joyaEditando) {
        await invoke("actualizar_joya", { id: joyaEditando.id, input: form });
      } else {
        await invoke("crear_joya", { input: form });
      }
      await cargarJoyas();
      setVista("lista");
    } catch (e) {
      setError("Error guardando: " + String(e));
    }
  }

  async function eliminar(id: number) {
    try {
      await invoke("eliminar_joya", { id });
      await cargarJoyas();
    } catch (e) {
      console.error("Error eliminando:", e);
    }
  }

  function escanearEpc() {
    if (!window.AndroidRFID) {
      setError("RFID no disponible");
      return;
    }
    setEscaneandoEpc(true);
    setError(null);

    const interval = setInterval(() => {
      try {
        const raw = window.AndroidRFID.scanRFID(500);
        const data = JSON.parse(raw);
        if (data.success && data.tags.length > 0) {
          const epc = data.tags[0].epc;
          setForm(prev => ({ ...prev, epc }));
          clearInterval(interval);
          setEscaneandoEpc(false);
        }
      } catch (e) {
        clearInterval(interval);
        setEscaneandoEpc(false);
      }
    }, 600);

    setTimeout(() => {
      clearInterval(interval);
      setEscaneandoEpc(false);
    }, 10000);
  }

  // ============ FOTO ============

  function tomarFoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment"; // abre la cámara directamente en Android

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setForm(prev => ({ ...prev, foto: base64 }));
      };
      reader.readAsDataURL(file);
    };

    input.click();
  }

  function elegirDeGaleria() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    // sin "capture" abre la galería

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setForm(prev => ({ ...prev, foto: base64 }));
      };
      reader.readAsDataURL(file);
    };

    input.click();
  }

  const joyasFiltradas = joyas
    .filter(j => filtro === "Todas" || j.categoria === filtro)
    .filter(j =>
      busqueda === "" ||
      j.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      j.epc?.toLowerCase().includes(busqueda.toLowerCase())
    );

  // ============ DETALLE ============
  if (vista === "detalle" && joyaDetalle) {
    return (
      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <button
            onClick={() => { setVista("lista"); setJoyaDetalle(null); }}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>
            ←
          </button>
          <h2 style={{ margin: 0 }}>Detalle</h2>
          <button onClick={() => abrirForm(joyaDetalle)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>
            ✏️
          </button>
        </div>

        {/* Foto */}
        <div style={styles.fotoContainer}>
          {joyaDetalle.foto ? (
            <img src={joyaDetalle.foto} alt={joyaDetalle.nombre} style={styles.fotoImg} />
          ) : (
            <div style={styles.fotoPlaceholder}>
              <span style={{ fontSize: 40 }}>📷</span>
            </div>
          )}
        </div>

        <h3 style={{ margin: "0 0 8px" }}>{joyaDetalle.nombre}</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <span style={styles.badgeCategoria}>{joyaDetalle.categoria}</span>
          <span style={{
            ...styles.badgeEstado,
            backgroundColor: joyaDetalle.estado === "En stock" ? "#e8f5e9"
              : joyaDetalle.estado === "Vendido" ? "#ffebee" : "#fff3e0",
            color: joyaDetalle.estado === "En stock" ? "#2e7d32"
              : joyaDetalle.estado === "Vendido" ? "#c62828" : "#e65100",
          }}>
            {joyaDetalle.estado}
          </span>
        </div>

        <div style={styles.card}>
          {[
            ["Metal", joyaDetalle.metal || "—"],
            ["Peso", `${joyaDetalle.peso_g} g`],
            ["Precio", `S/ ${joyaDetalle.precio.toLocaleString()}`],
            ["Ubicación", joyaDetalle.ubicacion],
            ["Tag RFID", joyaDetalle.epc ?? "Sin asignar"],
            ["Actualizado", new Date(joyaDetalle.actualizado_at).toLocaleDateString("es-PE")],
          ].map(([label, valor], i) => (
            <div key={label} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: i < 5 ? "1px solid #f5f5f5" : "none",
            }}>
              <span style={{ fontSize: 13, color: "#666" }}>{label}</span>
              <span style={{
                fontSize: 13,
                fontWeight: "bold",
                fontFamily: label === "Tag RFID" ? "monospace" : "inherit",
                color: label === "Tag RFID" && !joyaDetalle.epc ? "#e65100" : "#1a1a2e",
              }}>
                {valor}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            eliminar(joyaDetalle.id);
            setVista("lista");
            setJoyaDetalle(null);
          }}
          style={styles.btnEliminar}
        >
          🗑 Eliminar joya
        </button>
      </div>
    );
  }

  // ============ FORMULARIO ============
  if (vista === "form") {
    return (
      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <button
            onClick={() => setVista("lista")}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>
            ←
          </button>
          <h2 style={{ margin: 0 }}>
            {joyaEditando ? "Editar joya" : "Nueva joya"}
          </h2>
          <button onClick={guardar} style={styles.btnGuardar}>
            Guardar
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* Foto */}
        <div style={styles.fotoContainer}>
          {form.foto ? (
            <img src={form.foto} alt="preview" style={styles.fotoImg} />
          ) : (
            <div style={styles.fotoPlaceholder}>
              <span style={{ fontSize: 40 }}>📷</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={tomarFoto} style={styles.btnFoto}>
            📷 Tomar foto
          </button>
          <button onClick={elegirDeGaleria} style={styles.btnFoto}>
            🖼️ Galería
          </button>
          {form.foto && (
            <button
              onClick={() => setForm(p => ({ ...p, foto: null }))}
              style={{ ...styles.btnFoto, backgroundColor: "#ffebee", color: "#c62828" }}
            >
              🗑
            </button>
          )}
        </div>

        <button
          onClick={escanearEpc}
          disabled={escaneandoEpc}
          style={styles.btnEscanearEpc}
        >
          <span style={{ fontSize: 20 }}>📡</span>
          <div style={{ textAlign: "left", flex: 1 }}>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: 14 }}>
              {escaneandoEpc ? "Escaneando... acerca el tag" : "Escanear tag RFID"}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#6C63FF" }}>
              {form.epc ?? "Toca para activar el lector"}
            </p>
          </div>
          <span>›</span>
        </button>

        <div style={styles.campo}>
          <label style={styles.label}>Nombre *</label>
          <input
            value={form.nombre}
            onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
            placeholder="Ej: Anillo solitario oro"
            style={styles.input}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...styles.campo, flex: 1 }}>
            <label style={styles.label}>Categoría</label>
            <select
              value={form.categoria}
              onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
              style={styles.input}
            >
              {["Anillo", "Collar", "Aretes", "Pulsera", "Dije"].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ ...styles.campo, flex: 1 }}>
            <label style={styles.label}>Metal</label>
            <input
              value={form.metal}
              onChange={e => setForm(p => ({ ...p, metal: e.target.value }))}
              placeholder="Ej: Oro 18k"
              style={styles.input}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...styles.campo, flex: 1 }}>
            <label style={styles.label}>Peso (g)</label>
            <input
              type="number"
              value={form.peso_g || ""}
              onChange={e => setForm(p => ({ ...p, peso_g: parseFloat(e.target.value) || 0 }))}
              style={styles.input}
            />
          </div>
          <div style={{ ...styles.campo, flex: 1 }}>
            <label style={styles.label}>Precio (S/)</label>
            <input
              type="number"
              value={form.precio || ""}
              onChange={e => setForm(p => ({ ...p, precio: parseFloat(e.target.value) || 0 }))}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Ubicación</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["Tienda", "Almacen", "Ambos"].map(u => (
              <button
                key={u}
                onClick={() => setForm(p => ({ ...p, ubicacion: u }))}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  border: "none",
                  borderRadius: 8,
                  backgroundColor: form.ubicacion === u ? "#6C63FF" : "#f0f0f0",
                  color: form.ubicacion === u ? "white" : "#333",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Estado</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["En stock", "Vendido", "Reservado"].map(e => (
              <button
                key={e}
                onClick={() => setForm(p => ({ ...p, estado: e }))}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  border: "none",
                  borderRadius: 8,
                  backgroundColor: form.estado === e ? "#1a1a2e" : "#f0f0f0",
                  color: form.estado === e ? "white" : "#333",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============ LISTA ============
  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>

    {/* Header con botón importar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
      }}>
        <div>
          <h2 style={{ margin: 0 }}>Joyas</h2>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            {joyas.length} piezas
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={importarExcel}
            disabled={importando}
            style={{
              padding: "8px 12px",
              backgroundColor: "#e8f5e9",
              color: "#2e7d32",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              opacity: importando ? 0.6 : 1,
            }}
          >
            {importando ? "⏳" : "📥 Importar"}
          </button>
          <button onClick={() => abrirForm()} style={styles.btnAgregar}>
            +
          </button>
        </div>
      </div>

      {/* Mensaje importación */}
      {msgImport && (
        <div style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: msgImport.startsWith("✅") ? "#e8f5e9" : "#ffebee",
          color: msgImport.startsWith("✅") ? "#2e7d32" : "#c62828",
          marginBottom: 12,
          fontSize: 13,
        }}>
          {msgImport}
        </div>
      )}

      {/* Búsqueda */}
      <input
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar por nombre o EPC..."
        style={{
          ...styles.input,
          marginBottom: 12,
          width: "100%",
          boxSizing: "border-box",
        }}
      />

      {/* Filtros */}
      <div style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        marginBottom: 16,
        paddingBottom: 4,
      }}>
        {categorias.map(cat => (
          <button
            key={cat}
            onClick={() => setFiltro(cat)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: filtro === cat ? "none" : "1px solid #ddd",
              backgroundColor: filtro === cat ? "#6C63FF" : "white",
              color: filtro === cat ? "white" : "#333",
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {cargando && (
        <p style={{ textAlign: "center" }}>⏳ Cargando...</p>
      )}

      {!cargando && joyasFiltradas.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "#999" }}>
          <p style={{ fontSize: 32 }}>💎</p>
          <p>No hay joyas registradas</p>
          <button onClick={() => abrirForm()} style={styles.btnIniciar}>
            + Agregar primera joya
          </button>
        </div>
      )}

      {joyasFiltradas.map(joya => (
        <div
          key={joya.id}
          onClick={() => abrirDetalle(joya)}
          style={{ ...styles.joyaCard, cursor: "pointer" }}
        >
          <div style={styles.joyaIcono}>
            {joya.foto ? (
              <img src={joya.foto} alt="" style={{ width: "100%", height: "100%", borderRadius: 10, objectFit: "cover" }} />
            ) : "💎"}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: 14 }}>
              {joya.nombre}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              {joya.metal} · {joya.peso_g}g · S/{joya.precio.toLocaleString()}
            </p>
            {!joya.epc ? (
              <p style={{ margin: 0, fontSize: 11, color: "#e65100" }}>
                Sin tag RFID asignado
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: "#2e7d32", fontFamily: "monospace" }}>
                {joya.epc.slice(0, 8)}...
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => abrirForm(joya)} style={styles.btnIcono}>
              ✏️
            </button>
            <button
              onClick={() => eliminar(joya.id)}
              style={{ ...styles.btnIcono, backgroundColor: "#ffebee" }}
            >
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  joyaCard: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "white",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  joyaIcono: {
    width: 44,
    height: 44,
    backgroundColor: "#f5f3ff",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    overflow: "hidden",
  },
  campo: {
    marginBottom: 14,
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
  btnGuardar: {
    padding: "8px 20px",
    backgroundColor: "#6C63FF",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnAgregar: {
    width: 36,
    height: 36,
    backgroundColor: "#6C63FF",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontSize: 20,
    cursor: "pointer",
  },
  btnIcono: {
    padding: "6px 8px",
    backgroundColor: "#f5f5f5",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
  },
  btnEscanearEpc: {
    width: "100%",
    padding: 14,
    backgroundColor: "#f5f3ff",
    border: "1px solid #e0d7ff",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    marginBottom: 16,
    boxSizing: "border-box",
  },
  btnIniciar: {
    padding: "12px 24px",
    backgroundColor: "#6C63FF",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    cursor: "pointer",
  },
  error: {
    backgroundColor: "#ffebee",
    color: "#c62828",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 13,
  },
  fotoContainer: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#f5f5f5",
  },
  fotoImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  fotoPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ccc",
  },
  btnFoto: {
    flex: 1,
    padding: "10px 0",
    backgroundColor: "#f5f3ff",
    color: "#6C63FF",
    border: "1px solid #e0d7ff",
    borderRadius: 8,
    fontSize: 13,
    cursor: "pointer",
  },
  card: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "white",
  },
  badgeCategoria: {
    padding: "4px 12px",
    borderRadius: 8,
    fontSize: 12,
    backgroundColor: "#f5f3ff",
    color: "#6C63FF",
    fontWeight: "bold",
  },
  badgeEstado: {
    padding: "4px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "bold",
  },
  btnEliminar: {
    width: "100%",
    padding: 14,
    backgroundColor: "#ffebee",
    color: "#c62828",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 8,
  },
};