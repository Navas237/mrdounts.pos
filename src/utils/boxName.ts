// اسم بوكس الدونتس الموحد: «بوكس 4 ميني» / «بوكس 6 عادي» / «بوكس 4 محشي»
export function donutBoxName(count?: number | null, type?: string | null): string {
  const t = type === 'mini' || type === 'ميني' ? 'ميني'
    : type === 'stuffed' || type === 'حشو' || type === 'محشي' ? 'محشي'
    : 'عادي';
  return `بوكس ${count || 0} ${t}`;
}
