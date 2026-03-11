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

${userPrompt ? `使用者補充提示：${userPrompt}\n\n` : ''}任務規則：
1. 根據使用者提供的圖片或 PDF 文件內容，生成適合作為字卡的知識點。一個概念一張，不要把多個定理塞進同一張。
2. 每張字卡有正面（問題/概念）和背面（答案/解釋）。
3. frontText / backText：文字欄位，可直接嵌入行內 LaTeX，格式為 $formula$，例如「質量 $m$ 與加速度 $a$ 的乘積」。
4. frontMath / backMath：整行獨立展示的公式欄位，直接寫 LaTeX 源碼，不要加 $ 符號。留空時請填 null 而非空字串。
5. 每張卡至少要有 frontText 或 frontMath 其中一個有值，其他欄位若無內容請填 null。
6. 回傳純 JSON 陣列，不要任何說明文字。

回傳格式範例：
[
  {
    "frontText": "牛頓第二運動定律",
    "frontMath": null,
    "backText": "合力等於質量乘以加速度，$F = ma$",
    "backMath": null
  },
  {
    "frontText": "定積分的定義",
    "frontMath": null,
    "backText": "函數曲線與 $x$ 軸之間的有向面積",
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

    const requestBody = { contents: [{ role: 'user' as const, parts }] };

    // Try v1beta first, then v1 — different models live on different API versions
    let text = '';
    const apiVersions = ['v1beta', 'v1'] as const;
    let lastError: Error | null = null;

    for (const apiVer of apiVersions) {
        try {
            const genModel = genAI.getGenerativeModel({ model }, { apiVersion: apiVer });
            const result = await genModel.generateContent(requestBody);
            text = result.response.text().trim();
            lastError = null;
            break;
        } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
            // Only retry on 404 (model not found for this API version)
            if (lastError.message.includes('404')) {
                continue;
            }
            // Non-404 errors (quota, auth, etc.) — throw immediately
            throw lastError;
        }
    }

    if (lastError) {
        throw lastError;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        // Fallback: try to extract JSON array from the text
        const match = text.match(/(\[\s*\{[\s\S]*\}\s*\])/);
        if (!match) {
            throw new Error(`AI 回應格式有誤，無法解析。原始回應：\n${text.slice(0, 400)}`);
        }
        try {
            parsed = JSON.parse(match[1]);
        } catch {
            throw new Error(`AI 回應格式有誤，無法解析。原始回應：\n${text.slice(0, 400)}`);
        }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('AI 未生成任何字卡，請嘗試調整提示詞或換一個檔案');
    }

    // Normalize: convert empty strings to undefined
    const cards: GeneratedCard[] = (parsed as GeneratedCard[]).map(c => ({
        frontText: c.frontText || undefined,
        frontMath: c.frontMath || undefined,
        backText: c.backText || undefined,
        backMath: c.backMath || undefined,
    }));

    return cards;
}
