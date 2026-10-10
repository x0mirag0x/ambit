export const localizeFilterSentinel = (value: string, translate: (key: string) => string): string => (
    value === 'Unknown' || value === 'Other' ? translate(value) : value
);

const GENERATION_TYPE_LABELS: Record<string, string> = {
    txt2img: 'Text to Image',
    img2img: 'Image to Image',
    extras: 'Extras/Upscale',
    grid: 'Grid',
    saved: 'Saved',
    unknown: 'Unknown',
    text_to_video: 'Text to video',
    image_to_video: 'Image to video',
    first_last_frame_to_video: 'First/last frame',
    video_editing: 'Video editing',
    audio_lip_sync: 'Audio / lip sync',
    guided_video: 'Guided video',
};

export const generationTypeLabel = (type: string): string => GENERATION_TYPE_LABELS[type] || type;
