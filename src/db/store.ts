import localforage from 'localforage';
import { Card, Tag, UserStats, DEFAULT_TAGS } from './schema';

// Dedicated instances
const tagsStore = localforage.createInstance({ name: 'Flashcards', storeName: 'tags' });
const cardsStore = localforage.createInstance({ name: 'Flashcards', storeName: 'cards' });
const statsStore = localforage.createInstance({ name: 'Flashcards', storeName: 'stats' });

// Tags
export async function getTags(): Promise<Tag[]> {
    const keys = await tagsStore.keys();
    if (keys.length === 0) {
        // Initialize default tags
        const newTags: Tag[] = DEFAULT_TAGS.map(t => ({
            id: crypto.randomUUID(),
            name: t.name,
            createdAt: Date.now()
        }));
        for (const tag of newTags) {
            await tagsStore.setItem(tag.id, tag);
        }
        return newTags;
    }

    const tags: Tag[] = [];
    for (const key of keys) {
        const item = await tagsStore.getItem<Tag>(key);
        if (item) tags.push(item);
    }
    return tags.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addTag(name: string): Promise<Tag> {
    const newTag: Tag = { id: crypto.randomUUID(), name, createdAt: Date.now() };
    await tagsStore.setItem(newTag.id, newTag);
    return newTag;
}

export async function updateTag(id: string, name: string): Promise<void> {
    const tag = await tagsStore.getItem<Tag>(id);
    if (tag) {
        tag.name = name;
        await tagsStore.setItem(id, tag);
    }
}

export async function deleteTag(id: string): Promise<void> {
    await tagsStore.removeItem(id);
    // Also delete associated cards
    const cards = await getCardsByTag(id);
    for (const c of cards) {
        await cardsStore.removeItem(c.id);
    }
}

// Cards
export async function getCards(): Promise<Card[]> {
    const keys = await cardsStore.keys();
    const cards: Card[] = [];
    for (const key of keys) {
        const item = await cardsStore.getItem<Card>(key);
        if (item) cards.push(item);
    }
    return cards;
}

export async function getCardsByTag(tagId: string): Promise<Card[]> {
    const allCards = await getCards();
    return allCards.filter(c => c.tagId === tagId);
}

export async function addCard(card: Omit<Card, 'id' | 'createdAt'>): Promise<Card> {
    const newCard: Card = {
        ...card,
        id: crypto.randomUUID(),
        createdAt: Date.now()
    };
    await cardsStore.setItem(newCard.id, newCard);
    return newCard;
}

export async function updateCard(card: Card): Promise<Card> {
    await cardsStore.setItem(card.id, card);
    return card;
}

export async function deleteCard(id: string): Promise<void> {
    await cardsStore.removeItem(id);
}

// Stats
export async function getUserStats(): Promise<UserStats> {
    const stats = await statsStore.getItem<UserStats>('user');
    if (!stats) {
        const defaultStats: UserStats = { streak: 0, lastReviewDate: '', totalGraduated: 0 };
        await statsStore.setItem('user', defaultStats);
        return defaultStats;
    }
    return stats;
}

export async function updateUserStats(stats: UserStats): Promise<void> {
    await statsStore.setItem('user', stats);
}
