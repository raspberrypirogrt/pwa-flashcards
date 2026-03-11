// ── AI Settings localStorage helpers ──────────────────────────────────────────

const KEY_API_KEY = 'ai_gemini_api_key';
const KEY_MODEL = 'ai_gemini_model';
const KEY_PRESETS = 'ai_gemini_presets';

export type GeminiModel = 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-3-flash';

export interface PromptPreset {
    id: string;
    name: string;
    text: string;
}

// ── API Key ────────────────────────────────────────────────────────────────────

export function getApiKey(): string {
    return localStorage.getItem(KEY_API_KEY) ?? '';
}

export function setApiKey(key: string): void {
    localStorage.setItem(KEY_API_KEY, key);
}

// ── Model ──────────────────────────────────────────────────────────────────────

export function getModel(): GeminiModel {
    const stored = localStorage.getItem(KEY_MODEL);
    if (stored === 'gemini-2.0-flash' || stored === 'gemini-2.5-flash' || stored === 'gemini-3-flash') return stored;
    return 'gemini-2.0-flash';
}

export function setModel(model: GeminiModel): void {
    localStorage.setItem(KEY_MODEL, model);
}

// ── Prompt Presets ─────────────────────────────────────────────────────────────

const DEFAULT_PRESETS: PromptPreset[] = [
    {
        id: 'default-1',
        name: '通用知識',
        text: '請根據內容生成詳細的知識點字卡，正面為概念或問題，背面為解釋或答案。如有數學公式請使用 LaTeX 格式。',
    },
    {
        id: 'default-2',
        name: '數學 / 物理',
        text: '請專注於數學推導或物理定律，正面寫定理名稱或題目，背面寫完整推導過程與結論。公式請使用 LaTeX 格式。',
    },
    {
        id: 'default-3',
        name: '英文單字',
        text: '請從內容中提取重要英文詞彙，正面為英文單字，背面為中文釋義與例句。',
    },
];

export function getPresets(): PromptPreset[] {
    const raw = localStorage.getItem(KEY_PRESETS);
    if (!raw) return DEFAULT_PRESETS;
    try {
        return JSON.parse(raw) as PromptPreset[];
    } catch {
        return DEFAULT_PRESETS;
    }
}

export function savePresets(presets: PromptPreset[]): void {
    localStorage.setItem(KEY_PRESETS, JSON.stringify(presets));
}

export function addPreset(name: string, text: string): PromptPreset {
    const presets = getPresets();
    const newPreset: PromptPreset = { id: crypto.randomUUID(), name, text };
    presets.push(newPreset);
    savePresets(presets);
    return newPreset;
}

export function updatePreset(id: string, name: string, text: string): void {
    const presets = getPresets().map(p => p.id === id ? { ...p, name, text } : p);
    savePresets(presets);
}

export function deletePreset(id: string): void {
    const presets = getPresets().filter(p => p.id !== id);
    savePresets(presets);
}
