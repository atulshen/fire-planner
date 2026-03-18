/**
 * Parse CSV text handling quoted fields, commas inside quotes, and newlines in quotes.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || (c === '\r' && next === '\n')) {
        row.push(field);
        field = '';
        if (row.length > 1 || row[0].trim() !== '') rows.push(row);
        row = [];
        if (c === '\r') i++;
      } else {
        field += c;
      }
    }
  }
  // Last field/row
  row.push(field);
  if (row.length > 1 || row[0].trim() !== '') rows.push(row);

  return rows;
}
