const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new Database(DB_PATH);

// Habilitar Write-Ahead Logging para alto rendimiento y tolerancia a concurrencia
db.pragma('journal_mode = WAL');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bankroll_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      initial_bank REAL NOT NULL DEFAULT 10000.0,
      current_bank REAL NOT NULL DEFAULT 10000.0,
      target_bank REAL NOT NULL DEFAULT 20000.0,
      default_stake_pct REAL NOT NULL DEFAULT 5.0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT,
      bookmaker TEXT DEFAULT 'Desconocido',
      event_name TEXT NOT NULL,
      sport TEXT DEFAULT 'Fútbol',
      league TEXT DEFAULT 'N/D',
      market TEXT NOT NULL,
      odds REAL NOT NULL,
      stake REAL NOT NULL,
      potential_payout REAL NOT NULL,
      profit_loss REAL,
      status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, WON, LOST, VOID, CANCELLED
      score_final TEXT,
      source TEXT DEFAULT 'IMAGE_OCR',        -- IMAGE_OCR, MANUAL_TEXT, BOT_AUTO
      source_bot TEXT DEFAULT 'manual',       -- rojas_y_goles, apuestasprepartido, pronosticos_yt, manual
      ai_analysis TEXT,
      confidence_score INTEGER DEFAULT 75,
      image_file_id TEXT,
      raw_extracted_text TEXT,
      placed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      user_id TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS bankroll_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bet_id INTEGER,
      type TEXT NOT NULL, -- BET_PLACED, BET_WON, BET_LOST, BET_VOID, ADJUSTMENT
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
    CREATE INDEX IF NOT EXISTS idx_bets_placed_at ON bets(placed_at);
  `);

  // Inicializar bankroll_settings si no existe
  const existing = db.prepare('SELECT id FROM bankroll_settings WHERE id = 1').get();
  if (!existing) {
    const initialBank = parseFloat(process.env.INITIAL_BANKROLL) || 10000.0;
    const targetBank = parseFloat(process.env.TARGET_BANKROLL) || 20000.0;
    const defaultStakePct = parseFloat(process.env.DEFAULT_STAKE_PCT) || 5.0;

    db.prepare(`
      INSERT INTO bankroll_settings (id, initial_bank, current_bank, target_bank, default_stake_pct)
      VALUES (1, ?, ?, ?, ?)
    `).run(initialBank, initialBank, targetBank, defaultStakePct);
  }
}

// Inicializar de inmediato
initDb();

function getBankroll() {
  const settings = db.prepare('SELECT * FROM bankroll_settings WHERE id = 1').get();
  if (!settings) {
    initDb();
    return getBankroll();
  }

  // Calcular dinero en juego (apuestas PENDING)
  const inPlayRow = db.prepare(`
    SELECT COALESCE(SUM(stake), 0) AS in_play, COUNT(*) AS count_pending
    FROM bets
    WHERE status = 'PENDING'
  `).get();

  // Estadísticas globales de apuestas resueltas
  const statsRow = db.prepare(`
    SELECT 
      COUNT(*) AS total_resolved,
      COALESCE(SUM(CASE WHEN status = 'WON' THEN 1 ELSE 0 END), 0) AS won,
      COALESCE(SUM(CASE WHEN status = 'LOST' THEN 1 ELSE 0 END), 0) AS lost,
      COALESCE(SUM(CASE WHEN status = 'VOID' THEN 1 ELSE 0 END), 0) AS void_bets,
      COALESCE(SUM(stake), 0) AS total_staked_resolved,
      COALESCE(SUM(profit_loss), 0) AS total_profit
    FROM bets
    WHERE status IN ('WON', 'LOST', 'VOID')
  `).get();

  const totalBets = (statsRow.total_resolved || 0) + (inPlayRow.count_pending || 0);
  const won = statsRow.won || 0;
  const lost = statsRow.lost || 0;
  const decided = won + lost;
  const winRate = decided > 0 ? ((won / decided) * 100).toFixed(1) : '0.0';
  const yieldPct = statsRow.total_staked_resolved > 0 
    ? ((statsRow.total_profit / statsRow.total_staked_resolved) * 100).toFixed(1)
    : '0.0';

  const inPlay = inPlayRow.in_play || 0.0;
  const currentBank = settings.current_bank;
  const freeBalance = currentBank - inPlay;
  const netProfit = currentBank - settings.initial_bank;
  const progressPct = ((netProfit / (settings.target_bank - settings.initial_bank)) * 100).toFixed(1);

  // Calcular stake recomendado dinámico (4.5% - 5.0% del saldo actual)
  const recommendedStake = Math.round((currentBank * 0.0475) / 10) * 10; // Redondeado a decenas

  return {
    initial_bank: settings.initial_bank,
    current_bank: currentBank,
    target_bank: settings.target_bank,
    currency: settings.currency,
    in_play: inPlay,
    free_balance: freeBalance,
    net_profit: netProfit,
    progress_pct: Math.max(0, parseFloat(progressPct)),
    total_bets: totalBets,
    pending_bets: inPlayRow.count_pending || 0,
    won_bets: won,
    lost_bets: lost,
    void_bets: statsRow.void_bets || 0,
    win_rate: parseFloat(winRate),
    yield_pct: parseFloat(yieldPct),
    recommended_stake: Math.max(100, recommendedStake)
  };
}

function addBet(betData) {
  const insertBet = db.transaction(() => {
    const odds = parseFloat(betData.odds) || 1.80;
    const stake = parseFloat(betData.stake) || 500.0;
    const potentialPayout = betData.potential_payout 
      ? parseFloat(betData.potential_payout) 
      : parseFloat((odds * stake).toFixed(2));

    const result = db.prepare(`
      INSERT INTO bets (
        ticket_id, bookmaker, event_name, sport, league, market, odds, stake,
        potential_payout, status, source, source_bot, ai_analysis,
        confidence_score, image_file_id, raw_extracted_text, placed_at, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      betData.ticket_id || null,
      betData.bookmaker || 'Desconocido',
      betData.event_name,
      betData.sport || 'Fútbol',
      betData.league || 'N/D',
      betData.market,
      odds,
      stake,
      potentialPayout,
      betData.source || 'IMAGE_OCR',
      betData.source_bot || 'manual',
      betData.ai_analysis || null,
      betData.confidence_score || 75,
      betData.image_file_id || null,
      betData.raw_extracted_text || null,
      betData.placed_at || new Date().toISOString(),
      betData.notes || null,
      betData.user_id ? String(betData.user_id) : null
    );

    const betId = result.lastInsertRowid;
    return betId;
  });

  return insertBet();
}

function updateBetStatus(betId, newStatus, profitLoss = null, scoreFinal = null) {
  const updateTx = db.transaction(() => {
    const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(betId);
    if (!bet) throw new Error(`Apuesta #${betId} no encontrada.`);

    // Si ya estaba resuelta y tiene el mismo status, no hacer nada
    if (bet.status === newStatus) return bet;

    // Revertir efecto previo si ya estaba resuelta
    let currentBank = db.prepare('SELECT current_bank FROM bankroll_settings WHERE id = 1').get().current_bank;
    if (bet.status === 'WON' && bet.profit_loss !== null) {
      currentBank -= bet.profit_loss;
    } else if (bet.status === 'LOST' && bet.profit_loss !== null) {
      currentBank -= bet.profit_loss; // sumaba la pérdida
    }

    let calculatedProfitLoss = 0.0;
    if (newStatus === 'WON') {
      calculatedProfitLoss = profitLoss !== null 
        ? parseFloat(profitLoss) 
        : parseFloat((bet.potential_payout - bet.stake).toFixed(2));
      currentBank += calculatedProfitLoss;
    } else if (newStatus === 'LOST') {
      calculatedProfitLoss = profitLoss !== null 
        ? -Math.abs(parseFloat(profitLoss)) 
        : -bet.stake;
      currentBank += calculatedProfitLoss;
    } else if (newStatus === 'VOID' || newStatus === 'CANCELLED') {
      calculatedProfitLoss = 0.0;
    }

    // Actualizar apuesta
    db.prepare(`
      UPDATE bets
      SET status = ?, profit_loss = ?, score_final = COALESCE(?, score_final), resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, calculatedProfitLoss, scoreFinal, betId);

    // Actualizar bankroll
    db.prepare(`
      UPDATE bankroll_settings
      SET current_bank = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(currentBank);

    // Registrar transacción
    db.prepare(`
      INSERT INTO bankroll_transactions (bet_id, type, amount, balance_after, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      betId,
      `BET_${newStatus}`,
      calculatedProfitLoss,
      currentBank,
      `Apuesta #${betId} (${bet.event_name} - ${bet.market}) resuelta como ${newStatus}`
    );

    return {
      ...bet,
      status: newStatus,
      profit_loss: calculatedProfitLoss,
      score_final: scoreFinal || bet.score_final,
      new_bankroll: currentBank
    };
  });

  return updateTx();
}

function getBetById(betId) {
  return db.prepare('SELECT * FROM bets WHERE id = ?').get(betId);
}

function getPendingBets(limit = 15) {
  return db.prepare(`
    SELECT * FROM bets
    WHERE status = 'PENDING'
    ORDER BY placed_at ASC
    LIMIT ?
  `).all(limit);
}

function getRecentBets(limit = 10) {
  return db.prepare(`
    SELECT * FROM bets
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

function deleteBet(betId) {
  const deleteTx = db.transaction(() => {
    const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(betId);
    if (!bet) return false;

    // Si ya estaba resuelta, ajustar bankroll
    if (bet.status !== 'PENDING' && bet.profit_loss) {
      db.prepare(`
        UPDATE bankroll_settings
        SET current_bank = current_bank - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(bet.profit_loss);
    }

    db.prepare('DELETE FROM bankroll_transactions WHERE bet_id = ?').run(betId);
    db.prepare('DELETE FROM bets WHERE id = ?').run(betId);
    return true;
  });

  return deleteTx();
}

function adjustBankroll(newBankAmount, reason = 'Ajuste manual de saldo') {
  const adjustTx = db.transaction(() => {
    const current = db.prepare('SELECT current_bank FROM bankroll_settings WHERE id = 1').get().current_bank;
    const diff = newBankAmount - current;

    db.prepare(`
      UPDATE bankroll_settings
      SET current_bank = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(newBankAmount);

    db.prepare(`
      INSERT INTO bankroll_transactions (type, amount, balance_after, description)
      VALUES ('ADJUSTMENT', ?, ?, ?)
    `).run(diff, newBankAmount, reason);

    return newBankAmount;
  });

  return adjustTx();
}

module.exports = {
  db,
  initDb,
  getBankroll,
  addBet,
  updateBetStatus,
  getBetById,
  getPendingBets,
  getRecentBets,
  deleteBet,
  adjustBankroll
};
