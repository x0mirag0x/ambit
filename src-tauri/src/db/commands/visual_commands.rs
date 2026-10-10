use super::run_blocking;
use crate::visual::{
    parse_dhash, rank_similar, signature_from_path, SIMILAR_RESULT_LIMIT,
};
use rusqlite::{params, OptionalExtension};
use tauri::AppHandle;

#[derive(serde::Serialize, specta::Type, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SimilarImageHit {
    pub id: String,
    pub distance: u32,
}

#[derive(serde::Serialize, specta::Type, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VisualBackfillResult {
    pub updated: usize,
    pub remaining: usize,
}

#[tauri::command(rename_all = "camelCase")]
#[specta::specta]
pub async fn search_similar_images(
    app: AppHandle,
    path: String,
) -> Result<Vec<SimilarImageHit>, String> {
    let signature = signature_from_path(&path).ok_or_else(|| "Could not read the search image".to_string())?;
    let query = parse_dhash(&signature.dhash).ok_or_else(|| "Could not hash the search image".to_string())?;
    run_blocking(app, move |conn| {
        let mut statement = conn
            .prepare(
                "SELECT images.id, images.dhash
                 FROM images
                 WHERE images.dhash IS NOT NULL
                   AND length(images.dhash) = 16
                   AND images.media_type = 'image'
                   AND images.is_deleted = 0
                   AND images.is_missing = 0
                   AND images.id IN (SELECT id FROM scoped_images)",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| error.to_string())?;
        let mut candidates = Vec::new();
        for row in rows {
            let (id, hash) = row.map_err(|error| error.to_string())?;
            if let Some(bits) = parse_dhash(&hash) {
                candidates.push((id, bits));
            }
        }
        Ok(rank_similar(query, candidates)
            .into_iter()
            .take(SIMILAR_RESULT_LIMIT)
            .map(|(id, distance)| SimilarImageHit { id, distance })
            .collect())
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
#[specta::specta]
pub async fn get_image_palette(app: AppHandle, id: String) -> Result<Vec<String>, String> {
    run_blocking(app, move |conn| {
        let palette = conn
            .query_row(
                "SELECT color_palette FROM images
                 WHERE id = ?1 AND id IN (SELECT id FROM scoped_images)",
                params![id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .flatten();
        Ok(split_palette(palette.as_deref()))
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
#[specta::specta]
pub async fn backfill_visual_signatures(
    app: AppHandle,
    limit: u32,
) -> Result<VisualBackfillResult, String> {
    let batch_limit = limit.clamp(1, 80);
    run_blocking(app, move |conn| {
        if !visual_columns_ready(conn) {
            return Ok(VisualBackfillResult {
                updated: 0,
                remaining: 0,
            });
        }
        let mut statement = conn
            .prepare(
                "SELECT id, path FROM images
                 WHERE media_type = 'image'
                   AND is_deleted = 0
                   AND is_missing = 0
                   AND id IN (SELECT id FROM scoped_images)
                   AND (dhash IS NULL OR color_palette IS NULL)
                 LIMIT ?1",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![batch_limit], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| error.to_string())?;
        let pending = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        let mut updated = 0usize;
        for (id, path) in &pending {
            store_visual_signature(conn, id, path, false)?;
            updated += 1;
        }
        let remaining = conn
            .query_row(
                "SELECT COUNT(*) FROM images
                 WHERE media_type = 'image'
                   AND is_deleted = 0
                   AND is_missing = 0
                   AND id IN (SELECT id FROM scoped_images)
                   AND (dhash IS NULL OR color_palette IS NULL)",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| error.to_string())?
            .max(0) as usize;
        Ok(VisualBackfillResult { updated, remaining })
    })
    .await
}

pub fn visual_columns_ready(conn: &rusqlite::Connection) -> bool {
    conn.query_row(
        "SELECT 1 FROM pragma_table_info('images') WHERE name = 'dhash'",
        [],
        |_| Ok(()),
    )
    .optional()
    .ok()
    .flatten()
    .is_some()
}

fn clear_visual_signature(conn: &rusqlite::Connection, id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE images
         SET dhash = NULL, dominant_r = NULL, dominant_g = NULL, dominant_b = NULL, color_palette = NULL
         WHERE id = ?1",
        params![id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn mark_visual_signature_unavailable(conn: &rusqlite::Connection, id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE images
         SET dhash = '', dominant_r = NULL, dominant_g = NULL, dominant_b = NULL, color_palette = ''
         WHERE id = ?1",
        params![id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn store_visual_signature(
    conn: &rusqlite::Connection,
    id: &str,
    path: &str,
    is_missing: bool,
) -> Result<(), String> {
    if !visual_columns_ready(conn) {
        return Ok(());
    }
    if is_missing {
        clear_visual_signature(conn, id)?;
        return Ok(());
    }
    if !std::path::Path::new(path).is_file() {
        // An empty hash leaves the column non-null so a silent backfill does not
        // retry the same missing file forever. Search only accepts 16 hex digits.
        mark_visual_signature_unavailable(conn, id)?;
        return Ok(());
    }
    let Some(signature) = signature_from_path(path) else {
        mark_visual_signature_unavailable(conn, id)?;
        return Ok(());
    };
    conn.execute(
        "UPDATE images
         SET dhash = ?2,
             dominant_r = ?3,
             dominant_g = ?4,
             dominant_b = ?5,
             color_palette = ?6
         WHERE id = ?1",
        params![
            id,
            signature.dhash,
            i64::from(signature.dominant_r),
            i64::from(signature.dominant_g),
            i64::from(signature.dominant_b),
            signature.palette.join(",")
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn split_palette(value: Option<&str>) -> Vec<String> {
    value
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|color| color.starts_with('#') && color.len() == 7)
        .map(str::to_string)
        .collect()
}
