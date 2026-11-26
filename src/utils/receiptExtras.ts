// بنود الإضافات المدفوعة على الإيصال: كل صوص/خيار له سعر إضافي يظهر كسطر مستقل.
export interface ExtraLine { name: string; qty: number; price: number }

/** تجميع الإضافات المتطابقة (الاسم + السعر) في سطر واحد */
export function addExtra(map: Map<string, ExtraLine>, name: string, price: number, qty = 1): void {
  if (!name || !(price > 0)) return;
  const key = `${name}|${price}`;
  const cur = map.get(key) || { name, qty: 0, price };
  cur.qty += qty;
  map.set(key, cur);
}

/** لو مجموع السطور أقل/أكثر من إجمالي الإضافات المخزن (طلبات قديمة)، نضيف سطر «إضافات» بالفرق عشان الإيصال يتجمع صح */
export function reconcileExtras(lines: ExtraLine[], extrasTotalPerUnit: number): ExtraLine[] {
  const sum = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const diff = Math.round((extrasTotalPerUnit - sum) * 100) / 100;
  if (Math.abs(diff) < 0.01) return lines;
  return [...lines, { name: 'إضافات', qty: 1, price: diff }];
}
