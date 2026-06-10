use calamine::{Reader, Xlsx, DataType};
use serde::{Deserialize, Serialize};
use rust_xlsxwriter::XlsxError;
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

fn xlsx_err(e: XlsxError) -> String {
    e.to_string()
}

pub fn generar_excel_inventario(
    ruta: &str,
    joyas: &[crate::db::Joya],
    resultados: &[crate::db::ResultadoTag],
) -> Result<(), String> {
    use rust_xlsxwriter::*;

    let mut workbook = Workbook::new();

    let fmt_header = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0x1a1a2e))
        .set_font_color(Color::White)
        .set_align(FormatAlign::Center);

    let fmt_ok = Format::new()
        .set_font_color(Color::RGB(0x2e7d32));

    let fmt_faltante = Format::new()
        .set_font_color(Color::RGB(0xc62828));

    let fmt_no_esp = Format::new()
        .set_font_color(Color::RGB(0xe65100));

    let fmt_moneda = Format::new()
        .set_num_format("S/ #,##0.00");

    // ===== HOJA 1: CATÁLOGO =====
    let sheet1 = workbook.add_worksheet();
    sheet1.set_name("Catalogo").map_err(xlsx_err)?;

    let headers = [
        "Nombre", "Categoría", "Metal", "Peso (g)",
        "Precio (S/)", "Ubicación", "Estado", "EPC", "Inventariado"
    ];

    for (col, h) in headers.iter().enumerate() {
        sheet1.write_with_format(0, col as u16, *h, &fmt_header)
            .map_err(xlsx_err)?;
    }

    // Mapa EPC → estado conciliación
    let mut mapa: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    for r in resultados {
        mapa.insert(r.epc.clone(), r.estado_conciliacion.clone());
    }

    for (i, joya) in joyas.iter().enumerate() {
        let row = (i + 1) as u32;
        sheet1.write(row, 0, &joya.nombre).map_err(xlsx_err)?;
        sheet1.write(row, 1, &joya.categoria).map_err(xlsx_err)?;
        sheet1.write(row, 2, &joya.metal).map_err(xlsx_err)?;
        sheet1.write(row, 3, joya.peso_g).map_err(xlsx_err)?;
        sheet1.write_with_format(row, 4, joya.precio, &fmt_moneda).map_err(xlsx_err)?;
        sheet1.write(row, 5, &joya.ubicacion).map_err(xlsx_err)?;
        sheet1.write(row, 6, &joya.estado).map_err(xlsx_err)?;
        sheet1.write(row, 7, joya.epc.as_deref().unwrap_or("")).map_err(xlsx_err)?;

        if let Some(epc) = &joya.epc {
            let estado = mapa.get(epc).map(|s| s.as_str()).unwrap_or("No escaneado");
            let fmt = match estado {
                "OK"       => &fmt_ok,
                "Faltante" => &fmt_faltante,
                _          => &fmt_no_esp,
            };
            sheet1.write_with_format(row, 8, estado, fmt).map_err(xlsx_err)?;
        } else {
            sheet1.write(row, 8, "Sin tag").map_err(xlsx_err)?;
        }
    }

    sheet1.set_column_width(0, 30).map_err(xlsx_err)?;
    sheet1.set_column_width(1, 12).map_err(xlsx_err)?;
    sheet1.set_column_width(2, 14).map_err(xlsx_err)?;
    sheet1.set_column_width(7, 20).map_err(xlsx_err)?;
    sheet1.set_column_width(8, 14).map_err(xlsx_err)?;

    // ===== HOJA 2: RESUMEN =====
    let sheet2 = workbook.add_worksheet();
    sheet2.set_name("Resumen").map_err(xlsx_err)?;

    let total     = joyas.len();
    let con_tag   = joyas.iter().filter(|j| j.epc.is_some()).count();
    let sin_tag   = total - con_tag;
    let ok        = resultados.iter().filter(|r| r.estado_conciliacion == "OK").count();
    let faltantes = resultados.iter().filter(|r| r.estado_conciliacion == "Faltante").count();
    let no_esp    = resultados.iter().filter(|r| r.estado_conciliacion == "No esperado").count();
    let valor: f64 = joyas.iter().map(|j| j.precio).sum();

    sheet2.merge_range(0, 0, 0, 1, "RESUMEN DE INVENTARIO", &fmt_header)
        .map_err(xlsx_err)?;

    let filas: &[(&str, String)] = &[
        ("Total joyas",       total.to_string()),
        ("Con tag RFID",      con_tag.to_string()),
        ("Sin tag RFID",      sin_tag.to_string()),
        ("Valor total (S/)",  format!("{:.2}", valor)),
        ("",                  "".to_string()),
        ("Encontradas (OK)",  ok.to_string()),
        ("Faltantes",         faltantes.to_string()),
        ("No esperadas",      no_esp.to_string()),
    ];

    for (i, (label, valor)) in filas.iter().enumerate() {
        let row = (i + 2) as u32;
        sheet2.write(row, 0, *label).map_err(xlsx_err)?;
        sheet2.write(row, 1, valor.as_str()).map_err(xlsx_err)?;
    }

    sheet2.set_column_width(0, 25).map_err(xlsx_err)?;
    sheet2.set_column_width(1, 15).map_err(xlsx_err)?;

    // Guardar como bytes y retornar
    workbook.save(ruta).map_err(xlsx_err)?;

    Ok(())
}