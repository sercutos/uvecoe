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

La base de datos local **no replica** el modelo completo del backend: solo guarda lo necesario
para configurar el portátil y evaluar. No existen tablas locales de `shifts`, `rounds`,
`planners` ni `stations`.

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

# Empaquetado (solo --dir)
npm run pack

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
  index.jsx                 Router + ThemeProvider
  App.jsx                   Guardián: comprueba configuración y API base
  components/
    Login.jsx               Formulario y lógica online/offline
    Toolbar.jsx             Navegación, ayuda, acerca de, logout
    Logo/Logo.jsx           Logo (actualmente importado pero no usado en Login)
  pages/
    login/                  Envoltorio de Login
    admin/AdminConfig.jsx   Configuración inicial del portátil
    dates/                  Selección de fecha (turnos -> días)
    rounds/                 Selección de ronda
    turns/                  Selección de turno
    evaluation/             Pantalla principal de evaluación
    settings/               Re-descarga, cambio de URL y sincronización
    questions/              Vista de prueba del banco de preguntas
    students/               Tabla de alumnos
    home/                   Archivo muerto/roto, no importado
  utils/
    apiConfig.js            URL base y helpers de paths
    api.js                  fetchWithAuth (Bearer desde sessionStorage)

assets/                     splash.html, login.html (sin uso), imágenes
data/                       uvecoe.db (runtime) y openecoe_lite.db (legacy)
dist/                       Build de Vite (actualmente desactualizado)
```

### Flujo de pantallas

`/login` → `/` (fecha) → `/rounds` → `/turns` → `/evaluation`
Rutas auxiliares: `/settings`, `/students`, `/questions`.

La selección de fecha/ronda/turno **solo vive en `sessionStorage`**; se pierde al reiniciar la app.

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
| `configuracion` | `id`, `ecoe_id`, `station_id`, `station_name`, `block_id` | Una sola fila. `block_id` es `NOT NULL` |
| `users` | `usuario_id_server` (unique), `email` (unique), `role`, `token_temporal` | Copia de usuarios del servidor para login offline |
| `students` | `id` (PK del servidor), `name`, `surnames`, `dni`, `id_planner`, `planner_order` | Se descargan por estación/ECOE |
| `questions` | `id` (PK del servidor), `area`, `id_station`, `order`, `id_block`, `reference`, `description`, `question_schema` | `question_schema` se guarda como texto JSON |
| `resultados` | `id_student` FK, `id_question` FK, `id_station`, `points`, `answer_schema` (TEXT), `sincronizado`, `evaluado_en` | FKs con `ON DELETE CASCADE`; **sin índice único** |
| `settings` | `key` (PK), `value` | `api_base_url` |

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
| `POST /backend/auth/tokens` | `{ token, expiration }` | No devuelve `user_id` ni `role`; el código los espera |
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

### Bug de contrato más importante

`AdminConfig.jsx:155-156` y `settings.jsx:217-218` llaman a:

```
/students?per_page=500&id_ecoe=<id>
```

La API **ignora** `id_ecoe`. Verificado en vivo:

- `id_ecoe=999` → devuelve 276 alumnos.
- `ecoe_id=999` → devuelve 0.

Además, para el modo offline hay que filtrar por `planner_id` (turno + ronda), no solo por ECOE.

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
3. **Unicidad lógica:** una fila por `(id_student, id_question, id_station)`. Actualmente
   no hay restricción en la DB; usar `upsert` al implementar mejoras.
4. **Nunca borrar resultados al re-descargar.** Las FKs con `CASCADE` hacen que borrar
   `questions` o `students` elimine las respuestas asociadas. Usar `upsert` o conservar históricos.
5. **Puntos reales:** `points` debe respetar `max_points` y `question_schema.options`. Hoy se
   hardcodea `1` y `{ id_option: 1 }`.
6. **Configuración atómica:** descargar y validar todo antes de guardar `configuracion`, y hacerlo
   en una transacción.
7. **Los IDs locales son IDs del servidor.** No generar IDs ficticios para resultados que luego
   se sincronizan.
8. **Offline real:** la app debe poder evaluar tras un reinicio sin red. Para ello necesita
   persistir turnos/rondas/planners y la relación alumno↔planner, no solo `sessionStorage`.

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

### Estado de MUI Grid

El proyecto usa `<Grid item xs={12} sm={6}>`, API de **GridLegacy**. En MUI 7 `Grid` espera:

```jsx
<Grid container spacing={3}>
  <Grid size={{ xs: 12, sm: 6 }}>...</Grid>
</Grid>
```

Si se mantiene la API antigua, importar `GridLegacy as Grid`. No mezclar ambas.

---

## 9. Problemas conocidos y zonas peligrosas

### P0 — no tocar sin cuidado / corregir antes de un ECOE real

1. **Descarga de alumnos sin filtrar** (`AdminConfig.jsx:155-156`, `settings.jsx:217-218`):
   `id_ecoe` ignorado por la API. Guarda 276 alumnos en lugar de los 12 del planner.
2. **Borrado en cascada de resultados** (`queries.js:14-40`, `main.js:212-214`): re-descargar
   configuración elimina respuestas ya evaluadas.
3. **FK silenciosa al guardar respuestas** (`evaluation.jsx:308-315`): si el alumno o la pregunta
   online no existe en SQLite, el `INSERT` falla y solo se registra en consola.
4. **Configuración prematura y no transaccional** (`AdminConfig.jsx:129-135`,
   `queries.js:65-74`): se guarda antes de descargar datos; `block_id` es `NOT NULL` pero puede
   llegar `null`.
5. **Modo offline incompleto** (`evaluation.jsx:87-109`): no hay tablas de planners/turnos/rondas;
   se evalúa toda la tabla `students`.
6. **URL del servidor no aplicada en Login** (`App.jsx:9-21`, `index.jsx:35`): `initApiConfig()`
   solo corre en rutas protegidas; tras reiniciar, Login usa `localhost:8000`.
7. **Autenticación local débil** (`Login.jsx:19-20`, `80-101`; `Toolbar.jsx:140-142`;
   `index.jsx:24-27`): credenciales por defecto, login offline sin contraseña, logout que no
   limpia el token.
8. **Datos personales en Git:** `data/openecoe_lite.db` contiene alumnos, respuestas y usuarios.
   No añadir más DBs al repo y valorar limpiar el historial.
9. **`dist/` obsoleto:** el build actual es anterior al código fuente. Regenerarlo antes de
   empaquetar o de ejecutar sin `NODE_ENV=development`.

### P1 — robustez y calidad

- Sin índice único en `resultados`; riesgo de duplicados por clics rápidos
  (`main.js:316-356`).
- `points` y `answer_schema` hardcodeados (`evaluation.jsx:291-305`).
- Fallback a SQLite solo si una petición lanza excepción; una lista vacía no hace fallback
  (`evaluation.jsx:115-117`).
- Sincronización sin token, sin timeout y marcando todo como sincronizado
  (`main.js:360-431`).
- `id_planner` mal mapeado en `queries.js:36` (la API devuelve `id_planner`, no `planner.$ref`).
- `users.truncate()` en `queries.js:43` borra los usuarios locales, incluido el logueado.
- Ruta de DB inconsistente al empaquetar (`main.js` vs `knex.js`).
- Empaquetado sin `asarUnpack` para `better-sqlite3` ni rebuild automático.
- Código de pruebas: autoselección de ECOE/estación (`AdminConfig.jsx:212-223`) e IDs fijos
  (`QuestionPage.jsx:56-58`).
- Cronómetro que vuelve a `07:00` al llegar a cero (`evaluation.jsx:346-366`).
- `Toolbar.jsx:134-136` muestra siempre `ecoe@umh.es`.
- Settings muestra estado verde aunque no haya conexión (`settings.jsx:439-442`).
- `home.jsx` está roto/no importado; `students copy.jsx`, `assets/login.html`, `LogoOscuro` y
  `bcryptjs` no se usan.
- Coexisten `package-lock.json` y `yarn.lock`.
- `src/db/migrations/init.js` no tiene timestamp.
- `fetch` sin timeout ni abort en renderer y en `main.js`.

### P2 — mantenimiento

- Duplicación de la lógica de descarga entre `AdminConfig.jsx` y `settings.jsx`.
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
- `data/uvecoe.db`: `settings` con `api_base_url = http://localhost:8000`, `configuracion` vacía,
  0 alumnos, 0 preguntas y 0 resultados. La app arrancará en el panel de administración.
- `dist/` contiene un build antiguo; no usar para producción sin regenerarlo.
- No hay suite de tests ni linter configurados.

---

## 13. Deuda técnica priorizada

**P0:** filtrar alumnos por planner, evitar borrado en cascada, guardar configuración de forma
atómica, validar FKs antes de guardar, persistir turnos/rondas/planners para offline, cargar la
URL antes del Login, limpiar sesión y credenciales, sacar DBs del repo, regenerar `dist/`.

**P1:** índice único + upsert en `resultados`, respetar `max_points`, fallback offline ante listas
vacías, token/timeout en sync, corregir `id_planner`, no truncar usuarios, unificar ruta de DB,
configurar empaquetado de `better-sqlite3`, eliminar código de prueba, arreglar Grid/cronómetro.

**P2:** refactor de descargas duplicadas, tests, lint, validación IPC, `safeStorage`, CSP.
