import { FileText } from 'lucide-react';
import { getImageUrl } from '@/lib/config';
import Modal from '@/components/employees/ModalShell';

export default function ReceiptPreviewModal({ path, onClose }) {
  return (
    <Modal title="إيصال الدفعة" onClose={onClose}>
      <div className="space-y-3">
        {/\.(jpg|jpeg|png|webp)$/i.test(path) ? (
          <img src={getImageUrl(path)} alt="receipt" className="w-full rounded-xl border border-[#3D3554]" />
        ) : (
          <a href={getImageUrl(path)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#2F264C] text-[#ECC796] text-xs font-bold border border-[#3D3554] hover:bg-white/5">
            <FileText className="w-4 h-4" /> فتح ملف الإيصال
          </a>
        )}
      </div>
    </Modal>
  );
}
