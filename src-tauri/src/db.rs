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
    pub ubicacion: String,   // "Tienda" | "Almacen" | "Ambos"
    pub estado: String,      // "En stock" | "Vendido" | "Reservado"
    pub epc: Option<String>, // puede ser null
    pub foto: Option<String>,
    pub creado_at: String,
    pub actualizado_at: String,
    pub sincronizado: bool,  // false = pendiente de sync
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
    pub estado: String,      // "Local" | "Enviado"
    pub duracion_min: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ResultadoTag {
    pub epc: String,
    pub nombre: Option<String>,
    pub categoria: Option<String>,
    pub ubicacion: Option<String>,
    pub estado_conciliacion: String, // "OK" | "Faltante" | "No esperado"
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
            scanned_at  DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (toma_id) REFERENCES tomas(id)
        );
    ")?;
    Ok(())
}

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
    let mut rows = stmt.query_map(params![epc], |row| {
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
    })?;
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
    let joyas = stmt.query_map([], |row| {
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
    })?
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
        "INSERT INTO toma_tags (toma_id, epc, rssi) VALUES (?1, ?2, ?3)",
        params![toma_id, epc, rssi],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn conciliar_toma(conn: &Connection, toma_id: i64) -> Result<Vec<ResultadoTag>> {
    // Tags escaneados vs joyas registradas
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
            epc:                  row.get(0)?,
            nombre:               row.get(1)?,
            categoria:            row.get(2)?,
            ubicacion:            row.get(3)?,
            estado_conciliacion:  row.get(4)?,
        })
    })?
    .collect::<Result<Vec<ResultadoTag>>>()?;

    // Joyas faltantes (registradas pero no escaneadas en esta toma)
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
            epc:                  row.get(0)?,
            nombre:               row.get(1)?,
            categoria:            row.get(2)?,
            ubicacion:            row.get(3)?,
            estado_conciliacion:  "Faltante".to_string(),
        })
    })?
    .collect::<Result<Vec<ResultadoTag>>>()?;

    resultados.extend(faltantes);

    // Actualizar contadores en la toma
    let ok = resultados.iter().filter(|r| r.estado_conciliacion == "OK").count() as i64;
    let faltantes_count = resultados.iter().filter(|r| r.estado_conciliacion == "Faltante").count() as i64;
    let no_esperadas = resultados.iter().filter(|r| r.estado_conciliacion == "No esperado").count() as i64;
    let total = resultados.len() as i64;

    conn.execute(
        "UPDATE tomas SET
            total_escaneadas = ?1,
            total_ok = ?2,
            total_faltantes = ?3,
            total_no_esperadas = ?4
         WHERE id = ?5",
        params![total, ok, faltantes_count, no_esperadas, toma_id],
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