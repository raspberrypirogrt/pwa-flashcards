import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { Card, Tag, LEVEL_INTERVALS_DAYS } from '../db/schema';
import { updateCard } from '../db/store';
import { X, Volume2, FlipHorizontal } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import { wrapLatex } from '../utils/math';

interface FlashcardReviewProps {
    queue: Card[];
    tag: Tag;
    onComplete: (reviewedCards: Card[], stats: any) => void;
    onExit: () => void;
}

export default function FlashcardReview({ queue, tag, onComplete, onExit }: FlashcardReviewProps) {
    // We need a local queue because wrong answers send cards back into the queue for today.
    const [localQueue, setLocalQueue] = useState<Card[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    const [sessionCards, setSessionCards] = useState<Map<string, Card>>(new Map()); // tracking modified cards
    const [graduatedThisSession, setGraduatedThisSession] = useState(0);

    useEffect(() => {
        // initialize queue, shuffle it
        setLocalQueue([...queue].sort(() => 0.5 - Math.random()));
        const initialSessionCards = new Map();
        queue.forEach(c => initialSessionCards.set(c.id, { ...c }));
        setSessionCards(initialSessionCards);
    }, [queue]);

    const x = useMotionValue(0);
    const controls = useAnimation();
    const rotateToFlip = useAnimation();

    // Opacity & Scale transformers mapping the drag position to colors indicating Yes/No

    // Glow effect mapped from drag position
    const boxShadow = useTransform(
        x,
        [-150, 0, 150],
        [
            '0px 0px 50px rgba(239, 68, 68, 0.6)', // Red glow left
            '0px 0px 0px rgba(0, 0, 0, 0)',        // No glow center
            '0px 0px 50px rgba(34, 197, 94, 0.6)'  // Green glow right
        ]
    );

    const removeCard = async (direction: 'left' | 'right') => {
        const currentCard = localQueue[currentIndex];
        const modifiedCard = sessionCards.get(currentCard.id)!;

        let appended = false;
        let newGraduated = graduatedThisSession;

        if (direction === 'left') {
            // Wrong — reset to Lv1 and re-queue for today
            modifiedCard.level = 1;
            modifiedCard.nextReviewDate = Date.now();
            // Push it to the back of the local queue so we see it again today
            setLocalQueue(prev => [...prev, currentCard]);
            appended = true;
        } else {
            // Right — advance level
            modifiedCard.level = (modifiedCard.level + 1) as Card['level'];

            const interval = LEVEL_INTERVALS_DAYS[modifiedCard.level];
            if (interval !== undefined && interval > 0) {
                modifiedCard.nextReviewDate = Date.now() + interval * 24 * 60 * 60 * 1000;
            }

            if (modifiedCard.level > 7) {
                modifiedCard.level = 8; // Graduated
                newGraduated += 1;
                setGraduatedThisSession(newGraduated);
            }
        }

        // ── Persist immediately so progress survives mid-session exits ──────
        await updateCard(modifiedCard);

        setIsFlipped(false);
        rotateToFlip.set({ rotateY: 0 });
        x.set(0);

        const nextIdx = currentIndex + 1;
        const targetLength = localQueue.length + (appended ? 1 : 0);

        if (nextIdx >= targetLength) {
            onComplete(Array.from(sessionCards.values()), { streak: 1, totalGraduated: newGraduated });
            return;
        }

        setCurrentIndex(nextIdx);
        // Instant reset for the new card rendering
        controls.set({ x: 0, opacity: 1 });
    };

    const handleDragEnd = async (_event: any, info: any) => {
        const swipeThreshold = 100;
        const velocityThreshold = 500; // Pixels per second

        const isSwipeRight = info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold;
        const isSwipeLeft = info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold;

        if (isSwipeRight) {
            // Swipe Right (Remember)
            await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } });
            removeCard('right');
        } else if (isSwipeLeft) {
            // Swipe Left (Forget)
            await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
            removeCard('left');
        } else {
            // Snap back
            controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
        }
    };

    const handleFlip = () => {
        const targetRotateY = isFlipped ? 0 : 180;
        rotateToFlip.start({ rotateY: targetRotateY, transition: { duration: 0.4 } });
        setIsFlipped(!isFlipped);
    };

    const playTTS = (text: string, lang = 'en-US') => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        window.speechSynthesis.speak(utterance);
    };

    if (localQueue.length === 0 || currentIndex >= localQueue.length) return null;

    const currentCard = localQueue[currentIndex];
    // Calculate true level
    const displayedLevel = sessionCards.get(currentCard.id)?.level ?? currentCard.level;

    return (
        <div className="review-session fade-in">
            <div className="review-header">
                <button className="btn-icon" onClick={onExit}><X size={24} /></button>
                <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>{tag.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {currentIndex + 1} / {localQueue.length}
                    </span>
                </div>
                <div style={{ width: 40 }}></div> {/* placeholder for balance */}
            </div>

            <div className="swipe-container" style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '10vh' }}>

                {/* Swipe hints removed manually per user request */}

                <motion.div
                    drag={isFlipped ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }} // Keep constraints to 0 to prevent sticking, but elastic makes it move
                    dragElastic={0.8} // High elasticity for smooth pulling across screen
                    dragSnapToOrigin={true} // Naturally wants to snap back if let go
                    onDragEnd={handleDragEnd}
                    style={{ x, perspective: 1000, touchAction: 'pan-y' }}
                    animate={controls}
                    className="flashcard-wrapper"
                >
                    <motion.div
                        className="flashcard glass-card"
                        animate={rotateToFlip}
                        style={{
                            boxShadow, // Applied dynamic glow
                            transformStyle: "preserve-3d",
                            width: '85vw',
                            maxWidth: '400px',
                            minHeight: '60vh',
                            position: 'relative',
                            borderRadius: '24px',
                            cursor: isFlipped ? 'grab' : 'pointer',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        onClick={handleFlip}
                    >
                        {/* Front Side */}
                        <div className="card-face card-front" style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span className="badge badge-tag">{tag.name}</span>
                                <span className="badge badge-level">Lv.{displayedLevel}</span>
                            </div>

                            <div className="card-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflowY: 'auto' }}>
                                {currentCard.frontImage && <img src={currentCard.frontImage} alt="front" style={{ maxHeight: '200px', borderRadius: '12px', marginBottom: '1rem' }} />}
                                {currentCard.frontText && <div style={{ fontSize: '1.5rem', fontWeight: '600', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><Latex>{currentCard.frontText}</Latex></div>}
                                {currentCard.frontMath && <div className="katex-wrap" style={{ fontSize: '1.25rem', marginTop: '1rem', width: '100%' }}><Latex>{wrapLatex(currentCard.frontMath)}</Latex></div>}

                                {/* Audio Button */}
                                {(currentCard.frontText && tag.name.includes('英文')) && (
                                    <button className="btn-icon" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)' }} onClick={(e) => { e.stopPropagation(); playTTS(currentCard.frontText!); }}>
                                        <Volume2 size={24} />
                                    </button>
                                )}
                            </div>

                            {!isFlipped && (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
                                    <FlipHorizontal size={20} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                    點擊翻轉
                                </div>
                            )}
                        </div>

                        {/* Back Side */}
                        <div className="card-face card-back" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span className="badge badge-tag">{tag.name}</span>
                                <span className="badge badge-level">Lv.{displayedLevel}</span>
                            </div>

                            <div className="card-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflowY: 'auto' }}>
                                {currentCard.backImage && <img src={currentCard.backImage} alt="back" style={{ maxHeight: '200px', borderRadius: '12px', marginBottom: '1rem' }} />}
                                {currentCard.backText && <div style={{ fontSize: '1.25rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><Latex>{currentCard.backText}</Latex></div>}
                                {currentCard.backMath && <div className="katex-wrap" style={{ fontSize: '1.25rem', marginTop: '1rem', width: '100%' }}><Latex>{wrapLatex(currentCard.backMath)}</Latex></div>}
                            </div>

                            {isFlipped && (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
                                    <FlipHorizontal size={20} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                    點擊翻回正面，或左右滑動判定
                                </div>
                            )}
                        </div>

                    </motion.div>
                </motion.div>

            </div>
        </div>
    );
}
