# 🚀 ESTRATEGIA MAESTRA DE APUESTAS DEPORTIVAS: RUTA $10,000 ➔ $20,000

---

## 🎯 1. OBJETIVO Y PARÁMETROS FINANCIEROS

* **Capital Inicial (Bankroll):** `$10,000.00 MXN`
* **Objetivo de Beneficio Neto:** `+$10,000.00 MXN` (Meta: Alcanzar `$20,000.00 MXN`)
* **Modelo de Staking Dinámico por Volumen:**
  * **Lunes a Jueves (Bajo volumen, 1 a 3 picks diarios):** Stake completo de **`4.5% - 5.0%`** (`$450.00 - $500.00 MXN` por pick).
  * **Viernes a Domingo (Alto volumen, 6 a 12+ picks diarios):**
    * **Estrategia por Bloques Horarios Secuenciales (Recomendada):** Mantener `$500.00 MXN` por pick pero apostando de forma escalonada por horario (máximo 3 partidos simultáneos en juego). Al liquidarse los partidos matutinos, se reinvierte en la tarde.
    * **Estrategia de Stake Dividido:** Si se meten 8 o más partidos que juegan al mismo tiempo, apostar **`$250.00 - $300.00 MXN`** por pick para blindar el capital.
* **Recálculo Escalonado (Interés Compuesto):** Se recalcula el valor del stake cada **lunes por la mañana** o cada vez que el bank sume **+$2,500 MXN** de beneficio neto:
  * **Fase 1 ($10,000 - $12,499):** Stake = `$450 - $500` por pick.
  * **Fase 2 ($12,500 - $14,999):** Stake = `$600` por pick.
  * **Fase 3 ($15,000 - $17,499):** Stake = `$700` por pick.
  * **Fase 4 ($17,500 - $19,999):** Stake = `$800 - $850` por pick.
  * **Meta ($20,000+):** Objetivo cumplido.

---

## 🧩 2. ESTRATEGIA OPERATIVA POR SISTEMA

### 🔴 PROYECTO 1: `rojas y goles` (Alertas en Vivo)
* **Canal/Bot:** Telegram en tiempo real (`index.js`).
* **Horario de Monitoreo:** Activo de 07:00 a 21:00 hrs CDMX.
* **Reglas de Élite Autorizadas (Histórico >80%-90% Win Rate):**
  1. **Regla 1 (Tarjeta Roja Estratégica):** Minuto 35 a 72 con expulsión para un equipo y el favorito empatando o perdiendo. *(Win rate histórico: >90%)*.
  2. **Regla 7 (Partido Caliente / Tarjetas):** Encuentros con alto índice de fricción en copas y derbis. *(Win rate histórico: >90%)*.
  3. **Regla 2 (Favorito Sufre en HT):** Minuto 45 a 55 con claro dominio pero marcador empatado o perdiendo. *(Win rate histórico: ~80%)*.
  4. **Regla 4 (Asedio Intenso / Late Goal):** Minuto 75 a 83 con ráfaga de ataques (disparo inmediato).
* **Filtros Obligatorios de Entrada:**
  * **Confianza de DeepSeek Reasoner:** $\ge 75\%$.
  * **Momio Objetivo:** $\ge @1.70$. *(Aprovechar SafeOdds @1.60+ o esperar 2-3 minutos en vivo a que la cuota alcance @1.70 - @1.85)*.

---

### 📅 PROYECTO 2: `apuestasprepartido` (Boletines Diarios)
* **Horarios de Boletín:** 
  * 🌅 **06:00 CDMX:** Partidos de 8:00 a 10:00 hrs.
  * ☀️ **10:00 CDMX:** Partidos de 11:00 a 13:00 hrs.
  * 🌆 **13:00 CDMX:** Partidos de 14:00 a 17:00 hrs.
  * 🌙 **17:00 CDMX:** Partidos de 18:00 a 23:00 hrs.
* **Modo Operativo:** **Picks Simples Masivos**
  * Colocar una apuesta simple independiente a **CADA pick del boletín** que cumpla:
    * **Confianza IA DeepSeek:** $\ge 75\%$.
    * **Momio:** $\ge @1.70$ (Ambos Anotan, Over 2.5, combinada AA + Over 2.5, o selecciones Under del módulo defensivo con valor).
  * *(Win rate verificado del sistema: **80.65%**)*.

---

### 📺 PROYECTO 3: `pronosticos_deportivos_yt` (Consensos YouTube)
* **Hora de Publicación/Ejecución:** 10:00 AM CDMX (`ejecutar_analisis.bat` / Web Vercel).
* **Criterio de Ejecución:** **Consensos Fuertes de 3+ Canales**.
* **Protocolo:**
  * Identificar en el reporte web o boletín de Telegram los partidos donde coincidan **3 o más tipsters**.
  * Apostar a la línea de consenso en simple con el stake asignado de la jornada.
  * Utilizar el dictamen del *Abogado del Diablo (DeepSeek Reasoner)* para validar alertas y confirmar cuotas de valor $\ge @1.72$.

---

## 📊 3. MATEMÁTICAS Y PROYECCIÓN DE CRECIMIENTO

| Métrica | Valor Estimado |
| :--- | :--- |
| **Cuota Media Ponderada** | `@1.78 - @1.85` |
| **Win Rate Esperado Combinado** | `~75.0%` |
| **Beneficio Neto Medio por Acierto** | `+$380.00 MXN` (a stake $480) |
| **Pérdida por Desacierto** | `-$480.00 MXN` |
| **Valor Esperado (EV) por Apuesta** | `+0.35 Unidades (+35.0% ROI/Yield)` |
| **Volumen Diario Estimado** | `3 a 5 picks calificados` |
| **Aciertos Netos Necesarios** | `~22 a 26 apuestas ganadas netas` |
| **Tiempo Estimado de Ejecución** | **12 a 18 días de operación disciplinada** |

---

## 🛡️ 4. REGLAS DE ORO DE DISCIPLINA

1. **Cero Tilt / Venganza:** Jamás aumentar el stake tras un fallo para "recuperar". El tamaño del stake solo se mueve en las revisiones escalonadas.
2. **Gestión de Volumen de Fin de Semana:** Si hay 8 o más partidos el sábado o domingo, usar la técnica de **Bloques Horarios Secuenciales** (liberar saldo por horarios) o reducir a **$250 - $300 por pick** para no sobreexponer el bankroll simultáneamente.
3. **Registro Diario:** Anotar cada apuesta, momio real obtenido y resultado en la bitácora para monitorear el yield en tiempo real.
