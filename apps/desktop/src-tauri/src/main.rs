#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use serde::Deserialize;

#[derive(Deserialize)]
struct IgnorePayload { ignore: bool }

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![set_ignore_cursor])
    .setup(|app| {
      // Verificar se a janela já existe
      if app.get_webview_window("psicolmeia-main").is_some() {
        return Ok(());
      }
      
      let _win = WebviewWindowBuilder::new(app, "psicolmeia-main", WebviewUrl::default())
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .visible(true)
        .build()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn set_ignore_cursor(window: tauri::WebviewWindow, payload: IgnorePayload) -> Result<(), String> {
  window.set_ignore_cursor_events(payload.ignore).map_err(|e| e.to_string())
}
