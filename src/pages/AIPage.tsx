import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Sparkles, Key, ChevronDown, ChevronUp, Plus, Trash2,
    Pencil, Check, X, Upload, FileText, Image as ImageIcon,
    Camera, CheckSquare, Square, Loader2, AlertCircle
} from 'lucide-react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { getTags } from '../db/store';
import { addCard } from '../db/store';
import { Tag } from '../db/schema';
import {
    getApiKey, setApiKey as saveApiKey,
    getModel, setModel as saveModel,
    getPresets,
    addPreset, updatePreset, deletePreset,
    PromptPreset, GeminiModel
} from '../utils/aiStorage';
import { generateFlashcards, GeneratedCard } from '../utils/gemini';
import { wrapLatex } from '../utils/math';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PreviewCard extends GeneratedCard {
    id: string;
    selected: boolean;
    isFlipped: boolean;
    isEditing: boolean;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Flip card for preview */
function AICard({ card, onChange, onToggleSelect }: {
    card: PreviewCard;
    onChange: (updated: Partial<GeneratedCard>) => void;
    onToggleSelect: () => void;
}) {
    const [localFrontText, setLocalFrontText] = useState(card.frontText ?? '');
    const [localFrontMath, setLocalFrontMath] = useState(card.frontMath ?? '');
    const [localBackText, setLocalBackText] = useState(card.backText ?? '');
    const [localBackMath, setLocalBackMath] = useState(card.backMath ?? '');

    const handleSaveEdit = () => {
        onChange({
            frontText: localFrontText || undefined,
            frontMath: localFrontMath || undefined,
            backText: localBackText || undefined,
            backMath: localBackMath || undefined,
        });
    };

    return (
        <div className={`ai-card-wrapper ${card.selected ? '' : 'ai-card-deselected'}`}>
            {/* Header row */}
            <div className="ai-card-header">
                <button
                    className="ai-card-select-btn"
                    onClick={onToggleSelect}
                    title={card.selected ? '取消選取' : '選取'}
                >
                    {card.selected ? <CheckSquare size={18} className="icon-amber" /> : <Square size={18} />}
                </button>
            </div>

            {card.isEditing ? (
                /* ── Edit Mode ── */
                <div className="ai-card-edit">
                    <p className="ai-edit-label">正面</p>
                    <textarea
                        className="form-input mb-2"
                        rows={2}
                        placeholder="正面文字"
                        value={localFrontText}
                        onChange={e => setLocalFrontText(e.target.value)}
                    />
                    <textarea
                        className="form-input font-mono mb-3"
                        rows={2}
                        placeholder="正面 LaTeX（不含 $）"
                        value={localFrontMath}
                        onChange={e => setLocalFrontMath(e.target.value)}
                    />
                    <p className="ai-edit-label">背面</p>
                    <textarea
                        className="form-input mb-2"
                        rows={2}
                        placeholder="背面文字"
                        value={localBackText}
                        onChange={e => setLocalBackText(e.target.value)}
                    />
                    <textarea
                        className="form-input font-mono mb-3"
                        rows={2}
                        placeholder="背面 LaTeX（不含 $）"
                        value={localBackMath}
                        onChange={e => setLocalBackMath(e.target.value)}
                    />
                    <button className="btn-primary w-100" onClick={handleSaveEdit}>
                        <Check size={16} style={{ marginRight: 6 }} /> 儲存修改
                    </button>
                </div>
            ) : (
                /* ── Preview / Flip Mode ── */
                <div className={`ai-flip-card ${card.isFlipped ? 'flipped' : ''}`} onClick={() => onChange({})}>
                    <div className="ai-flip-inner">
                        {/* Front */}
                        <div className="ai-flip-face ai-flip-front">
                            <span className="ai-face-label">正面</span>
                            {card.frontText && <p className="ai-card-text">{card.frontText}</p>}
                            {card.frontMath && (
                                <div className="math-preview">
                                    <Latex>{wrapLatex(card.frontMath)}</Latex>
                                </div>
                            )}
                            {!card.frontText && !card.frontMath && (
                                <p className="ai-card-empty">（無內容）</p>
                            )}
                            <span className="ai-flip-hint">點擊翻面</span>
                        </div>
                        {/* Back */}
                        <div className="ai-flip-face ai-flip-back">
                            <span className="ai-face-label">背面</span>
                            {card.backText && <p className="ai-card-text">{card.backText}</p>}
                            {card.backMath && (
                                <div className="math-preview">
                                    <Latex>{wrapLatex(card.backMath)}</Latex>
                                </div>
                            )}
                            {!card.backText && !card.backMath && (
                                <p className="ai-card-empty">（無內容）</p>
                            )}
                            <span className="ai-flip-hint">點擊翻回</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AIPage() {
    // Settings
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState<GeminiModel>('gemini-1.5-flash');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [apiKeySaved, setApiKeySaved] = useState(false);

    // Presets
    const [presets, setPresets] = useState<PromptPreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const [editingPreset, setEditingPreset] = useState<PromptPreset | null>(null);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetText, setNewPresetText] = useState('');
    const [showAddPreset, setShowAddPreset] = useState(false);

    // Deck
    const [tags, setTags] = useState<Tag[]>([]);
    const [selectedTagId, setSelectedTagId] = useState('');

    // Custom prompt
    const [customPrompt, setCustomPrompt] = useState('');

    // Upload
    const [images, setImages] = useState<string[]>([]); // base64 data URLs
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Generation
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [previewCards, setPreviewCards] = useState<PreviewCard[]>([]);

    // Toast
    const [toast, setToast] = useState('');

    // Load initial data
    useEffect(() => {
        setApiKey(getApiKey());
        setModel(getModel());
        setPresets(getPresets());
        getTags().then(ts => {
            setTags(ts);
            if (ts.length > 0) setSelectedTagId(ts[0].id);
        });
    }, []);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    // ── API Key ───────────────────────────────────────────────────────────────

    const handleSaveApiKey = () => {
        saveApiKey(apiKey);
        setApiKeySaved(true);
        setTimeout(() => setApiKeySaved(false), 2000);
    };

    // ── Model ─────────────────────────────────────────────────────────────────

    const handleModelChange = (m: GeminiModel) => {
        setModel(m);
        saveModel(m);
    };

    // ── Presets ───────────────────────────────────────────────────────────────

    const handleSelectPreset = (id: string) => {
        if (selectedPresetId === id) {
            setSelectedPresetId(null);
        } else {
            setSelectedPresetId(id);
            const p = presets.find(x => x.id === id);
            if (p) setCustomPrompt(p.text);
        }
    };

    const handleAddPreset = () => {
        if (!newPresetName.trim() || !newPresetText.trim()) return;
        const p = addPreset(newPresetName.trim(), newPresetText.trim());
        setPresets(getPresets());
        setNewPresetName('');
        setNewPresetText('');
        setShowAddPreset(false);
        setSelectedPresetId(p.id);
        setCustomPrompt(p.text);
    };

    const handleUpdatePreset = () => {
        if (!editingPreset) return;
        updatePreset(editingPreset.id, editingPreset.name, editingPreset.text);
        setPresets(getPresets());
        setEditingPreset(null);
    };

    const handleDeletePreset = (id: string) => {
        deletePreset(id);
        setPresets(getPresets());
        if (selectedPresetId === id) {
            setSelectedPresetId(null);
            setCustomPrompt('');
        }
    };

    // ── Image Upload ──────────────────────────────────────────────────────────

    const compressImage = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const maxPx = 1500;
                let { naturalWidth: w, naturalHeight: h } = img;
                if (Math.max(w, h) > maxPx) {
                    const r = maxPx / Math.max(w, h);
                    w = Math.round(w * r);
                    h = Math.round(h * r);
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => {
                // Fallback: read raw
                const reader = new FileReader();
                reader.onload = e => resolve(e.target!.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            };
            img.src = url;
        });
    }, []);

    const handleImageFiles = async (files: FileList | File[]) => {
        const arr = Array.from(files).filter(f => f.type.startsWith('image/') || f.name.endsWith('.heic') || f.name.endsWith('.heif'));
        const results = await Promise.all(arr.map(f => compressImage(f)));
        setImages(prev => [...prev, ...results]);
    };

    const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleImageFiles(e.target.files);
            e.target.value = '';
        }
    };

    // Drag & drop
    const [dragging, setDragging] = useState(false);
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
    const handleDragLeave = () => setDragging(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) handleImageFiles(e.dataTransfer.files);
    };

    const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setPdfFile(file);
        e.target.value = '';
    };

    // ── Generation ────────────────────────────────────────────────────────────

    const handleGenerate = async () => {
        setError('');
        setPreviewCards([]);
        const deckName = tags.find(t => t.id === selectedTagId)?.name ?? '未命名牌組';
        const finalPrompt = customPrompt.trim();

        setGenerating(true);
        try {
            const cards = await generateFlashcards({
                apiKey,
                model,
                deckName,
                userPrompt: finalPrompt,
                imageDataUrls: images,
                pdfFile,
            });

            const previews: PreviewCard[] = cards.map(c => ({
                ...c,
                id: crypto.randomUUID(),
                selected: true,
                isFlipped: false,
                isEditing: false,
            }));
            setPreviewCards(previews);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : '發生未知錯誤');
        } finally {
            setGenerating(false);
        }
    };

    // ── Preview actions ───────────────────────────────────────────────────────

    const updateCard = (id: string, changes: Partial<GeneratedCard>) => {
        setPreviewCards(prev => prev.map(c => {
            if (c.id !== id) return c;
            // Empty change object = toggle flip
            if (Object.keys(changes).length === 0) {
                return { ...c, isFlipped: !c.isFlipped, isEditing: false };
            }
            return { ...c, ...changes, isEditing: false };
        }));
    };

    const toggleSelect = (id: string) => {
        setPreviewCards(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
    };

    const toggleEdit = (id: string) => {
        setPreviewCards(prev => prev.map(c => c.id === id ? { ...c, isEditing: !c.isEditing, isFlipped: false } : c));
    };

    const selectAll = () => setPreviewCards(prev => prev.map(c => ({ ...c, selected: true })));
    const selectNone = () => setPreviewCards(prev => prev.map(c => ({ ...c, selected: false })));

    const handleImport = async () => {
        const toImport = previewCards.filter(c => c.selected);
        if (toImport.length === 0) {
            showToast('請至少選取一張卡片');
            return;
        }
        if (!selectedTagId) {
            showToast('請選擇目標牌組');
            return;
        }
        for (const card of toImport) {
            await addCard({
                tagId: selectedTagId,
                level: 0,
                frontText: card.frontText || undefined,
                frontMath: card.frontMath || undefined,
                backText: card.backText || undefined,
                backMath: card.backMath || undefined,
                nextReviewDate: 0,
            });
        }
        showToast(`✅ 已匯入 ${toImport.length} 張卡片`);
        setPreviewCards(prev => prev.filter(c => !c.selected));
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const selectedCount = previewCards.filter(c => c.selected).length;
    const deckName = tags.find(t => t.id === selectedTagId)?.name ?? '';

    return (
        <div className="ai-page fade-in">

            {/* ── Page Title ── */}
            <div className="section-header">
                <h2 className="text-gradient">
                    <Sparkles size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                    AI 生成字卡
                </h2>
            </div>

            {/* ══════════════════════════════════════════════
                區塊 A — 設定面板
            ══════════════════════════════════════════════ */}
            <div className="glass-card ai-settings-card">
                <button className="ai-settings-toggle" onClick={() => setSettingsOpen(o => !o)}>
                    <span className="ai-settings-toggle-left">
                        <Key size={16} />  AI 設定
                    </span>
                    {settingsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {settingsOpen && (
                    <div className="ai-settings-body">

                        {/* API Key */}
                        <label className="form-label">Gemini API Key</label>
                        <div className="ai-key-row">
                            <input
                                type="password"
                                className="form-input"
                                placeholder="輸入你的 Gemini API Key"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                            />
                            <button className="btn-secondary ai-key-save-btn" onClick={handleSaveApiKey}>
                                {apiKeySaved ? <Check size={16} /> : '儲存'}
                            </button>
                        </div>
                        <p className="ai-disclaimer">
                            ⚠ API Key 僅儲存於本機 localStorage，不會上傳至任何伺服器。
                        </p>

                        <hr className="divider" />

                        {/* Model */}
                        <label className="form-label">模型選擇</label>
                        <div className="compress-chips mb-4">
                            {(['gemini-1.5-flash', 'gemini-1.5-pro'] as GeminiModel[]).map(m => (
                                <button
                                    key={m}
                                    className={`compress-chip ${model === m ? 'active' : ''}`}
                                    onClick={() => handleModelChange(m)}
                                >
                                    {m === 'gemini-1.5-flash' ? '⚡ Flash（快速）' : '🧠 Pro（精準）'}
                                </button>
                            ))}
                        </div>

                        <hr className="divider" />

                        {/* Target Deck */}
                        <label className="form-label">目標牌組</label>
                        <select
                            className="form-input mb-4"
                            value={selectedTagId}
                            onChange={e => setSelectedTagId(e.target.value)}
                        >
                            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>

                        <hr className="divider" />

                        {/* Preset Prompts */}
                        <div className="ai-preset-header">
                            <label className="form-label" style={{ marginBottom: 0 }}>預設提示詞</label>
                            <button className="btn-icon-sm" onClick={() => setShowAddPreset(o => !o)} title="新增">
                                <Plus size={16} />
                            </button>
                        </div>

                        {showAddPreset && (
                            <div className="ai-preset-add-form">
                                <input
                                    className="form-input mb-2"
                                    placeholder="提示詞名稱"
                                    value={newPresetName}
                                    onChange={e => setNewPresetName(e.target.value)}
                                />
                                <textarea
                                    className="form-input mb-2"
                                    rows={3}
                                    placeholder="提示詞內容"
                                    value={newPresetText}
                                    onChange={e => setNewPresetText(e.target.value)}
                                />
                                <div className="ai-preset-add-actions">
                                    <button className="btn-primary" onClick={handleAddPreset}>新增</button>
                                    <button className="btn-secondary" onClick={() => setShowAddPreset(false)}>取消</button>
                                </div>
                            </div>
                        )}

                        <div className="ai-preset-list">
                            {presets.map(p => (
                                <div key={p.id} className={`ai-preset-item ${selectedPresetId === p.id ? 'active' : ''}`}>
                                    {editingPreset?.id === p.id ? (
                                        <div className="ai-preset-edit-inline">
                                            <input
                                                className="form-input mb-1"
                                                value={editingPreset.name}
                                                onChange={e => setEditingPreset({ ...editingPreset, name: e.target.value })}
                                            />
                                            <textarea
                                                className="form-input mb-2"
                                                rows={3}
                                                value={editingPreset.text}
                                                onChange={e => setEditingPreset({ ...editingPreset, text: e.target.value })}
                                            />
                                            <div className="ai-preset-add-actions">
                                                <button className="btn-primary" onClick={handleUpdatePreset}>儲存</button>
                                                <button className="btn-secondary" onClick={() => setEditingPreset(null)}>取消</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="ai-preset-row" onClick={() => handleSelectPreset(p.id)}>
                                            <span className="ai-preset-name">{p.name}</span>
                                            <div className="ai-preset-actions">
                                                <button className="btn-icon-sm" onClick={e => { e.stopPropagation(); setEditingPreset(p); }} title="編輯">
                                                    <Pencil size={14} />
                                                </button>
                                                <button className="btn-icon-sm danger" onClick={e => { e.stopPropagation(); handleDeletePreset(p.id); }} title="刪除">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <hr className="divider" />

                        {/* Custom Prompt */}
                        <label className="form-label">補充提示詞</label>
                        <textarea
                            className="form-input mb-1"
                            rows={4}
                            placeholder="在此補充說明，例如：重點在第3章、只生成定理類型的卡片…"
                            value={customPrompt}
                            onChange={e => setCustomPrompt(e.target.value)}
                        />
                        <p className="ai-hint">選擇預設提示詞後，內容會自動帶入此框，可再修改。</p>
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════
                區塊 B — 上傳輸入
            ══════════════════════════════════════════════ */}
            <div className="glass-card ai-upload-card">
                <h3 className="section-title">
                    <Upload size={16} style={{ marginRight: 6 }} />
                    上傳內容
                </h3>

                {/* Image upload zone */}
                <div
                    className={`ai-dropzone ${dragging ? 'dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="ai-dropzone-btns">
                        <button className="btn-secondary ai-upload-btn" onClick={() => imageInputRef.current?.click()}>
                            <ImageIcon size={16} /> 選擇圖片
                        </button>
                        <button className="btn-secondary ai-upload-btn" onClick={() => cameraInputRef.current?.click()}>
                            <Camera size={16} /> 拍照
                        </button>
                    </div>
                    <p className="ai-dropzone-hint">或拖曳圖片到此區域（支援多張）</p>

                    <input ref={imageInputRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={handleImageInputChange} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleImageInputChange} />
                </div>

                {/* Image thumbnails */}
                {images.length > 0 && (
                    <div className="ai-thumb-grid">
                        {images.map((src, i) => (
                            <div key={i} className="ai-thumb">
                                <img src={src} alt={`upload-${i}`} />
                                <button className="ai-thumb-remove" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}>
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <hr className="divider" />

                {/* PDF upload */}
                <div className="ai-pdf-row">
                    <button className="btn-secondary ai-upload-btn" onClick={() => pdfInputRef.current?.click()}>
                        <FileText size={16} /> 上傳 PDF
                    </button>
                    {pdfFile && (
                        <div className="ai-pdf-info">
                            <FileText size={14} />
                            <span>{pdfFile.name}</span>
                            <button className="btn-icon-sm danger" onClick={() => setPdfFile(null)} title="移除">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    <input ref={pdfInputRef} type="file" accept="application/pdf" hidden onChange={handlePdfChange} />
                </div>

                <hr className="divider" />

                {/* Quick deck info */}
                {deckName && (
                    <p className="ai-deck-badge">
                        🗂 目標牌組：<strong>{deckName}</strong>
                    </p>
                )}

                {/* Generate button */}
                <button
                    className="btn-primary w-100 ai-generate-btn"
                    onClick={handleGenerate}
                    disabled={generating || (images.length === 0 && !pdfFile)}
                >
                    {generating
                        ? <><Loader2 size={18} className="spin" /> 生成中…</>
                        : <><Sparkles size={18} /> 開始生成字卡</>}
                </button>

                {error && (
                    <div className="ai-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════
                區塊 C — 預覽結果
            ══════════════════════════════════════════════ */}
            {previewCards.length > 0 && (
                <div className="glass-card ai-preview-card fade-in">
                    <div className="ai-preview-toolbar">
                        <h3 className="section-title" style={{ marginBottom: 0 }}>
                            預覽 · 共 {previewCards.length} 張（已選 {selectedCount}）
                        </h3>
                        <div className="ai-preview-actions">
                            <button className="btn-icon-sm" onClick={selectAll} title="全選"><CheckSquare size={16} /></button>
                            <button className="btn-icon-sm" onClick={selectNone} title="全取消"><Square size={16} /></button>
                        </div>
                    </div>

                    <div className="ai-card-list">
                        {previewCards.map((card) => (
                            <div key={card.id} className="ai-card-container">
                                <AICard
                                    card={card}
                                    onChange={(changes) => updateCard(card.id, changes)}
                                    onToggleSelect={() => toggleSelect(card.id)}
                                />
                                <div className="ai-card-footer">
                                    <button
                                        className={`btn-secondary ai-edit-btn ${card.isEditing ? 'active' : ''}`}
                                        onClick={() => toggleEdit(card.id)}
                                    >
                                        {card.isEditing ? <><X size={14} /> 取消</> : <><Pencil size={14} /> 編輯</>}
                                    </button>
                                    <button
                                        className="btn-icon-sm danger"
                                        onClick={() => setPreviewCards(prev => prev.filter(c => c.id !== card.id))}
                                        title="刪除此卡"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="btn-primary w-100 mt-4" onClick={handleImport} style={{ padding: '0.9rem' }}>
                        <Check size={18} style={{ marginRight: 6 }} />
                        匯入 {selectedCount} 張字卡至「{deckName}」
                    </button>
                </div>
            )}

            {/* ── Regenerate hint (after generation) ── */}
            {previewCards.length === 0 && !generating && !error && images.length === 0 && !pdfFile && (
                <div className="ai-empty-state">
                    <Sparkles size={40} className="ai-empty-icon" />
                    <p>上傳圖片或 PDF，並設定好 API Key 與目標牌組，即可讓 AI 自動生成字卡。</p>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="toast fade-in">
                    <Check size={20} /> {toast}
                </div>
            )}
        </div>
    );
}
