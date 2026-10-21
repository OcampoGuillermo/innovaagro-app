# InnovaAgro-App

Mercado directo entre productores de Formosa y consumidores. La app incluye
catálogo de temporada, cuentas, pedidos persistentes, panel de productor,
stock, perfiles públicos, favoritos, capacitación y contacto por WhatsApp.

Es una aplicación web con servidor propio: Node.js + Express + SQLite. No es
un HTML con datos en `localStorage` y no procesa pagos online.

## Requisitos

- Node.js **24 o superior** (usa `node:sqlite`).
- npm.
- Un navegador moderno.

## Arrancar en tu computadora

```bash
npm install
npm start
```

Abrí <http://localhost:3000>.

Para desarrollo con recarga del servidor:

```bash
npm run dev
```

La primera ejecución crea `data/innovaagro.db` y carga el catálogo inicial.
No hace falta configurar nada más.

## Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Compradora | `demo@innovaagro.app` | `demo1234` |
| Productor | `finca@innovaagro.app` | `demo1234` |

Los nueve productores iniciales tienen cuenta con la misma contraseña:
`cooperativa@`, `apiario@`, `quesos@`, `huerta@`, `artesanas@`, `frutas@`,
`ribera@` y `verde@innovaagro.app`.

Estas cuentas y el catálogo inicial son contenido de demostración. Cambiá las
contraseñas o no las crees en una instalación real.

## Qué es real y qué es de ejemplo

- **Real en este servidor:** cuentas nuevas, pedidos nuevos, stock, favoritos,
  perfiles editados, avance de capacitación, canasta y preferencias.
- **De ejemplo:** los nueve productores iniciales, los 23 productos, sus
  precios, las rutas, los puntos de retiro, los siete pedidos iniciales y las
  fotografías de referencia.
- **No implementado:** cobros online, transferencias automáticas, logística,
  facturación, recuperación de contraseña y notificaciones push.
- El pago se coordina por WhatsApp: efectivo, transferencia o Mercado Pago.
  La app solo registra la preferencia.

Antes de abrirla al público, reemplazá los datos de ejemplo, revisá los créditos
de las fotos y publicá una política de privacidad con un contacto real.

## Funciones principales

**Comprador:** catálogo con búsqueda, filtros y orden; detalle con sello de
origen y lote; historias de productores; favoritos; canasta; retiro o envío;
pedidos divididos por productor; WhatsApp; rutas; capacitación.

**Productor:** panel con métricas; alta y edición de productos; stock; pausa;
foto; pedidos y cambios de estado; perfil público y WhatsApp; capacitación;
constructor de pitch.

**PWA:** se puede instalar en Android/iOS. El catálogo y la última copia de los
datos quedan disponibles sin conexión. Las acciones de cuenta, pedidos, stock y
pagos requieren conexión.

## Estructura

```text
public/            Frontend (SPA vanilla, CSS, PWA, imágenes)
server/            Express, SQLite, autenticación y API
shared/            Catálogo, rutas, cursos y pedidos iniciales (JSON)
data/              Base SQLite (se crea sola; no se versiona)
public/uploads/    Fotos subidas por productores (no se versionan)
tools/             Utilidades de desarrollo y pruebas; no es parte de la app
PRODUCT.md         Brief de producto y criterios de diseño
GUIA-PUBLICACION.md Guía de despliegue, respaldo y límites
```

## Variables de entorno

| Variable | Para qué sirve |
| --- | --- |
| `PORT` | Puerto HTTP. Por defecto `3000`. |
| `DATA_DIR` | Carpeta persistente de la base. Por defecto `data/`. |
| `UPLOADS_DIR` | Carpeta persistente de fotos subidas. Por defecto `public/uploads/`. |
| `SEED_CATALOG` | `false` evita cargar el catálogo de ejemplo en el primer arranque. |
| `SEED_DEMO` | `false` evita crear cuentas y pedidos de ejemplo. |
| `COOKIE_SECURE` | `true` agrega `Secure` a la cookie de sesión. Obligatorio con HTTPS. |
| `TRUST_PROXY` | `true` si hay un proxy inverso delante de Node. |
| `NODE_ENV` | `production` activa caché de assets estáticos. |

Copiá `.env.example` a `.env` para usarlas localmente. `.env` no se versiona.

## Verificación rápida

```bash
npm run check
curl http://localhost:3000/api/health
```

## Publicación

Seguí [GUIA-PUBLICACION.md](GUIA-PUBLICACION.md). Necesitás un hosting que
ejecute Node de forma continua y ofrezca disco persistente. GitHub Pages,
Netlify estático o cualquier hosting solo-estático **no** sirven para esta app,
porque la API y SQLite necesitan un proceso y un disco.

## Privacidad y seguridad

- Contraseñas con `scrypt`; sesiones con cookie `HttpOnly` y `SameSite=Lax`.
- Validación de origen para escrituras, CSP y límite de intentos de login.
- Los pedidos se validan contra stock y precios del servidor dentro de una
  transacción.
- No se usan analítica, publicidad ni cookies de terceros.
- Hacé respaldos de `DATA_DIR` y de `UPLOADS_DIR` (por defecto `public/uploads/`).

Las fotografías provienen de Wikimedia Commons con licencias abiertas. Los
créditos están en `public/js/data.js` y en la pantalla **Acerca de**.
