import { useState, useEffect } from 'react';
import { getTags, getCards, updateCard, updateUserStats, getUserStats } from '../db/store';
import { Tag, Card, UserStats } from '../db/schema';
import { Layers, Plus, PartyPopper, Check } from 'lucide-react';
import FlashcardReview from '../components/FlashcardReview';

export default function TaskPage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [allCards, setAllCards] = useState<Card[]>([]);
    const [dueCardsByTag, setDueCardsByTag] = useState<Record<string, Card[]>>({});
    const [reviewingTag, setReviewingTag] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addCount, setAddCount] = useState(5);
    const [addTagId, setAddTagId] = useState<string>('');
    const [toast, setToast] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const ts = await getTags();
        const cs = await getCards();

        setTags(ts);
        setAllCards(cs);

        // Calculate due cards (Level 1, or Level > 1 where nextReviewDate <= now)
        const dueByTag: Record<string, Card[]> = {};
        const now = Date.now();
        cs.forEach(card => {
            if (card.level === 1 || (card.level > 1 && card.level < 8 && card.nextReviewDate <= now)) {
                if (!dueByTag[card.tagId]) dueByTag[card.tagId] = [];
                dueByTag[card.tagId].push(card);
            }
        });

        setDueCardsByTag(dueByTag);
    }

    const handleDrawNewCards = async () => {
        if (!addTagId) return;

        // Find warehouse cards for this tag
        const warehouseCards = allCards.filter(c => c.tagId === addTagId && c.level === 0);
        if (warehouseCards.length === 0) {
            setShowAddModal(false);
            setToast('這個標籤的倉庫已經沒有卡片了！');
            setTimeout(() => setToast(''), 3000);
            return;
        }

        // Shuffle and pick N
        const shuffled = [...warehouseCards].sort(() => 0.5 - Math.random());
        const toDraw = shuffled.slice(0, addCount);

        // Update levels
        for (const card of toDraw) {
            card.level = 1;
            card.nextReviewDate = Date.now(); // Due today
            await updateCard(card);
        }

        setShowAddModal(false);
        loadData();
    };

    const handleSessionComplete = async (reviewedCards: Card[], userStatsUpdates: Partial<UserStats>) => {
        // Process reviews
        for (const card of reviewedCards) {
            await updateCard(card);
        }

        // Count total unique study days: +1 only if today hasn't been counted yet
        if (userStatsUpdates.streak !== undefined) {
            const stats = await getUserStats();
            const todayString = new Date().toISOString().split('T')[0];
            if (stats.lastReviewDate !== todayString) {
                // New study day — increment total
                stats.streak += 1;
                stats.lastReviewDate = todayString;
            }
            // (No reset: we just count cumulative days, not consecutive)
            if (userStatsUpdates.totalGraduated) {
                stats.totalGraduated += userStatsUpdates.totalGraduated;
            }
            await updateUserStats(stats);
        }

        setReviewingTag(null);
        loadData();
    };

    if (reviewingTag) {
        const queue = dueCardsByTag[reviewingTag] || [];
        const tagObj = tags.find(t => t.id === reviewingTag);
        return (
            <FlashcardReview
                queue={queue}
                tag={tagObj!}
                onComplete={handleSessionComplete}
                onExit={() => { setReviewingTag(null); loadData(); }}
            />
        );
    }

    const tagsWithDue = Object.keys(dueCardsByTag);

    return (
        <div className="task-page fade-in">
            <div className="section-header">
                <h2 className="text-gradient"><Layers size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> 任務</h2>
                <button className="btn-icon" onClick={() => setShowAddModal(true)}>
                    <Plus size={24} />
                </button>
            </div>

            {tagsWithDue.length === 0 ? (
                <div className="empty-state glass-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <PartyPopper size={48} color="var(--success)" style={{ marginBottom: '1rem' }} />
                    <h3>今日任務完成！</h3>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>太棒了，所有標籤都已經複習完畢。點擊右上角的「+」號從倉庫抽取新卡片來學習吧。</p>
                </div>
            ) : (
                <div className="tags-list">
                    {tagsWithDue.map(tagId => {
                        const tag = tags.find(t => t.id === tagId);
                        if (!tag) return null;
                        const count = dueCardsByTag[tagId].length;
                        return (
                            <div key={tagId} className="glass-card tag-card transform-hover" onClick={() => setReviewingTag(tagId)} style={{ cursor: 'pointer' }}>
                                <div className="tag-header">
                                    <h3>{tag.name}</h3>
                                </div>
                                <div className="tag-stats">
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                                        待複習: {count} 張
                                    </span>
                                </div>
                                <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                    開始複習
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay fade-in">
                    <div className="glass-card modal-content" style={{ padding: '2rem' }}>
                        <h3>從倉庫抽取新卡片</h3>
                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label>選擇標籤</label>
                                <select
                                    className="form-input mt-2"
                                    value={addTagId}
                                    onChange={e => setAddTagId(e.target.value)}
                                >
                                    <option value="">-- 請選擇 --</option>
                                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label>抽取數量</label>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                    {[1, 5, 10, 20].map(n => (
                                        <button
                                            key={n}
                                            className={`btn-chip ${addCount === n ? 'active' : ''}`}
                                            onClick={() => setAddCount(n)}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>取消</button>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={handleDrawNewCards}>確認抽取</button>
                        </div>
                    </div>
                </div>
            )}
            {toast && (
                <div className="toast fade-in"><Check size={20} /> {toast}</div>
            )}
        </div>
    );
}
