use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

// ============ STRUCTS ============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Joya {
    pub id: i64,
    pub nombre: String,
    pub categoria: String,
    pub metal: String,
    pub peso_g: f64,
    pub precio: f64,
    pub ubicacion: String,
    pub estado: String,
    pub epc: Option<String>,
    pub foto: Option<String>,
    pub creado_at: String,
    pub actualizado_at: String,
    pub sincronizado: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct JoyaInput {
    pub nombre: String,
    pub categoria: String,
    pub metal: String,
    pub peso_g: f64,
    pub precio: f64,
    pub ubicacion: String,
    pub estado: String,
    pub epc: Option<String>,
    pub foto: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Tag {
    pub id: i64,
    pub epc: String,
    pub rssi: i32,
    pub scanned_at: String,
    pub session_id: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Session {
    pub session_id: String,
    pub total: i64,
    pub started_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Toma {
    pub id: i64,
    pub numero: i64,
    pub fecha: String,
    pub ubicacion: String,
    pub total_escaneadas: i64,
    pub total_ok: i64,
    pub total_faltantes: i64,
    pub total_no_esperadas: i64,
    pub estado: String,
    pub duracion_min: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ResultadoTag {
    pub epc: String,
    pub nombre: Option<String>,
    pub categoria: Option<String>,
    pub ubicacion: Option<String>,
    pub estado_conciliacion: String,
}

// ============ SETUP ============

pub fn init(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS joyas (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre          TEXT NOT NULL,
            categoria       TEXT NOT NULL DEFAULT '',
            metal           TEXT NOT NULL DEFAULT '',
            peso_g          REAL NOT NULL DEFAULT 0,
            precio          REAL NOT NULL DEFAULT 0,
            ubicacion       TEXT NOT NULL DEFAULT 'Tienda',
            estado          TEXT NOT NULL DEFAULT 'En stock',
            epc             TEXT UNIQUE,
            foto            TEXT,
            sincronizado    INTEGER NOT NULL DEFAULT 0,
            creado_at       DATETIME DEFAULT (datetime('now','localtime')),
            actualizado_at  DATETIME DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS tomas (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            numero              INTEGER NOT NULL,
            fecha               DATETIME DEFAULT (datetime('now','localtime')),
            ubicacion           TEXT NOT NULL DEFAULT 'Todas',
            total_escaneadas    INTEGER DEFAULT 0,
            total_ok            INTEGER DEFAULT 0,
            total_faltantes     INTEGER DEFAULT 0,
            total_no_esperadas  INTEGER DEFAULT 0,
            estado              TEXT NOT NULL DEFAULT 'Local',
            duracion_min        INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS toma_tags (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            toma_id     INTEGER NOT NULL,
            epc         TEXT NOT NULL,
            rssi        INTEGER,
            veces_detectado INTEGER NOT NULL DEFAULT 1,
            scanned_at  DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (toma_id) REFERENCES tomas(id),
            UNIQUE(toma_id, epc)
        );

        CREATE TABLE IF NOT EXISTS config (
            clave TEXT PRIMARY KEY,
            valor TEXT
        );

        CREATE TABLE IF NOT EXISTS zonas_wifi (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            zona        TEXT NOT NULL,
            bssid       TEXT NOT NULL UNIQUE,
            activo      INTEGER NOT NULL DEFAULT 1,
            creado_at   DATETIME DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo            TEXT NOT NULL,              -- 'toma' | 'joya'
            referencia_id   INTEGER NOT NULL,
            estado          TEXT NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'enviado' | 'error'
            intentos        INTEGER NOT NULL DEFAULT 0,
            ultimo_error    TEXT,
            creado_at       DATETIME DEFAULT (datetime('now','localtime')),
            enviado_at      DATETIME
        );
    ")?;
    Ok(())
}

// ── Función compartida — ahora al nivel del módulo ──────────────────
fn mapear_joya(row: &rusqlite::Row) -> rusqlite::Result<Joya> {
    Ok(Joya {
        id:             row.get(0)?,
        nombre:         row.get(1)?,
        categoria:      row.get(2)?,
        metal:          row.get(3)?,
        peso_g:         row.get(4)?,
        precio:         row.get(5)?,
        ubicacion:      row.get(6)?,
        estado:         row.get(7)?,
        epc:            row.get(8)?,
        foto:           row.get(9)?,
        sincronizado:   row.get::<_, i64>(10)? == 1,
        creado_at:      row.get(11)?,
        actualizado_at: row.get(12)?,
    })
}
// ────────────────────────────────────────────────────────────────────

// ============ JOYAS ============

pub fn crear_joya(conn: &Connection, input: &JoyaInput) -> Result<i64> {
    conn.execute(
        "INSERT INTO joyas (nombre, categoria, metal, peso_g, precio, ubicacion, estado, epc, foto)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            input.nombre, input.categoria, input.metal,
            input.peso_g, input.precio, input.ubicacion,
            input.estado, input.epc, input.foto
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn actualizar_joya(conn: &Connection, id: i64, input: &JoyaInput) -> Result<usize> {
    let count = conn.execute(
        "UPDATE joyas SET
            nombre = ?1, categoria = ?2, metal = ?3,
            peso_g = ?4, precio = ?5, ubicacion = ?6,
            estado = ?7, epc = ?8, foto = ?9,
            sincronizado = 0,
            actualizado_at = datetime('now','localtime')
         WHERE id = ?10",
        params![
            input.nombre, input.categoria, input.metal,
            input.peso_g, input.precio, input.ubicacion,
            input.estado, input.epc, input.foto, id
        ],
    )?;
    Ok(count)
}

pub fn eliminar_joya(conn: &Connection, id: i64) -> Result<usize> {
    let count = conn.execute("DELETE FROM joyas WHERE id = ?1", params![id])?;
    Ok(count)
}

pub fn get_joyas(conn: &Connection, categoria: Option<&str>) -> Result<Vec<Joya>> {
    match categoria {
        Some(cat) => {
            let mut stmt = conn.prepare(
                "SELECT * FROM joyas WHERE categoria = ?1 ORDER BY nombre"
            )?;
            let resultado = stmt.query_map(params![cat], mapear_joya)?
                .collect::<Result<Vec<Joya>>>()?;
            Ok(resultado)
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT * FROM joyas ORDER BY nombre"
            )?;
            let resultado = stmt.query_map([], mapear_joya)?
                .collect::<Result<Vec<Joya>>>()?;
            Ok(resultado)
        }
    }
}

pub fn get_joya_por_epc(conn: &Connection, epc: &str) -> Result<Option<Joya>> {
    let mut stmt = conn.prepare("SELECT * FROM joyas WHERE epc = ?1")?;
    let mut rows = stmt.query_map(params![epc], mapear_joya)?;
    Ok(rows.next().transpose()?)
}

pub fn asignar_epc(conn: &Connection, id: i64, epc: &str) -> Result<usize> {
    let count = conn.execute(
        "UPDATE joyas SET epc = ?1, sincronizado = 0,
         actualizado_at = datetime('now','localtime') WHERE id = ?2",
        params![epc, id],
    )?;
    Ok(count)
}

pub fn get_no_sincronizadas(conn: &Connection) -> Result<Vec<Joya>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM joyas WHERE sincronizado = 0 ORDER BY actualizado_at"
    )?;
    let joyas = stmt.query_map([], mapear_joya)?
        .collect::<Result<Vec<Joya>>>()?;
    Ok(joyas)
}

pub fn marcar_sincronizada(conn: &Connection, id: i64) -> Result<usize> {
    let count = conn.execute(
        "UPDATE joyas SET sincronizado = 1 WHERE id = ?1",
        params![id],
    )?;
    Ok(count)
}

// ============ TOMAS ============

pub fn crear_toma(conn: &Connection, ubicacion: &str) -> Result<i64> {
    let numero: i64 = conn.query_row(
        "SELECT COALESCE(MAX(numero), 0) + 1 FROM tomas",
        [],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO tomas (numero, ubicacion) VALUES (?1, ?2)",
        params![numero, ubicacion],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn insertar_tag_toma(conn: &Connection, toma_id: i64, epc: &str, rssi: i32) -> Result<i64> {
    conn.execute(
        "INSERT INTO toma_tags (toma_id, epc, rssi, veces_detectado)
         VALUES (?1, ?2, ?3, 1)
         ON CONFLICT(toma_id, epc) DO UPDATE SET
            veces_detectado = veces_detectado + 1,
            rssi = ?3
         ",
        params![toma_id, epc, rssi],
    )?;

    let id: i64 = conn.query_row(
        "SELECT id FROM toma_tags WHERE toma_id = ?1 AND epc = ?2",
        params![toma_id, epc],
        |row| row.get(0)
    )?;

    Ok(id)
}

pub fn conciliar_toma(conn: &Connection, toma_id: i64) -> Result<Vec<ResultadoTag>> {
    let mut stmt = conn.prepare("
        SELECT
            tt.epc,
            j.nombre,
            j.categoria,
            j.ubicacion,
            CASE
                WHEN j.id IS NULL THEN 'No esperado'
                ELSE 'OK'
            END as estado_conciliacion
        FROM toma_tags tt
        LEFT JOIN joyas j ON j.epc = tt.epc
        WHERE tt.toma_id = ?1
        GROUP BY tt.epc
    ")?;

    let mut resultados: Vec<ResultadoTag> = stmt.query_map(params![toma_id], |row| {
        Ok(ResultadoTag {
            epc:                 row.get(0)?,
            nombre:              row.get(1)?,
            categoria:           row.get(2)?,
            ubicacion:           row.get(3)?,
            estado_conciliacion: row.get(4)?,
        })
    })?
    .collect::<Result<Vec<ResultadoTag>>>()?;

    let mut stmt2 = conn.prepare("
        SELECT j.epc, j.nombre, j.categoria, j.ubicacion
        FROM joyas j
        WHERE j.epc IS NOT NULL
        AND j.epc NOT IN (
            SELECT epc FROM toma_tags WHERE toma_id = ?1
        )
    ")?;

    let faltantes = stmt2.query_map(params![toma_id], |row| {
        Ok(ResultadoTag {
            epc:                 row.get(0)?,
            nombre:              row.get(1)?,
            categoria:           row.get(2)?,
            ubicacion:           row.get(3)?,
            estado_conciliacion: "Faltante".to_string(),
        })
    })?
    .collect::<Result<Vec<ResultadoTag>>>()?;

    resultados.extend(faltantes);

    let ok            = resultados.iter().filter(|r| r.estado_conciliacion == "OK").count() as i64;
    let faltantes_cnt = resultados.iter().filter(|r| r.estado_conciliacion == "Faltante").count() as i64;
    let no_esperadas  = resultados.iter().filter(|r| r.estado_conciliacion == "No esperado").count() as i64;
    let total         = resultados.len() as i64;

    conn.execute(
        "UPDATE tomas SET
            total_escaneadas = ?1,
            total_ok = ?2,
            total_faltantes = ?3,
            total_no_esperadas = ?4
         WHERE id = ?5",
        params![total, ok, faltantes_cnt, no_esperadas, toma_id],
    )?;

    Ok(resultados)
}

pub fn get_tomas(conn: &Connection) -> Result<Vec<Toma>> {
    let mut stmt = conn.prepare(
        "SELECT id, numero, fecha, ubicacion, total_escaneadas,
                total_ok, total_faltantes, total_no_esperadas, estado, duracion_min
         FROM tomas ORDER BY fecha DESC"
    )?;
    let tomas = stmt.query_map([], |row| {
        Ok(Toma {
            id:                 row.get(0)?,
            numero:             row.get(1)?,
            fecha:              row.get(2)?,
            ubicacion:          row.get(3)?,
            total_escaneadas:   row.get(4)?,
            total_ok:           row.get(5)?,
            total_faltantes:    row.get(6)?,
            total_no_esperadas: row.get(7)?,
            estado:             row.get(8)?,
            duracion_min:       row.get(9)?,
        })
    })?
    .collect::<Result<Vec<Toma>>>()?;
    Ok(tomas)
}

pub fn buscar_joya(conn: &Connection, query: &str) -> Result<Vec<Joya>> {
    let patron = format!("%{}%", query.to_lowercase());
    let mut stmt = conn.prepare(
        "SELECT * FROM joyas
         WHERE LOWER(nombre) LIKE ?1
         OR epc LIKE ?2
         ORDER BY nombre
         LIMIT 10"
    )?;
    // ── ahora mapear_joya es visible aquí ──
    let resultado = stmt.query_map(params![patron, patron], mapear_joya)?
        .collect::<Result<Vec<Joya>>>()?;
    Ok(resultado)
}

// ============ CONFIG ============

pub fn get_config(conn: &Connection, clave: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT valor FROM config WHERE clave = ?1")?;
    let mut rows = stmt.query_map(params![clave], |row| row.get::<_, String>(0))?;
    Ok(rows.next().transpose()?)
}

pub fn set_config(conn: &Connection, clave: &str, valor: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO config (clave, valor) VALUES (?1, ?2)
         ON CONFLICT(clave) DO UPDATE SET valor = ?2",
        params![clave, valor],
    )?;
    Ok(())
}

// ============ ZONAS WIFI ============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ZonaWifi {
    pub id: i64,
    pub zona: String,
    pub bssid: String,
    pub activo: bool,
}

pub fn get_zonas_wifi(conn: &Connection) -> Result<Vec<ZonaWifi>> {
    let mut stmt = conn.prepare(
        "SELECT id, zona, bssid, activo FROM zonas_wifi ORDER BY zona, bssid"
    )?;
    let zonas = stmt.query_map([], |row| {
        Ok(ZonaWifi {
            id:     row.get(0)?,
            zona:   row.get(1)?,
            bssid:  row.get(2)?,
            activo: row.get::<_, i64>(3)? == 1,
        })
    })?
    .collect::<Result<Vec<ZonaWifi>>>()?;
    Ok(zonas)
}

pub fn agregar_zona_wifi(conn: &Connection, zona: &str, bssid: &str) -> Result<i64> {
    conn.execute(
        "INSERT OR IGNORE INTO zonas_wifi (zona, bssid) VALUES (?1, ?2)",
        params![zona, bssid],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn eliminar_zona_wifi(conn: &Connection, id: i64) -> Result<usize> {
    let count = conn.execute("DELETE FROM zonas_wifi WHERE id = ?1", params![id])?;
    Ok(count)
}

pub fn get_toma_por_id(conn: &Connection, id: i64) -> Result<Option<Toma>> {
    let mut stmt = conn.prepare(
        "SELECT id, numero, fecha, ubicacion, total_escaneadas,
                total_ok, total_faltantes, total_no_esperadas, estado, duracion_min
         FROM tomas WHERE id = ?1"
    )?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(Toma {
            id:                 row.get(0)?,
            numero:             row.get(1)?,
            fecha:              row.get(2)?,
            ubicacion:          row.get(3)?,
            total_escaneadas:   row.get(4)?,
            total_ok:           row.get(5)?,
            total_faltantes:    row.get(6)?,
            total_no_esperadas: row.get(7)?,
            estado:             row.get(8)?,
            duracion_min:       row.get(9)?,
        })
    })?;
    Ok(rows.next().transpose()?)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TomaTag {
    pub epc: String,
    pub rssi: i32,
    pub scanned_at: String,
}

pub fn get_tags_por_toma(conn: &Connection, toma_id: i64) -> Result<Vec<TomaTag>> {
    let mut stmt = conn.prepare(
        "SELECT epc, rssi, scanned_at FROM toma_tags WHERE toma_id = ?1"
    )?;
    let tags = stmt.query_map(params![toma_id], |row| {
        Ok(TomaTag {
            epc:        row.get(0)?,
            rssi:       row.get(1)?,
            scanned_at: row.get(2)?,
        })
    })?
    .collect::<Result<Vec<TomaTag>>>()?;
    Ok(tags)
}

pub fn marcar_toma_enviada(conn: &Connection, id: i64) -> Result<usize> {
    let count = conn.execute(
        "UPDATE tomas SET estado = 'Enviado' WHERE id = ?1",
        params![id],
    )?;
    Ok(count)
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SyncItem {
    pub id: i64,
    pub tipo: String,
    pub referencia_id: i64,
    pub estado: String,
    pub intentos: i64,
    pub ultimo_error: Option<String>,
    pub creado_at: String,
}

pub fn agregar_a_cola(conn: &Connection, tipo: &str, referencia_id: i64) -> Result<i64> {
    conn.execute(
        "INSERT INTO sync_queue (tipo, referencia_id) VALUES (?1, ?2)",
        params![tipo, referencia_id],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_pendientes(conn: &Connection) -> Result<Vec<SyncItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, tipo, referencia_id, estado, intentos, ultimo_error, creado_at
         FROM sync_queue
         WHERE estado = 'pendiente'
         ORDER BY creado_at"
    )?;
    let items = stmt.query_map([], |row| {
        Ok(SyncItem {
            id:            row.get(0)?,
            tipo:          row.get(1)?,
            referencia_id: row.get(2)?,
            estado:        row.get(3)?,
            intentos:      row.get(4)?,
            ultimo_error:  row.get(5)?,
            creado_at:     row.get(6)?,
        })
    })?
    .collect::<Result<Vec<SyncItem>>>()?;
    Ok(items)
}

pub fn marcar_enviado(conn: &Connection, id: i64) -> Result<usize> {
    let count = conn.execute(
        "UPDATE sync_queue SET estado = 'enviado', enviado_at = datetime('now','localtime') WHERE id = ?1",
        params![id],
    )?;
    Ok(count)
}

pub fn marcar_error(conn: &Connection, id: i64, error: &str) -> Result<usize> {
    let count = conn.execute(
        "UPDATE sync_queue SET estado = 'pendiente', intentos = intentos + 1, ultimo_error = ?1 WHERE id = ?2",
        params![error, id],
    )?;
    Ok(count)
}

pub fn contar_pendientes(conn: &Connection) -> Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM sync_queue WHERE estado = 'pendiente'",
        [], |row| row.get(0)
    )
}