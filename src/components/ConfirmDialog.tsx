

interface ConfirmDialogProps {
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    danger?: boolean;
}

/**
 * Shared in-app confirmation dialog.
 * Replaces native window.confirm (which is blocked in iOS PWA standalone mode).
 */
export default function ConfirmDialog({
    message,
    confirmLabel = '確定',
    onConfirm,
    onCancel,
    danger = true,
}: ConfirmDialogProps) {
    return (
        <div className="modal-overlay" style={{ zIndex: 300 }} onClick={onCancel}>
            <div
                className="glass-card modal-content"
                onClick={e => e.stopPropagation()}
                style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
                <p style={{ fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{message}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={onCancel}
                        style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--text-muted)', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        取消
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{ flex: 1, background: danger ? 'var(--danger)' : 'var(--primary)', color: 'white', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
