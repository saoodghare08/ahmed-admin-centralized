import xlsx from 'xlsx';

const workbook = xlsx.utils.book_new();
const ws_data = [
  ['type', 'name_en', 'name_ar', 'parent_category_en', 'sort_order', 'is_active'],
  ['category', 'Perfumes', 'العطور', '', 1, 1],
  ['subcategory', 'Oud', 'عود', 'Perfumes', 1, 1]
];
const ws = xlsx.utils.aoa_to_sheet(ws_data);
xlsx.utils.book_append_sheet(workbook, ws, "Sheet1");
xlsx.writeFile(workbook, 'test_import.xlsx');
console.log('Test file created');
