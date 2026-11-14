//! Build a PromptBase-compatible SQLite catalog for archive export.
//!
//! Archive layout expected by PromptBase import:
//!   manifest.json
//!   database/promptbase.db
//!   media/<library_id>/<relative_path>

use rusqlite::{params, Connection};
use serde::Deserialize;
use specta::Type;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PromptBaseExportItem {
    pub title: String,
    pub prompt: String,
    pub ai_model: String,
    pub tags: String,
    pub relative_path: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub content_type: String,
    pub created_at: String,
    pub is_bookmarked: bool,
}

fn temp_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("dvoyna_promptbase_export_{nanos}.db"))
}

fn create_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            kind TEXT NOT NULL DEFAULT 'normal' CHECK (kind IN ('inbox', 'normal')),
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE UNIQUE INDEX idx_one_inbox
          ON folders(kind) WHERE kind = 'inbox';
        CREATE TABLE items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            prompt TEXT NOT NULL DEFAULT '',
            ai_model TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '',
            source_url TEXT,
            file_path TEXT,
            no_file INTEGER NOT NULL DEFAULT 0,
            content_type TEXT NOT NULL DEFAULT 'none',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            width INTEGER,
            height INTEGER,
            is_bookmarked INTEGER NOT NULL DEFAULT 0,
            trashed_at TEXT,
            library_id INTEGER,
            relative_path TEXT,
            scheduled_date TEXT,
            scheduled_time TEXT NOT NULL DEFAULT '',
            schedule_done INTEGER NOT NULL DEFAULT 0,
            post_text TEXT NOT NULL DEFAULT '',
            post_channels TEXT NOT NULL DEFAULT '',
            reminder_enabled INTEGER NOT NULL DEFAULT 1,
            reminder_snoozed_until TEXT,
            extra_notes TEXT NOT NULL DEFAULT '',
            phash TEXT
        );
        CREATE TABLE item_folders (
            item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
            PRIMARY KEY (item_id, folder_id)
        );
        CREATE TABLE packs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            cover_item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE pack_items (
            pack_id INTEGER NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
            item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (pack_id, item_id)
        );
        CREATE INDEX idx_pack_items_pack_order
          ON pack_items(pack_id, sort_order ASC, item_id ASC);
        CREATE INDEX idx_items_created ON items(created_at DESC);
        CREATE TABLE libraries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        "#,
    )
    .map_err(|error| format!("Failed to create PromptBase schema: {error}"))
}

pub(crate) fn build_promptbase_database_bytes(
    items: &[PromptBaseExportItem],
    library_name: &str,
) -> Result<Vec<u8>, String> {
    let path = temp_db_path();
    let bytes = (|| {
        let conn = Connection::open(&path)
            .map_err(|error| format!("Failed to open temporary PromptBase database: {error}"))?;
        create_schema(&conn)?;

        conn.execute(
            "INSERT INTO folders (id, name, kind, sort_order) VALUES (1, 'Inbox', 'inbox', 0)",
            [],
        )
        .map_err(|error| format!("Failed to insert Inbox folder: {error}"))?;
        conn.execute(
            "INSERT INTO folders (id, name, kind, sort_order) VALUES (2, 'DVOYNA', 'normal', 1000)",
            [],
        )
        .map_err(|error| format!("Failed to insert DVOYNA folder: {error}"))?;
        conn.execute(
            "INSERT INTO libraries (id, name, path, sort_order) VALUES (1, ?1, 'media/1', 1000)",
            params![library_name],
        )
        .map_err(|error| format!("Failed to insert library: {error}"))?;

        for item in items {
            conn.execute(
                "INSERT INTO items (
                    title, prompt, ai_model, tags, no_file, content_type, created_at,
                    width, height, is_bookmarked, library_id, relative_path
                ) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, 1, ?10)",
                params![
                    item.title,
                    item.prompt,
                    item.ai_model,
                    item.tags,
                    item.content_type,
                    item.created_at,
                    item.width,
                    item.height,
                    if item.is_bookmarked { 1 } else { 0 },
                    item.relative_path,
                ],
            )
            .map_err(|error| format!("Failed to insert PromptBase item: {error}"))?;

            let item_id = conn.last_insert_rowid();
            conn.execute(
                "INSERT INTO item_folders (item_id, folder_id) VALUES (?1, 2)",
                params![item_id],
            )
            .map_err(|error| format!("Failed to link PromptBase item to folder: {error}"))?;
        }

        drop(conn);
        fs::read(&path).map_err(|error| format!("Failed to read PromptBase database bytes: {error}"))
    })();

    let _ = fs::remove_file(&path);
    bytes
}

#[tauri::command(rename_all = "camelCase")]
#[specta::specta]
pub fn build_promptbase_database(
    items: Vec<PromptBaseExportItem>,
    library_name: String,
) -> Result<Vec<u8>, String> {
    let name = {
        let trimmed = library_name.trim();
        if trimmed.is_empty() {
            "Dvoyna Export".to_string()
        } else {
            trimmed.to_string()
        }
    };
    build_promptbase_database_bytes(&items, &name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_readable_promptbase_catalog() {
        let items = vec![PromptBaseExportItem {
            title: "forest.png".into(),
            prompt: "Prompt:\na forest path".into(),
            ai_model: "Seedream V5 pro".into(),
            tags: "mosaic".into(),
            relative_path: "forest.png".into(),
            width: Some(1080),
            height: Some(1080),
            content_type: "image".into(),
            created_at: "2026-10-02 12:22:15".into(),
            is_bookmarked: true,
        }];

        let bytes = build_promptbase_database_bytes(&items, "Dvoyna Export").expect("db bytes");
        assert!(bytes.len() > 100);

        let path = temp_db_path();
        fs::write(&path, &bytes).expect("write temp db");
        let conn = Connection::open(&path).expect("open");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM items", [], |row| row.get(0))
            .expect("count");
        assert_eq!(count, 1);
        let prompt: String = conn
            .query_row("SELECT prompt FROM items WHERE relative_path = 'forest.png'", [], |row| {
                row.get(0)
            })
            .expect("prompt");
        assert!(prompt.contains("forest path"));
        let folder_name: String = conn
            .query_row(
                "SELECT f.name FROM folders f
                 JOIN item_folders ifr ON ifr.folder_id = f.id
                 JOIN items i ON i.id = ifr.item_id
                 WHERE i.relative_path = 'forest.png'",
                [],
                |row| row.get(0),
            )
            .expect("folder");
        assert_eq!(folder_name, "DVOYNA");
        let _ = fs::remove_file(&path);
    }
}
