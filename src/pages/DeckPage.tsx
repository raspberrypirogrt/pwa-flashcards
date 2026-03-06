import { useState, useEffect } from 'react';
import { getTags, getCardsByTag, updateCard, deleteCard } from '../db/store';
import { Tag, Card } from '../db/schema';
import { Search, ChevronDown, ChevronUp, PackageOpen, Image as ImageIcon } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

export default function DeckPage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [expandedTag, setExpandedTag] = useState<string | null>(null);
    const [cards, setCards] = useState<Card[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Edit State
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [editFrontText, setEditFrontText] = useState('');
    const [editBackText, setEditBackText] = useState('');
    const [editFrontMath, setEditFrontMath] = useState('');
    const [editBackMath, setEditBackMath] = useState('');
    const [editFrontImage, setEditFrontImage] = useState('');
    const [editBackImage, setEditBackImage] = useState('');

    useEffect(() => {
        loadTags();
    }, []);

    async function loadTags() {
        const ts = await getTags();
        setTags(ts);
    }

    const handleExpand = async (tagId: string) => {
        if (expandedTag === tagId) {
            setExpandedTag(null);
            setCards([]);
        } else {
            setExpandedTag(tagId);
            const tagCards = await getCardsByTag(tagId);
            setCards(tagCards);
        }
    };

    const handleMoveToLv1 = async (card: Card) => {
        const updated = { ...card, level: 1 as Card['level'], nextReviewDate: Date.now() };
        await updateCard(updated);
        // update local state
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
    };

    const handleSaveEdit = async (card: Card) => {
        const updated = {
            ...card,
            frontText: editFrontText,
            backText: editBackText,
            frontMath: editFrontMath,
            backMath: editBackMath,
            frontImage: editFrontImage,
            backImage: editBackImage
        };
        await updateCard(updated);
        setCards(prev => prev.map(c => c.id === card.id ? updated : c));
        setEditingCardId(null);
    };

    const handleDeleteCard = async (card: Card) => {
        if (window.confirm('確定要刪除這張卡片嗎？此操作無法復原。')) {
            await deleteCard(card.id);
            setCards(prev => prev.filter(c => c.id !== card.id));
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

    const filteredCards = cards.filter(c => {
        if (!searchQuery) return true;
        const term = searchQuery.toLowerCase();
        return (c.frontText?.toLowerCase().includes(term) || c.backText?.toLowerCase().includes(term));
    });

    return (
        <div className="deck-page fade-in">
            <div className="section-header">
                <h2 className="text-gradient">牌組管理</h2>
            </div>

            <div className="accordion-list">
                {tags.map(tag => {
                    const isExpanded = tag.id === expandedTag;

                    return (
                        <div key={tag.id} className="accordion-item glass-card mb-3">
                            <div
                                className="accordion-header flex justify-between align-center p-3"
                                onClick={() => handleExpand(tag.id)}
                                style={{ cursor: 'pointer', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <h3 style={{ margin: 0 }}>{tag.name}</h3>
                                {isExpanded ? <ChevronUp /> : <ChevronDown />}
                            </div>

                            {isExpanded && (
                                <div className="accordion-content" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1rem' }}>
                                    {tag.name.includes('英文') && (
                                        <div className="search-bar mb-4" style={{ position: 'relative', marginBottom: '1rem' }}>
                                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input
                                                type="text"
                                                placeholder="搜尋單字..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                            />
                                        </div>
                                    )}

                                    {filteredCards.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>目前沒有卡片</p>
                                    ) : (
                                        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                            {filteredCards.map(card => (
                                                <div key={card.id} className="deck-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                        <span className={`badge ${card.level === 0 ? 'badge-gray' : card.level === 8 ? 'badge-green' : 'badge-blue'}`}>
                                                            {card.level === 0 ? '倉庫' : card.level === 8 ? '畢業' : `Lv.${card.level}`}
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            {card.level === 0 && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleMoveToLv1(card); }}
                                                                    style={{ background: 'transparent', border: '1px solid var(--primary-light)', color: 'var(--primary-light)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    <PackageOpen size={14} /> 加入 Lv1
                                                                </button>
                                                            )}
                                                            {editingCardId === card.id ? (
                                                                <button onClick={(e) => { e.stopPropagation(); handleSaveEdit(card); }} style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                                                                    儲存
                                                                </button>
                                                            ) : (
                                                                <button onClick={(e) => { e.stopPropagation(); handleStartEdit(card); }} style={{ background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                                                                    編輯
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {editingCardId === card.id ? (
                                                        <div className="card-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                                                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>正面內容</label>
                                                                <textarea value={editFrontText} onChange={e => setEditFrontText(e.target.value)} className="form-input mb-3" rows={2} placeholder="正面文字" />
                                                                <textarea value={editFrontMath} onChange={e => setEditFrontMath(e.target.value)} className="form-input mb-3 font-mono" rows={1} placeholder="LaTeX 數學公式 (例：E=mc^2)" />
                                                                {editFrontImage ? (
                                                                    <div className="preview-wrap mb-3"><img src={editFrontImage} alt="前端圖片預覽" /><button className="remove-img" onClick={() => setEditFrontImage('')}>✕</button></div>
                                                                ) : (
                                                                    <input type="file" accept="image/*, .svg" onChange={(e) => handleImageChange('front', e)} className="form-input mb-3" />
                                                                )}
                                                            </div>
                                                            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                                                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>背面內容</label>
                                                                <textarea value={editBackText} onChange={e => setEditBackText(e.target.value)} className="form-input mb-3" rows={2} placeholder="背面文字" />
                                                                <textarea value={editBackMath} onChange={e => setEditBackMath(e.target.value)} className="form-input mb-3 font-mono" rows={1} placeholder="LaTeX 數學公式 (例：\frac{a}{b})" />
                                                                {editBackImage ? (
                                                                    <div className="preview-wrap mb-3"><img src={editBackImage} alt="後端圖片預覽" /><button className="remove-img" onClick={() => setEditBackImage('')}>✕</button></div>
                                                                ) : (
                                                                    <input type="file" accept="image/*, .svg" onChange={(e) => handleImageChange('back', e)} className="form-input mb-3" />
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                                <button onClick={() => setEditingCardId(null)} style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--text-muted)', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                                                                    取消編輯
                                                                </button>
                                                                <button onClick={() => handleDeleteCard(card)} style={{ flex: 1, background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                                                                    刪除此卡片
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="card-preview">
                                                            <p style={{ fontWeight: '500', marginBottom: '4px' }}>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '6px' }}>Q:</span>
                                                                {card.frontText && card.frontText}
                                                                {card.frontMath && <span style={{ marginLeft: '4px' }}><Latex>{card.frontMath}</Latex></span>}
                                                                {card.frontImage && <ImageIcon size={16} style={{ marginLeft: '4px', color: 'var(--text-muted)', verticalAlign: 'middle' }} />}
                                                            </p>
                                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                                <span style={{ fontSize: '0.8rem', marginRight: '6px' }}>A:</span>
                                                                {card.backText && card.backText}
                                                                {card.backMath && <span style={{ marginLeft: '4px' }}><Latex>{card.backMath}</Latex></span>}
                                                                {card.backImage && <ImageIcon size={16} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />}
                                                            </p>
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
