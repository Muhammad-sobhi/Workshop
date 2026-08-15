import React, { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { Download, Upload, Database, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, HardDrive, FileJson, Clock } from 'lucide-react';

export default function BackupSettings() {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/backup/status');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleDownloadBackup = async () => {
    setDownloading(true);
    setMsg('');
    setError('');
    try {
      const response = await apiClient.get('/backup/export', {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `workshop_backup_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMsg('تم إنشاء وتحميل النسخة الاحتياطية بنجاح على جهازك.');
      fetchStatus();
    } catch (err) {
      console.error(err);
      setError('فشل في تحميل النسخة الاحتياطية.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRestoreBackup = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('يرجى اختيار ملف النسخة الاحتياطية (.json) أولاً.');
      return;
    }

    if (!window.confirm('⚠️ تحذير: استعادة النسخة الاحتياطية ستستبدل البيانات الحالية بالبيانات الموجودة في الملف. هل تريد المتابعة؟')) {
      return;
    }

    setRestoring(true);
    setMsg('');
    setError('');

    const formData = new FormData();
    formData.append('backup_file', selectedFile);

    try {
      const res = await apiClient.post('/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMsg(res.data?.message || 'تمت استعادة النسخة الاحتياطية بنجاح.');
      setSelectedFile(null);
      fetchStatus();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'فشل في استعادة النسخة الاحتياطية، تأكد من صحة الملف.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informational Hero Card */}
      <div
        className="rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(236,199,150,0.08), rgba(47,38,76,0.6))', borderColor: 'rgba(236,199,150,0.3)' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(236,199,150,0.15)', color: '#ECC796' }}>
            <Database size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              النسخ الاحتياطي التلقائي بضغطة زر
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                حماية 100%
              </span>
            </h3>
            <p className="text-xs mt-1" style={{ color: '#D4CEEB' }}>
              حفظ وتأمين كافة بيانات الورشة (الخزينة، الفواتير، المخازن، العملاء، والموردين) في ملف واحد مشفر يمكنك حفظه على فلاشة أو Google Drive
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadBackup}
          disabled={downloading}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-[0.98] shadow-lg shrink-0"
          style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
        >
          {downloading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              جاري تجهيز النسخة...
            </>
          ) : (
            <>
              <Download size={16} />
              تنزيل نسخة احتياطية فورية (.JSON)
            </>
          )}
        </button>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Health & Stats */}
        <div className="rounded-2xl border p-5 space-y-4" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          <div className="flex items-center justify-between pb-3 border-b border-[#3D3554]">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <HardDrive size={16} className="text-[#ECC796]" />
              حالة وقوة قاعدة البيانات
            </h4>
            <button onClick={fetchStatus} className="text-[#A49EC0] hover:text-white transition-all">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
              <span className="text-[11px]" style={{ color: '#A49EC0' }}>إجمالي السجلات المحفوظة</span>
              <p className="text-lg font-bold text-emerald-400 mt-1">
                {stats?.total_records?.toLocaleString('ar-SA') || '0'} سجل
              </p>
            </div>

            <div className="p-3 rounded-xl border" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
              <span className="text-[11px]" style={{ color: '#A49EC0' }}>الجداول المحمية بالنسخة</span>
              <p className="text-lg font-bold text-[#ECC796] mt-1">
                {stats?.total_tables || 24} جدول
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-[#D4CEEB] pt-2">
            <p className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              النسخة تشمل: الخزينة، الفواتير، المخازن، أوامر الإنتاج، الموردين، والعملاء.
            </p>
            <p className="flex items-center gap-1.5">
              <Clock size={14} className="text-[#ECC796]" />
              تاريخ خادم النظام: {stats?.server_time || new Date().toLocaleString('ar-EG')}
            </p>
          </div>
        </div>

        {/* Restore Backup Panel */}
        <div className="rounded-2xl border p-5 space-y-4" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          <div className="pb-3 border-b border-[#3D3554]">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload size={16} className="text-purple-400" />
              استعادة نسخة احتياطية سابقة
            </h4>
            <p className="text-xs mt-1" style={{ color: '#A49EC0' }}>
              رفع ملف النسخة الاحتياطية (.json) لاسترجاع بيانات الورشة
            </p>
          </div>

          <form onSubmit={handleRestoreBackup} className="space-y-4">
            <div
              className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:bg-white/5"
              style={{ borderColor: '#3D3554' }}
              onClick={() => document.getElementById('backup-file-input').click()}
            >
              <FileJson size={28} className="mx-auto text-[#ECC796] mb-2" />
              <input
                id="backup-file-input"
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs font-semibold text-white">
                {selectedFile ? selectedFile.name : 'انقر لاختيار ملف النسخة الاحتياطية'}
              </p>
              <p className="text-[10px] text-[#A49EC0] mt-1">صيغة JSON المعتمدة فقط</p>
            </div>

            <button
              type="submit"
              disabled={!selectedFile || restoring}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 hover:opacity-90 flex items-center justify-center gap-2 bg-purple-500/20 text-purple-200 border border-purple-500/40"
            >
              {restoring ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  جاري استعادة البيانات وفحص الجداول...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  تأكيد استعادة النسخة الاحتياطية
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
