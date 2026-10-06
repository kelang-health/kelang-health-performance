export const mainYearKey='web_primary_fiscal_year';
export function primaryYear(rows){const year=rows.find(r=>r.setting_key===mainYearKey)?.value?.year;return [2568,2569,2570].includes(year)?year:null;}
export function initialYear(rows){return primaryYear(rows)??2569;}
