const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const {
  getBankroll,
  addBet,
  updateBetStatus,
  getBetById,
  getPendingBets,
  getRecentBets,
  deleteBet,
  adjustBankroll
} = require('./db');

const {
  parseBetImageWithGemini,
  parseBetTextWithGeminiOrDeepSeek,
  generateTacticalAnalysisWithDeepSeek
} = require('./aiVisionService');

const { autoVerifyPendingBets } = require('./verifierService');
const { generateHtmlReport } = require('./reportGenerator');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN no está definido en el archivo .env');
  process.exit(1);
}

// Inicializar el Bot de Telegram con long polling
const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🤖 Bot de Control de Apuestas (@apuestasIngresadasBot) iniciado con éxito...');

/**
 * Formatea una tarjeta de apuesta para Telegram
 */
function formatBetCard(bet, id, bank) {
  const odds = parseFloat(bet.odds || bet.momio || 1.80).toFixed(2);
  const stake = parseFloat(bet.stake || 500).toFixed(2);
  const payout = parseFloat(bet.potential_payout || bet.retorno_potencial || (odds * stake)).toFixed(2);
  const profit = (payout - stake).toFixed(2);

  const bankPct = ((stake / bank.current_bank) * 100).toFixed(1);

  return `🎫 <b>APUESTA REGISTRADA #${id}</b>
━━━━━━━━━━━━━━━━━━━━
⚽ <b>Evento:</b> ${escapeHtml(bet.event_name || bet.partido)}
🏆 <b>Liga/Deporte:</b> ${escapeHtml(bet.sport || bet.deporte || 'Fútbol')} · ${escapeHtml(bet.league || bet.liga || 'N/D')}
🏢 <b>Casa:</b> ${escapeHtml(bet.bookmaker || bet.casa_apuestas || 'Desconocido')}
🎯 <b>Mercado:</b> <code>${escapeHtml(bet.market || bet.mercado)}</code>

📊 <b>Momio:</b> @${odds}
💰 <b>Stake:</b> $${stake} MXN (${bankPct}% del Bank)
💵 <b>Retorno Potencial:</b> $${payout} MXN <i>(+ $${profit} MXN)</i>
━━━━━━━━━━━━━━━━━━━━
🤖 <b>Análisis Táctico IA:</b>
<i>${escapeHtml(bet.ai_analysis || 'Apuesta agregada al control del bankroll.')}</i>
━━━━━━━━━━━━━━━━━━━━
🏦 <b>Saldo Bank:</b> $${bank.current_bank.toFixed(2)} MXN | En Juego: $${bank.in_play.toFixed(2)} MXN`;
}

/**
 * Botones inline de resolución rápida para una apuesta
 */
function getResolutionKeyboard(betId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Ganada', callback_data: `won_${betId}` },
        { text: '❌ Perdida', callback_data: `lost_${betId}` }
      ],
      [
        { text: '⚪ Anulada / Push', callback_data: `void_${betId}` },
        { text: '🗑️ Eliminar', callback_data: `del_${betId}` }
      ]
    ]
  };
}

// ----------------------------------------------------
// 📸 MANEJO DE FOTOS Y CAPTURAS DE PANTALLA (OCR + IA)
// ----------------------------------------------------
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photoArray = msg.photo;

  if (!photoArray || photoArray.length === 0) return;

  const statusMsg = await bot.sendMessage(chatId, '🔍 <i>Analizando boleto de apuesta con IA (OCR Vision + DeepSeek)...</i>', { parse_mode: 'HTML' });

  try {
    // Tomar la foto con mayor resolución
    const highestPhoto = photoArray[photoArray.length - 1];
    const fileId = highestPhoto.file_id;
    const fileLink = await bot.getFileLink(fileId);

    // Descargar el buffer de la imagen
    const imageRes = await axios.get(fileLink, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageRes.data);

    // 1. Extraer datos con Gemini Vision
    const extracted = await parseBetImageWithGemini(imageBuffer);

    // 2. Generar análisis táctico con DeepSeek Reasoner
    const aiAnalysis = await generateTacticalAnalysisWithDeepSeek(extracted);
    extracted.ai_analysis = aiAnalysis;

    // 3. Guardar en SQLite
    const betId = addBet({
      ticket_id: extracted.id_ticket,
      bookmaker: extracted.casa_apuestas,
      event_name: extracted.partido,
      sport: extracted.deporte,
      league: extracted.liga,
      market: extracted.mercado,
      odds: extracted.momio,
      stake: extracted.stake,
      potential_payout: extracted.retorno_potencial,
      source: 'IMAGE_OCR',
      ai_analysis: aiAnalysis,
      confidence_score: extracted.confianza_extraccion || 85,
      image_file_id: fileId,
      user_id: msg.from.id
    });

    const bank = getBankroll();

    // Eliminar mensaje de espera
    await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    // Enviar tarjeta formateada con botones interactivos
    await bot.sendMessage(chatId, formatBetCard(extracted, betId, bank), {
      parse_mode: 'HTML',
      reply_markup: getResolutionKeyboard(betId)
    });

  } catch (error) {
    console.error('[PHOTO PROCESS ERROR]:', error);
    await bot.editMessageText(`❌ <b>Error al procesar la imagen:</b>\n${escapeHtml(error.message)}\n\n<i>Tip: También puedes escribir el texto directamente (ej. "Over 2.5 Real Madrid vs Barcelona @ 1.85 $500").</i>`, {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML'
    }).catch(() => {});
  }
});

// ----------------------------------------------------
// 💬 MANEJO DE COMANDOS Y MENSAJES DE TEXTO
// ----------------------------------------------------
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Omitir si es un comando manejado específicamente
  if (text.startsWith('/')) {
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (command === '/start' || command === '/help' || command === '/ayuda') {
      const bank = getBankroll();
      const welcome = `🚀 <b>¡BIENVENIDO AL GESTOR DE BANKROLL INTELIGENTE!</b>
━━━━━━━━━━━━━━━━━━━━
🎯 <b>Objetivo:</b> $${bank.initial_bank.toLocaleString()} MXN ➔ <b>$${bank.target_bank.toLocaleString()} MXN</b>
💰 <b>Saldo Actual:</b> $${bank.current_bank.toFixed(2)} MXN
📊 <b>Stake Sugerido:</b> $${bank.recommended_stake} MXN (4.5% - 5.0%)

📸 <b>¿Cómo registrar apuestas?</b>
Simplemente <b>envía una captura de pantalla / foto de tu boleto de apuesta</b> (Bet365, Caliente, etc.) y la IA extraerá automáticamente el partido, mercado, momio y stake.

O escribe un texto directo como:
<code>Over 2.5 Real Madrid vs Barcelona @ 1.85 $500</code>

━━━━━━━━━━━━━━━━━━━━
📋 <b>Comandos Disponibles:</b>
/balance o /stats - Ver balance general y rendimiento
/pendientes - Lista de apuestas en juego con botones
/historial - Últimas 10 jugadas registradas
/verificar - Auto-verificar marcadores y liquidar
/reporte - Descargar reporte visual interactivo en HTML
/backup - Descargar archivo SQLite (.sqlite) para DB Browser
/ganada <code>&lt;id&gt;</code> - Marcar apuesta como ganada
/perdida <code>&lt;id&gt;</code> - Marcar apuesta como perdida
/anulada <code>&lt;id&gt;</code> - Marcar como nula / push
/ajustar_bank <code>&lt;monto&gt;</code> - Calibrar saldo del bankroll`;

      return bot.sendMessage(chatId, welcome, { parse_mode: 'HTML' });
    }

    if (command === '/balance' || command === '/stats' || command === '/bankroll') {
      const bank = getBankroll();
      const progressBlocks = Math.round(bank.progress_pct / 10);
      const progressBar = '🟩'.repeat(Math.min(10, Math.max(0, progressBlocks))) + '⬜'.repeat(Math.max(0, 10 - Math.min(10, progressBlocks)));

      const balanceMsg = `🏦 <b>ESTADO GENERAL DEL BANKROLL</b>
━━━━━━━━━━━━━━━━━━━━
💵 <b>Saldo Total:</b> $${bank.current_bank.toFixed(2)} MXN
⏳ <b>En Juego (Pendientes):</b> $${bank.in_play.toFixed(2)} MXN (${bank.pending_bets} apuestas)
🔓 <b>Saldo Disponible:</b> $${bank.free_balance.toFixed(2)} MXN
📈 <b>Ganancia Neta:</b> ${bank.net_profit >= 0 ? '+' : ''}$${bank.net_profit.toFixed(2)} MXN

🎯 <b>Progreso a la Meta ($20,000 MXN):</b>
${progressBar} <b>${bank.progress_pct}%</b>

━━━━━━━━━━━━━━━━━━━━
📊 <b>Estadísticas de Rendimiento:</b>
• <b>Win Rate:</b> ${bank.win_rate}%
• <b>Aciertos:</b> ${bank.won_bets} ✅ · ${bank.lost_bets} ❌ · ${bank.void_bets} ⚪
• <b>Yield / Retorno:</b> ${bank.yield_pct >= 0 ? '+' : ''}${bank.yield_pct}%
• <b>Stake Recomendado Hoy:</b> <b>$${bank.recommended_stake} MXN</b>`;

      return bot.sendMessage(chatId, balanceMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏳ Ver Pendientes', callback_data: 'view_pending' },
              { text: '🔄 Actualizar', callback_data: 'refresh_balance' }
            ]
          ]
        }
      });
    }

    if (command === '/pendientes') {
      const pending = getPendingBets(10);
      if (pending.length === 0) {
        return bot.sendMessage(chatId, '✅ <b>No tienes apuestas pendientes en este momento.</b>\n\nEnvía una foto de tu boleto para registrar tu próxima jugada.', { parse_mode: 'HTML' });
      }

      for (const b of pending) {
        const textCard = `⏳ <b>APUESTA PENDIENTE #${b.id}</b>
⚽ <b>${escapeHtml(b.event_name)}</b>
🎯 Mercado: <code>${escapeHtml(b.market)}</code>
📊 Momio: @${b.odds.toFixed(2)} | Stake: $${b.stake.toFixed(2)} MXN
💵 Retorno: $${b.potential_payout.toFixed(2)} MXN`;

        await bot.sendMessage(chatId, textCard, {
          parse_mode: 'HTML',
          reply_markup: getResolutionKeyboard(b.id)
        });
      }
      return;
    }

    if (command === '/historial') {
      const recent = getRecentBets(8);
      if (recent.length === 0) {
        return bot.sendMessage(chatId, '📭 Aún no hay historial de apuestas registradas.');
      }

      let historyText = `📋 <b>ÚLTIMAS APUESTAS REGISTRADAS</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      for (const b of recent) {
        const icon = b.status === 'WON' ? '✅' : b.status === 'LOST' ? '❌' : b.status === 'VOID' ? '⚪' : '⏳';
        const pl = b.profit_loss !== null ? `(${b.profit_loss >= 0 ? '+' : ''}$${b.profit_loss.toFixed(2)})` : '';
        historyText += `${icon} <b>#${b.id}</b> ${escapeHtml(b.event_name)}\n   ${escapeHtml(b.market)} @${b.odds.toFixed(2)} · Stake: $${b.stake} ${pl}\n\n`;
      }

      return bot.sendMessage(chatId, historyText, { parse_mode: 'HTML' });
    }

    if (command === '/ganada' || command === '/perdida' || command === '/anulada') {
      const betId = parseInt(args[0], 10);
      if (!betId || isNaN(betId)) {
        return bot.sendMessage(chatId, `⚠️ Debes indicar el ID de la apuesta. Ejemplo: <code>${command} 1</code>`, { parse_mode: 'HTML' });
      }

      const status = command === '/ganada' ? 'WON' : command === '/perdida' ? 'LOST' : 'VOID';
      try {
        const updated = updateBetStatus(betId, status);
        const icon = status === 'WON' ? '✅ GANADA' : status === 'LOST' ? '❌ PERDIDA' : '⚪ ANULADA';
        const bank = getBankroll();
        return bot.sendMessage(chatId, `${icon} <b>Apuesta #${betId} actualizada.</b>\n\n💵 P/L: ${updated.profit_loss >= 0 ? '+' : ''}$${(updated.profit_loss || 0).toFixed(2)} MXN\n🏦 Saldo Actual: <b>$${bank.current_bank.toFixed(2)} MXN</b>`, { parse_mode: 'HTML' });
      } catch (err) {
        return bot.sendMessage(chatId, `❌ Error: ${err.message}`);
      }
    }

    if (command === '/ajustar_bank') {
      const newAmount = parseFloat(args[0]);
      if (isNaN(newAmount) || newAmount <= 0) {
        return bot.sendMessage(chatId, '⚠️ Uso: <code>/ajustar_bank 10500</code>', { parse_mode: 'HTML' });
      }

      adjustBankroll(newAmount, 'Ajuste manual vía Telegram');
      return bot.sendMessage(chatId, `✅ <b>Bankroll calibrado exitosamente a: $${newAmount.toFixed(2)} MXN</b>`, { parse_mode: 'HTML' });
    }

    if (command === '/verificar') {
      const waitMsg = await bot.sendMessage(chatId, '🔄 <i>Consultando marcadores oficiales en API-Sports...</i>', { parse_mode: 'HTML' });
      const resolved = await autoVerifyPendingBets();
      await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});

      if (resolved.length === 0) {
        return bot.sendMessage(chatId, 'ℹ️ No se encontraron partidos finalizados para liquidar automáticamente.');
      }

      let summary = `✅ <b>${resolved.length} Apuesta(s) liquidadas automáticamente:</b>\n\n`;
      for (const r of resolved) {
        const icon = r.status === 'WON' ? '✅' : '❌';
        summary += `${icon} <b>#${r.id} ${escapeHtml(r.event_name)}</b> (${r.score_final})\n   Resultado: ${r.status} (${r.profit_loss >= 0 ? '+' : ''}$${r.profit_loss.toFixed(2)} MXN)\n\n`;
      }
      return bot.sendMessage(chatId, summary, { parse_mode: 'HTML' });
    }

    if (command === '/reporte') {
      const filePath = generateHtmlReport();
      await bot.sendDocument(chatId, filePath, {
        caption: '📊 <b>Reporte Interactivo de Bankroll ($5k -> $20k)</b>\n<i>Ábrelo en tu navegador para ver la tabla completa y métricas.</i>',
        parse_mode: 'HTML'
      });
      return;
    }

    if (command === '/backup' || command === '/basededatos' || command === '/db') {
      const dbPath = path.join(__dirname, 'database.sqlite');
      if (fs.existsSync(dbPath)) {
        await bot.sendDocument(chatId, dbPath, {
          caption: '💾 <b>Archivo de Base de Datos SQLite (database.sqlite)</b>\n<i>Puedes abrirlo directamente en DB Browser for SQLite en tu PC.</i>',
          parse_mode: 'HTML'
        });
      } else {
        await bot.sendMessage(chatId, '❌ No se encontró el archivo de base de datos.');
      }
      return;
    }

    return;
  }

  // Si no es un comando con '/', procesar como texto de apuesta libre
  if (text.length > 5 && !text.startsWith('/')) {
    const statusMsg = await bot.sendMessage(chatId, '🔍 <i>Analizando texto de apuesta con IA...</i>', { parse_mode: 'HTML' });
    try {
      const extracted = await parseBetTextWithGeminiOrDeepSeek(text);
      const aiAnalysis = await generateTacticalAnalysisWithDeepSeek(extracted);
      extracted.ai_analysis = aiAnalysis;

      const betId = addBet({
        ticket_id: extracted.id_ticket,
        bookmaker: extracted.casa_apuestas || 'Desconocido',
        event_name: extracted.partido,
        sport: extracted.deporte || 'Fútbol',
        league: extracted.liga || 'N/D',
        market: extracted.mercado,
        odds: extracted.momio,
        stake: extracted.stake || 500,
        potential_payout: extracted.retorno_potencial,
        source: 'MANUAL_TEXT',
        ai_analysis: aiAnalysis,
        confidence_score: extracted.confianza_extraccion || 85,
        user_id: msg.from.id
      });

      const bank = getBankroll();
      await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
      await bot.sendMessage(chatId, formatBetCard(extracted, betId, bank), {
        parse_mode: 'HTML',
        reply_markup: getResolutionKeyboard(betId)
      });
    } catch (e) {
      await bot.editMessageText(`❌ No se pudo interpretar la apuesta: ${e.message}`, {
        chat_id: chatId,
        message_id: statusMsg.message_id
      }).catch(() => {});
    }
  }
});

// ----------------------------------------------------
// 🔘 MANEJO DE BOTONES INTERACTIVOS (CALLBACK QUERIES)
// ----------------------------------------------------
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  try {
    if (data === 'refresh_balance') {
      const bank = getBankroll();
      await bot.answerCallbackQuery(query.id, { text: `Saldo: $${bank.current_bank.toFixed(2)} MXN` });
      return;
    }

    if (data === 'view_pending') {
      await bot.answerCallbackQuery(query.id);
      const pending = getPendingBets(5);
      if (pending.length === 0) {
        return bot.sendMessage(chatId, '✅ No hay apuestas pendientes.');
      }
      for (const b of pending) {
        await bot.sendMessage(chatId, `⏳ <b>#${b.id} ${escapeHtml(b.event_name)}</b>\n${escapeHtml(b.market)} @${b.odds.toFixed(2)} · $${b.stake.toFixed(2)} MXN`, {
          parse_mode: 'HTML',
          reply_markup: getResolutionKeyboard(b.id)
        });
      }
      return;
    }

    const [action, betIdStr] = data.split('_');
    const betId = parseInt(betIdStr, 10);

    if (action === 'del') {
      deleteBet(betId);
      await bot.answerCallbackQuery(query.id, { text: `Apuesta #${betId} eliminada` });
      await bot.editMessageText(`🗑️ <i>Apuesta #${betId} eliminada del registro.</i>`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML'
      });
      return;
    }

    let newStatus = 'PENDING';
    if (action === 'won') newStatus = 'WON';
    else if (action === 'lost') newStatus = 'LOST';
    else if (action === 'void') newStatus = 'VOID';

    if (['WON', 'LOST', 'VOID'].includes(newStatus)) {
      const updated = updateBetStatus(betId, newStatus);
      const bank = getBankroll();

      const icon = newStatus === 'WON' ? '✅ GANADA' : newStatus === 'LOST' ? '❌ PERDIDA' : '⚪ ANULADA';
      const plText = updated.profit_loss !== null ? `(${updated.profit_loss >= 0 ? '+' : ''}$${updated.profit_loss.toFixed(2)} MXN)` : '';

      await bot.answerCallbackQuery(query.id, { text: `Apuesta #${betId}: ${icon} ${plText}` });

      const updatedText = `${query.message.text}\n\n━━━━━━━━━━━━━━━━━━━━\n<b>ESTADO FINAL:</b> ${icon} ${plText}\n🏦 <b>Nuevo Saldo:</b> $${bank.current_bank.toFixed(2)} MXN`;

      await bot.editMessageText(updatedText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] }
      }).catch(() => {});
    }

  } catch (err) {
    console.error('[CALLBACK ERROR]:', err);
    await bot.answerCallbackQuery(query.id, { text: `Error: ${err.message}`, show_alert: true });
  }
});

// ----------------------------------------------------
// ⏰ TAREA PROGRAMADA: AUTO-VERIFICACIÓN CADA 30 MIN
// ----------------------------------------------------
cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON] Ejecutando auto-verificación de apuestas pendientes...');
  try {
    const results = await autoVerifyPendingBets();
    if (results.length > 0) {
      console.log(`[CRON] ${results.length} apuestas liquidadas automáticamente.`);
    }
  } catch (e) {
    console.error('[CRON ERROR]:', e.message);
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { bot };
