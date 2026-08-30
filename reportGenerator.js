const fs = require('fs');
const path = require('path');
const { getBankroll, db } = require('./db');

function generateHtmlReport() {
  const bank = getBankroll();
  const allBets = db.prepare(`
    SELECT * FROM bets
    ORDER BY id DESC
  `).all();

  const progressPercent = Math.min(100, Math.max(0, ((bank.current_bank - bank.initial_bank) / (bank.target_bank - bank.initial_bank)) * 100));

  // Generar filas de la tabla
  const rowsHtml = allBets.map(b => {
    let badgeClass = 'badge-pending';
    let statusText = '⏳ PENDIENTE';
    let profitText = `$0.00`;
    let profitClass = 'neutral';

    if (b.status === 'WON') {
      badgeClass = 'badge-won';
      statusText = '✅ GANADA';
      profitText = `+$${(b.profit_loss || 0).toFixed(2)}`;
      profitClass = 'positive';
    } else if (b.status === 'LOST') {
      badgeClass = 'badge-lost';
      statusText = '❌ PERDIDA';
      profitText = `-$${Math.abs(b.profit_loss || b.stake).toFixed(2)}`;
      profitClass = 'negative';
    } else if (b.status === 'VOID') {
      badgeClass = 'badge-void';
      statusText = '⚪ ANULADA';
      profitText = `$0.00`;
      profitClass = 'neutral';
    } else if (b.status === 'CASH_OUT') {
      badgeClass = 'badge-cashout';
      statusText = '💵 CASH OUT';
      const pl = b.profit_loss || 0;
      profitText = `${pl >= 0 ? '+' : '-'}$${Math.abs(pl).toFixed(2)}`;
      profitClass = pl >= 0 ? 'positive' : 'negative';
    }

    const dateStr = b.placed_at ? new Date(b.placed_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/D';

    return `
      <tr>
        <td><strong>#${b.id}</strong></td>
        <td>${dateStr}</td>
        <td>
          <div class="event-title">${escapeHtml(b.event_name)}</div>
          <div class="event-sub">${escapeHtml(b.sport || 'Fútbol')} · ${escapeHtml(b.league || 'N/D')} (${escapeHtml(b.bookmaker || 'Bookie')})</div>
        </td>
        <td><span class="market-tag">${escapeHtml(b.market)}</span></td>
        <td><strong>@${b.odds.toFixed(2)}</strong></td>
        <td>$${b.stake.toFixed(2)}</td>
        <td>$${b.potential_payout.toFixed(2)}</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td class="${profitClass}"><strong>${profitText}</strong></td>
      </tr>
    `;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Control de Bankroll $10k -> $20k</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #131b2e;
      --border: #1e293b;
      --primary: #38bdf8;
      --primary-gradient: linear-gradient(135deg, #38bdf8, #818cf8);
      --green: #22c55e;
      --red: #ef4444;
      --yellow: #f59e0b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 24px; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
    h1 { font-size: 26px; font-weight: 800; background: var(--primary-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.25); }
    .card-label { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .card-value { font-size: 28px; font-weight: 800; margin-top: 8px; }
    .card-footer { font-size: 12px; margin-top: 6px; color: var(--text-muted); }

    .progress-section { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 24px; margin-bottom: 28px; }
    .progress-header { display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 12px; }
    .progress-bar-bg { background: #1e293b; height: 16px; border-radius: 8px; overflow: hidden; }
    .progress-bar-fill { height: 100%; background: var(--primary-gradient); border-radius: 8px; transition: width 0.5s ease; }

    .table-container { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    th { background: #0f172a; padding: 14px 16px; color: var(--text-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
    td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:hover { background: rgba(255,255,255,0.02); }

    .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-block; }
    .badge-won { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
    .badge-lost { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-void { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3); }
    .badge-cashout { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }

    .market-tag { background: #1e293b; padding: 3px 8px; border-radius: 6px; font-size: 12px; color: #38bdf8; }
    .positive { color: var(--green); }
    .negative { color: var(--red); }
    .neutral { color: var(--text-muted); }
    .event-title { font-weight: 600; }
    .event-sub { font-size: 12px; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Dashboard Maestro de Bankroll</h1>
        <div class="subtitle">Control Inteligente con Telegram Bot (@apuestasIngresadasBot) & SQLite</div>
      </div>
      <div>
        <span class="badge badge-won">ACTIVO Y SINCRONIZADO</span>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="card-label">Bankroll Actual</div>
        <div class="card-value" style="color: #38bdf8;">$${bank.current_bank.toFixed(2)} MXN</div>
        <div class="card-footer">Inicial: $${bank.initial_bank.toFixed(2)} MXN</div>
      </div>
      <div class="card">
        <div class="card-label">Ganancia Neta</div>
        <div class="card-value ${bank.net_profit >= 0 ? 'positive' : 'negative'}">
          ${bank.net_profit >= 0 ? '+' : ''}$${bank.net_profit.toFixed(2)} MXN
        </div>
        <div class="card-footer">Progreso Meta: ${progressPercent.toFixed(1)}%</div>
      </div>
      <div class="card">
        <div class="card-label">Win Rate / Acierto</div>
        <div class="card-value" style="color: #4ade80;">${bank.win_rate}%</div>
        <div class="card-footer">${bank.won_bets} Ganadas · ${bank.lost_bets} Perdidas</div>
      </div>
      <div class="card">
        <div class="card-label">Yield / Retorno</div>
        <div class="card-value" style="color: #818cf8;">${bank.yield_pct >= 0 ? '+' : ''}${bank.yield_pct}%</div>
        <div class="card-footer">Stake Sugerido: $${bank.recommended_stake} MXN</div>
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-header">
        <span>Ruta a la Meta ($20,000 MXN)</span>
        <span>${progressPercent.toFixed(1)}% Completado</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Fecha</th>
            <th>Evento / Partido</th>
            <th>Mercado</th>
            <th>Momio</th>
            <th>Stake</th>
            <th>Retorno Pot.</th>
            <th>Estado</th>
            <th>P/L Neto</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="9" style="text-align:center; padding:32px; color:#94a3b8;">Aún no has registrado apuestas. Envía una foto o texto al bot @apuestasIngresadasBot para comenzar.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

  const outputPath = path.join(__dirname, 'reporte_bankroll.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  return outputPath;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  generateHtmlReport
};
