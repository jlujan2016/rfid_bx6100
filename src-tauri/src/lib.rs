use tauri::Manager;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RFIDTag {
    epc: String,
    rssi: i32,
}

#[tauri::command]
async fn scan_rfid(app_handle: tauri::AppHandle, duration: Option<i32>) -> Result<(), String> {
    let duration_val = duration.unwrap_or(200);
    let window = app_handle.get_webview_window("main")
        .ok_or("No se pudo obtener la ventana principal")?;
    
    let js_code = format!(
        r#"
        (function() {{
            try {{
                if (window.AndroidRFID && window.AndroidRFID.scanRFID) {{
                    const result = window.AndroidRFID.scanRFID({});
                    const data = JSON.parse(result);
                    window.dispatchEvent(new CustomEvent('rfid-scan-result', {{ detail: data }}));
                }} else {{
                    window.dispatchEvent(new CustomEvent('rfid-scan-result', {{ 
                        detail: {{ success: false, error: 'AndroidRFID no disponible' }}
                    }}));
                }}
            }} catch(e) {{
                window.dispatchEvent(new CustomEvent('rfid-scan-result', {{ 
                    detail: {{ success: false, error: e.toString() }}
                }}));
            }}
        }})();
        "#,
        duration_val
    );
    
    window.eval(&js_code)
        .map_err(|e| format!("Error ejecutando escáner RFID: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, scan_rfid])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}