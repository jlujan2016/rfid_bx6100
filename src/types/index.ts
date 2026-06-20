export interface Joya {
  id: number;
  nombre: string;
  categoria: string;
  metal: string;
  peso_g: number;
  precio: number;
  ubicacion: string;
  estado: string;
  epc: string | null;
  foto: string | null;
  sincronizado: boolean;
  creado_at: string;
  actualizado_at: string;
}

export interface TagEscaneado {
  epc: string;
  rssi: number;
  count: number;
  joya: Joya | null;        // null = No esperado
  zona: string;
  ultima_lectura: string;
}

export interface ResultadoTag {
  epc: string;
  nombre: string | null;
  categoria: string | null;
  ubicacion: string | null;
  estado_conciliacion: string; // "OK" | "Faltante" | "No esperado"
}

export interface Toma {
  id: number;
  numero: number;
  fecha: string;
  ubicacion: string;
  total_escaneadas: number;
  total_ok: number;
  total_faltantes: number;
  total_no_esperadas: number;
  estado: string;
  duracion_min: number;
}
export interface JoyaInput {
  nombre: string;
  categoria: string;
  metal: string;
  peso_g: number;
  precio: number;
  ubicacion: string;
  estado: string;
  epc: string | null;
  foto: string | null;
}

interface JoyaFoto {
  id: number;
  joya_id: number;
  foto: string;
  es_portada: boolean;
  orden: number;
}