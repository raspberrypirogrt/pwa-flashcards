import { useState, useEffect, useRef } from 'react';
import { getTags, addCard } from '../db/store';
import { Tag } from '../db/schema';
import { PlusCircle, Image as ImageIcon, Check } from 'lucide-react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function AddCardPage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [tagId, setTagId] = useState('');

    const [frontText, setFrontText] = useState('');
    const [frontMath, setFrontMath] = useState('');
    const [frontImage, setFrontImage] = useState<string>('');

    const [backText, setBackText] = useState('');
    const [backMath, setBackMath] = useState('');
    const [backImage, setBackImage] = useState<string>('');

    const [toast, setToast] = useState('');

    const fileInputFront = useRef<HTMLInputElement>(null);
    const fileInputBack = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getTags().then(ts => {
            setTags(ts);
            if (ts.length > 0) setTagId(ts[0].id);
        });
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (side === 'front') setFrontImage(event.target?.result as string);
            else setBackImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!tagId) return;
        if (!frontText && !frontMath && !frontImage) {
            alert('請至少填寫正面的文字、公式或圖片');
            return;
        }

        try {
            await addCard({
                tagId,
                level: 0, // start in warehouse
                frontText: frontText.trim() || undefined,
                frontMath: frontMath.trim() || undefined,
                frontImage: frontImage || undefined,
                backText: backText.trim() || undefined,
                backMath: backMath.trim() || undefined,
                backImage: backImage || undefined,
                nextReviewDate: 0
            });

            // Show toast
            setToast('已新增至倉庫');
            setTimeout(() => setToast(''), 2000);

            // Reset form (keep tag)
            setFrontText('');
            setFrontMath('');
            setFrontImage('');
            setBackText('');
            setBackMath('');
            setBackImage('');
        } catch (e) {
            console.error(e);
            alert('儲存失敗');
        }
    };

    return (
        <div className="add-page fade-in">
            <div className="section-header">
                <h2 className="text-gradient"><PlusCircle size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> 新增卡片</h2>
            </div>

            <div className="glass-card scroll-form">
                <label className="form-label">選擇標籤</label>
                <select
                    className="form-input mb-4"
                    value={tagId}
                    onChange={e => setTagId(e.target.value)}
                >
                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                <hr className="divider" />

                {/* Front */}
                <h3 className="section-title">正面 (問題)</h3>
                <textarea
                    className="form-input mb-3"
                    placeholder="輸入文字..."
                    rows={3}
                    value={frontText}
                    onChange={e => setFrontText(e.target.value)}
                />
                <textarea
                    className="form-input mb-3 font-mono"
                    placeholder="輸入 LaTeX 公式 (例如: $E = mc^2$)..."
                    rows={2}
                    value={frontMath}
                    onChange={e => setFrontMath(e.target.value)}
                />
                {frontMath && (
                    <div className="math-preview mb-3">
                        <Latex>{frontMath}</Latex>
                    </div>
                )}

                <div className="image-upload-area mb-4">
                    <input type="file" accept="image/*, .svg" hidden ref={fileInputFront} onChange={e => handleImageUpload(e, 'front')} />
                    {frontImage ? (
                        <div className="preview-wrap">
                            <img src={frontImage} alt="Front preview" />
                            <button className="btn-icon danger remove-img" onClick={() => setFrontImage('')}>✕</button>
                        </div>
                    ) : (
                        <button className="btn-secondary flex-center" onClick={() => fileInputFront.current?.click()}>
                            <ImageIcon size={20} style={{ marginRight: '8px' }} /> 加入圖片
                        </button>
                    )}
                </div>

                <hr className="divider" />

                {/* Back */}
                <h3 className="section-title">背面 (答案)</h3>
                <textarea
                    className="form-input mb-3"
                    placeholder="輸入文字..."
                    rows={3}
                    value={backText}
                    onChange={e => setBackText(e.target.value)}
                />
                <textarea
                    className="form-input mb-3 font-mono"
                    placeholder="輸入 LaTeX 公式..."
                    rows={2}
                    value={backMath}
                    onChange={e => setBackMath(e.target.value)}
                />
                {backMath && (
                    <div className="math-preview mb-3">
                        <Latex>{backMath}</Latex>
                    </div>
                )}

                <div className="image-upload-area mb-4">
                    <input type="file" accept="image/*, .svg" hidden ref={fileInputBack} onChange={e => handleImageUpload(e, 'back')} />
                    {backImage ? (
                        <div className="preview-wrap">
                            <img src={backImage} alt="Back preview" />
                            <button className="btn-icon danger remove-img" onClick={() => setBackImage('')}>✕</button>
                        </div>
                    ) : (
                        <button className="btn-secondary flex-center" onClick={() => fileInputBack.current?.click()}>
                            <ImageIcon size={20} style={{ marginRight: '8px' }} /> 加入圖片
                        </button>
                    )}
                </div>

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
