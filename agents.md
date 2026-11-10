# AGENTS.md — UVECOE

> Guía operativa para agentes de código que trabajen en este repositorio.
> Idioma del proyecto: **español** (UI, mensajes de error y documentación).
> Última revisión: 2026-11-07.

---

## 1. Contexto del proyecto

**UVECOE** es una aplicación de escritorio **Electron** para evaluar estaciones de un ECOE
(Examen Clínico Objetivo Estructurado). Sigue una filosofía **local-first / offline-first**:

1. Se autentica contra un **FastAPI** central (`http://localhost:8000` por defecto).
2. Descarga la configuración de la estación: ECOE, estación, bloque, rúbrica, alumnos y usuarios.
3. Guarda todo en **SQLite local** (`better-sqlite3` + `Knex`).
4. Permite evaluar sin red y autoguarda **cada switch** inmediatamente.
5. Al recuperar conexión, sube las respuestas pendientes en bloque a `/answers/bulk-sync`.

### Stack

| Capa | Tecnología |
|---|---|
| Escritorio | Electron 39 |
| UI | React 19, React Router 7, MUI 7 |
| Build renderer | Vite 7 |
| Persistencia local | SQLite (`better-sqlite3`), Knex 3 |
| Backend | FastAPI + MySQL (contenedor externo, no forma parte del repo) |
| Empaquetado | electron-builder (target Windows NSIS) |

La base de datos local **no replica** el modelo completo del backend, pero desde el punto 2 sí
guarda la planificación necesaria para trabajar offline: `shifts`, `rounds` y `planners`.
No se guarda una tabla local de `stations`; el orden de la estación se persiste en
`configuracion.station_order`.

---

## 2. Comandos habituales

```bash
# Dependencias
npm install

# Desarrollo (UNA terminal: Vite + Electron con concurrently)
npm start

# Alternativa en dos terminales
npm run dev          # Vite en http://localhost:5173
npm run electron:dev # Electron esperando a que Vite esté listo

# Borrar la DB local y arrancar de cero (¡DESTRUCTIVO!)
npm run start:clean  # equivale a npm run dev:clean

# Build del renderer -> dist/
npm run build

# Build + empaquetado (--dir) -> release/linux-unpacked
npm run pack

# Instalador Windows NSIS sin firmar -> release/UVECOE-<version>-setup.exe
# (requiere Windows o Wine/Docker; no requiere certificado)
npm run dist:win

# Windows firmado con el certificado interno (recomendado)
# Lee CSC_LINK/CSC_KEY_PASSWORD y verifica la firma al terminar
npm run dist:win:signed

# Rebuild del módulo nativo para Electron
npx electron-rebuild -f -w better-sqlite3

# Migraciones (CLI; usar desde la raíz del repo)
npx knex migrate:latest
npx knex migrate:list
npx knex migrate:make nombre_migracion

# Tests de rotación y puntos (node:test, sin dependencias)
npm test
```

### Requisitos para desarrollo

1. Backend FastAPI levantado en `http://localhost:8000`
   (Swagger: `http://localhost:8000/backend/api/v1/docs`).
2. `npm start` (levanta Vite + Electron). Si Vite ya está corriendo, usar
   `npm run electron:dev` para no chocar con el puerto 5173.

`main.js` usa `NODE_ENV === "development"` para cargar Vite; si se ejecuta `electron .` sin esa
variable, cargará `dist/index.html` (que actualmente está **obsoleto**).

---

## 3. Arquitectura y mapa de archivos

```
main.js                     Proceso principal: ventanas, migraciones, IPC, sync y descargas
preload.js                  Puente contextBridge -> window.api
knexfile.js                 Config de Knex para la CLI (data/uvecoe.db)
vite.config.js              root = src/renderer; salida = dist/

src/db/
  knex.js                   Instancia Knex y resolución de la ruta de la DB
  queries.js                Consultas de configuración, datos iniciales y usuarios
  settings.js               Tabla settings (api_base_url)
  migrations/               Migraciones timestamped de Knex

src/renderer/
  index.jsx                 Bootstrap (URL) + Router + ThemeProvider
  App.jsx                   Guardián: comprueba configuración y API base
  components/
    Login.jsx               Login online/offline con hash bcrypt
    ReauthDialog.jsx        Reconexión con el servidor sin salir de la evaluación
    Toolbar.jsx             Navegación, ayuda, acerca de, logout y estado de sync
  pages/
    setup/FirstRunSetup.jsx Asistente de primer arranque: URL + admin
    login/                  Envoltorio de Login
    admin/AdminConfig.jsx   Configuración inicial del portátil
    dates/                  Selección de fecha (turnos -> días)
    rounds/                 Selección de ronda
    turns/                  Selección de turno
    evaluation/             Pantalla principal de evaluación
    settings/               Re-descarga, cambio de URL y sincronización
    questions/              Vista informativa del banco de preguntas (sin responder)
    students/               Tabla de alumnos
  hooks/
    useChrono.js            Socket.IO del cronómetro y eventos de audio
  utils/
    apiConfig.js            URL base, chrono base y helpers de paths
    api.js                  fetchWithAuth (Bearer desde sessionStorage)
    auth.js                 Rol de sesión, admin/superadmin y organización
    chrono.mjs              Formato y estado del cronómetro (con test)
    chronoAudio.js          Reproducción de los audios de evento
    scoring.mjs             Rotación de alumnos y puntos (con test)
    stationData.js          Descarga completa y paginada de la estación

src/renderer/assets/sounds/ Audios del cronómetro (entrar, salir, avisos)
assets/                     splash.html, imágenes
data/                       uvecoe.db (runtime; openecoe_lite.db fue eliminada)
dist/                       Build de Vite (regenerado el 2026-11-07)
scripts/
  build-win-signed.ps1      Build Windows + firma + verificación
  install-code-signing-cert.ps1  Confianza en LocalMachine (12 portátiles)
  uninstall-clean.ps1       Desinstalación limpia + backup de DB
  desinstalar-limpio.bat    Lanzador de la desinstalación limpia
```

### Flujo de pantallas

`/login` → `/` (fecha) → `/rounds` → `/turns` → `/evaluation`
Rutas auxiliares: `/settings`, `/students`, `/questions`. El Banco de Preguntas es solo
informativo: no tiene interruptores ni guarda respuestas. `/settings` solo es accesible para un
superadmin de la plataforma o un `administrator` de la organización; la lista de ECOEs se filtra
por `id_organization` (el backend ya la filtra, el cliente lo vuelve a comprobar).

Si se entra directamente en `/evaluation` sin la selección completa (por ejemplo desde el icono
"Evaluación Activa" del Toolbar), se redirige al primer paso que falte: `/`, `/rounds` o `/turns`.

La selección de fecha/ronda/turno **solo vive en `sessionStorage`**; se pierde al reiniciar la app.
Las pantallas de fecha/ronda/turno se reconstruyen desde SQLite cuando no hay red.

Claves de `sessionStorage` usadas:

| Clave | Contenido |
|---|---|
| `local_session` | Sesión local válida; permite evaluar aunque no haya token |
| `token_ecoe` | Token Bearer real; nunca se inventa en modo offline |
| `token_expires_at` | Caducidad devuelta por `/auth/tokens` |
| `sync_auth_required` | El servidor rechazó el token; hay que reconectar para sincronizar |
| `user_email`, `user_role`, `user_is_admin`, `user_is_superadmin`, `user_org_id`, `user_org_name` | Identidad y permisos de la sesión |
| `api_base_url` | URL base cacheada |
| `todos_los_turnos` | Array completo de turnos |
| `selected_date_string` | Día en formato `dd/mm/aaaa` |
| `selected_round_id`, `selected_round_code` | Ronda |
| `selected_shift_id`, `selected_shift_code` | Turno |

---

## 4. Modelo de datos local

Ruta de la DB:

- **Desarrollo:** `process.cwd()/data/uvecoe.db` (normalmente la raíz del repo).
- **Empaquetado:** `app.getPath("userData")/uvecoe.db`.

> ⚠️ `main.js` calcula la ruta con `__dirname/data`, mientras que `src/db/knex.js` usa
> `userData` al estar empaquetado. Unificar esa lógica antes de tocar el empaquetado.

### Tablas

| Tabla | Campos relevantes | Notas |
|---|---|---|
| `configuracion` | `id`, `ecoe_id`, `station_id`, `station_name`, `block_id`, `station_order` | Una sola fila. `block_id` es `NOT NULL`; `station_order` es el orden 1..12 de la estación |
| `users` | `usuario_id_server` (unique), `email` (unique), `role`, `is_admin`, `is_superadmin`, `id_organization`, `token_temporal`, `token_expires_at`, `password_hash` | Copia de usuarios para login offline; `password_hash` es bcrypt y se guarda en el primer login online; los campos de admin se leen de `/users/me` |
| `students` | `id` (PK del servidor), `name`, `surnames`, `dni`, `id_planner`, `planner_order`, `active` | Se descargan **los 276 del ECOE**; `id_planner` agrupa los 12 de cada turno; `active=false` si desaparecen del servidor |
| `questions` | `id` (PK del servidor), `area`, `id_station`, `order`, `id_block`, `reference`, `description`, `question_schema`, `active` | `question_schema` incluye `type` y `options[].points`; los puntos se leen de `options[0].points`; `active=false` si la pregunta ya no se publica |
| `resultados` | `id_student` FK, `id_question` FK, `id_station`, `points`, `answer_schema` (TEXT), `sincronizado`, `sync_batch`, `evaluado_en` | `points` admite decimales (0.5); índice único `(id_student, id_question, id_station)`; escritura por `upsert`; `sync_batch` marca el lote en vuelo y cualquier escritura nueva lo limpia |
| `settings` | `key` (PK), `value` | `api_base_url` |
| `shifts` | `id`, `id_ecoe`, `shift_code`, `time_start` | Turnos descargados para seleccionar fecha/turno offline |
| `rounds` | `id`, `id_ecoe`, `round_code`, `description` | Rondas descargadas |
| `planners` | `id`, `id_shift`, `id_round` | Une turno + ronda; agrupa los 12 alumnos del turno |

Todos los identificadores de negocio (`id_student`, `id_question`, etc.) son **IDs del servidor**.
No se deben inventar IDs locales para sincronizar.

---

## 5. Canales IPC

Definidos en `main.js` y expuestos en `preload.js`:

- `db:obtenerConfiguracion`
- `db:guardarConfiguracion`
- `db:get-setting`
- `db:set-setting`
- `db:obtenerUsuarioLocal`
- `db:guardarUsuarioLocal`
- `db:guardarDatosIniciales`
- `db:getStudents`
- `db:obtener-preguntas`
- `db:obtener-respuestas-alumno`
- `db:guardar-resultado`
- `db:sincronizar-respuestas-al-servidor`
- `db:contar-pendientes`
- `db:obtener-shifts`
- `db:obtener-rounds`
- `db:obtener-planner`
- `db:obtener-estudiantes-planner`
- `db:asegurar-referencias`

El preload expone **solo métodos explícitos**; no hay `invoke(channel, data)` genérico. Añadir
un método por canal y validar el payload en `main`.

---

## 6. Contrato real con la API (verificado contra el backend local)

Base:

- API: `${apiBase}/backend/api/v1`
- Auth: `${apiBase}/backend/auth`
- OpenAPI: `/backend/api/v1/openapi.json`
- Swagger: `/backend/api/v1/docs`

El token se envía como `Authorization: Bearer <token>` en el renderer (`fetchWithAuth`).
La sincronización también envía el token; el renderer no llama a `bulk-sync` sin una sesión de
servidor válida.

Con `webSecurity` activo, el backend debe incluir en `CORS_ORIGINS` los orígenes de la app:
`http://localhost:5173`, `http://127.0.0.1:5173` (desarrollo) y `null` (app empaquetada con
`file://`).

### Cronómetro por Socket.IO

- Se conecta al **mismo origen** que `api_base_url` (Caddy/nginx), namespace
  `/round{selected_round_id}`.
- Caddy enruta `/socket.io/*` al contenedor `chrono:5001`.
- Eventos: `tic_tac` (cada segundo), `init_stage`, `evento`, `end_round`, `aborted`.
- `tic_tac` manda tiempo transcurrido: `restante = stage.duration - t`.
- `evento.target` es `0` (todas las estaciones) o IDs separados por coma.
- Si no hay tick ni estado, la app muestra “Sin cronómetro” y usa el audio/megafonía.
- Los audios de `evento.sound` (`entrar.mp3`, `salir.mp3`, etc.) se reproducen desde
  `src/renderer/assets/sounds/`.

| Endpoint | Forma de respuesta | Notas críticas |
|---|---|---|
| `GET /backend/status` | `{ status: "ok" }` | Health check usado por el asistente inicial |
| `POST /backend/auth/tokens` | `{ token, expiration }` | No devuelve `user_id` ni `role`; el código los espera |
| `GET /users/me` | `UserRead` | Requiere Bearer; el asistente exige `is_superadmin` o rol `administrator` |
| `GET /ecoes` | Array | Requiere Bearer |
| `GET /stations?ecoe_id=` | `{ items, total, page, per_page }` | Campo `id_parent_station` (no `parent_station`) |
| `GET /shifts?id_ecoe=` | `{ items, ... }` | `time_start` puede ser string ISO o `{ $date }`; se normaliza a string antes de insertar |
| `GET /rounds?ecoe_id=` | Array | |
| `GET /planners?shift_id=&round_id=` | Array | |
| `GET /blocks?station_id=` | `{ items, ... }` | |
| `GET /questions?station_id=&block_id=` | Array | Cada pregunta trae `question_schema` y `area.name`; los puntos están en `options[].points` (0.5, 1...) |
| `GET /students?ecoe_id=&planner_id=` | `{ items, total, ... }` | **El parámetro es `ecoe_id`, NO `id_ecoe`** |
| `GET /users` | Array | Requiere Bearer |
| `POST /answers/bulk-sync` | `{ status, message, inserted_or_updated }` | La app exige token de sesión antes de llamarlo |
| `GET /answers/station/{station_id}` | Array de `AnswerRead` | Se descarga al configurar/actualizar el portátil y se importa en `resultados` |

### Descarga y agrupación de alumnos

**Implementado:** la descarga usa `ecoe_id` (no `id_ecoe`) y guarda **los 276 alumnos del ECOE**
con su `id_planner` y `planner_order`.

La API **ignora** `id_ecoe`. Verificado en vivo:

- `id_ecoe=999` → devuelve 276 alumnos (filtro ignorado).
- `ecoe_id=999` → devuelve 0 (filtro aplicado).

El filtro de 12 alumnos **no se hace al descargar**, sino al evaluar: se resuelve el planner del
turno + ronda y se cargan solo sus 12 alumnos. La rotación se aplica después con el
`station_order`.

### Payload de sincronización

`POST /backend/api/v1/answers/bulk-sync` espera un **array** de:

```json
{
  "id_student": 1,
  "id_question": 61,
  "id_station": 13,
  "points": 1,
  "answer_schema": { "type": "checkbox", "selected": [{ "id_option": 1 }] }
}
```

`answer_schema` debe ser un **objeto**, no un string. En SQLite se guarda con
`JSON.stringify()` y `main.js` lo parsea antes de enviarlo.

---

## 7. Reglas de negocio e invariantes

1. **Un portátil = un ECOE + una estación + un bloque.** La configuración se guarda en
   `configuracion` y bloquea la pantalla de administración.
2. **Autoguardado inmediato:** cada cambio de switch debe persistirse en `resultados`.
3. **Unicidad lógica:** una fila por `(id_student, id_question, id_station)`. La DB tiene un
   índice único y `db:guardar-resultado` usa `upsert`; no volver al patrón `select` + `insert`.
4. **Nunca borrar resultados al re-descargar.** La descarga hace `upsert` de `questions` y
   `students` y no ejecuta `del()` sobre ellas. Las FKs con `CASCADE` siguen en el esquema: no
   volver a introducir borrados masivos. La descarga también importa las respuestas del servidor
   (`GET /answers/station/{station_id}`) como `sincronizado = true`, pero **no pisa** las respuestas
   locales con `sincronizado = false` (pendientes de subir).
5. **Puntos reales:** `points` y `answer_schema` se calculan desde
   `question_schema.options[0].points` publicado por el servidor. No hardcodear `1` ni
   `id_option: 1`. Una respuesta con puntos `> 0` (por ejemplo `0.5`) se muestra como switch activo.
6. **Configuración atómica:** descargar y validar todo (bloque, preguntas, 276 alumnos,
   planificación y usuarios) antes de guardar `configuracion`, y hacerlo en una transacción.
7. **Los IDs locales son IDs del servidor.** No generar IDs ficticios para resultados que luego
   se sincronizan.
8. **Offline real:** la app debe poder evaluar tras un reinicio sin red. Ya persiste
   turnos/rondas/planners y el orden de la estación; la selección de fecha/turno se lee de SQLite
   si no hay red.
9. **Todos los alumnos, un planner por turno:** se descargan los 276 del ECOE, pero cada turno
   evalúa solo los 12 de su `planner`. Nunca caer a evaluar la tabla `students` completa.
10. **Rotación:** los alumnos se ordenan por `planner_order` (1..12) y la estación `k` empieza
    por el alumno `k`, rotando hacia `k-1`:
    `k, k-1, …, 1, 12, …, k+1`. Implementado en `reorderStudentsForStation`.
11. **Login online/offline:** el primer login de cada usuario debe hacerse con red para guardar el
    `password_hash` bcrypt. Sin hash, el login offline se rechaza. Un 401/403 del servidor nunca
    cae a offline; solo se usa offline si falla la red o el servidor no está operativo. Tras el
    login online se lee `/users/me` para guardar `role`, `is_admin`, `is_superadmin` e
    `id_organization`; si esa llamada falla se usa el último perfil local. El login offline
    guarda `local_session` y nunca inventa un token.
12. **Logout:** debe revocar el token (best effort), limpiar `token_ecoe`, `user_email`, los datos
    de rol/organización y toda la selección de fecha/ronda/turno, y conservar `api_base_url` para
    el siguiente Login.
13. **Sincronización:** el Toolbar muestra `N pendientes` / `Al día` y permite sincronizar al
    pulsar. La evaluación intenta auto-sync al entrar, cada 5 minutos y al pasar de alumno; es
    silenciosa y no bloquea. Solo se envían respuestas (nunca alumnos, turnos ni preguntas), en
    lotes de 500 filas con timeout de 30 s por lote. Si falla, los lotes anteriores quedan
    sincronizados, las respuestas restantes quedan pendientes y se reintentan. Cada lote en vuelo
    se marca con `sync_batch`; si el evaluador cambia una respuesta durante el envío, el `upsert`
    limpia esa marca y la fila no se da por sincronizada. Si el servidor responde 401, no se
    cierra la sesión ni se navega a `/login`: se marca `sync_auth_required`, se borra solo el
    token y el Toolbar ofrece reconectar sin interrumpir la evaluación.
14. **Primer arranque:** una DB nueva (`setup_completed=false`) muestra el asistente antes del
    Login. Exige probar `/backend/status`, autenticar un admin y validar `/users/me`
    (`is_superadmin` o rol `administrator`). Si falla, no se puede continuar. Las DBs ya
    configuradas (`setup_completed=true`) se saltan el asistente.
14. **Soft-delete:** las preguntas/alumnos que ya no vienen en la descarga se marcan
    `active=false`, nunca se borran si tienen resultados. La evaluación y las vistas filtran
    `active=true`. Si el servidor los vuelve a publicar, el upsert los reactiva.

---

## 8. Convenciones de código

- **Main/preload/DB:** CommonJS (`require` / `module.exports`).
- **Renderer:** ESM + JSX. Componentes funcionales; no usar clases.
- **Nombres de columnas y campos API:** `snake_case` (`id_student`, `question_schema`).
- **Nombres internos JS:** `camelCase` (`currentStudent`, `stationId`).
- **UI y mensajes:** español, con el mismo tono que el resto de pantallas.
- **Estilos:** MUI (`sx`, componentes `Box`, `Paper`, etc.). No introducir Tailwind ni CSS-in-JS nuevo.
- **Consultas SQL:** concentrarlas en `src/db/`. `main.js` debe quedar fino: IPC -> función de DB.
- **Errores:** registrar en consola con prefijo (`[EVALUATION]`, `[SYNC]`, etc.) y devolver mensajes
  claros al usuario.
- **Estado React:** usar actualizaciones funcionales (`setAnswers(prev => ...)`) en toggles y
  operaciones que puedan ejecutarse en ráfaga.
- **IPC:** añadir el método explícito en `preload.js` y su handler `db:*` en `main.js`.

### MUI Grid

El proyecto usa deliberadamente la API antigua `item`/`xs`/`sm` y por eso importa:

```jsx
import Grid from "@mui/material/GridLegacy";
```

No importar `Grid` desde `@mui/material` en estas pantallas: es el Grid nuevo de MUI 7, ignora
`item`/`xs`/`sm` y rompe el layout (fechas/turnos cortados). No mezclar ambas APIs.

---

## 9. Problemas conocidos y zonas peligrosas

### Resuelto en el punto 2 (2026-11-07)

- Descarga de los 276 alumnos del ECOE con `ecoe_id` e `id_planner` correcto.
- Tablas locales `shifts`, `rounds`, `planners` y `configuracion.station_order`.
- Evaluación offline que resuelve el planner, carga sus 12 alumnos y rota por estación.
- `upsert` de alumnos/preguntas y configuración al final: re-descargar ya no borra resultados.
- `db:asegurar-referencias` hace upsert de los alumnos/preguntas online antes de evaluar.
- Índice único en `resultados` y `upsert` por `(id_student, id_question, id_station)`.
- Si el autoguardado falla, el switch se revierte y se muestra un `Alert` al evaluador.

### Resuelto en el login (2026-11-07)

- `Bootstrap` en `index.jsx` inicializa `api_base_url` antes de renderizar Login.
- Credenciales por defecto eliminadas del código.
- Login offline verificado con bcrypt contra `users.password_hash`.
- 401/403 no permiten bypass offline; solo red caída o servidor no operativo.
- Logout revoca el token, limpia la sesión y muestra el usuario real en el Toolbar.

### P0 — reglas permanentes

1. **Datos personales:** no volver a trackear `data/*.db`; contienen alumnos, respuestas y usuarios.
   El histórico ya se limpió.
2. **`dist/`:** se regeneró el 2026-11-07. Volver a ejecutar `npm run build` antes de empaquetar
   o de ejecutar sin `NODE_ENV=development`, ya que `dist/` está ignorado por Git.

No queda ningún P0 funcional abierto.

### Resuelto en P1 (2026-11-07)

- Los puntos se leen de `options[].points`; la migración histórica corrigió resultados antiguos.
- `AnswerBulkItem.points` del backend pasa de `int` a `float` (archivo externo
  `/home/scubero/openECOE-FASTAPI/backend/app/schemas/answer.py`).
- Sincronización con Bearer token, timeout de 30 s por lote y validación de `inserted_or_updated`.
- Timeout de 10 s en las peticiones del renderer (`fetchWithAuth`, Settings y AdminConfig) para
  caer a SQLite en vez de quedarse cargando indefinidamente.
- Cronómetro conectado al Chrono por Socket.IO: cuenta desde `stage.duration - t`, para en cero,
  reproduce los audios de `evento` y muestra “Sin cronómetro” si no hay estado.
- El panel de configuración inicial exige elegir ECOE y estación; ya no autoselecciona.
- Eliminada de Settings la tarjeta “Reset DB” que solo mostraba un aviso y no borraba nada.
- Settings comprueba `/backend/status` de verdad; ya no muestra el servidor en verde por defecto.
- Eliminado el código muerto: `home.jsx`, `students copy.jsx`, `assets/login.html`,
  `Logo/Logo.jsx`, `src/db/reset.js`, `logo.jpeg`, `db:obtener-estudiantes` y
  `queries.guardarUsuarioLocal`.
- Un solo gestor de paquetes: npm. Eliminados `yarn.lock`, `electronmon` y el paquete
  duplicado `electron-rebuild`; se mantiene `@electron/rebuild` (mismo binario).
- Eliminado `questions.max_points`: los puntos se leen de `question_schema.options[0].points`.
- Las respuestas en pantalla se guardan por `id_student`; una lectura o escritura tardía del
  alumno anterior ya no puede caer en el alumno siguiente.
- Contador de pendientes en el Toolbar, sync manual al pulsar y auto-sync en evaluación
  (al entrar, cada 5 min y al pasar de alumno). Bloqueo para evitar sync simultáneas.
- Soft-delete de preguntas/alumnos obsoletos con `active`; resultados históricos conservados.
- Asistente de primer arranque con URL, prueba de conexión y validación de administrador;
  guarda `api_base_url`, hash del admin y `setup_completed=true`.
- Empaquetado: salida en `release/`, allowlist de `files`, `asarUnpack` de `better-sqlite3`,
  `postinstall` y ruta de DB unificada (`userData` en producción).
- Firma Authenticode del instalador y del `.exe` con certificado interno; timestamp RFC3161.
  El certificado debe confiarse en cada portátil (Root + TrustedPublisher).
- `init.js` se mantiene como migración no-op `async` por compatibilidad con DBs antiguas.
- Si fallan las migraciones, la app guarda una copia `*.failed-<timestamp>` de la base, muestra
  un error y se cierra; no abre una ventana con tablas incompletas.

### P1 — robustez y calidad

- `src/db/migrations/init.js` no tiene timestamp; no borrarlo (ya está registrado en DBs antiguas).

### P2 — mantenimiento

- Faltan tests de integración, lint y formato; los tests actuales cubren rotación y puntos.
- Falta de validación de payloads IPC.
- Tokens en claro; usar `safeStorage` de Electron.

---

## 10. Flujo de trabajo recomendado para un agente

1. **Leer** este archivo y los archivos implicados antes de editar.
2. **No ejecutar** `npm run start:clean` ni `dev:clean` salvo petición explícita: borran
   `data/uvecoe.db`.
3. Para cambios de esquema:
   - Crear una migración nueva timestamped; no editar migraciones ya aplicadas.
   - Probar con una DB temporal o copia de `data/uvecoe.db`.
   - Ejecutar `npx knex migrate:latest` desde la raíz.
4. Para cambios de API:
   - Contratar con `http://localhost:8000/backend/api/v1/openapi.json`.
   - Recordar `ecoe_id` (no `id_ecoe`) y las respuestas paginadas (`items`).
5. Para cambios en renderer:
   - Arrancar `npm start` (Vite + Electron).
   - Comprobar el flujo completo: login → configuración → fecha → ronda → turno → evaluación →
     settings → sincronización.
6. Antes de cerrar:
   - `npm run build` si se toca el renderer.
   - Revisar que `dist/` se ha regenerado.
   - Comprobar `git status` para no commitear DBs, tokens ni credenciales.

### Smoke test manual

```bash
# 1. Backend
curl -s http://localhost:8000/backend/status

# 2. Inspeccionar DB local
sqlite3 data/uvecoe.db ".tables"
sqlite3 -header -column data/uvecoe.db "select * from configuracion;"
sqlite3 -header -column data/uvecoe.db "select count(*) as pendientes from resultados where sincronizado = 0;"

# 3. Arrancar (Vite + Electron)
npm start
```

Checklist funcional:

- [ ] Login online guarda `token_ecoe` y usuario local.
- [ ] Login offline funciona con un usuario previamente sincronizado.
- [ ] La configuración descarga bloque, preguntas, alumnos y usuarios.
- [ ] La evaluación guarda una fila por switch en `resultados`.
- [ ] Al cambiar de alumno se recuperan sus respuestas previas.
- [ ] La sincronización sube solo `sincronizado = 0` y las marca después.
- [ ] `npm run build` genera `dist/` con fecha actual.

---

## 11. Reglas de seguridad y datos

- **No commitear** `data/*.db`, `.env`, tokens, contraseñas ni capturas con datos personales.
- No introducir credenciales por defecto en el código.
- Mantener `contextIsolation: true`; no habilitar `nodeIntegration` ni `webSecurity: false`.
- La ventana solo navega a la app; `will-navigate`, `will-redirect` y las ventanas nuevas se
  bloquean en `main.js`.
- No exponer un `invoke` genérico desde el preload.
- El backend debe permitir en `CORS_ORIGINS` los orígenes de la app: `http://localhost:5173`,
  `http://127.0.0.1:5173` en desarrollo y `null` para la app empaquetada con `file://`.
- No loguear tokens ni datos personales.
- Tratar las respuestas y los DNIs como datos sensibles (GDPR).

---

## 12. Estado actual del entorno (referencia)

- Backend accesible en `http://localhost:8000` con OpenAPI 1.0.0.
- ECOE de prueba: `ECOE1` (id 1), estaciones 13-24, turnos T1-T23, ronda R1 (id 11).
- `data/uvecoe.db`: `settings` con `api_base_url = http://localhost:8000`, configuración de la
  Estación 1 (`station_order = 1`), 276 alumnos activos, 30 preguntas activas con
  `options[].points` (1 o 0.5), 13 usuarios (0 con `password_hash` hasta el primer login online),
  23 turnos, 1 ronda, 23 planners y 5 resultados corregidos (0.5 donde corresponde).
  Índices `resultados_unique_student_question_station`, `resultados_sincronizado_idx`,
  `questions_active_station_idx` y `students_active_planner_idx`.
- `data/openecoe_lite.db` fue eliminada: era legacy y no la usaba el código.
- `dist/` se regeneró y `release/` (Linux y Windows) está ignorado por Git.
- Instalador Windows generado, firmado y probado: `release/UVECOE-1.0.0-setup.exe`, instalación
  per-user, acceso directo y DB en `%APPDATA%\uvecoe\uvecoe.db`. Incluye HashRouter, GridLegacy,
  contador de pendientes, auto-sync, soft-delete y asistente de primer arranque.
- Certificado interno `UVECOE - Universitat de Valencia` (thumbprint
  `B09EC007BDCC8A7C4E9968973C7F3EE7E852C83D`, válido hasta 2031). Firmante y timestamp
  verificados con `Get-AuthenticodeSignature` (`Status: Valid`).
- Para los 12 portátiles hay que desplegar el `.cer` en `LocalMachine\Root` y
  `LocalMachine\TrustedPublisher` con `scripts/install-code-signing-cert.ps1` (admin) o GPO/Intune.
- Desinstalación limpia: `scripts/uninstall-clean.ps1` (backup de DB, borra
  `%APPDATA%\uvecoe`, opcional `-RemoveCertificate`). El desinstalador NSIS solo
  no borra la DB por seguridad.
- `settings.setup_completed` = `true` en DBs configuradas; una DB nueva arranca en el asistente.
- La app empaquetada usa `HashRouter` (file://); en desarrollo se mantiene `BrowserRouter`.
- La DB empaquetada en Linux se crea en `~/.config/uvecoe/uvecoe.db` (userData).
- Flujo E2E verificado: online/offline, Estación 1 (orden 1) y Estación 2 (orden 2), login
  online/offline, FK/upsert, puntos 0.5, sync con token y rechazo de lote parcial.
- Soft-delete verificado: quitar una pregunta/alumno de la descarga los deja `active=false`,
  conserva sus resultados y los reactiva si vuelven a publicarse.
- Tests de rotación y puntos con `node --test`; no hay linter configurado.

---

## 13. Deuda técnica priorizada

**P0:** no queda deuda funcional; mantener las reglas de datos personales y de `dist/`.

**P1:** eliminar código de prueba, arreglar el cronómetro, unificar el gestor de paquetes y añadir
lint y tests de integración.

**P2:** firma comercial OV/EV o Azure Trusted Signing si se distribuye fuera de la UV; el
certificado interno actual solo genera confianza en equipos donde se despliegue el `.cer`.

**P2:** refactor de descargas duplicadas, tests de integración, lint, validación IPC, `safeStorage`, CSP.
