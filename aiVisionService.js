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

const Tesseract = require('tesseract.js');

const VISION_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.7-flash'
];

/**
 * Procesa la imagen mediante OCR local (Tesseract) y estructura los datos con DeepSeek.
 * Sirve de respaldo total cuando las APIs de visión externa no responden.
 */
async function parseBetImageWithOcrAndDeepSeek(imageBuffer) {
  console.log('[FALLBACK] Iniciando reconocimiento OCR local con Tesseract...');
  try {
    const { data: { text } } = await Tesseract.recognize(
      imageBuffer,
      'spa+eng',
      { logger: () => {} }
    );

    if (!text || text.trim().length < 5) {
      throw new Error('El OCR no detectó texto legible en la imagen.');
    }

    console.log('[FALLBACK] Texto OCR extraído con éxito. Estructurando con DeepSeek...');
    const prompt = `Eres un sistema experto en apuestas deportivas. A continuación se muestra el texto extraído por OCR de una captura de pantalla de boleto de apuesta:
"""
${text}
"""

Extrae minuciosamente todos los datos y responde ÚNICAMENTE con un JSON plano y válido con el siguiente formato exacto (sin texto adicional ni bloques markdown):
{
  "casa_apuestas": "Nombre de la casa de apuestas (ej. Bet365, Caliente, Codere, o Desconocido)",
  "partido": "Nombre de los equipos (ej. Real Madrid vs Barcelona)",
  "deporte": "Fútbol u otro deporte",
  "liga": "Nombre del torneo o N/D",
  "mercado": "Mercado exacto (ej. Menos de 5.5 Goles, Over 2.5, Ambos Anotan)",
  "momio": 1.80,
  "stake": 500.0,
  "retorno_potencial": 900.0,
  "tipo": "Simple",
  "id_ticket": null,
  "confianza_extraccion": 80
}`;

    if (DEEPSEEK_KEY) {
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
          timeout: 20000
        }
      );

      const candidate = response.data?.choices?.[0]?.message?.content || '';
      const cleaned = candidate.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      parsed.source_method = 'OCR_TESSERACT_DEEPSEEK';
      return parsed;
    }
  } catch (err) {
    console.error('[OCR DEEPSEEK FALLBACK ERROR]:', err.message);
  }
  return null;
}

/**
 * Analiza una captura de pantalla de boleto de apuesta usando Gemini Vision (Multimodal)
 * con fallback automático a OCR Local + DeepSeek.
 */
async function parseBetImageWithGemini(imageBuffer, mimeType = 'image/png') {
  const base64Data = imageBuffer.toString('base64');

  const prompt = `Eres un sistema OCR y analista experto de apuestas deportivas.
Tu objetivo es leer minuciosamente la captura de pantalla del boleto de apuesta adjunto y extraer todos los datos clave en formato JSON EXACTO.

Instrucciones de Extracción:
1. "casa_apuestas": Nombre de la casa de apuestas visible (ej. Bet365, Caliente.mx, Codere, Betano, Playdoit, 1xBet, Novibet, etc., o "Desconocido").
2. "partido": Nombres completos de los equipos o rivales (ej. "Real Madrid vs Barcelona", "Alemannia am. vs. Karlsruher am.", "Chivas vs América").
3. "deporte": Deporte ("Fútbol", "Béisbol", "Básquetbol", "Fútbol Americano", "Tenis", etc.).
4. "liga": Liga o torneo (ej. "LaLiga", "Liga MX", "Premier League", "MLB", etc., o "N/D").
5. "mercado": Mercado exacto de la apuesta (ej. "Menos de 5.5 Goles", "Ambos Anotan - Sí", "Más de 2.5 Goles", "Ganador del Partido (1X2) - Real Madrid").
6. "momio": Cuota en formato DECIMAL (ej. 1.56, 1.85, etc.).
7. "stake": Importe o monto apostado en número flotante (ej. 10.0, 500.0). Si no aparece visible en la imagen, asigna 500.0 por defecto.
8. "retorno_potencial": Pago total estimado en número flotante (ej. 15.60). Si no es visible, calcula (momio * stake).
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
  "momio": 1.56,
  "stake": 10.0,
  "retorno_potencial": 15.60,
  "tipo": "Simple",
  "id_ticket": null,
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

  let lastError = null;

  // 1. Intentar con Gemini Vision (modelos actualizados y rotación de claves)
  if (GEMINI_KEYS.length > 0) {
    for (const model of VISION_MODELS) {
      for (let i = 0; i < GEMINI_KEYS.length; i++) {
        const apiKey = getNextGeminiKey();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        try {
          const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
          });

          const candidate = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleaned = candidate.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          parsed.source_method = `GEMINI_VISION_${model}`;
          return parsed;
        } catch (error) {
          lastError = error.response?.data?.error?.message || error.message;
          console.warn(`[GEMINI RETRY] Modelo ${model} falló: ${lastError}`);
        }
      }
    }
  }

  // 2. Si todos los modelos de Gemini fallan, activar respaldo OCR Local + DeepSeek
  console.log('[GEMINI FAILED] Activando respaldo OCR + DeepSeek...');
  const ocrDeepSeekResult = await parseBetImageWithOcrAndDeepSeek(imageBuffer);
  if (ocrDeepSeekResult && (ocrDeepSeekResult.partido || ocrDeepSeekResult.mercado)) {
    return ocrDeepSeekResult;
  }

  throw new Error(`No se pudo procesar la imagen con Gemini Vision ni con OCR DeepSeek: ${lastError}`);
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
  for (const model of VISION_MODELS) {
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const apiKey = getNextGeminiKey();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 }
        }, { timeout: 15000 });
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim());
      } catch (e) {
        console.warn(`[GEMINI TEXT RETRY] ${model}: ${e.message}`);
      }
    }
  }

  throw new Error('No se pudo procesar el texto con ningún proveedor de IA.');
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
