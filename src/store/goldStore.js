/**
 * goldStore.js — Zustand store para la Alarma de Rebote en Soporte Alcista
 *
 * Estado persistido en localStorage (clave: 'gold-bounce-alarm'):
 *   supportLevel   → el precio de soporte que el usuario configura
 *   isAlarmActive  → si el monitoreo está activo
 *
 * Estado efímero (solo sesión):
 *   triggeredAlarms → historial de las últimas 10 alarmas disparadas
 *
 * Lógica de detección:
 *   prevPrice < supportLevel  AND  currentPrice >= supportLevel
 *   → Cruce alcista desde abajo del nivel de soporte → rebote confirmado
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useGoldStore = create(
  persist(
    (set, get) => ({
      // ── Estado persistido ──────────────────────────────────────────────
      supportLevel:  3300,   // número: nivel de soporte en USD (default razonable)
      isAlarmActive: false,  // boolean: si el monitoreo está activo

      // ── Estado efímero (no se persiste) ───────────────────────────────
      triggeredAlarms: [],   // [{ price: number, triggeredAt: number (ms) }]

      // ── Acciones ───────────────────────────────────────────────────────

      /** Actualiza el nivel de soporte. Llamar con el valor debounced del input. */
      setSupportLevel: (level) => set({ supportLevel: level }),

      /** Activa/desactiva la alarma. Llamar desde el toggle switch. */
      toggleAlarm: () =>
        set((state) => ({ isAlarmActive: !state.isAlarmActive })),

      /** Setter directo (útil para programmatic control). */
      setAlarmActive: (bool) => set({ isAlarmActive: bool }),

      /**
       * Registra una alarma disparada en el historial (últimas 10).
       * Llamado internamente por checkBounceAlarm.
       */
      recordTriggeredAlarm: (price) =>
        set((state) => ({
          triggeredAlarms: [
            { price, triggeredAt: Date.now() },
            ...state.triggeredAlarms,
          ].slice(0, 10),
        })),

      /**
       * Verifica si se cumple la condición de rebote alcista.
       *
       * Condición: precio anterior estaba POR DEBAJO del soporte
       *            Y precio actual está EN O POR ENCIMA del soporte.
       *
       * Retorna true si la alarma fue disparada (el llamador debe
       * mostrar el toast y la notificación del browser).
       *
       * @param {number|null} previousPrice
       * @param {number} currentPrice
       * @returns {boolean}
       */
      checkBounceAlarm: (previousPrice, currentPrice) => {
        const { supportLevel, isAlarmActive } = get();

        // Guardia: alarma inactiva o primer tick (sin precio previo)
        if (!isAlarmActive) return false;
        if (previousPrice === null || previousPrice === undefined) return false;
        if (!supportLevel || supportLevel <= 0) return false;

        const bounced =
          previousPrice < supportLevel && currentPrice >= supportLevel;

        if (bounced) {
          get().recordTriggeredAlarm(currentPrice);
        }

        return bounced;
      },
    }),
    {
      name: 'gold-bounce-alarm',   // clave de localStorage
      partialize: (state) => ({    // solo persistir estos campos
        supportLevel:  state.supportLevel,
        isAlarmActive: state.isAlarmActive,
      }),
    }
  )
);
