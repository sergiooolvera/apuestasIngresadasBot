const axios = require('axios');
require('dotenv').config();

const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

let currentGeminiKeyIndex = 0;

function getNextGeminiKey() {
  if (GEMINI_KEYS.length === 0) return null;
  const key = GEMINI_KEYS[currentGeminiKeyIndex];
  currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % GEMINI_KEYS.length;
  return key;
}

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';

/**
 * Analiza una captura de pantalla de boleto de apuesta usando Gemini Vision (Multimodal).
 * Extrae casa de apuestas, partido, mercado, momio, stake y ganancia potencial en JSON estructurado.
 */
async function parseBetImageWithGemini(imageBuffer, mimeType = 'image/jpeg') {
  const base64Data = imageBuffer.toString('base64');
  const apiKey = getNextGeminiKey();

  if (!apiKey) {
    throw new Error('No se configuraron claves de GEMINI_API_KEYS en el archivo .env');
  }

  const prompt = `Eres un sistema OCR y analista experto de apuestas deportivas.
Tu objetivo es leer minuciosamente la captura de pantalla del boleto de apuesta adjunto y extraer todos los datos clave en formato JSON EXACTO.

Instrucciones de Extracción:
1. "casa_apuestas": Nombre de la casa de apuestas visible (ej. Bet365, Caliente.mx, Codere, Betano, Playdoit, 1xBet, Novibet, etc., o "Desconocido").
2. "partido": Nombres completos de los equipos o rivales (ej. "Real Madrid vs Barcelona", "Chivas vs América", "New York Yankees vs Boston Red Sox").
3. "deporte": Deporte ("Fútbol", "Béisbol", "Básquetbol", "Fútbol Americano", "Tenis", etc.).
4. "liga": Liga o torneo (ej. "LaLiga", "Liga MX", "Premier League", "MLB", etc., o "N/D").
5. "mercado": Mercado exacto de la apuesta (ej. "Ambos Anotan - Sí", "Más de 2.5 Goles", "Ganador del Partido (1X2) - Real Madrid", "Línea de Carreras -1.5", etc.).
6. "momio": Cuota en formato DECIMAL (ej. si está en formato americano como -110 -> 1.91, +150 -> 2.50, si es decimal como 1.85 -> 1.85).
7. "stake": Importe o monto apostado en número flotante (ej. 500.0). Si no aparece visible en la imagen, asigna 500.0 por defecto.
8. "retorno_potencial": Pago total estimado en número flotante (ej. 925.0). Si no es visible, calcula (momio * stake).
9. "tipo": "Simple" o "Combinada / Parlay".
10. "id_ticket": Número de referencia o ID del boleto si es visible, o null.
11. "confianza_extraccion": Porcentaje entero de legibilidad de la imagen (ej. 90).

Responde ÚNICAMENTE en formato JSON plano sin bloques markdown ni texto adicional:
{
  "casa_apuestas": "...",
  "partido": "...",
  "deporte": "...",
  "liga": "...",
  "mercado": "...",
  "momio": 1.85,
  "stake": 500.0,
  "retorno_potencial": 925.0,
  "tipo": "Simple",
  "id_ticket": "...",
  "confianza_extraccion": 90
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1000
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000
    });

    const candidate = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = candidate.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return parsed;
  } catch (error) {
    console.error('[GEMINI OCR ERROR]:', error.response?.data || error.message);
    throw new Error(`Fallo en el reconocimiento de imagen con IA: ${error.message}`);
  }
}

/**
 * Parsea un texto libre de apuesta (ej. "Over 2.5 Chivas vs America @ 1.90 $500")
 */
async function parseBetTextWithGeminiOrDeepSeek(inputText) {
  const prompt = `Analiza el siguiente texto de apuesta deportiva y extrae los datos en JSON plano:
Texto: "${inputText}"

Responde ÚNICAMENTE en JSON con esta estructura:
{
  "casa_apuestas": "Desconocido",
  "partido": "Equipo Local vs Equipo Visitante",
  "deporte": "Fútbol",
  "liga": "N/D",
  "mercado": "Descripción de la selección",
  "momio": 1.80,
  "stake": 500.0,
  "retorno_potencial": 900.0,
  "tipo": "Simple",
  "confianza_extraccion": 85
}`;

  if (DEEPSEEK_KEY) {
    try {
      const response = await axios.post(
        'https://api.deepseek.com/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const content = response.data?.choices?.[0]?.message?.content || '';
      const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.warn('[DEEPSEEK TEXT ERROR, fallback a Gemini]:', e.message);
    }
  }

  // Fallback Gemini
  const apiKey = getNextGeminiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1 }
  });
  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim());
}

/**
 * Genera una evaluación táctica con DeepSeek Reasoner para la apuesta registrada.
 */
async function generateTacticalAnalysisWithDeepSeek(betData) {
  if (!DEEPSEEK_KEY) {
    return 'Apuesta registrada y agregada al control del bankroll.';
  }

  const prompt = `Actúa como un Analista de Apuestas Cuantitativo y Gestor de Bankroll.
Se acaba de ingresar la siguiente apuesta:
- Evento: ${betData.partido || betData.event_name}
- Deporte/Liga: ${betData.deporte || 'Fútbol'} (${betData.liga || 'N/D'})
- Mercado: ${betData.mercado || betData.market}
- Momio: @${betData.momio || betData.odds}
- Stake: $${betData.stake} MXN

Proporciona un veredicto y análisis táctico profesional ultra conciso (máximo 2 oraciones) indicando el valor (+EV) y una recomendación clave de seguimiento.`;

  try {
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-reasoner',
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content || '';
    return reply.trim();
  } catch (error) {
    // Fallback con deepseek-chat si reasoner está saturado
    try {
      const responseFallback = await axios.post(
        'https://api.deepseek.com/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
      return responseFallback.data?.choices?.[0]?.message?.content?.trim() || 'Apuesta verificada con IA.';
    } catch (e2) {
      return 'Apuesta registrada en la base de datos de control.';
    }
  }
}

module.exports = {
  parseBetImageWithGemini,
  parseBetTextWithGeminiOrDeepSeek,
  generateTacticalAnalysisWithDeepSeek
};
