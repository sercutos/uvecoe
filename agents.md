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

# Instalador Windows NSIS -> release/UVECOE-<version>-setup.exe
# (requiere Windows o Wine/Docker; en este entorno se compiló en Windows)
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

# Tests: actualmente NO hay tests reales
npm test             # termina con error a propósito
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
  reset.js                  Borrado de la DB en desarrollo
  migrations/               Migraciones timestamped de Knex

src/renderer/
  index.jsx                 Bootstrap (URL) + Router + ThemeProvider
  App.jsx                   Guardián: comprueba configuración y API base
  components/
    Login.jsx               Login online/offline con hash bcrypt
    Toolbar.jsx             Navegación, ayuda, acerca de, logout
    Logo/Logo.jsx           Logo (actualmente importado pero no usado en Login)
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
    home/                   Archivo muerto/roto, no importado
  utils/
    apiConfig.js            URL base y helpers de paths
    api.js                  fetchWithAuth (Bearer desde sessionStorage)
    stationData.js          Descarga completa y paginada de la estación

assets/                     splash.html, login.html (sin uso), imágenes
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
informativo: no tiene interruptores ni guarda respuestas.

Si se entra directamente en `/evaluation` sin la selección completa (por ejemplo desde el icono
"Evaluación Activa" del Toolbar), se redirige al primer paso que falte: `/`, `/rounds` o `/turns`.

La selección de fecha/ronda/turno **solo vive en `sessionStorage`**; se pierde al reiniciar la app.
Las pantallas de fecha/ronda/turno se reconstruyen desde SQLite cuando no hay red.

Claves de `sessionStorage` usadas:

| Clave | Contenido |
|---|---|
| `token_ecoe` | Token Bearer |
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
| `users` | `usuario_id_server` (unique), `email` (unique), `role`, `token_temporal`, `password_hash` | Copia de usuarios para login offline; `password_hash` es bcrypt y se guarda en el primer login online |
| `students` | `id` (PK del servidor), `name`, `surnames`, `dni`, `id_planner`, `planner_order`, `active` | Se descargan **los 276 del ECOE**; `id_planner` agrupa los 12 de cada turno; `active=false` si desaparecen del servidor |
| `questions` | `id` (PK del servidor), `area`, `id_station`, `order`, `id_block`, `reference`, `description`, `question_schema`, `max_points`, `active` | `question_schema` incluye `type` y `options[].points`; `max_points` se rellena desde la rúbrica publicada; `active=false` si la pregunta ya no se publica |
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
- `db:descargar-preguntas-servidor`
- `db:obtener-estudiantes`
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

El preload expone métodos explícitos **y** un `invoke(channel, data)` genérico. No añadir
nuevos canales genéricos; preferir métodos explícitos y validar el payload en `main`.

---

## 6. Contrato real con la API (verificado contra el backend local)

Base:

- API: `${apiBase}/backend/api/v1`
- Auth: `${apiBase}/backend/auth`
- OpenAPI: `/backend/api/v1/openapi.json`
- Swagger: `/backend/api/v1/docs`

El token se envía como `Authorization: Bearer <token>` en el renderer (`fetchWithAuth`).
**La sincronización y `db:descargar-preguntas-servidor` de `main.js` no envían token.**

| Endpoint | Forma de respuesta | Notas críticas |
|---|---|---|
| `GET /backend/status` | `{ status: "ok" }` | Health check usado por el asistente inicial |
| `POST /backend/auth/tokens` | `{ token, expiration }` | No devuelve `user_id` ni `role`; el código los espera |
| `GET /users/me` | `UserRead` | Requiere Bearer; el asistente exige `is_superadmin` o rol `administrator` |
| `GET /ecoes` | Array | Requiere Bearer |
| `GET /stations?ecoe_id=` | `{ items, total, page, per_page }` | Campo `id_parent_station` (no `parent_station`) |
| `GET /shifts?id_ecoe=` | `{ items, ... }` | `time_start` es string ISO, no `{ $date }`; el código lo tolera |
| `GET /rounds?ecoe_id=` | Array | |
| `GET /planners?shift_id=&round_id=` | Array | |
| `GET /blocks?station_id=` | `{ items, ... }` | |
| `GET /questions?station_id=&block_id=` | Array | Cada pregunta trae `question_schema` y `area.name`; hay `max_points` de `0.5` |
| `GET /students?ecoe_id=&planner_id=` | `{ items, total, ... }` | **El parámetro es `ecoe_id`, NO `id_ecoe`** |
| `GET /users` | Array | Requiere Bearer |
| `POST /answers/bulk-sync` | `{ status, message, inserted_or_updated }` | Hoy no exige token en el servidor |
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
5. **Puntos reales:** `points` y `answer_schema` se calculan desde `max_points` y
   `question_schema.options` publicados por el servidor. No hardcodear `1` ni `id_option: 1`.
   Una respuesta con puntos `> 0` (por ejemplo `0.5`) se muestra como switch activo.
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
    cae a offline; solo se usa offline si falla la red o el servidor no está operativo.
12. **Logout:** debe revocar el token (best effort), limpiar `token_ecoe`, `user_email` y toda la
    selección de fecha/ronda/turno, y conservar `api_base_url` para el siguiente Login.
13. **Sincronización:** el Toolbar muestra `N pendientes` / `Al día` y permite sincronizar al
    pulsar. La evaluación intenta auto-sync al entrar, cada 5 minutos y al pasar de alumno; es
    silenciosa y no bloquea. Si falla, las respuestas quedan pendientes y se reintentan. El lote
    en vuelo se marca con `sync_batch`; si el evaluador cambia una respuesta durante el envío, el
    `upsert` limpia esa marca y la fila no se da por sincronizada.
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

- `max_points` y `options[].points` se leen del servidor; migración corrige resultados antiguos.
- `AnswerBulkItem.points` del backend pasa de `int` a `float` (archivo externo
  `/home/scubero/openECOE-FASTAPI/backend/app/schemas/answer.py`).
- Sincronización con Bearer token, timeout de 30 s y validación de `inserted_or_updated`.
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

### P1 — robustez y calidad

- Código de pruebas: autoselección de ECOE/estación (`AdminConfig.jsx`).
- Cronómetro que vuelve a `07:00` al llegar a cero (`evaluation.jsx`).
- Settings muestra estado verde aunque no haya conexión.
- `home.jsx` está roto/no importado; `students copy.jsx`, `assets/login.html` y `LogoOscuro`
  no se usan.
- Coexisten `package-lock.json` y `yarn.lock`.
- `src/db/migrations/init.js` no tiene timestamp; no borrarlo (ya está registrado en DBs antiguas).
- `fetch` sin timeout ni abort en el renderer.

### P2 — mantenimiento

- Falta de tests, lint y formato.
- Falta de validación de payloads IPC.
- `webSecurity: false` y `invoke` genérico en preload.
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
- Mantener `contextIsolation: true`; no habilitar `nodeIntegration`.
- Evitar `webSecurity: false`; si se necesita comunicación HTTP, resolverlo con CORS o IPC.
- No exponer canales IPC arbitrarios desde el preload.
- No loguear tokens ni datos personales.
- Tratar las respuestas y los DNIs como datos sensibles (GDPR).

---

## 12. Estado actual del entorno (referencia)

- Backend accesible en `http://localhost:8000` con OpenAPI 1.0.0.
- ECOE de prueba: `ECOE1` (id 1), estaciones 13-24, turnos T1-T23, ronda R1 (id 11).
- `data/uvecoe.db`: `settings` con `api_base_url = http://localhost:8000`, configuración de la
  Estación 1 (`station_order = 1`), 276 alumnos activos, 30 preguntas activas con
  `max_points` (1 o 0.5), 13 usuarios (0 con `password_hash` hasta el primer login online),
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
- No hay suite de tests automatizada ni linter configurados.

---

## 13. Deuda técnica priorizada

**P0:** no queda deuda funcional; mantener las reglas de datos personales y de `dist/`.

**P1:** eliminar código de prueba, arreglar el cronómetro, unificar el gestor de paquetes y añadir
tests/lint.

**P2:** firma comercial OV/EV o Azure Trusted Signing si se distribuye fuera de la UV; el
certificado interno actual solo genera confianza en equipos donde se despliegue el `.cer`.

**P2:** refactor de descargas duplicadas, tests, lint, validación IPC, `safeStorage`, CSP.
