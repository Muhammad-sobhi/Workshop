'use client';

export default function ConfirmDialog({ confirmDialog, setConfirmDialog }) {
  if (!confirmDialog) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border p-6 text-center" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <p className="text-sm text-white mb-6">{confirmDialog.message}</p>
        <div className="flex gap-3">
          {confirmDialog.type === 'confirm' ? (
            <>
              <button type="button" onClick={async () => { const cb = confirmDialog.onConfirm; setConfirmDialog(null); if (cb) await cb(); }} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90" style={{ background: '#10B981', color: '#FFF' }}>تأكيد</button>
              <button type="button" onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 rounded-xl text-xs font-bold border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>إلغاء</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90" style={{ background: '#8D7EC8', color: '#FFF' }}>حسناً</button>
          )}
        </div>
      </div>
    </div>
  );
}
