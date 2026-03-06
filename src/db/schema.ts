export interface Tag {
    id: string;
    name: string;
    createdAt: number;
}

export type CardLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
// 0: Warehouse, 1-7: SRS levels, 8: Graduated

export interface Card {
    id: string;
    tagId: string;
    level: CardLevel;

    // Content (Front)
    frontText?: string;
    frontImage?: string; // base64
    frontMath?: string; // LaTeX
    frontAudio?: string; // base64

    // Content (Back)
    backText?: string;
    backImage?: string;
    backMath?: string;
    backAudio?: string;

    createdAt: number;
    nextReviewDate: number; // timestamp
}

export interface DailyStats {
    date: string; // YYYY-MM-DD
    cardsReviewed: number;
    correctCount: number;
    incorrectCount: number;
}

export interface UserStats {
    streak: number;
    lastReviewDate: string; // YYYY-MM-DD
    totalGraduated: number;
}

// Initial tags based on user requirement
export const DEFAULT_TAGS: Omit<Tag, 'id' | 'createdAt'>[] = [
    { name: '通用英文' },
    { name: '專業英文' },
];

export const LEVEL_INTERVALS_DAYS: Record<CardLevel, number> = {
    0: -1, // Warehouse
    1: 0,  // Today
    2: 1,  // 1 day
    3: 3,  // 3 days
    4: 7,  // 7 days
    5: 15, // 15 days
    6: 31, // 31 days
    7: 63, // 63 days
    8: -1, // Graduated
};
