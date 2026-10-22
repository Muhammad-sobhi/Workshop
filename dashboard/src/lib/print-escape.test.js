import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportToPDF } from './utils';
import { useAppStore } from './store';

describe('exportToPDF', () => {
  afterEach(() => vi.restoreAllMocks());

  it('escapes user text so it cannot inject HTML into the print window', () => {
    let written = '';
    vi.spyOn(window, 'open').mockReturnValue({ document: { write: (h) => { written += h; }, close() {} } });
    vi.spyOn(useAppStore, 'getState').mockReturnValue({ settings: { company_name: '<b>co</b>' } });

    const payload = '<img src=x onerror=alert(1)>';
    exportToPDF('report', ['name'], [{ name: payload }], ['name']);

    expect(written).not.toContain(payload);
    expect(written).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(written).toContain('&lt;b&gt;co&lt;/b&gt;');
  });
});
