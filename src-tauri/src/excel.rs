use calamine::{Reader, Xlsx, DataType};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ImportResult {
    pub insertadas: usize,
    pub duplicadas: usize,
    pub errores: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FilaExcel {
    pub nombre: String,
    pub categoria: String,
    pub metal: String,
    pub peso_g: f64,
    pub precio: f64,
    pub ubicacion: String,
    pub estado: String,
    pub epc: Option<String>,
}

use std::io::Cursor;

pub fn leer_excel_bytes(bytes: &[u8]) -> Result<Vec<FilaExcel>, String> {
    let cursor = Cursor::new(bytes);
    let mut workbook = Xlsx::new(cursor)
        .map_err(|e| format!("Error abriendo archivo: {}", e))?;

    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or("El archivo no tiene hojas")?;

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("Error leyendo hoja: {}", e))?;

    let mut filas: Vec<FilaExcel> = Vec::new();
    let mut iter = range.rows();
    iter.next(); // saltar encabezado

    for row in iter {
        let nombre = row.get(0)
            .and_then(|c| c.as_string())
            .unwrap_or_default()
            .trim()
            .to_string();

        if nombre.is_empty() { continue; }

        let categoria = row.get(1)
            .and_then(|c| c.as_string())
            .unwrap_or_else(|| "Sin categoría".to_string())
            .trim()
            .to_string();

        let metal = row.get(2)
            .and_then(|c| c.as_string())
            .unwrap_or_default()
            .trim()
            .to_string();

        let peso_g = row.get(3).and_then(|c| c.as_f64()).unwrap_or(0.0);
        let precio  = row.get(4).and_then(|c| c.as_f64()).unwrap_or(0.0);

        let ubicacion = row.get(5)
            .and_then(|c| c.as_string())
            .unwrap_or_else(|| "Tienda".to_string())
            .trim()
            .to_string();

        let estado = row.get(6)
            .and_then(|c| c.as_string())
            .unwrap_or_else(|| "En stock".to_string())
            .trim()
            .to_string();

        let epc = row.get(7)
            .and_then(|c| c.as_string())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        filas.push(FilaExcel { nombre, categoria, metal, peso_g, precio, ubicacion, estado, epc });
    }

    Ok(filas)
}