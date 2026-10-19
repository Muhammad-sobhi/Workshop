'use client';

export default function ConfirmDialog({ confirmDialog, setConfirmDialog }) {
  if (!confirmDialog) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border p-6 text-center" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <p className="text-sm text-white mb-6 whitespace-pre-line">{confirmDialog.message}</p>
        {confirmDialog.type === 'choice' ? (
          <div className="flex flex-col gap-2">
            {confirmDialog.choices.map((choice) => (
              <button
                key={choice.label}
                type="button"
                onClick={async () => { setConfirmDialog(null); await choice.onSelect(); }}
                className="w-full p-3 rounded-xl text-right border transition-all hover:bg-white/5"
                style={{ borderColor: choice.color, color: '#FFF' }}
              >
                <span className="block text-xs font-bold" style={{ color: choice.color }}>{choice.label}</span>
                {choice.description && <span className="block text-[11px] text-gray-300 mt-1 leading-relaxed">{choice.description}</span>}
              </button>
            ))}
            <button type="button" onClick={() => setConfirmDialog(null)} className="w-full py-2.5 rounded-xl text-xs font-bold border mt-1" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>رجوع</button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
