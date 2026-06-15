mod db;
mod excel;
use tauri::Manager;
use std::sync::Mutex;
use rusqlite::Connection;
use tauri::State;
use db::{JoyaInput, Joya, Toma, ResultadoTag};
use serde::{Serialize, Deserialize};

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
            get_resumen,
            get_config_api,
            set_config_api,
            probar_conexion,
            get_zonas_wifi,
            agregar_zona_wifi,
            eliminar_zona_wifi,
            login,
logout,
get_sesion,
sync_joyas_a_api,
sync_toma_a_api,
debug_config,
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

#[derive(serde::Serialize)]
struct ResumenData {
    total_joyas: i64,
    con_tag: i64,
    sin_tag: i64,
    valor_total: f64,
    por_categoria: Vec<CategoriaStats>,
    ultimas_tomas: Vec<Toma>,
}

#[derive(serde::Serialize)]
struct CategoriaStats {
    categoria: String,
    total: i64,
    porcentaje: f64,
}

#[tauri::command]
fn get_resumen(state: State<DbState>) -> Result<ResumenData, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Totales
    let total_joyas: i64 = conn.query_row(
        "SELECT COUNT(*) FROM joyas", [], |r| r.get(0)
    ).map_err(|e| e.to_string())?;

    let con_tag: i64 = conn.query_row(
        "SELECT COUNT(*) FROM joyas WHERE epc IS NOT NULL", [], |r| r.get(0)
    ).map_err(|e| e.to_string())?;

    let valor_total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(precio), 0) FROM joyas", [], |r| r.get(0)
    ).map_err(|e| e.to_string())?;

    // Por categoría
    let mut stmt = conn.prepare(
        "SELECT categoria, COUNT(*) as total
         FROM joyas
         GROUP BY categoria
         ORDER BY total DESC"
    ).map_err(|e| e.to_string())?;

    let cats = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<_>>();

    let por_categoria = cats.iter().map(|(cat, total)| {
        CategoriaStats {
            categoria: cat.clone(),
            total: *total,
            porcentaje: if total_joyas > 0 {
                (*total as f64 / total_joyas as f64) * 100.0
            } else { 0.0 },
        }
    }).collect();

    // Últimas tomas
    let ultimas_tomas = db::get_tomas(&conn)
        .map_err(|e| e.to_string())?
        .into_iter()
        .take(3)
        .collect();

    Ok(ResumenData {
        total_joyas,
        con_tag,
        sin_tag: total_joyas - con_tag,
        valor_total,
        por_categoria,
        ultimas_tomas,
    })
}

#[derive(Serialize, Deserialize)]
struct ConfigApi {
    url: String,
    token: String,
}

#[tauri::command]
fn get_config_api(state: State<DbState>) -> Result<ConfigApi, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let url = db::get_config(&conn, "api_url").map_err(|e| e.to_string())?.unwrap_or_default();
    let token = db::get_config(&conn, "api_token").map_err(|e| e.to_string())?.unwrap_or_default();
    Ok(ConfigApi { url, token })
}

#[tauri::command]
fn set_config_api(state: State<DbState>, url: String, token: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_config(&conn, "api_url", &url).map_err(|e| e.to_string())?;
    db::set_config(&conn, "api_token", &token).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn probar_conexion(url: String, token: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let endpoint = format!("{}/joyas", url.trim_end_matches('/'));

    let resp = client
        .get(&endpoint)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Error de conexión: {}", e))?;

    let status = resp.status();

    if status.is_success() {
        Ok("Conexión exitosa".to_string())
    } else if status.as_u16() == 401 {
        Err("Token inválido o expirado".to_string())
    } else {
        Err(format!("Error HTTP {}", status.as_u16()))
    }
}

// ============ ZONAS WIFI ============

#[tauri::command]
fn get_zonas_wifi(state: State<DbState>) -> Result<Vec<db::ZonaWifi>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_zonas_wifi(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn agregar_zona_wifi(state: State<DbState>, zona: String, bssid: String) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::agregar_zona_wifi(&conn, &zona, &bssid).map_err(|e| e.to_string())
}

#[tauri::command]
fn eliminar_zona_wifi(state: State<DbState>, id: i64) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::eliminar_zona_wifi(&conn, id).map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize)]
struct LoginResponse {
    success: bool,
    message: String,
    data: Option<LoginData>,
}

#[derive(Serialize, Deserialize)]
struct LoginData {
    token: String,
    usuario: UsuarioData,
}

#[derive(Serialize, Deserialize, Clone)]
struct UsuarioData {
    id: i64,
    nombre: String,
    usuario: String,
    rol: String,
}

#[tauri::command]
async fn login(
    state: State<'_, DbState>,
    usuario: String,
    password: String,
) -> Result<UsuarioData, String> {
    // Obtener URL configurada
    let url = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::get_config(&conn, "api_url")
            .map_err(|e| e.to_string())?
            .ok_or("Configura primero la URL de la API en Ajustes")?
    };

    let endpoint = format!("{}/auth/login", url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let resp = client
        .post(&endpoint)
        .form(&[("usuario", &usuario), ("password", &password)])
        .send()
        .await
        .map_err(|e| format!("Error de conexión: {}", e))?;

    let status = resp.status();
    let body: LoginResponse = resp.json().await
        .map_err(|e| format!("Respuesta inválida: {}", e))?;

    if !status.is_success() || !body.success {
        return Err(body.message);
    }

    let data = body.data.ok_or("Respuesta sin datos")?;

    // Guardar sesión en SQLite
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_token", &data.token).map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_usuario", &data.usuario.usuario).map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_nombre", &data.usuario.nombre).map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_rol", &data.usuario.rol).map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_id", &data.usuario.id.to_string()).map_err(|e| e.to_string())?;

    // También actualizar el token de la API para que probar_conexion funcione
    db::set_config(&conn, "api_token", &data.token).map_err(|e| e.to_string())?;

    Ok(data.usuario)
}

#[tauri::command]
fn logout(state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_token", "").map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_usuario", "").map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_nombre", "").map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_rol", "").map_err(|e| e.to_string())?;
    db::set_config(&conn, "session_id", "").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_sesion(state: State<DbState>) -> Result<Option<UsuarioData>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let token = db::get_config(&conn, "session_token").map_err(|e| e.to_string())?;

    match token {
        Some(t) if !t.is_empty() => {
            let id = db::get_config(&conn, "session_id").map_err(|e| e.to_string())?
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0);
            let nombre = db::get_config(&conn, "session_nombre").map_err(|e| e.to_string())?.unwrap_or_default();
            let usuario = db::get_config(&conn, "session_usuario").map_err(|e| e.to_string())?.unwrap_or_default();
            let rol = db::get_config(&conn, "session_rol").map_err(|e| e.to_string())?.unwrap_or_default();

            Ok(Some(UsuarioData { id, nombre, usuario, rol }))
        }
        _ => Ok(None),
    }
}

#[tauri::command]
async fn sync_joyas_a_api(
    state: State<'_, DbState>,
) -> Result<String, String> {
    let (url, token, joyas) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let url = db::get_config(&conn, "api_url")
            .map_err(|e| e.to_string())?
            .ok_or("URL de API no configurada")?;
        let token = db::get_config(&conn, "api_token")
            .map_err(|e| e.to_string())?
            .ok_or("Token no configurado. Inicia sesión primero.")?;
        let joyas = db::get_joyas(&conn, None)
            .map_err(|e| e.to_string())?;
        (url, token, joyas)
    };

    if joyas.is_empty() {
        return Ok("No hay joyas para sincronizar".to_string());
    }

    let endpoint = format!("{}/joyas/sync", url.trim_end_matches('/'));

    let payload = serde_json::json!({ "joyas": joyas });

    let client = reqwest::Client::new();
    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error de conexión: {}", e))?;

    let status = resp.status();
    let body: serde_json::Value = resp.json().await
        .map_err(|e| format!("Respuesta inválida: {}", e))?;

    if status.is_success() {
        let insertadas  = body["data"]["insertadas"].as_i64().unwrap_or(0);
        let actualizadas = body["data"]["actualizadas"].as_i64().unwrap_or(0);
        Ok(format!("✅ {} insertadas, {} actualizadas", insertadas, actualizadas))
    } else {
        Err(body["message"].as_str().unwrap_or("Error desconocido").to_string())
    }
}

#[tauri::command]
async fn sync_toma_a_api(
    state: State<'_, DbState>,
    toma_id: i64,
) -> Result<String, String> {
    let (url, token, toma, tags) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let url = db::get_config(&conn, "api_url")
            .map_err(|e| e.to_string())?
            .ok_or("URL de API no configurada")?;
        let token = db::get_config(&conn, "api_token")
            .map_err(|e| e.to_string())?
            .ok_or("Token no configurado")?;
        let toma = db::get_toma_por_id(&conn, toma_id)
            .map_err(|e| e.to_string())?
            .ok_or("Toma no encontrada")?;
        let tags = db::get_tags_por_toma(&conn, toma_id)
            .map_err(|e| e.to_string())?;
        (url, token, toma, tags)
    };

    let endpoint = format!("{}/tomas/sync", url.trim_end_matches('/'));

    let payload = serde_json::json!({
        "numero":             toma.numero,
        "fecha":              toma.fecha,
        "ubicacion":          toma.ubicacion,
        "total_escaneadas":   toma.total_escaneadas,
        "total_ok":           toma.total_ok,
        "total_faltantes":    toma.total_faltantes,
        "total_no_esperadas": toma.total_no_esperadas,
        "duracion_min":       toma.duracion_min,
        "tags":               tags,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error de conexión: {}", e))?;

    let status = resp.status();
    let body: serde_json::Value = resp.json().await
        .map_err(|e| format!("Respuesta inválida: {}", e))?;

    if status.is_success() {
        // Marcar toma como enviada en SQLite local
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::marcar_toma_enviada(&conn, toma_id).map_err(|e| e.to_string())?;
        Ok(format!("✅ Toma #{} sincronizada", toma.numero))
    } else {
        Err(body["message"].as_str().unwrap_or("Error desconocido").to_string())
    }
}

#[tauri::command]
fn debug_config(
    app: tauri::AppHandle,
    state: State<DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Ruta real del archivo
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("rfid_joyas.db");

    // Leer todo lo que hay en config
    let mut stmt = conn
        .prepare("SELECT clave, valor FROM config")
        .map_err(|e| e.to_string())?;

    let filas: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({
        "db_path": db_path.to_string_lossy(),
        "config": filas,
    }))
}