use tauri_plugin_sql::{Migration, MigrationKind};

/// Migration 85: perceptual hash and dominant colours live beside the item,
/// not inside the list-query projection.
pub fn migration85() -> Migration {
    Migration {
        version: 85,
        description: "add_visual_signatures",
        sql: r#"
            ALTER TABLE images ADD COLUMN dhash TEXT;
            ALTER TABLE images ADD COLUMN dominant_r INTEGER;
            ALTER TABLE images ADD COLUMN dominant_g INTEGER;
            ALTER TABLE images ADD COLUMN dominant_b INTEGER;
            ALTER TABLE images ADD COLUMN color_palette TEXT;
            CREATE INDEX IF NOT EXISTS idx_images_dhash_pending
                ON images(id)
                WHERE media_type = 'image'
                  AND is_deleted = 0
                  AND is_missing = 0
                  AND dhash IS NULL;
            CREATE INDEX IF NOT EXISTS idx_images_dominant_color
                ON images(dominant_r, dominant_g, dominant_b)
                WHERE dominant_r IS NOT NULL AND is_deleted = 0;
        "#,
        kind: MigrationKind::Up,
    }
}
