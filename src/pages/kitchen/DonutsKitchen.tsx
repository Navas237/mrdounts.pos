import React, { useState } from 'react';
import { DonutsToppingKitchen } from './DonutsToppingKitchen';
import { DonutsInjectionKitchen } from './DonutsInjectionKitchen';
import { Sparkles, Syringe } from 'lucide-react';

export const DonutsKitchen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'topping' | 'injection'>('topping');

  return (
    <div className="space-y-3.5">
      {/* شريط التبديل العلوي السريع بين محطة التوبنج ومحطة الحقن */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-line shadow-2xs max-w-sm sm:max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('topping')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'topping'
              ? 'bg-brand-700 text-white shadow-2xs'
              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
          }`}
        >
          <Sparkles className="w-4 h-4 stroke-[2.2]" />
          <span>شاشة التوبنج والبوكسات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('injection')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'injection'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
          }`}
        >
          <Syringe className="w-4 h-4 stroke-[2.2]" />
          <span>شاشة الحقن والحشو</span>
        </button>
      </div>

      {/* المحتوى الفعلي للمحطة المختارة */}
      {activeTab === 'topping' ? <DonutsToppingKitchen /> : <DonutsInjectionKitchen />}
    </div>
  );
};
