const axios = require('axios');
const { getPendingBets, updateBetStatus, db } = require('./db');
require('dotenv').config();

const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '7bc03cebb119e1c8a95a85ba1432f038';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';

/**
 * Evalúa si una apuesta resultó ganada o perdida dado el marcador final y el mercado
 */
function evaluateOutcomeLocally(market, scoreFinal) {
  if (!scoreFinal || !scoreFinal.includes('-')) return null;

  const parts = scoreFinal.split('-').map(s => parseInt(s.trim(), 10));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;

  const [h, a] = parts;
  const totalGoals = h + a;
  const btts = (h > 0 && a > 0);
  const m = market.toLowerCase();

  // Ambos Anotan y Over 2.5
  if ((m.includes('ambos') || m.includes('btts') || m.includes('aa')) && (m.includes('2.5') || m.includes('over 2.5') || m.includes('más de 2.5'))) {
    return (btts && totalGoals > 2.5) ? 'WON' : 'LOST';
  }

  // Ambos Anotan (BTTS)
  if (m.includes('ambos anotan') || m.includes('btts') || m === 'aa' || m.includes('ambos marcan')) {
    if (m.includes('no')) {
      return !btts ? 'WON' : 'LOST';
    }
    return btts ? 'WON' : 'LOST';
  }

  // Over 2.5
  if (m.includes('más de 2.5') || m.includes('over 2.5') || m.includes('+2.5')) {
    return totalGoals > 2.5 ? 'WON' : 'LOST';
  }

  // Under 2.5
  if (m.includes('menos de 2.5') || m.includes('under 2.5') || m.includes('-2.5')) {
    return totalGoals < 2.5 ? 'WON' : 'LOST';
  }

  // Over 1.5
  if (m.includes('más de 1.5') || m.includes('over 1.5') || m.includes('+1.5')) {
    return totalGoals > 1.5 ? 'WON' : 'LOST';
  }

  // Under 1.5
  if (m.includes('menos de 1.5') || m.includes('under 1.5') || m.includes('-1.5')) {
    return totalGoals < 1.5 ? 'WON' : 'LOST';
  }

  // Over 0.5
  if (m.includes('más de 0.5') || m.includes('over 0.5') || m.includes('+0.5')) {
    return totalGoals > 0.5 ? 'WON' : 'LOST';
  }

  // 1X2 / Ganador
  if (m.includes('gana local') || m.includes('1') && !m.includes('x')) {
    return h > a ? 'WON' : 'LOST';
  }
  if (m.includes('gana visita') || m.includes('visitante') || m.includes('2')) {
    return a > h ? 'WON' : 'LOST';
  }
  if (m.includes('empate') || m.includes('tie') || m.includes('draw')) {
    return h === a ? 'WON' : 'LOST';
  }

  return null;
}

/**
 * Consulta API-Sports para buscar el resultado de un partido
 */
async function searchMatchResultApiSports(eventName) {
  if (!API_SPORTS_KEY) return null;
  const teams = eventName.split(/vs|v\.|-|–/i).map(t => t.trim());
  if (teams.length < 2) return null;

  const home = teams[0];
  const away = teams[1];

  try {
    // Buscar fixtures recientes con el nombre del equipo local
    const url = `https://v3.football.api-sports.io/fixtures?date=${new Date().toISOString().slice(0, 10)}`;
    const res = await axios.get(url, {
      headers: { 'x-apisports-key': API_SPORTS_KEY },
      timeout: 8000
    });

    const fixtures = res.data?.response || [];
    for (const fix of fixtures) {
      const fHome = fix.teams?.home?.name || '';
      const fAway = fix.teams?.away?.name || '';
      const statusShort = fix.fixture?.status?.short;

      if ((fHome.toLowerCase().includes(home.toLowerCase()) || home.toLowerCase().includes(fHome.toLowerCase())) &&
          (fAway.toLowerCase().includes(away.toLowerCase()) || away.toLowerCase().includes(fAway.toLowerCase()))) {
        
        if (['FT', 'AET', 'PEN'].includes(statusShort)) {
          const hGoals = fix.goals?.home ?? 0;
          const aGoals = fix.goals?.away ?? 0;
          return `${hGoals}-${aGoals}`;
        }
      }
    }
  } catch (e) {
    console.warn('[API-SPORTS SEARCH ERROR]:', e.message);
  }

  return null;
}

/**
 * Verifica automáticamente las apuestas pendientes
 */
async function autoVerifyPendingBets() {
  const pending = getPendingBets(30);
  const results = [];

  for (const bet of pending) {
    try {
      const score = await searchMatchResultApiSports(bet.event_name);
      if (score) {
        const outcome = evaluateOutcomeLocally(bet.market, score);
        if (outcome) {
          const updated = updateBetStatus(bet.id, outcome, null, score);
          results.push(updated);
        }
      }
    } catch (err) {
      console.error(`Error verificando apuesta #${bet.id}:`, err.message);
    }
  }

  return results;
}

module.exports = {
  autoVerifyPendingBets,
  evaluateOutcomeLocally,
  searchMatchResultApiSports
};
