mod db;
mod excel;
use tauri::Manager;
use std::sync::Mutex;
use rusqlite::Connection;
use tauri::State;
use db::{JoyaInput, Joya, Toma, ResultadoTag};

struct DbState(Mutex<Connection>);

// ============ JOYAS ============

#[tauri::command]
fn get_joyas(state: State<DbState>, categoria: Option<String>) -> Result<Vec<Joya>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_joyas(&conn, categoria.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn crear_joya(state: State<DbState>, input: JoyaInput) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::crear_joya(&conn, &input).map_err(|e| e.to_string())
}

#[tauri::command]
fn actualizar_joya(state: State<DbState>, id: i64, input: JoyaInput) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::actualizar_joya(&conn, id, &input).map_err(|e| e.to_string())
}

#[tauri::command]
fn eliminar_joya(state: State<DbState>, id: i64) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::eliminar_joya(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn asignar_epc(state: State<DbState>, id: i64, epc: String) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::asignar_epc(&conn, id, &epc).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_no_sincronizadas(state: State<DbState>) -> Result<Vec<Joya>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_no_sincronizadas(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn marcar_sincronizada(state: State<DbState>, id: i64) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::marcar_sincronizada(&conn, id).map_err(|e| e.to_string())
}

// ============ TOMAS ============

#[tauri::command]
fn crear_toma(state: State<DbState>, ubicacion: String) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::crear_toma(&conn, &ubicacion).map_err(|e| e.to_string())
}

#[tauri::command]
fn insertar_tag_toma(
    state: State<DbState>,
    toma_id: i64,
    epc: String,
    rssi: i32,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::insertar_tag_toma(&conn, toma_id, &epc, rssi).map_err(|e| e.to_string())
}

#[tauri::command]
fn conciliar_toma(state: State<DbState>, toma_id: i64) -> Result<Vec<ResultadoTag>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::conciliar_toma(&conn, toma_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_tomas(state: State<DbState>) -> Result<Vec<Toma>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_tomas(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn insertar_datos_prueba(state: State<DbState>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Primero limpia datos anteriores de prueba
    conn.execute_batch("DELETE FROM joyas WHERE nombre LIKE 'PRUEBA%'")
        .map_err(|e| e.to_string())?;

    // Joyas de prueba — reemplaza los EPC con los que lee tu lector real
    let joyas = vec![
        ("PRUEBA Anillo solitario oro", "Anillo", "Oro 18k", 3.2, 2400.0, "Tienda", "En stock", Some("02071601")),
        ("PRUEBA Collar perlas", "Collar", "Plata 925", 12.8, 890.0, "Tienda", "En stock", Some("02071501")),
        ("PRUEBA Aretes argolla", "Aretes", "Oro blanco 14k", 1.9, 1150.0, "Almacen", "En stock", Some("00447101")),
        ("PRUEBA Pulsera tennis", "Pulsera", "Oro 18k", 8.5, 4500.0, "Almacen", "En stock", None),  // Sin EPC asignado
        ("PRUEBA Dije corazon", "Dije", "Oro 18k", 2.1, 680.0, "Tienda", "En stock", Some("02071701")),
    ];

    for (nombre, cat, metal, peso, precio, ubic, estado, epc) in &joyas {
        conn.execute(
            "INSERT OR IGNORE INTO joyas (nombre, categoria, metal, peso_g, precio, ubicacion, estado, epc)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![nombre, cat, metal, peso, precio, ubic, estado, epc],
        ).map_err(|e| e.to_string())?;
    }

    Ok(format!("{} joyas de prueba insertadas", joyas.len()))
}

// ============ SETUP ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init()) 
        .setup(|app| {
            let db_path = app
                .path()
                .app_data_dir()
                .expect("No se pudo obtener app_data_dir")
                .join("rfid_joyas.db");

            let conn = Connection::open(&db_path)
                .expect("No se pudo abrir la base de datos");

            db::init(&conn).expect("Error inicializando tablas");
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_joyas,
            crear_joya,
            actualizar_joya,
            eliminar_joya,
            asignar_epc,
            get_no_sincronizadas,
            marcar_sincronizada,
            crear_toma,
            insertar_tag_toma,
            conciliar_toma,
            get_tomas,
            insertar_datos_prueba,
            buscar_joya,
            importar_excel_bytes,
            exportar_inventario,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn importar_excel_bytes(
    state: State<DbState>,
    bytes: Vec<u8>,
) -> Result<excel::ImportResult, String> {
    let filas = excel::leer_excel_bytes(&bytes)?;

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut resultado = excel::ImportResult {
        insertadas: 0,
        duplicadas: 0,
        errores: Vec::new(),
    };

    for fila in &filas {
        if let Some(epc) = &fila.epc {
            match db::get_joya_por_epc(&conn, epc) {
                Ok(Some(existente)) => {
                    resultado.duplicadas += 1;
                    resultado.errores.push(format!(
                        "EPC {} ya existe en '{}'",
                        epc, existente.nombre
                    ));
                    continue;
                }
                Ok(None) => {}
                Err(e) => {
                    resultado.errores.push(format!("Error verificando EPC: {}", e));
                    continue;
                }
            }
        }

        let input = db::JoyaInput {
            nombre:    fila.nombre.clone(),
            categoria: fila.categoria.clone(),
            metal:     fila.metal.clone(),
            peso_g:    fila.peso_g,
            precio:    fila.precio,
            ubicacion: fila.ubicacion.clone(),
            estado:    fila.estado.clone(),
            epc:       fila.epc.clone(),
            foto:      None,
        };

        match db::crear_joya(&conn, &input) {
            Ok(_)  => resultado.insertadas += 1,
            Err(e) => resultado.errores.push(
                format!("Error insertando '{}': {}", fila.nombre, e)
            ),
        }
    }

    Ok(resultado)
}
#[tauri::command]
fn exportar_inventario(
    app: tauri::AppHandle,
    state: State<DbState>,
    toma_id: Option<i64>,
) -> Result<Vec<u8>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let joyas = db::get_joyas(&conn, None).map_err(|e| e.to_string())?;

    let resultados = if let Some(id) = toma_id {
        db::conciliar_toma(&conn, id).unwrap_or_default()
    } else {
        Vec::new()
    };

    // Usar directorio de caché de la app en lugar de temp del sistema
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let temp_path = cache_dir.join("inventario_rfid.xlsx");
    let temp_str = temp_path.to_string_lossy().to_string();

    excel::generar_excel_inventario(&temp_str, &joyas, &resultados)?;

     // Leer bytes del archivo generado
    let bytes = std::fs::read(&temp_path).map_err(|e| e.to_string())?;

    // Limpiar temporal
    let _ = std::fs::remove_file(&temp_path);

    Ok(bytes)
}
#[tauri::command]
fn buscar_joya(state: State<DbState>, query: String) -> Result<Vec<db::Joya>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::buscar_joya(&conn, &query).map_err(|e| e.to_string())
}