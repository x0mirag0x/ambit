import { describe, expect, it } from 'vitest';
import { GeneratorTool, type AIImage, type VideoAsset } from '../../types';
import {
  allocatePromptBaseRelativePath,
  buildPromptBaseExportItems,
  buildPromptBaseManifest,
  formatPromptBaseCreatedAt,
  sanitizePromptBaseFileName,
} from '../promptbaseExport';

const image = (overrides: Partial<AIImage> = {}): AIImage => ({
  id: 'C:/images/photo.png',
  url: 'asset://C:/images/photo.png',
  thumbnailUrl: 'asset://C:/thumbs/photo.webp',
  filename: 'photo.png',
  timestamp: Date.UTC(2026, 9, 2, 12, 22, 15),
  width: 1080,
  height: 1080,
  isFavorite: true,
  metadata: {
    tool: GeneratorTool.COMFYUI,
    model: 'Seedream V5 pro',
    steps: 20,
    cfg: 7,
    sampler: 'Euler',
    positivePrompt: 'a forest path',
    negativePrompt: '',
  },
  ...overrides,
});

describe('promptbaseExport helpers', () => {
  it('builds a PromptBase-compatible manifest', () => {
    expect(buildPromptBaseManifest('Dvoyna Export', 1794658693)).toEqual({
      format: 'promptbase-archive',
      version: 1,
      exportedAt: '1794658693',
      profileId: 'dvoyna-export',
      profileName: 'Dvoyna Export',
    });
  });

  it('formats created_at like the PromptBase sample catalog', () => {
    expect(formatPromptBaseCreatedAt(Date.UTC(2026, 9, 2, 12, 22, 15))).toBe('2026-10-02 12:22:15');
  });

  it('sanitizes and de-duplicates relative paths', () => {
    expect(sanitizePromptBaseFileName('a<>b.png')).toBe('a__b.png');
    const used = new Set<string>();
    expect(allocatePromptBaseRelativePath('photo.png', used)).toBe('photo.png');
    expect(allocatePromptBaseRelativePath('photo.png', used)).toBe('photo (2).png');
  });

  it('maps images and videos into PromptBase export rows with prompts', () => {
    const clip: VideoAsset = {
      ...image({
        id: 'C:/videos/clip.mp4',
        filename: 'clip.mp4',
        isFavorite: false,
        metadata: {
          tool: GeneratorTool.UNKNOWN,
          model: 'Unknown',
          steps: 0,
          cfg: 0,
          sampler: '',
          positivePrompt: 'Prompt:\nalready prefixed',
          negativePrompt: '',
          overrideModel: 'GPT Image 2',
        },
      }),
      mediaType: 'video',
      durationMs: 1000,
      videoCodec: 'h264',
      audioPresent: true,
      rotationDegrees: 0,
      probeStatus: 'ready',
      playbackStatus: 'playable',
    };

    const rows = buildPromptBaseExportItems([image(), clip]);
    expect(rows).toHaveLength(2);
    expect(rows[0].item).toMatchObject({
      title: 'photo.png',
      relativePath: 'photo.png',
      prompt: 'Prompt:\na forest path',
      aiModel: 'Seedream V5 pro',
      contentType: 'image',
      createdAt: '2026-10-02 12:22:15',
      isBookmarked: true,
      width: 1080,
      height: 1080,
    });
    expect(rows[1].item).toMatchObject({
      title: 'clip.mp4',
      prompt: 'Prompt:\nalready prefixed',
      aiModel: 'GPT Image 2',
      contentType: 'video',
      isBookmarked: false,
    });
  });
});
