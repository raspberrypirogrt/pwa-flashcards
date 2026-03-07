import { useState, useEffect, useRef } from 'react';
import { getTags, addCard } from '../db/store';
import { Tag } from '../db/schema';
import { PlusCircle, Image as ImageIcon, Check, Zap, Table } from 'lucide-react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import BatchImportModal from '../components/BatchImportModal';
import { wrapLatex } from '../utils/math';

// ── Image processing ──────────────────────────────────────────────────────────

type Quality = 'original' | 'high' | 'standard';

const QUALITY_OPTIONS: { label: string; value: Quality; detail: string }[] = [
    { label: '不壓縮', value: 'original', detail: '保留原始大小' },
    { label: '高品質', value: 'high', detail: 'JPEG 85%，≤2000px' },
    { label: '標準', value: 'standard', detail: 'JPEG 70%，≤1200px' },
];

const QUALITY_SETTINGS: Record<Quality, { maxPx: number; quality: number }> = {
    original: { maxPx: Infinity, quality: 1 },
    high: { maxPx: 2000, quality: 0.85 },
    standard: { maxPx: 1200, quality: 0.70 },
};

function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

/** Convert a base64 data-URL to byte length */
function dataUrlBytes(dataUrl: string): number {
    const base64 = dataUrl.split(',')[1] || '';
    return Math.floor(base64.length * 0.75);
}

/**
 * Process a file:
 *  1. Draw to canvas (handles HEIC on iOS Safari, which decodes it before canvas)
 *  2. Scale down if wider/taller than maxPx
 *  3. Export as JPEG at specified quality
 *  If quality === 'original', just do FileReader (preserve SVG / exact bytes)
 */
async function processImage(file: File, quality: Quality): Promise<string> {
    const { maxPx, quality: q } = QUALITY_SETTINGS[quality];

    // SVG: never compress, return as-is
    if (file.type === 'image/svg+xml' || quality === 'original') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target!.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Load image via object URL (works for HEIC on iOS Safari)
    const objectUrl = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let { naturalWidth: w, naturalHeight: h } = img;

            // Scale if needed
            if (Math.max(w, h) > maxPx) {
                const ratio = maxPx / Math.max(w, h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', q));
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            // Fallback: read as-is
            const reader = new FileReader();
            reader.onload = e => resolve(e.target!.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        };
        img.src = objectUrl;
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ImageMeta { original: number; compressed: number }

export default function AddCardPage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [tagId, setTagId] = useState('');

    const [frontText, setFrontText] = useState('');
    const [frontMath, setFrontMath] = useState('');
    const [frontImage, setFrontImage] = useState<string>('');
    const [frontMeta, setFrontMeta] = useState<ImageMeta | null>(null);

    const [backText, setBackText] = useState('');
    const [backMath, setBackMath] = useState('');
    const [backImage, setBackImage] = useState<string>('');
    const [backMeta, setBackMeta] = useState<ImageMeta | null>(null);

    const [notes, setNotes] = useState('');

    const [quality, setQuality] = useState<Quality>('high');
    const [processing, setProcessing] = useState<'front' | 'back' | null>(null);
    const [toast, setToast] = useState('');
    const [showBatchImport, setShowBatchImport] = useState(false);

    const fileInputFront = useRef<HTMLInputElement>(null);
    const fileInputBack = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getTags().then(ts => {
            setTags(ts);
            if (ts.length > 0) setTagId(ts[0].id);
        });
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setProcessing(side);
        try {
            const originalSize = file.size;
            const result = await processImage(file, quality);
            const compressedSize = dataUrlBytes(result);

            if (side === 'front') {
                setFrontImage(result);
                setFrontMeta({ original: originalSize, compressed: compressedSize });
            } else {
                setBackImage(result);
                setBackMeta({ original: originalSize, compressed: compressedSize });
            }
        } catch {
            setToast('圖片處理失敗，請再試一次');
            setTimeout(() => setToast(''), 3000);
        } finally {
            setProcessing(null);
            // Reset input so the same file can be re-selected
            e.target.value = '';
        }
    };

    const handleSave = async () => {
        if (!tagId) return;
        if (!frontText && !frontMath && !frontImage) {
            setToast('請至少填寫正面的文字、公式或圖片');
            setTimeout(() => setToast(''), 3000);
            return;
        }
        try {
            await addCard({
                tagId,
                level: 0,
                frontText: frontText.trim() || undefined,
                frontMath: frontMath.trim() || undefined,
                frontImage: frontImage || undefined,
                backText: backText.trim() || undefined,
                backMath: backMath.trim() || undefined,
                backImage: backImage || undefined,
                notes: notes.trim() || undefined,
                nextReviewDate: 0
            });

            setToast('已新增至倉庫');
            setTimeout(() => setToast(''), 2000);

            setFrontText(''); setFrontMath(''); setFrontImage(''); setFrontMeta(null);
            setBackText(''); setBackMath(''); setBackImage(''); setBackMeta(null);
            setNotes('');
        } catch (e) {
            console.error(e);
            setToast('儲存失敗');
            setTimeout(() => setToast(''), 3000);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    const renderImageArea = (side: 'front' | 'back') => {
        const image = side === 'front' ? frontImage : backImage;
        const meta = side === 'front' ? frontMeta : backMeta;
        const inputRef = side === 'front' ? fileInputFront : fileInputBack;
        const clear = side === 'front'
            ? () => { setFrontImage(''); setFrontMeta(null); }
            : () => { setBackImage(''); setBackMeta(null); };
        const isLoading = processing === side;

        return (
            <div className="image-upload-area mb-4">
                <input
                    type="file"
                    accept="image/*, .heic, .heif, .svg"
                    hidden
                    ref={inputRef}
                    onChange={e => handleImageUpload(e, side)}
                />
                {isLoading ? (
                    <div className="img-processing-indicator">
                        <span className="spinner" /> 處理中…
                    </div>
                ) : image ? (
                    <div className="preview-wrap">
                        <img src={image} alt={`${side} preview`} />
                        <button className="btn-icon danger remove-img" onClick={clear}>✕</button>
                        {meta && quality !== 'original' && meta.original !== meta.compressed && (
                            <div className="img-size-badge">
                                {formatBytes(meta.original)} → {formatBytes(meta.compressed)}
                            </div>
                        )}
                    </div>
                ) : (
                    <button className="btn-secondary flex-center" style={{ width: '100%' }} onClick={() => inputRef.current?.click()}>
                        <ImageIcon size={20} style={{ marginRight: '8px' }} /> 加入圖片
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="add-page fade-in">
            {showBatchImport && (
                <BatchImportModal
                    tags={tags}
                    onClose={() => setShowBatchImport(false)}
                    onImported={(count) => {
                        setShowBatchImport(false);
                        setToast(`✅ 已批量匯入 ${count} 張卡片`);
                        setTimeout(() => setToast(''), 3000);
                    }}
                />
            )}

            <div className="section-header">
                <h2 className="text-gradient"><PlusCircle size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> 新增卡片</h2>
                <button className="backup-btn" onClick={() => setShowBatchImport(true)} title="批量匯入">
                    <Table size={14} /> 批量匯入
                </button>
            </div>

            <div className="glass-card scroll-form">
                <label className="form-label">選擇標籤</label>
                <select className="form-input mb-4" value={tagId} onChange={e => setTagId(e.target.value)}>
                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                {/* ── Image compression toggle ── */}
                <div className="compress-row mb-4">
                    <span className="compress-label">
                        <Zap size={15} />
                        圖片壓縮
                    </span>
                    <div className="compress-chips">
                        {QUALITY_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                className={`compress-chip ${quality === opt.value ? 'active' : ''}`}
                                onClick={() => setQuality(opt.value)}
                                title={opt.detail}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <span className="compress-hint">{QUALITY_OPTIONS.find(o => o.value === quality)?.detail}</span>
                </div>

                <hr className="divider" />

                {/* Front */}
                <h3 className="section-title">正面 (問題)</h3>
                <textarea className="form-input mb-3" placeholder="輸入文字..." rows={3} value={frontText} onChange={e => setFrontText(e.target.value)} />
                <textarea className="form-input mb-3 font-mono" placeholder="直接輸入 LaTeX，例：E = mc^2（不用加 $）" rows={2} value={frontMath} onChange={e => setFrontMath(e.target.value)} />
                {frontMath && <div className="math-preview mb-3"><Latex>{wrapLatex(frontMath)}</Latex></div>}
                {renderImageArea('front')}

                <hr className="divider" />

                {/* Back */}
                <h3 className="section-title">背面 (答案)</h3>
                <textarea className="form-input mb-3" placeholder="輸入文字..." rows={3} value={backText} onChange={e => setBackText(e.target.value)} />
                <textarea className="form-input mb-3 font-mono" placeholder="直接輸入 LaTeX（不用加 $）" rows={2} value={backMath} onChange={e => setBackMath(e.target.value)} />
                {backMath && <div className="math-preview mb-3"><Latex>{wrapLatex(backMath)}</Latex></div>}
                {renderImageArea('back')}

                <hr className="divider" />

                {/* Notes / Keywords */}
                <h3 className="section-title">🔖 備註 / 關鍵字</h3>
                <textarea
                    className="form-input mb-3"
                    placeholder="搜尋用關鍵字，例：第三章、Fourier Transform、拉普拉斯（可留空）"
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                />

                <button className="btn-primary w-100 mt-4" onClick={handleSave} style={{ padding: '1rem', fontSize: '1.1rem' }}>
                    儲存至倉庫
                </button>
            </div>

            {toast && (
                <div className="toast fade-in">
                    <Check size={20} /> {toast}
                </div>
            )}
        </div>
    );
}
