# Bitácora de Desarrollo - Estrategia Maestra de Apuestas Deportivas (Bank 5k -> 20k)

## Objetivo
Diseñar, estructurar y ejecutar una estrategia integral de inversión y gestión de bankroll ($5,000 iniciales activos con $5,000 de reserva -> objetivo $20,000 de balance total, con stake constante de $500 pesos por apuesta) aprovechando los 3 sistemas inteligentes desarrollados:
1. **`rojas y goles`**: Alertas en vivo con SafeOdds @1.60+, filtrado por reglas tácticas de élite y análisis profundo con DeepSeek Reasoner.
2. **`apuestasprepartido`**: Predictor pre-partido con boletines por bloques, módulos ofensivo (AA/Over 2.5) y defensivo (Under/BTTS NO) con DeepSeek Reasoner.
3. **`pronosticos_deportivos_yt`**: Analizador de consensos de 12 canales tipsters de YouTube con filtro crítico de "Abogado del Diablo" y recomendación de valor @1.72+.

---

## [2026-08-27] - Alineación Estratégica Completa (/grill-me) y Definición del Plan Maestro

### 1. Parámetros Financieros y de Gestión de Bankroll
- **Bankroll Inicial Activo**: $5,000.00 MXN.
- **Reserva de Seguridad**: $5,000.00 MXN en respaldo.
- **Objetivo Financiero**: $20,000.00 MXN (Multiplicar x4 el Bank Activo).
- **Modelo de Stake Fijo**: **$500.00 MXN constantes por pick**.
- **Manejo de Volumen**:
  - **Entre semana (Lunes a Jueves, bajo volumen 1-3 picks)**: Stake estándar de $500.00 MXN.
  - **Fin de semana (Viernes a Domingo, alto volumen 6-12 picks)**: 
    - **Opción A (Staking por Bloques Horarios Secuenciales)**: Mantener $500 apostando por bloques que no coincidan en la misma hora (máximo 2-3 partidos simultáneos). Conforme terminan los de la mañana, se reinvierte en los de la tarde.
    - **Opción B (Stake Reducido por Volumen Masivo)**: Si se meten 6+ picks simultáneos a la misma hora, reducir a $250 por pick para no sobrecargar el bankroll.

### 2. Protocolo Operativo por Proyecto
- **`rojas y goles`**: Reglas 1, 2, 7 y Late Goal con Confianza $\ge 75\%$ y Momio $\ge 1.70$.
- **`apuestasprepartido`**: Picks simples masivos con Confianza $\ge 75\%$ y Momio $\ge 1.70$.
- **`pronosticos_deportivos_yt`**: Consensos fuertes de 3+ canales apoyados por DeepSeek Reasoner.

---

## [2026-08-27] - Implementación del Bot de Telegram (@apuestasIngresadasBot) & Publicación en GitHub

### Componentes Desarrollados:
1. **Base de Datos Persistente SQLite (`db.js`)**:
   - Tablas `bankroll_settings`, `bets` y `bankroll_transactions` con modo WAL de alto rendimiento.
   - Sincronización de `INITIAL_BANKROLL=5000.00` y `DEFAULT_STAKE_AMOUNT=500.00`.
   - Control en tiempo real de saldo libre, dinero en juego (`in_play`), ganancia neta, Win Rate, Yield y cálculo de progreso hacia la meta de $20,000 MXN.
2. **Motor de IA Multimodal Dual (`aiVisionService.js`)**:
   - **Gemini 2.5 Flash Vision**: OCR inteligente que lee capturas de pantalla de boletos de cualquier casa (Bet365, Caliente, Playdoit, Codere, etc.) y extrae partido, liga, mercado, momio decimal, stake y pago potencial en JSON estructurado (fallback stake: $500.0).
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
   - Listo para conexión directa en Railway con `INITIAL_BANKROLL=5000.00` y `DEFAULT_STAKE_AMOUNT=500.00`.
