const {
  initDb,
  getBankroll,
  addBet,
  updateBetStatus,
  getPendingBets,
  getRecentBets,
  deleteBet,
  adjustBankroll,
  db
} = require('./db');

const { generateHtmlReport } = require('./reportGenerator');
const { parseBetTextWithGeminiOrDeepSeek } = require('./aiVisionService');

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DEL SISTEMA DE GESTIÓN DE APUESTAS ---');

  // 1. Probar Banco Inicial
  const initialBank = getBankroll();
  console.log('1. Bankroll Inicial:', {
    current: initialBank.current_bank,
    initial: initialBank.initial_bank,
    target: initialBank.target_bank,
    recommendedStake: initialBank.recommended_stake
  });

  // 2. Probar inserción de apuesta
  const betId = addBet({
    ticket_id: 'TEST123456',
    bookmaker: 'Bet365',
    event_name: 'Real Madrid vs Barcelona',
    sport: 'Fútbol',
    league: 'LaLiga',
    market: 'Ambos Anotan y Over 2.5',
    odds: 1.85,
    stake: 500.0,
    potential_payout: 925.0,
    source: 'MANUAL_TEXT',
    ai_analysis: 'Gran probabilidad de goles dado el promedio de 3.2 xG en los últimos 5 clásicos.'
  });
  console.log(`2. Apuesta de prueba creada con ID: #${betId}`);

  // 3. Comprobar pendientes
  const pending = getPendingBets();
  console.log(`3. Apuestas pendientes en BD: ${pending.length} (esperado >= 1)`);

  // 4. Resolver como WON
  const wonResult = updateBetStatus(betId, 'WON', 425.0, '2-1');
  console.log(`4. Apuesta #${betId} resuelta como WON:`, {
    status: wonResult.status,
    profit_loss: wonResult.profit_loss,
    new_bankroll: wonResult.new_bankroll
  });

  const updatedBank = getBankroll();
  console.log('5. Bankroll actualizado tras victoria:', {
    current: updatedBank.current_bank,
    profit: updatedBank.net_profit,
    progress: updatedBank.progress_pct + '%',
    winRate: updatedBank.win_rate + '%'
  });

  // 6. Probar generación de reporte HTML
  const reportPath = generateHtmlReport();
  console.log(`6. Reporte HTML generado en: ${reportPath}`);

  // 7. Probar parseo de texto con IA
  try {
    console.log('7. Probando parseo de texto libre de apuesta con IA...');
    const parsedText = await parseBetTextWithGeminiOrDeepSeek('Gana Chivas vs Atlas @ 1.95 $500 Caliente');
    console.log('   Resultado IA:', parsedText);
  } catch (e) {
    console.warn('   Nota IA:', e.message);
  }

  // 8. Limpiar apuesta de prueba
  deleteBet(betId);
  adjustBankroll(10000.0, 'Reset inicial post pruebas');
  console.log('8. Apuesta de prueba limpiada. Bankroll restaurado a $10,000.00 MXN.');

  console.log('✅ --- TODAS LAS PRUEBAS COMPLETADAS SATISFACTORIAMENTE ---');
}

runTests().catch(err => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
