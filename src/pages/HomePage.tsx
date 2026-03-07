import { useState, useEffect } from 'react';
import { getTags, getCards, addTag, deleteTag, updateTag, getUserStats } from '../db/store';
import { Tag, Card, UserStats } from '../db/schema';
import { BookOpen, CheckCircle, Tag as TagIcon, Plus, Edit2, Trash2, X } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

export default function HomePage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [stats, setStats] = useState<UserStats>({ streak: 0, lastReviewDate: '', totalGraduated: 0 });
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Tag | null>(null);

    useEffect(() => {
        let active = true;
        loadData().then(data => {
            if (active && data) {
                setTags(data.tags);
                setCards(data.cards);
                setStats(data.stats);
            }
        });
        return () => { active = false; };
    }, []);

    async function loadData() {
        const loadedTags = await getTags();
        const loadedCards = await getCards();
        const loadedStats = await getUserStats();
        return { tags: loadedTags, cards: loadedCards, stats: loadedStats };
    }

    const handleAddTag = async () => {
        const name = newTagName.trim();
        if (name) {
            if (tags.some(t => t.name === name)) {
                alert('這個標籤名稱已經存在了！');
                return;
            }
            await addTag(name);
            setNewTagName('');
            setIsAddingTag(false);
            const data = await loadData();
            setTags(data.tags);
        }
    };

    const handleUpdateTag = async () => {
        const name = newTagName.trim();
        if (editingTag && name) {
            if (tags.some(t => t.name === name && t.id !== editingTag.id)) {
                alert('這個標籤名稱已經存在了！');
                return;
            }
            await updateTag(editingTag.id, name);
            setEditingTag(null);
            setNewTagName('');
            const data = await loadData();
            setTags(data.tags);
        }
    };

    const handleDeleteTag = async (tag: Tag) => {
        setConfirmDelete(tag);
    };

    const confirmDeleteTag = async () => {
        if (!confirmDelete) return;
        await deleteTag(confirmDelete.id);
        setConfirmDelete(null);
        const data = await loadData();
        setTags(data.tags);
        setCards(data.cards);
    };

    // Stats computation
    const cardsDueToday = cards.filter(
        c => c.level === 1 || (c.level > 1 && c.level < 8 && c.nextReviewDate <= Date.now())
    ).length;

    return (
        <div className="home-page fade-in">
            {confirmDelete && (
                <ConfirmDialog
                    message={`確定要刪除「${confirmDelete.name}」及其所有關聯的卡片嗎？\n此操作無法還原。`}
                    confirmLabel="確定刪除"
                    onConfirm={confirmDeleteTag}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}

            <header className="header">
                <h1 className="text-gradient">記憶卡片</h1>
            </header>

            <section className="stats-section glass-card">
                <div className="stat-box">
                    <BookOpen size={32} color="var(--secondary)" />
                    <div>
                        <h3>已學習</h3>
                        <p className="stat-number">{stats.streak} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>天</span></p>
                    </div>
                </div>
                <div className="stat-box">
                    <CheckCircle size={32} color="var(--success)" />
                    <div>
                        <h3>今日待複習</h3>
                        <p className="stat-number">{cardsDueToday} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>張</span></p>
                    </div>
                </div>
            </section>

            <section className="tags-section mb-4">
                <div className="section-header">
                    <h2>📊 統計</h2>
                </div>

                {/* Main 3 Categories */}
                <div className="glass-card mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center', padding: '1.5rem' }}>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>倉庫</div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.8rem', color: 'var(--text-main)' }}>{cards.filter(c => c.level === 0).length}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>學習中</div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.8rem', color: 'var(--primary-light)' }}>{cards.filter(c => c.level > 0 && c.level < 8).length}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--success)', marginBottom: '4px' }}>已畢業</div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.8rem', color: 'var(--success)' }}>{cards.filter(c => c.level === 8).length}</div>
                    </div>
                </div>

                {/* Breakdown Lv1 - Lv7 */}
                <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', padding: '1rem' }}>
                    {[1, 2, 3, 4, 5, 6, 7].map(lv => (
                        <div key={lv}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lv{lv}</div>
                            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{cards.filter(c => c.level === lv).length}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="tags-section">
                <div className="section-header">
                    <h2><TagIcon size={20} /> 標籤總覽</h2>
                    <button className="btn-icon" onClick={() => {
                        setIsAddingTag(!isAddingTag);
                        if (editingTag) setEditingTag(null);
                        setNewTagName('');
                    }}>
                        {isAddingTag ? <X size={24} /> : <Plus size={24} />}
                    </button>
                </div>

                {(isAddingTag || editingTag) && (
                    <div className="glass-card tag-form fade-in">
                        <input
                            type="text"
                            placeholder="輸入標籤名稱..."
                            autoFocus
                            value={newTagName}
                            onChange={e => setNewTagName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (editingTag ? handleUpdateTag() : handleAddTag())}
                        />
                        <button className="btn-primary" onClick={editingTag ? handleUpdateTag : handleAddTag}>
                            {editingTag ? '儲存變更' : '新增標籤'}
                        </button>
                    </div>
                )}

                <div className="tags-list">
                    {tags.map((tag, index) => {
                        const tagCards = cards.filter(c => c.tagId === tag.id);
                        const lv0 = tagCards.filter(c => c.level === 0).length;
                        const learning = tagCards.filter(c => c.level > 0 && c.level < 8).length;
                        const grad = tagCards.filter(c => c.level === 8).length;

                        const isProtected = ['通用英文', '專業英文'].includes(tag.name) &&
                            tags.findIndex(t => t.name === tag.name) === index;

                        return (
                            <div key={tag.id} className="glass-card tag-card transform-hover">
                                <div className="tag-header">
                                    <h3>{tag.name}</h3>
                                    <div className="tag-actions">
                                        <button className="btn-icon btn-sm" onClick={() => {
                                            setEditingTag(tag);
                                            setNewTagName(tag.name);
                                            setIsAddingTag(false);
                                        }}>
                                            <Edit2 size={16} />
                                        </button>
                                        {!isProtected && (
                                            <button className="btn-icon btn-sm danger" onClick={() => handleDeleteTag(tag)}>
                                                <Trash2 size={16} color="var(--danger)" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="tag-stats">
                                    <div className="tag-stat"><span className="dot dot-gray"></span> 倉庫: {lv0}</div>
                                    <div className="tag-stat"><span className="dot dot-blue"></span> 學習中: {learning}</div>
                                    <div className="tag-stat"><span className="dot dot-green"></span> 畢業: {grad}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
