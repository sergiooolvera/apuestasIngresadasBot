# Bitácora de Desarrollo - Estrategia Maestra de Apuestas Deportivas (Bank 10k -> 20k)

## Objetivo
Diseñar, estructurar y ejecutar una estrategia integral de inversión y gestión de bankroll ($10,000 iniciales -> objetivo $20,000 de balance total, +$10,000 de beneficio neto) aprovechando los 3 sistemas inteligentes desarrollados:
1. **`rojas y goles`**: Alertas en vivo con SafeOdds @1.60+, filtrado por reglas tácticas de élite y análisis profundo con DeepSeek Reasoner.
2. **`apuestasprepartido`**: Predictor pre-partido con boletines por bloques, módulos ofensivo (AA/Over 2.5) y defensivo (Under/BTTS NO) con DeepSeek Reasoner.
3. **`pronosticos_deportivos_yt`**: Analizador de consensos de 12 canales tipsters de YouTube con filtro crítico de "Abogado del Diablo" y recomendación de valor @1.72+.

---

## [2026-08-27] - Alineación Estratégica Completa (/grill-me) y Definición del Plan Maestro

### 1. Parámetros Financieros y de Gestión de Bankroll
- **Bankroll Inicial**: $10,000.00 MXN.
- **Objetivo Financiero**: $20,000.00 MXN (+100% ROI, +$10,000 de ganancia neta).
- **Modelo de Staking Dinámico por Volumen (Entre Semana vs Fin de Semana)**:
  - **Entre semana (Lunes a Jueves, bajo volumen 1-3 picks)**: Stake estándar del 4.5% - 5.0% ($450 - $500 por pick).
  - **Fin de semana (Viernes a Domingo, alto volumen 6-12 picks)**: 
    - **Opción A (Staking por Bloques Horarios Secuenciales)**: Mantener $500 apostando por bloques que no coincidan en la misma hora (máximo 3 partidos simultáneos). Conforme terminan los de la mañana, se reinvierte en los de la tarde.
    - **Opción B (Stake Reducido por Volumen Masivo)**: Si se meten 8+ picks simultáneos a la misma hora, reducir a media unidad ($250 - $300 por pick) para no sobrecargar el bankroll.
- **Recálculo Escalonado (Interés Compuesto)**: La unidad se recalcula cada lunes o al alcanzar hitos de +$2,500 de beneficio acumulado ($10,000 -> $12,500 -> $15,000 -> $17,500 -> $20,000).

### 2. Protocolo Operativo por Proyecto
- **`rojas y goles`**: Reglas 1, 2, 7 y Late Goal con Confianza $\ge 75\%$ y Momio $\ge 1.70$.
- **`apuestasprepartido`**: Picks simples masivos con Confianza $\ge 75\%$ y Momio $\ge 1.70$.
- **`pronosticos_deportivos_yt`**: Consensos fuertes de 3+ canales apoyados por DeepSeek Reasoner.

---

## [2026-08-27] - Implementación del Bot de Telegram (@apuestasIngresadasBot) & Publicación en GitHub

### Componentes Desarrollados:
1. **Base de Datos Persistente SQLite (`db.js`)**:
   - Tablas `bankroll_settings`, `bets` y `bankroll_transactions` con modo WAL de alto rendimiento.
   - Control en tiempo real de saldo libre, dinero en juego (`in_play`), ganancia neta, Win Rate, Yield y cálculo de progreso hacia la meta de $20,000 MXN.
2. **Motor de IA Multimodal Dual (`aiVisionService.js`)**:
   - **Gemini 2.5 Flash Vision**: OCR inteligente que lee capturas de pantalla de boletos de cualquier casa (Bet365, Caliente, Playdoit, Codere, etc.) y extrae partido, liga, mercado, momio decimal, stake y pago potencial en JSON estructurado.
   - **DeepSeek Reasoner (`deepseek-reasoner` / `deepseek-chat`)**: Análisis táctico, probabilidad estimada y justificación matemática de valor (+EV).
3. **Servicio de Verificación y Liquidación (`verifierService.js`)**:
   - Mapeo y evaluación automática de marcadores finales vía API-Sports (`API_SPORTS_KEY`) y reglas locales para liquidar apuestas en `WON` / `LOST` / `VOID`.
4. **Generador de Reportes Interactivos (`reportGenerator.js`)**:
   - Dashboard web interactivo en HTML (`reporte_bankroll.html`) con barra de progreso a la meta de $20,000, tarjetas métricas y tabla detallada de apuestas.
5. **Servidor y Gestor de Telegram (`index.js`)**:
   - Escucha en tiempo real de capturas de pantalla (fotos) y mensajes de texto libre.
   - Botones inline interactivos en cada jugada (`[✅ Ganada]`, `[❌ Perdida]`, `[⚪ Anulada]`, `[🗑️ Eliminar]`).
   - Comandos slash integrados: `/balance`, `/stats`, `/pendientes`, `/historial`, `/verificar`, `/reporte`, `/ajustar_bank`, `/ganada`, `/perdida`, `/anulada`.
   - Tarea programada (Cron cada 30 min) para auditoría y auto-verificación en segundo plano.
6. **Publicación y Despliegue**:
   - Código subido exitosamente a GitHub: `https://github.com/sergiooolvera/apuestasIngresadasBot` (rama `main`).
   - Listo para conexión directa en Railway.
