import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { DeliveryWithRelations } from "@/services/deliveries";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Props {
  deliveries: DeliveryWithRelations[];
  period: string;
}

const STATUS_LABELS: Record<string, string> = {
  collecting: "Coletando",
  in_transit: "Em Trânsito",
  delivered: "Entregue",
  completed: "Entregue",
  cancelled: "Cancelado",
  returned: "Devolvido",
};

function computeKpis(deliveries: DeliveryWithRelations[]) {
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];
  const total = safeDeliveries.length;
  const delivered = safeDeliveries.filter(d => d.status === "delivered");
  const cancelled = safeDeliveries.filter(d => d.status === "cancelled").length;
  const pending = safeDeliveries.filter(d => d.status === "pending" || d.status === "broadcasted").length;
  const inTransit = safeDeliveries.filter(d => d.status === "in_transit" || d.status === "collecting" || d.status === "accepted").length;
  const revenue = delivered.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const avgTicket = delivered.length ? revenue / delivered.length : 0;
  const conversion = total ? (delivered.length / total) * 100 : 0;
  return { total, deliveredCount: delivered.length, cancelled, pending, inTransit, revenue, avgTicket, conversion };
}

function exportCSV(deliveries: DeliveryWithRelations[], period: string) {
  const headers = ["ID", "Cliente", "Empresa", "Status", "Valor", "Criado em", "Entregue em"];
  const rows = deliveries.map(d => [
    d.id.slice(0, 8),
    d.customer_name || "",
    d.companies?.name || "",
    STATUS_LABELS[d.status] || d.status,
    Number(d.value ?? 0).toFixed(2),
    d.created_at ? new Date(d.created_at).toLocaleString("pt-BR") : "",
    d.delivered_at ? new Date(d.delivered_at).toLocaleString("pt-BR") : "",
  ]);

  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `dashboard_${period}_${new Date().toISOString().split("T")[0]}.csv`);
  toast.success("CSV exportado com sucesso!");
}

function exportPDF(deliveries: DeliveryWithRelations[], period: string) {
  const k = computeKpis(deliveries);
  const generatedAt = new Date().toLocaleString("pt-BR");
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(deliveries.length / PAGE_SIZE));

  const fmtBRL = (n: number) =>
    `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const pageHeader = (pageNum: number) => `
    <header class="page-header">
      <div class="brand">
        <div class="brand-mark">É</div>
        <div>
          <div class="brand-name">É Pra Já · Painel Admin</div>
          <div class="brand-sub">Relatório operacional de entregas</div>
        </div>
      </div>
      <div class="meta">
        <div><strong>Período:</strong> ${period}</div>
        <div><strong>Gerado em:</strong> ${generatedAt}</div>
        <div><strong>Página:</strong> ${pageNum} / ${totalPages}</div>
      </div>
    </header>
  `;

  const kpiBlock = `
    <section class="kpis">
      <div class="kpi"><div class="kpi-val">${k.total}</div><div class="kpi-lbl">Total Entregas</div></div>
      <div class="kpi accent-success"><div class="kpi-val">${k.deliveredCount}</div><div class="kpi-lbl">Entregues</div></div>
      <div class="kpi accent-warning"><div class="kpi-val">${k.pending}</div><div class="kpi-lbl">Pendentes</div></div>
      <div class="kpi accent-info"><div class="kpi-val">${k.inTransit}</div><div class="kpi-lbl">Em Andamento</div></div>
      <div class="kpi accent-danger"><div class="kpi-val">${k.cancelled}</div><div class="kpi-lbl">Cancelados</div></div>
      <div class="kpi"><div class="kpi-val">${fmtBRL(k.revenue)}</div><div class="kpi-lbl">Faturamento</div></div>
      <div class="kpi"><div class="kpi-val">${fmtBRL(k.avgTicket)}</div><div class="kpi-lbl">Ticket Médio</div></div>
      <div class="kpi"><div class="kpi-val">${k.conversion.toFixed(1)}%</div><div class="kpi-lbl">Taxa Conversão</div></div>
    </section>
  `;

  const renderRows = (slice: DeliveryWithRelations[], offset: number) => slice.map((d, i) => `
    <tr>
      <td class="idx">${offset + i + 1}</td>
      <td class="mono">#${d.id.slice(0, 6)}</td>
      <td>${escape(d.customer_name || "-")}</td>
      <td>${escape(d.companies?.name || "-")}</td>
      <td><span class="badge badge-${d.status}">${STATUS_LABELS[d.status] || d.status}</span></td>
      <td class="num">${fmtBRL(Number(d.value ?? 0))}</td>
      <td class="date">${d.created_at ? new Date(d.created_at).toLocaleString("pt-BR") : "-"}</td>
    </tr>
  `).join("");

  const tableHeader = `
    <thead>
      <tr>
        <th class="idx">#</th>
        <th>ID</th>
        <th>Cliente</th>
        <th>Empresa</th>
        <th>Status</th>
        <th class="num">Valor</th>
        <th class="date">Criado em</th>
      </tr>
    </thead>
  `;

  const pages: string[] = [];
  if (deliveries.length === 0) {
    pages.push(`
      <div class="page">
        ${pageHeader(1)}
        ${kpiBlock}
        <div class="empty">Sem entregas registradas neste período.</div>
      </div>
    `);
  } else {
    for (let p = 0; p < totalPages; p++) {
      const slice = deliveries.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
      pages.push(`
        <div class="page">
          ${pageHeader(p + 1)}
          ${p === 0 ? kpiBlock : ""}
          <table class="data-table">
            ${tableHeader}
            <tbody>${renderRows(slice, p * PAGE_SIZE)}</tbody>
          </table>
          <footer class="page-footer">
            É Pra Já · Confidencial · ${generatedAt} · Pág. ${p + 1}/${totalPages}
          </footer>
        </div>
      `);
    }
  }

  const content = `<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="utf-8">
    <title>Relatório Dashboard – ${period}</title>
    <style>
      @page { size: A4; margin: 14mm 12mm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #1a1a2e; margin: 0; font-size: 11px; }
      .page { page-break-after: always; min-height: 260mm; display: flex; flex-direction: column; }
      .page:last-child { page-break-after: auto; }
      .page-header { display: flex; justify-content: space-between; align-items: flex-start;
        border-bottom: 2px solid #f97316; padding-bottom: 10px; margin-bottom: 14px; }
      .brand { display: flex; gap: 10px; align-items: center; }
      .brand-mark { width: 36px; height: 36px; background: linear-gradient(135deg,#f97316,#fb923c);
        color:#fff; border-radius: 10px; display:flex; align-items:center; justify-content:center;
        font-weight: 800; font-size: 18px; box-shadow: 0 4px 12px rgba(249,115,22,.3); }
      .brand-name { font-size: 14px; font-weight: 800; color: #1a1a2e; letter-spacing: -.2px; }
      .brand-sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
      .meta { font-size: 10px; color: #4b5563; text-align: right; line-height: 1.5; }
      .meta strong { color: #1a1a2e; }
      .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
      .kpi { background: #fafafa; border: 1px solid #eee; border-left: 3px solid #f97316;
        padding: 10px 12px; border-radius: 6px; }
      .kpi.accent-success { border-left-color: #10b981; }
      .kpi.accent-warning { border-left-color: #f59e0b; }
      .kpi.accent-info { border-left-color: #3b82f6; }
      .kpi.accent-danger { border-left-color: #ef4444; }
      .kpi-val { font-size: 16px; font-weight: 800; color: #1a1a2e; line-height: 1.1; }
      .kpi-lbl { font-size: 9px; color: #6b7280; margin-top: 3px; text-transform: uppercase; letter-spacing: .5px; }
      .data-table { width: 100%; border-collapse: collapse; font-size: 10px; flex: 1; }
      .data-table th { background: #1a1a2e; color: #fff; padding: 7px 8px; text-align: left;
        font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; }
      .data-table td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
      .data-table tr:nth-child(even) td { background: #fafafa; }
      .data-table .idx { width: 28px; color: #9ca3af; text-align: center; }
      .data-table .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
      .data-table .date { white-space: nowrap; color: #4b5563; }
      .data-table .mono { font-family: "SF Mono", Menlo, monospace; color: #4b5563; }
      .badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 9px; font-weight: 700; }
      .badge-delivered, .badge-completed { background: #d1fae5; color: #065f46; }
      .badge-cancelled { background: #fee2e2; color: #991b1b; }
      .badge-pending, .badge-broadcasted { background: #fef3c7; color: #92400e; }
      .badge-accepted, .badge-collecting, .badge-in_transit { background: #dbeafe; color: #1e40af; }
      .badge-returned { background: #f3e8ff; color: #6b21a8; }
      .page-footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee;
        font-size: 9px; color: #9ca3af; text-align: center; }
      .empty { padding: 60px 0; text-align: center; color: #9ca3af; font-size: 13px; }
    </style></head><body>
      ${pages.join("")}
      <script>
        window.addEventListener('load', function () {
          setTimeout(function () { window.print(); }, 350);
        });
      </script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(content);
    w.document.close();
    toast.success("PDF pronto para impressão!");
  } else {
    toast.error("Bloqueado pelo navegador. Permita pop-ups para gerar o PDF.");
  }
}

function escape(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DashboardExport({ deliveries, period }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportCSV(deliveries, period)}>
          📊 Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportPDF(deliveries, period)}>
          📄 Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
