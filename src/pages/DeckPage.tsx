import { useState, useEffect } from 'react';
import { getTags, getCardsByTag, updateCard, deleteCard, exportAllData, importAllData, BackupData } from '../db/store';
import { Tag, Card } from '../db/schema';
import { Search, ChevronDown, ChevronUp, PackageOpen, Image as ImageIcon, Download, Upload, BookOpen, ArrowUpDown } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import { useRef } from 'react';
import { wrapLatex } from '../utils/math';
import ConfirmDialog from '../components/ConfirmDialog';



// ── Level filter ───────────────────────────────────────────────────────────────
type LevelFilter = 'all' | 'warehouse' | 'active' | 'graduated';
const LEVEL_FILTERS: { value: LevelFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'warehouse', label: '倉庫' },
    { value: 'active', label: '複習中' },
    { value: 'graduated', label: '畢業' },
];

function matchesLevel(card: Card, filter: LevelFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'warehouse') return card.level === 0;
    if (filter === 'graduated') return card.level === 8;
    return card.level >= 1 && card.level <= 7;
}

// ── Sort ───────────────────────────────────────────────────────────────────────
type SortMode = 'newest' | 'oldest' | 'level';
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'newest', label: '最新' },
    { value: 'oldest', label: '最舊' },
    { value: 'level', label: '等級' },
];
function sortCards(cards: Card[], mode: SortMode): Card[] {
    return [...cards].sort((a, b) => {
        if (mode === 'newest') return b.createdAt - a.createdAt;
        if (mode === 'oldest') return a.createdAt - b.createdAt;
        return a.level - b.level;
    });
}

export default function DeckPage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [expandedTag, setExpandedTag] = useState<string | null>(null);
    const [cards, setCards] = useState<Card[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
    const [sortMode, setSortMode] = useState<SortMode>('newest');

    // Edit State
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [editFrontText, setEditFrontText] = useState('');
    const [editBackText, setEditBackText] = useState('');
    const [editFrontMath, setEditFrontMath] = useState('');
    const [editBackMath, setEditBackMath] = useState('');
    const [editFrontImage, setEditFrontImage] = useState('');
    const [editBackImage, setEditBackImage] = useState('');
    const [editNotes, setEditNotes] = useState('');

    // Custom confirm dialog
    const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

    // Backup status
    const [backupStatus, setBackupStatus] = useState<string | null>(null);
    const importRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadTags(); }, []);
    async function loadTags() {
        const ts = await getTags();
        setTags(ts);
    }

    const showConfirm = (message: string): Promise<boolean> =>
        new Promise(resolve => {
            setConfirmDialog({ message, onConfirm: () => { setConfirmDialog(null); resolve(true); } });
        });

    const handleExpand = async (tagId: string) => {
        if (expandedTag === tagId) {
            setExpandedTag(null); setCards([]);
        } else {
            setExpandedTag(tagId);
            const tagCards = await getCardsByTag(tagId);
            setCards(tagCards);
        }
        setSearchQuery('');
        setLevelFilter('all');
    };

    const handleMoveToLv1 = async (card: Card) => {
        const updated = { ...card, level: 1 as Card['level'], nextReviewDate: Date.now() };
        await updateCard(updated);
        setCards(prev => prev.map(c => c.id === card.id ? updated : c));
    };

    const handleStartEdit = (card: Card) => {
        setEditingCardId(card.id);
        setEditFrontText(card.frontText || '');
        setEditBackText(card.backText || '');
        setEditFrontMath(card.frontMath || '');
        setEditBackMath(card.backMath || '');
        setEditFrontImage(card.frontImage || '');
        setEditBackImage(card.backImage || '');
        setEditNotes(card.notes || '');
    };

    const handleSaveEdit = async (card: Card) => {
        const updated = {
            ...card,
            frontText: editFrontText, backText: editBackText,
            frontMath: editFrontMath, backMath: editBackMath,
            frontImage: editFrontImage, backImage: editBackImage,
            notes: editNotes.trim() || undefined,
        };
        await updateCard(updated);
        setCards(prev => prev.map(c => c.id === card.id ? updated : c));
        setEditingCardId(null);
    };

    const handleDeleteCard = async (card: Card) => {
        const confirmed = await showConfirm('確定要刪除這張卡片嗎？\n此操作無法復原。');
        if (confirmed) {
            await deleteCard(card.id);
            setCards(prev => prev.filter(c => c.id !== card.id));
            setEditingCardId(null);
        }
    };

    const handleImageChange = (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            if (side === 'front') setEditFrontImage(reader.result as string);
            else setEditBackImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // ── Backup / Restore ────────────────────────────────────────────────────────
    const handleExport = async () => {
        try {
            const data = await exportAllData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const date = new Date(data.exportedAt).toISOString().slice(0, 10);
            const a = document.createElement('a');
            a.href = url; a.download = `flashcards-backup-${date}.json`; a.click();
            URL.revokeObjectURL(url);
            setBackupStatus(`✅ 已匯出 ${data.cards.length} 張卡片`);
            setTimeout(() => setBackupStatus(null), 3000);
        } catch { setBackupStatus('❌ 匯出失敗'); setTimeout(() => setBackupStatus(null), 3000); }
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const data: BackupData = JSON.parse(reader.result as string);
                if (data.version !== 1 || !Array.isArray(data.tags) || !Array.isArray(data.cards)) throw new Error('格式錯誤');
                const confirmed = await showConfirm(`確定要還原備份嗎？\n這將覆蓋目前所有資料。`);
                if (confirmed) {
                    await importAllData(data);
                    await loadTags(); setExpandedTag(null); setCards([]);
                    setBackupStatus(`✅ 已匯入 ${data.cards.length} 張卡片`);
                    setTimeout(() => setBackupStatus(null), 3000);
                }
            } catch { setBackupStatus('❌ 匯入失敗'); setTimeout(() => setBackupStatus(null), 3000); }
            if (importRef.current) importRef.current.value = '';
        };
        reader.readAsText(file);
    };

    // ── Filtering & Sorting ─────────────────────────────────────────────────────
    const filteredCards = sortCards(cards.filter(c => {
        if (!matchesLevel(c, levelFilter)) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            c.frontText?.toLowerCase().includes(q) ||
            c.backText?.toLowerCase().includes(q) ||
            c.frontMath?.toLowerCase().includes(q) ||
            c.backMath?.toLowerCase().includes(q) ||
            (c.notes && c.notes.toLowerCase().includes(q))
        );
    }), sortMode);

    return (
        <div className="deck-page fade-in">
            {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
            {backupStatus && <div className="toast">{backupStatus}</div>}

            <div className="section-header">
                <h2 className="text-gradient">牌組管理</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleExport} className="backup-btn" title="匯出備份"><Download size={15} /> 匯出</button>
                    <button onClick={() => importRef.current?.click()} className="backup-btn" title="匯入備份"><Upload size={15} /> 匯入</button>
                    <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
                </div>
            </div>

            <div className="accordion-list">
                {tags.map(tag => {
                    const isExpanded = tag.id === expandedTag;
                    return (
                        <div key={tag.id} className="accordion-item glass-card mb-3">
                            <div className="accordion-header" onClick={() => handleExpand(tag.id)} style={{ cursor: 'pointer', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>{tag.name}</h3>
                                {isExpanded ? <ChevronUp /> : <ChevronDown />}
                            </div>

                            {isExpanded && (
                                <div className="accordion-content" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1rem' }}>

                                    {/* Search — shown for ALL tags */}
                                    <div className="search-bar mb-3" style={{ position: 'relative' }}>
                                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="搜尋文字、LaTeX 原文、備註關鍵字…"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '12px', background: 'rgba(0,0,0,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                        />
                                    </div>

                                    {/* Level filter & Sort */}
                                    <div className="level-filter-row mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {LEVEL_FILTERS.map(f => (
                                                <button
                                                    key={f.value}
                                                    className={`level-chip ${levelFilter === f.value ? 'active' : ''}`}
                                                    onClick={() => setLevelFilter(f.value)}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                            <span className="level-chip-count">{filteredCards.length} 張</span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ArrowUpDown size={14} color="var(--text-muted)" />
                                            <select
                                                className="form-input"
                                                style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
                                                value={sortMode}
                                                onChange={e => setSortMode(e.target.value as SortMode)}
                                            >
                                                {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {filteredCards.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>沒有符合的卡片</p>
                                    ) : (
                                        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                            {filteredCards.map(card => (
                                                <div key={card.id} className="deck-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '8px', flexWrap: 'wrap' }}>
                                                        <span className={`badge ${card.level === 0 ? 'badge-gray' : card.level === 8 ? 'badge-green' : 'badge-blue'}`}>
                                                            {card.level === 0 ? '倉庫' : card.level === 8 ? '畢業' : `Lv.${card.level}`}
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                            {card.level === 0 && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleMoveToLv1(card); }}
                                                                    style={{ background: 'transparent', border: '1px solid var(--primary-light)', color: 'var(--primary-light)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <PackageOpen size={14} /> 加入 Lv1
                                                                </button>
                                                            )}
                                                            {editingCardId === card.id ? (
                                                                <button onClick={(e) => { e.stopPropagation(); handleSaveEdit(card); }} style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>儲存</button>
                                                            ) : (
                                                                <button onClick={(e) => { e.stopPropagation(); handleStartEdit(card); }} style={{ background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>編輯</button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {editingCardId === card.id ? (
                                                        <div className="card-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '8px' }}>
                                                                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>正面內容</label>
                                                                <textarea value={editFrontText} onChange={e => setEditFrontText(e.target.value)} className="form-input mb-3" rows={2} placeholder="正面文字" />
                                                                <textarea value={editFrontMath} onChange={e => setEditFrontMath(e.target.value)} className="form-input mb-3 font-mono" rows={1} placeholder="直接輸入 LaTeX（不用加 $）" />
                                                                {editFrontImage ? (
                                                                    <div className="preview-wrap mb-3"><img src={editFrontImage} alt="前端圖片預覽" /><button className="remove-img" onClick={() => setEditFrontImage('')}>✕</button></div>
                                                                ) : (
                                                                    <input type="file" accept="image/*, .svg" onChange={(e) => handleImageChange('front', e)} className="form-input mb-3" />
                                                                )}
                                                            </div>
                                                            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '8px' }}>
                                                                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>背面內容</label>
                                                                <textarea value={editBackText} onChange={e => setEditBackText(e.target.value)} className="form-input mb-3" rows={2} placeholder="背面文字" />
                                                                <textarea value={editBackMath} onChange={e => setEditBackMath(e.target.value)} className="form-input mb-3 font-mono" rows={1} placeholder="直接輸入 LaTeX（不用加 $）" />
                                                                {editBackImage ? (
                                                                    <div className="preview-wrap mb-3"><img src={editBackImage} alt="後端圖片預覽" /><button className="remove-img" onClick={() => setEditBackImage('')}>✕</button></div>
                                                                ) : (
                                                                    <input type="file" accept="image/*, .svg" onChange={(e) => handleImageChange('back', e)} className="form-input mb-3" />
                                                                )}
                                                            </div>
                                                            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '8px' }}>
                                                                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>🔖 備註 / 關鍵字</label>
                                                                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="form-input" rows={2} placeholder="搜尋用關鍵字，例：第三章、Fourier" />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                                <button onClick={() => setEditingCardId(null)} style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--text-muted)', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>取消編輯</button>
                                                                <button onClick={() => handleDeleteCard(card)} style={{ flex: 1, background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>刪除此卡片</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="card-preview" style={{ minWidth: 0 }}>
                                                            <p style={{ fontWeight: '500', marginBottom: '4px', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '6px' }}>Q:</span>
                                                                {card.frontText && <Latex>{card.frontText}</Latex>}
                                                                {card.frontMath && <span className="katex-inline" style={{ marginLeft: '4px' }}><Latex>{wrapLatex(card.frontMath)}</Latex></span>}
                                                                {card.frontImage && <ImageIcon size={16} style={{ marginLeft: '4px', color: 'var(--text-muted)', verticalAlign: 'middle' }} />}
                                                            </p>
                                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                                                                <span style={{ fontSize: '0.8rem', marginRight: '6px' }}>A:</span>
                                                                {card.backText && <Latex>{card.backText}</Latex>}
                                                                {card.backMath && <span className="katex-inline" style={{ marginLeft: '4px' }}><Latex>{wrapLatex(card.backMath)}</Latex></span>}
                                                                {card.backImage && <ImageIcon size={16} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />}
                                                            </p>
                                                            {card.notes && (
                                                                <p style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <BookOpen size={12} /> {card.notes}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
