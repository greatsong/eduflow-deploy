/**
 * Gemini Nano Banana 2 이미지 생성 서비스
 *
 * 교재 챕터 생성 시 이미지 플레이스홀더(<!-- IMAGE: ... -->)를 감지하여
 * Gemini 3.1 Flash Image (Nano Banana 2) API로 자동 생성하고,
 * docs/images/ 에 저장한 뒤 마크다운의 플레이스홀더를 실제 이미지 경로로 교체
 *
 * API: generateContent() with responseModalities: ['IMAGE']
 * 모델: gemini-3.1-flash-image-preview (Nano Banana 2)
 */
import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// 이미지 플레이스홀더 정규식: <!-- IMAGE: 설명 텍스트 -->
const PLACEHOLDER_REGEX = /<!-- IMAGE: (.+?) -->/g;

// Nano Banana 모델 목록 (우선순위)
const IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',   // Nano Banana 2 (속도+품질 균형)
  'gemini-2.5-flash-image',           // Nano Banana (고속)
];

export class ImageGenerator {
  /**
   * @param {string} apiKey - Google API 키
   * @param {string} [model] - 사용할 모델 (기본: gemini-3.1-flash-image-preview)
   */
  constructor(apiKey, model = IMAGE_MODELS[0]) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  /**
   * 마크다운에서 이미지 플레이스홀더를 찾아 반환
   * @param {string} markdown
   * @returns {{ fullMatch: string, description: string, index: number }[]}
   */
  findPlaceholders(markdown) {
    const placeholders = [];
    let match;
    const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
    while ((match = regex.exec(markdown)) !== null) {
      placeholders.push({
        fullMatch: match[0],
        description: match[1].trim(),
        index: match.index,
      });
    }
    return placeholders;
  }

  /**
   * Gemini Nano Banana 2 (generateContent API)로 이미지 생성
   * @param {string} description - 이미지 설명
   * @param {object} options - 생성 옵션
   * @returns {{ success: boolean, imageData?: string, mimeType?: string, error?: string }}
   */
  async generateImage(description, options = {}) {
    const {
      style = 'educational illustration',
      aspectRatio = '3:2',
      imageSize = '1K',
    } = options;

    const prompt = `Educational illustration for a textbook: ${description}. Style: clean, professional, ${style}. Suitable for students. No text in the image unless specifically requested.`;

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      // 응답에서 이미지 데이터 추출
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return {
              success: true,
              imageData: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png',
            };
          }
        }
      }
      return { success: false, error: '이미지가 생성되지 않았습니다' };
    } catch (error) {
      console.error('이미지 생성 실패:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 챕터 마크다운의 플레이스홀더를 실제 이미지로 교체
   *
   * 1. 마크다운에서 <!-- IMAGE: ... --> 플레이스홀더를 찾음
   * 2. 각 플레이스홀더에 대해 Imagen API로 이미지 생성
   * 3. 생성된 이미지를 docsPath/images/ 에 저장
   * 4. 플레이스홀더를 ![설명](images/파일명) 으로 교체
   *
   * @param {string} markdown - 원본 마크다운 콘텐츠
   * @param {string} docsPath - docs 디렉토리 경로
   * @param {string} chapterId - 챕터 ID (파일명 생성용)
   * @param {function|null} progressCallback - 진행 상황 콜백
   * @returns {string} 이미지가 교체된 마크다운
   */
  async processChapterImages(markdown, docsPath, chapterId, progressCallback = null) {
    const placeholders = this.findPlaceholders(markdown);
    if (placeholders.length === 0) return markdown;

    const imagesDir = join(docsPath, 'images');
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true });
    }

    let result = markdown;
    let generated = 0;

    for (const ph of placeholders) {
      if (progressCallback) {
        const desc = ph.description.length > 50
          ? ph.description.substring(0, 50) + '...'
          : ph.description;
        progressCallback(`🖼️ 이미지 생성 중 (${generated + 1}/${placeholders.length}): ${desc}`);
      }

      const imgResult = await this.generateImage(ph.description);

      if (imgResult.success) {
        const filename = `${chapterId}_img${generated + 1}.png`;
        const imgPath = join(imagesDir, filename);
        await writeFile(imgPath, Buffer.from(imgResult.imageData, 'base64'));

        // 플레이스홀더를 실제 이미지 마크다운으로 교체
        const imgMarkdown = `![${ph.description}](images/${filename})`;
        result = result.replace(ph.fullMatch, imgMarkdown);
        generated++;
      } else {
        // 실패 시 플레이스홀더를 설명 텍스트로 교체 (graceful fallback)
        const fallback = `> **[이미지]** ${ph.description}\n> *(이미지 자동 생성에 실패했습니다. 직접 이미지를 추가해주세요.)*`;
        result = result.replace(ph.fullMatch, fallback);
      }
    }

    if (progressCallback) {
      progressCallback(`🖼️ 이미지 생성 완료: ${generated}/${placeholders.length}장 성공`);
    }

    return result;
  }

  /**
   * 단일 이미지 재생성 (기존 파일 덮어쓰기)
   * @param {string} description - 새 이미지 설명
   * @param {string} filename - 저장할 파일명 (예: chapter01_img1.png)
   * @param {string} docsPath - docs 디렉토리 경로
   * @returns {{ success: boolean, filename?: string, size?: number, error?: string }}
   */
  async generateSingle(description, filename, docsPath) {
    const imagesDir = join(docsPath, 'images');
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true });
    }

    const imgResult = await this.generateImage(description);
    if (!imgResult.success) {
      return { success: false, error: imgResult.error };
    }

    const buffer = Buffer.from(imgResult.imageData, 'base64');
    const imgPath = join(imagesDir, filename);
    await writeFile(imgPath, buffer);

    return { success: true, filename, size: buffer.length };
  }
}
