'use client';

export default function AlertDialog({ alertDialog, onClose }) {
  if (!alertDialog) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label={alertDialog.type === 'confirm' ? 'تأكيد' : 'تنبيه'}>
      <div className="glass-card rounded-xl p-6 max-w-sm w-full mx-4 text-center">
        <p className="text-foreground mb-6">{alertDialog.message}</p>
        <div className="flex justify-center gap-3">
          {alertDialog.type === 'confirm' ? (
            <>
              <button onClick={() => { alertDialog.onConfirm(); onClose(); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">تأكيد</button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">إلغاء</button>
            </>
          ) : (
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">حسناً</button>
          )}
        </div>
      </div>
    </div>
  );
}
