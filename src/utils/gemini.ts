// ── Gemini API integration ─────────────────────────────────────────────────────

import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import type { GeminiModel } from './aiStorage';

export interface GeneratedCard {
    frontText?: string;
    frontMath?: string;
    backText?: string;
    backMath?: string;
}

// System instruction telling Gemini exactly what we want
function buildSystemPrompt(deckName: string, userPrompt: string): string {
    return `你是一個專業的學習字卡生成助手。
牌組名稱：「${deckName}」

${userPrompt ? `使用者提示：${userPrompt}\n\n` : ''}任務規則：
1. 根據使用者提供的圖片或 PDF 文件內容，生成適合作為字卡的知識點。
2. 每張字卡有正面（問題/概念）和背面（答案/解釋）。
3. 文字請放在 frontText / backText 欄位。
4. 數學公式（LaTeX）請放在 frontMath / backMath 欄位（不要加 $$ 或 $ 符號，只放純 LaTeX 源碼）。
5. 每個欄位都是選填，但每張卡至少要有 frontText 或 frontMath 之一。
6. 回傳格式必須是純 JSON 陣列，不要有任何說明文字、markdown code block 或其他內容。

回傳格式範例：
[
  {
    "frontText": "牛頓第二運動定律",
    "frontMath": "",
    "backText": "物體所受合力等於質量乘以加速度",
    "backMath": "F = ma"
  },
  {
    "frontText": "積分的定義",
    "frontMath": "",
    "backText": "函數曲線與 x 軸之間的有向面積",
    "backMath": "\\int_a^b f(x)\\,dx"
  }
]`;
}

/**
 * Convert a base64 data URL to a Gemini inline data Part.
 */
function dataUrlToPart(dataUrl: string): Part {
    const [header, base64] = dataUrl.split(',');
    const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
    return {
        inlineData: {
            mimeType,
            data: base64,
        },
    };
}

/**
 * Convert a File to a Gemini inline data Part (works for images and PDFs).
 */
async function fileToPart(file: File): Promise<Part> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target!.result as string;
            const [header, base64] = dataUrl.split(',');
            const mimeType = file.type || (header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream');
            resolve({ inlineData: { mimeType, data: base64 } });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export interface GenerateOptions {
    apiKey: string;
    model: GeminiModel;
    deckName: string;
    userPrompt: string;
    imageDataUrls: string[];   // base64 data URLs for uploaded images
    pdfFile: File | null;      // PDF File object (if any)
}

/**
 * Call Gemini API and return parsed flashcard array.
 * Throws on API error or invalid JSON response.
 */
export async function generateFlashcards(options: GenerateOptions): Promise<GeneratedCard[]> {
    const { apiKey, model, deckName, userPrompt, imageDataUrls, pdfFile } = options;

    if (!apiKey) throw new Error('請先輸入 Gemini API Key');
    if (imageDataUrls.length === 0 && !pdfFile) {
        throw new Error('請先上傳圖片或 PDF');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    const systemPrompt = buildSystemPrompt(deckName, userPrompt);

    // Build content parts
    const parts: Part[] = [{ text: systemPrompt }];

    // Add image parts
    for (const dataUrl of imageDataUrls) {
        parts.push(dataUrlToPart(dataUrl));
    }

    // Add PDF part
    if (pdfFile) {
        const pdfPart = await fileToPart(pdfFile);
        parts.push(pdfPart);
    }

    const result = await genModel.generateContent({ contents: [{ role: 'user', parts }] });
    const text = result.response.text().trim();

    // Strip markdown code block if model wraps in ```json ... ```
    const jsonText = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    let cards: GeneratedCard[];
    try {
        cards = JSON.parse(jsonText);
    } catch {
        throw new Error(`AI 回應格式有誤，無法解析。原始回應：\n${text.slice(0, 300)}`);
    }

    if (!Array.isArray(cards) || cards.length === 0) {
        throw new Error('AI 未生成任何字卡，請嘗試調整提示詞或換一個檔案');
    }

    return cards;
}
