# UVECOE

Aplicación de escritorio para evaluar estaciones de un ECOE con soporte offline.

- Electron + React + Vite.
- SQLite local con Knex y `better-sqlite3`.
- Sincronización de respuestas contra un backend FastAPI.
- Login online y login offline con hash bcrypt.

La guía técnica completa está en [`agents.md`](./agents.md).

## Requisitos

- Node.js 20 o superior.
- npm.
- Backend FastAPI accesible desde el portátil.
- La URL del servidor debe ser la de Caddy/nginx (por ejemplo `https://ecoe.midominio.es`),
  no el puerto `8000` directo: el cronómetro usa `/socket.io` en el mismo origen.
- El servidor debe permitir en `CORS_ORIGINS` los orígenes de la app:
  `http://localhost:5173`, `http://127.0.0.1:5173` en desarrollo y `null` para la app
  empaquetada con `file://`.
- En producción usa HTTPS. Con `webSecurity` activo, Chromium puede bloquear un servidor
  `http://` remoto como contenido mixto. `http://localhost` sigue valiendo para desarrollo.
- En Windows, para empaquetar: certificado de firma si se usa la build firmada.

## Instalación

```bash
npm install
```

`postinstall` reconstruye `better-sqlite3` para Electron.

## Desarrollo

Con Vite y Electron en una sola consola:

```bash
npm start
```

En dos consolas:

```bash
npm run dev
npm run electron:dev
```

La app de desarrollo usa `data/uvecoe.db`. Esa carpeta está ignorada por Git porque
contiene datos locales de alumnos y respuestas.

## Tests

```bash
npm test
```

Cubren la rotación de alumnos por estación y el cálculo de puntos.

## Build y empaquetado

```bash
npm run build       # genera dist/
npm run pack        # build + paquete sin instalador
npm run dist:win    # instalador Windows
npm run dist:win:signed  # instalador Windows firmado
```

`dist/` y `release/` se generan y no se suben al repositorio. Los instaladores deben
publicarse en GitHub Releases, no dentro del código.

## Primer arranque

1. La app pide la URL del servidor y valida un administrador.
2. Después se descarga la configuración de la estación.
3. El primer login de cada usuario debe hacerse con red para guardar su hash bcrypt.
4. A partir de ahí se puede evaluar sin conexión y sincronizar cuando vuelva la red.

## Base de datos

- Desarrollo: `data/uvecoe.db`.
- Windows empaquetado: `%APPDATA%\uvecoe\uvecoe.db`.
- Linux empaquetado: `~/.config/uvecoe/uvecoe.db`.

No se debe subir ninguna base de datos al repositorio. Contiene datos personales.
Tampoco se suben `.env`, certificados privados ni la carpeta `node_modules`.

## Estructura

```text
main.js                 Proceso principal de Electron e IPC
preload.js              Puente seguro hacia el renderer
src/db/                 Knex, consultas, settings y migraciones
src/renderer/           React, pantallas y utilidades
assets/                 Imágenes, splash y login legado
scripts/                Build firmado y desinstalación limpia
```
