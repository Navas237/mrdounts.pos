import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer, Check } from 'lucide-react';
import { formatTime } from '@/utils/formatters';

interface LabelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  itemName: string;
  departmentName: string;
}

export const LabelPreviewModal: React.FC<LabelPreviewModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  itemName,
  departmentName,
}) => {
  const [isPrinted, setIsPrinted] = React.useState(false);

  const handlePrint = () => {
    setIsPrinted(true);
    setTimeout(() => {
      setIsPrinted(false);
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="معاينة ملصق الصنف (Label Preview)"
      description="محتوى الملصق المعتمد لطابعات الأقسام (طابعة الوافل / طابعة المشروبات)"
      maxWidth="sm"
    >
      <div className="space-y-4">
        {/* تصميم الملصق الصغير لمحاكاة طابعة الـ TSC / Zebra */}
        <div className="mx-auto w-64 p-4 rounded-xl border-2 border-dashed border-ink/40 bg-white text-black font-sans shadow-md space-y-3 text-center select-none">
          {/* لوجو البراند */}
          <div className="flex items-center justify-center gap-1.5 pb-2 border-b border-black/20">
            <span className="text-xl">ًںچ©</span>
            <span className="font-black text-sm tracking-tighter">MR DONUTS</span>
          </div>

          {/* رقم الأوردر بحجم ضخم وسهل القراءة */}
          <div className="py-2 bg-black/5 rounded-lg border border-black/10">
            <span className="text-xs font-bold block opacity-70">رقم الأوردر</span>
            <span className="text-3xl font-black tracking-tight font-mono">#{orderNumber}</span>
          </div>

          {/* اسم الصنف فقط (بسيط حسب المواصفات) */}
          <div className="py-1">
            <h4 className="font-extrabold text-sm leading-snug">{itemName}</h4>
            <span className="text-xs opacity-60 block mt-0.5">قسم {departmentName}</span>
          </div>

          {/* الوقت والتاريخ */}
          <div className="pt-2 border-t border-black/20 text-[9px] opacity-50 flex justify-between">
            <span>فرع: الرئيسي</span>
            <span>{formatTime(new Date().toISOString())}</span>
          </div>
        </div>

        <p className="text-xs text-ink-muted text-center leading-relaxed">
          حسب مواصفات النظام: الملصق يحمل اللوجو ورقم الأوردر واسم الصنف فقط، وتفاصيل الصوصات والتوبنج
          تظهر على شاشة القسم.
        </p>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            leftIcon={isPrinted ? <Check className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            {isPrinted ? 'تمت إشارة الطباعة' : 'طباعة الملصق الآن'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
};


