import { useState, useRef } from 'react';
import { getTags, addCard } from '../db/store';
import { Tag } from '../db/schema';
import { X, Download, Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedCard {
    tag: string;
    frontText: string;
    frontMath: string;
    backText: string;
    backMath: string;
    notes: string;
    // resolved after matching tag names
    tagId?: string;
    warning?: string;
    error?: string;
}

interface BatchImportModalProps {
    tags: Tag[];
    onClose: () => void;
    onImported: (count: number) => void;
}

// ── CSV Template ───────────────────────────────────────────────────────────────

const CSV_HEADER = 'tag,frontText,frontMath,backText,backMath,notes';
const CSV_EXAMPLE = [
    CSV_HEADER,
    '工程數學,,\\int_0^\\infty e^{-x}\\,dx,= 1,,Ch1 積分',
    '工程數學,求導數基本公式,\\frac{d}{dx}[x^n],= nx^{n-1},,微積分',
    '專業英文,ephemeral,,短暫的,,vocabulary Ch3',
].join('\n');

function downloadTemplate() {
    const blob = new Blob([CSV_EXAMPLE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flashcards-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// ── CSV / JSON parser ─────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim()); current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function parseFile(text: string): ParsedCard[] {
    text = text.trim();
    // Try JSON array first
    if (text.startsWith('[')) {
        const arr = JSON.parse(text) as Partial<ParsedCard>[];
        return arr.map(o => ({
            tag: o.tag || '',
            frontText: o.frontText || '',
            frontMath: o.frontMath || '',
            backText: o.backText || '',
            backMath: o.backMath || '',
            notes: o.notes || '',
        }));
    }
    // CSV
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    const idx = (col: string) => header.indexOf(col);
    return lines.slice(1).map(line => {
        const cols = parseCSVLine(line);
        const get = (col: string) => (idx(col) >= 0 ? (cols[idx(col)] || '') : '');
        return {
            tag: get('tag'),
            frontText: get('fronttext'),
            frontMath: get('frontmath'),
            backText: get('backtext'),
            backMath: get('backmath'),
            notes: get('notes'),
        };
    }).filter(c => c.frontText || c.frontMath || c.backText || c.backMath);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function BatchImportModal({ tags, onClose, onImported }: BatchImportModalProps) {
    const [parsed, setParsed] = useState<ParsedCard[] | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [defaultTag, setDefaultTag] = useState(tags[0]?.id || '');
    const fileRef = useRef<HTMLInputElement>(null);

    // Resolve tag names → IDs
    const resolved: ParsedCard[] = (parsed || []).map(c => {
        const tagName = c.tag.trim();
        let matched: Tag | undefined;
        if (tagName) {
            matched = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase()) ||
                tags.find(t => t.name.toLowerCase().includes(tagName.toLowerCase()));
        }
        const isFallback = !!tagName && !matched;
        const tagId = matched?.id || defaultTag;
        const error = (!tagName && !defaultTag) ? '找不到標籤' : undefined;
        const warning = isFallback ? `未找到標籤「${tagName}」，將使用預設標籤` : undefined;
        return { ...c, tagId, warning, error };
    });

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const cards = parseFile(ev.target!.result as string);
                if (cards.length === 0) throw new Error('未找到任何卡片資料，請確認格式');
                setParsed(cards);
                setParseError(null);
            } catch (err: any) {
                setParseError(err.message || '解析失敗');
                setParsed(null);
            }
        };
        reader.readAsText(file, 'utf-8');
        e.target.value = '';
    };

    const handleImport = async () => {
        if (!resolved.length) return;
        setImporting(true);
        try {
            const allTags = await getTags(); // refresh
            let count = 0;
            for (const c of resolved) {
                if (c.error) continue;
                const resolvedTagId = c.tagId ||
                    allTags.find(t => t.name.toLowerCase() === c.tag.toLowerCase())?.id ||
                    defaultTag;
                if (!resolvedTagId) continue;
                await addCard({
                    tagId: resolvedTagId,
                    level: 0,
                    frontText: c.frontText || undefined,
                    frontMath: c.frontMath || undefined,
                    backText: c.backText || undefined,
                    backMath: c.backMath || undefined,
                    notes: c.notes || undefined,
                    nextReviewDate: 0,
                });
                count++;
            }
            onImported(count);
        } finally {
            setImporting(false);
        }
    };

    const validCount = resolved.filter(c => !c.error).length;
    const errorCount = resolved.filter(c => c.error).length;

    return (
        <div className="modal-overlay" style={{ zIndex: 400, alignItems: 'flex-start', padding: '1rem', overflowY: 'auto' }} onClick={onClose}>
            <div className="glass-card" onClick={e => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 520, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', marginBottom: '2rem' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>📥 批量匯入卡片</h3>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                {/* Format hint */}
                <div className="batch-hint">
                    <FileText size={14} />
                    <span>支援 <strong>CSV</strong>（可用 Excel / Google Sheets 編輯）或 <strong>JSON 陣列</strong></span>
                </div>

                {/* Download template */}
                <button className="backup-btn" style={{ alignSelf: 'flex-start' }} onClick={downloadTemplate}>
                    <Download size={14} /> 下載 CSV 範本
                </button>

                {/* Default tag selector */}
                <div>
                    <label className="form-label" style={{ marginBottom: '4px' }}>
                        CSV 未指定標籤時，預設加入：
                    </label>
                    <select className="form-input" value={defaultTag} onChange={e => setDefaultTag(e.target.value)}>
                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>

                {/* File upload */}
                <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" style={{ display: 'none' }} onChange={handleFile} />
                <button className="btn-secondary flex-center" onClick={() => fileRef.current?.click()} style={{ padding: '0.75rem' }}>
                    <Upload size={18} style={{ marginRight: '8px' }} /> 選擇 CSV 或 JSON 檔案
                </button>

                {/* Parse error */}
                {parseError && (
                    <div className="batch-error"><AlertCircle size={16} /> {parseError}</div>
                )}

                {/* Preview table */}
                {resolved.length > 0 && (
                    <>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="batch-stat ok"><CheckCircle size={13} /> {validCount} 張可匯入</span>
                            {errorCount > 0 && <span className="batch-stat err"><AlertCircle size={13} /> {errorCount} 張有問題</span>}
                        </div>

                        <div className="batch-preview-wrap">
                            <table className="batch-table">
                                <thead>
                                    <tr>
                                        <th>標籤</th>
                                        <th>正面文字</th>
                                        <th>LaTeX 正面</th>
                                        <th>背面文字</th>
                                        <th>LaTeX 背面</th>
                                        <th>備註</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resolved.map((c, i) => (
                                        <tr key={i} className={c.error ? 'row-error' : c.warning ? 'row-warning' : ''}>
                                            <td>
                                                {tags.find(t => t.id === c.tagId)?.name || <span style={{ color: 'var(--danger)' }}>?</span>}
                                                {c.warning && <span title={c.warning} style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: '4px' }}><AlertCircle size={12} color="#f59e0b" /></span>}
                                            </td>
                                            <td>{c.frontText}</td>
                                            <td className="mono">{c.frontMath}</td>
                                            <td>{c.backText}</td>
                                            <td className="mono">{c.backMath}</td>
                                            <td>{c.notes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            className="btn-primary"
                            style={{ padding: '0.85rem', fontSize: '1rem' }}
                            disabled={importing || validCount === 0}
                            onClick={handleImport}
                        >
                            {importing ? '匯入中…' : `確認匯入 ${validCount} 張卡片`}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
