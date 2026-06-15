import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  rol: string;
}

interface Props {
  onLogin: (usuario: Usuario) => void;
}

export default function Login({ onLogin }: Props) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario.trim() || !password.trim()) {
      setError("Completa usuario y contraseña");
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const data = await invoke<Usuario>("login", { usuario, password });
      onLogin(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logo}>
          <span style={{ fontSize: 32 }}>💎</span>
        </div>

        <h2 style={{ margin: "0 0 4px", textAlign: "center" }}>JoyasRFID</h2>
        <p style={{ margin: "0 0 24px", textAlign: "center", fontSize: 13, color: "#666" }}>
          Sistema de inventario
        </p>

        {error && (
          <div style={styles.error}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <label style={styles.label}>Usuario</label>
          <input
            value={usuario}
            onChange={e => setUsuario(e.target.value)}
            placeholder="operario01"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect="off"
          />

          <label style={{ ...styles.label, marginTop: 12 }}>Contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type={mostrarPassword ? "text" : "password"}
              placeholder="••••••••"
              style={{ ...styles.input, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setMostrarPassword(p => !p)}
              style={styles.btnOjo}
            >
              {mostrarPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <button
            type="submit"
            disabled={cargando}
            style={{ ...styles.btnLogin, opacity: cargando ? 0.6 : 1 }}
          >
            {cargando ? "Verificando..." : "Iniciar sesión"}
          </button>
        </form>

      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
  },
  logo: {
    width: 64,
    height: 64,
    backgroundColor: "#f5f3ff",
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
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
    padding: "12px 14px",
    border: "1px solid #ddd",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "white",
  },
  btnOjo: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    padding: 4,
  },
  btnLogin: {
    width: "100%",
    padding: 14,
    marginTop: 20,
    backgroundColor: "#6C63FF",
    color: "white",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: "bold",
    cursor: "pointer",
  },
  error: {
    backgroundColor: "#ffebee",
    color: "#c62828",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
  },
};