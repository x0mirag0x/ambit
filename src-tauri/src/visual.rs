//! 64-bit difference hash and a small dominant-colour palette.
//!
//! dHash resizes to 9x8 grayscale and compares each pixel with the neighbour
//! on its right. The 64 bits are stored as 16 lowercase hex digits.

use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use std::collections::HashMap;
use std::io::Cursor;

pub const SIMILAR_DISTANCE_LIMIT: u32 = 10;
pub const SIMILAR_RESULT_LIMIT: usize = 40;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VisualSignature {
    pub dhash: String,
    pub dominant_r: u8,
    pub dominant_g: u8,
    pub dominant_b: u8,
    pub palette: Vec<String>,
}

pub fn dhash_from_image(image: &DynamicImage) -> u64 {
    let gray = image
        .resize_exact(9, 8, image::imageops::FilterType::Triangle)
        .into_luma8();
    let mut bits: u64 = 0;
    for y in 0..8 {
        for x in 0..8 {
            let left = gray.get_pixel(x, y)[0];
            let right = gray.get_pixel(x + 1, y)[0];
            bits = (bits << 1) | u64::from(left > right);
        }
    }
    bits
}

pub fn format_dhash(bits: u64) -> String {
    format!("{bits:016x}")
}

pub fn normalize_comparable_path(path: &str) -> String {
    let trimmed = path.trim().trim_start_matches(r"\\?\");
    trimmed.replace('\\', "/").to_ascii_lowercase()
}

pub fn parse_dhash(value: &str) -> Option<u64> {
    let trimmed = value.trim();
    if trimmed.len() != 16 {
        return None;
    }
    u64::from_str_radix(trimmed, 16).ok()
}

pub fn hamming_distance(left: u64, right: u64) -> u32 {
    (left ^ right).count_ones()
}

pub fn rank_similar(
    query: u64,
    candidates: impl IntoIterator<Item = (String, u64)>,
) -> Vec<(String, u32)> {
    let mut hits: Vec<(String, u32)> = candidates
        .into_iter()
        .map(|(id, hash)| (id, hamming_distance(query, hash)))
        .filter(|(_, distance)| *distance <= SIMILAR_DISTANCE_LIMIT)
        .collect();
    hits.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)));
    hits.truncate(SIMILAR_RESULT_LIMIT);
    hits
}

pub fn signature_from_image(image: &DynamicImage) -> VisualSignature {
    let dhash = format_dhash(dhash_from_image(image));
    let (dominant_r, dominant_g, dominant_b, palette) = dominant_palette(image);
    VisualSignature {
        dhash,
        dominant_r,
        dominant_g,
        dominant_b,
        palette,
    }
}

pub fn signature_from_path(path: &str) -> Option<VisualSignature> {
    let image = image::open(path).ok()?;
    Some(signature_from_image(&image))
}

fn dominant_palette(image: &DynamicImage) -> (u8, u8, u8, Vec<String>) {
    let small = image.resize(48, 48, image::imageops::FilterType::Triangle);
    let mut counts: HashMap<(u8, u8, u8), u32> = HashMap::new();
    for pixel in small.pixels() {
        let rgba = pixel.2;
        if rgba[3] < 128 {
            continue;
        }
        let key = (
            quantize(rgba[0]),
            quantize(rgba[1]),
            quantize(rgba[2]),
        );
        *counts.entry(key).or_insert(0) += 1;
    }
    let mut ranked: Vec<((u8, u8, u8), u32)> = counts.into_iter().collect();
    ranked.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    let palette = ranked
        .iter()
        .take(5)
        .map(|((r, g, b), _)| format!("#{r:02x}{g:02x}{b:02x}"))
        .collect::<Vec<_>>();
    let (r, g, b) = ranked
        .first()
        .map(|((r, g, b), _)| (*r, *g, *b))
        .unwrap_or((0, 0, 0));
    (r, g, b, palette)
}

fn quantize(channel: u8) -> u8 {
    let step = 24u16;
    let bucket = (u16::from(channel) / step) * step;
    u8::try_from(bucket.min(255)).unwrap_or(255)
}

fn encode_jpeg(image: &DynamicImage, quality: u8) -> DynamicImage {
    let rgb = image.to_rgb8();
    let mut bytes = Cursor::new(Vec::new());
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, quality);
    encoder
        .encode(
            rgb.as_raw(),
            rgb.width(),
            rgb.height(),
            image::ExtendedColorType::Rgb8,
        )
        .expect("jpeg encode");
    image::load_from_memory(bytes.get_ref()).expect("jpeg decode")
}

fn patterned(kind: u8) -> DynamicImage {
    let mut image: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(180, 140);
    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let value = match kind {
            0 => ((x.wrapping_mul(3).wrapping_add(y)) % 256) as u8,
            1 => {
                if (x / 8 + y / 8) % 2 == 0 {
                    24
                } else {
                    230
                }
            }
            _ => ((y.wrapping_mul(5)) % 256) as u8,
        };
        *pixel = Rgba([value, value / 2, 255 - value, 255]);
    }
    DynamicImage::ImageRgba8(image)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_image_is_the_closest_match() {
        let image = patterned(0);
        let hash = dhash_from_image(&image);
        let stored = format_dhash(hash);
        assert_eq!(stored.len(), 16);
        assert_eq!(parse_dhash(&stored), Some(hash));

        let hits = rank_similar(
            hash,
            [
                ("other".to_string(), dhash_from_image(&patterned(1))),
                ("same".to_string(), hash),
            ],
        );
        assert_eq!(hits.first().map(|(id, distance)| (id.as_str(), *distance)), Some(("same", 0)));
    }

    #[test]
    fn windows_and_posix_paths_refer_to_the_same_file() {
        let picked = r"C:\Users\RobotComp\Downloads\image.jpg";
        let stored = "C:/Users/RobotComp/Downloads/Image.JPG";
        let prefixed = r"\\?\C:\Users\RobotComp\Downloads\image.jpg";
        assert_eq!(normalize_comparable_path(picked), normalize_comparable_path(stored));
        assert_eq!(normalize_comparable_path(picked), normalize_comparable_path(prefixed));
        assert_ne!(
            normalize_comparable_path(picked),
            normalize_comparable_path(r"C:\Users\RobotComp\Downloads\other.jpg")
        );
    }

    #[test]
    fn recompressed_and_downscaled_copy_stays_within_the_search_limit() {
        let image = patterned(0);
        let original = dhash_from_image(&image);
        let recompressed = dhash_from_image(&encode_jpeg(&image, 45));
        let downscaled = image.resize(48, 36, image::imageops::FilterType::Triangle);
        let downscaled_hash = dhash_from_image(&downscaled);

        assert!(hamming_distance(original, recompressed) <= SIMILAR_DISTANCE_LIMIT);
        assert!(hamming_distance(original, downscaled_hash) <= SIMILAR_DISTANCE_LIMIT);

        let hits = rank_similar(
            original,
            [
                ("jpeg".to_string(), recompressed),
                ("small".to_string(), downscaled_hash),
                ("unrelated".to_string(), dhash_from_image(&patterned(1))),
            ],
        );
        let ids: Vec<&str> = hits.iter().map(|(id, _)| id.as_str()).collect();
        assert!(ids.contains(&"jpeg"));
        assert!(ids.contains(&"small"));
    }

    #[test]
    fn unrelated_image_is_excluded_from_the_top_results() {
        let query = dhash_from_image(&patterned(0));
        let unrelated = dhash_from_image(&patterned(1));
        assert!(hamming_distance(query, unrelated) > SIMILAR_DISTANCE_LIMIT);
        let hits = rank_similar(
            query,
            [
                ("near".to_string(), query),
                ("unrelated".to_string(), unrelated),
            ],
        );
        assert!(hits.iter().all(|(id, _)| id != "unrelated"));
        assert_eq!(hits.len(), 1);
    }
}
