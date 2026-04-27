export type ExportCell = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportCell>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

export function exportRowsToCsv(filename: string, rows: ExportRow[]): void {
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [headers, ...rows.map((row) => headers.map((header) => String(row[header] ?? "")))]
    .map((record) => record.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

export function exportRowsToPdf(title: string, subtitle: string, rows: ExportRow[]): void {
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0]);
  const bodyRows = rows
    .map((row) => `
      <tr>
        ${headers.map((header) => `<td>${escapeHtml(String(row[header] ?? ""))}</td>`).join("")}
      </tr>
    `)
    .join("");

  const popup = window.open("", "_blank", "width=1200,height=900");
  if (!popup) {
    throw new Error("Allow popups to export a PDF.");
  }

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          p { margin: 0 0 20px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
          th { background: #eff6ff; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}
