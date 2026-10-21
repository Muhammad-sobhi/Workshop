import { describe, it, expect } from 'vitest';
import { parseCsv, buildItems, IMPORT_SPECS } from './csv-import';

describe('parseCsv', () => {
  it('handles BOM, quotes, commas inside quotes, CRLF and blank lines', () => {
    const rows = parseCsv('﻿الاسم,الوصف\r\n"خشب, زان","قال ""ممتاز"""\r\n\r\nمسمار,\r\n');
    expect(rows).toEqual([['الاسم', 'الوصف'], ['خشب, زان', 'قال "ممتاز"'], ['مسمار', '']]);
  });

  it('detects semicolon-separated files (Excel in some locales)', () => {
    expect(parseCsv('name;unit\nخشب;متر')).toEqual([['name', 'unit'], ['خشب', 'متر']]);
  });
});

describe('buildItems', () => {
  it('maps Arabic or English headers in any order and converts numbers', () => {
    const csv = 'الفئة,unit_cost,الاسم,الوحدة\nأخشاب,"1,250.5",خشب زان,متر\n';
    expect(buildItems(IMPORT_SPECS.materials, csv)).toEqual({
      items: [{ category: 'أخشاب', unit_cost: 1250.5, name: 'خشب زان', unit: 'متر' }],
      errors: [],
    });
  });

  it('reports a missing required column', () => {
    const { errors } = buildItems(IMPORT_SPECS.products, 'الاسم,الوحدة,الفئة\nكرسي,حبة,كراسي');
    expect(errors).toEqual(['العمود "سعر البيع" مش موجود في أول سطر.']);
  });

  it('reports empty required cells and bad numbers with the Excel row number', () => {
    const { errors } = buildItems(IMPORT_SPECS.suppliers, 'الاسم,المديونية\nمورد 1,abc\n,100');
    expect(errors).toEqual(['سطر 2: "المديونية" لازم يكون رقم.', 'سطر 3: "الاسم" فاضي.']);
  });

  it('leaves optional empty cells out', () => {
    const { items } = buildItems(IMPORT_SPECS.clients, 'name,phone,email,debt_amount\nعميل,,,\n');
    expect(items).toEqual([{ name: 'عميل' }]);
  });

  it('rejects a file with only the header row', () => {
    expect(buildItems(IMPORT_SPECS.clients, 'الاسم\n').errors).toHaveLength(1);
  });
});
