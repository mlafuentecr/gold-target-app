# Gold Target App

Dashboard para monitorear `XAU/USD` con precio live, targets, pivot points, alertas de precio y alarma de rebote en soporte.

## Sitio

- Repositorio: [https://github.com/mlafuentecr/gold-target-app](https://github.com/mlafuentecr/gold-target-app)
- URL pública: pendiente de confirmar

## Funcionalidades

- Precio live de oro usando TwelveData.
- Indicadores técnicos por timeframe: `RSI`, `EMA 9`, `EMA 21`.
- Cálculo de `bullish target`, `bearish target`, rango y pivot points.
- Alertas de precio persistidas localmente.
- Alarma de rebote en soporte con notificaciones del navegador.
- Refresh manual y polling automático cuando el mercado está activo.

## Stack

- React 19
- Vite
- Tailwind CSS 4
- Zustand
- Sonner

## Variables de entorno

El proyecto usa un archivo `.env` en la raíz:

```env
VITE_TWELVE_API_KEY=tu_twelve_data_key
```

## Desarrollo local

```bash
npm install
npm run dev
```

La app abre por defecto en:

```text
http://localhost:5173
```

## Build

```bash
npm run build
npm run preview
```

## Estructura principal

- `src/api`: integración con proveedores de datos.
- `src/hooks/useGoldTarget.js`: orquestación principal de precio, indicadores y alertas.
- `src/pages/Dashboard.jsx`: UI principal.
- `src/store/goldStore.js`: estado global para la alarma de soporte.
- `src/utils`: formato, validaciones, alertas y helpers de mercado.

## Notas

- TwelveData entrega precio live, OHLC diario e indicadores de `XAU/USD`.
