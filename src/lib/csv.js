/**
 * Downloads data as a CSV file with BOM for correct Hebrew display in Excel.
 * @param {string} filename
 * @param {object[]} rows
 * @param {Record<string, string>} [headers] - optional column label map
 */
export function downloadCSV(filename, rows, headers = null) {
  if (!rows || rows.length === 0) return;

  const keys = headers ? Object.keys(headers) : Object.keys(rows[0]);
  const labels = headers ? Object.values(headers) : keys;

  const escape = (v) => {
    if (v == null) return '';
    const str = String(v);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const lines = [
    labels.map(escape).join(','),
    ...rows.map(row => keys.map(k => escape(row[k])).join(',')),
  ];

  // BOM + UTF-8 so Excel shows Hebrew correctly
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
