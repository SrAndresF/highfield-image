# Higgsfield AI Studio — Edición Multi-Usuario (BYOK)

Aplicación web full-stack construida con **Next.js (App Router)**, **TypeScript estricto**, **Tailwind CSS**, **Zod** y el SDK oficial **`@higgsfield/client/v2`** para la generación de imágenes y videos con inteligencia artificial utilizando la API de [Higgsfield (`open.higgsfield.ai`)](https://open.higgsfield.ai).

Diseñada específicamente para equipos donde **cada miembro ingresa su propia API Key (`api-key-id:api-key-secret`) desde el navegador**, sin existir ninguna API Key global almacenada en el servidor.

---

## Arquitectura de Concurrencia y Seguridad (Decisión Técnica del SDK v2)

Antes de implementar el backend, se inspeccionó el código fuente compilado y las definiciones de tipos del paquete oficial instalado (`node_modules/@higgsfield/client/dist/v2/client.js` y `client.d.ts`):

1. **Por qué NO usamos `config()` global**:
   En `@higgsfield/client/v2`, la función `config({ credentials })` muta un objeto singleton a nivel de módulo (`const globalState = {}`). En un servidor Next.js con varios usuarios concurrentes, llamar a `config()` provocaría condiciones de carrera (*race conditions*) mezclando las credenciales y facturación de distintos usuarios.
2. **Solución Híbrida Aislada por Petición (`createHiggsfieldClient` + REST `fetch`)**:
   - **Envío de trabajos (`POST /api/generate`)**: El SDK v2 exporta la fábrica `createHiggsfieldClient({ credentials })` que instancia un estado aislado (`initializeClient(config)`) con su propio cliente HTTP sin tocar `globalState`. Además, acepta `withPolling: false` en `client.subscribe(endpoint, { input, withPolling: false })`, lo que envía el trabajo y devuelve de inmediato el `request_id` sin bloquear el hilo ni agotar el timeout HTTP.
   - **Consulta de estado (`GET /api/status/[id]`), cancelación (`POST /api/cancel/[id]`) y validación de credenciales (`GET /api/credits`)**: Dado que la interfaz `HiggsfieldClient` del SDK v2 encapsula el polling de forma interna y no expone métodos públicos separados para consultar un `request_id` existente ni cancelarlo, estos Route Handlers invocan directamente la API REST oficial (`https://api.higgsfield.ai/requests/{id}/status` y `/cancel`) mediante `fetch` por petición inyectando el header `Authorization: Key KEY_ID:KEY_SECRET` de esa solicitud.
3. **Privacidad estricta de credenciales**:
   - La credencial viaja del navegador al backend únicamente en el header privado `x-hf-credentials` (jamás en URL ni query params).
   - El servidor no la guarda en disco, base de datos, variables globales ni cookies, y cuenta con un sanitizador (`sanitizeErrorText`) que redacta cualquier fragmento de credencial antes de devolver mensajes de error.
   - El historial local en `localStorage` se separa por usuario usando un **hash criptográfico SHA-256** (`hf_studio_history_sha256_<hash>`) calculado con Web Crypto API, sin incluir jamás la API Key en texto claro.

---

## Cómo obtener tu API Key de Higgsfield

1. Ingresa a la consola de desarrolladores de Higgsfield en [console.higgsfield.ai](https://console.higgsfield.ai) o [open.higgsfield.ai](https://open.higgsfield.ai).
2. Inicia sesión y asegúrate de contar con saldo positivo en tu cuenta API (*pay-as-you-go*).
3. Dirígete a la sección **API Keys** y crea una nueva clave.
4. Obtendrás dos valores:
   - **Key ID** (identificador público de la clave)
   - **Key Secret** (clave secreta)
5. En la interfaz de nuestra aplicación, haz clic en **"Configurar API Key"**, pega el par en formato `api-key-id:api-key-secret` (o cada parte en su campo), haz clic en **"Probar conexión"** y luego en **"Guardar y usar Key"**.

---

## Instalación y Ejecución Local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno (Opcional)
Copia el archivo de ejemplo si deseas activar una contraseña compartida para el equipo:
```bash
cp .env.example .env.local
```

### 3. Iniciar servidor de desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### 4. Compilar para producción
```bash
npm run build
npm run start
```

---

## Control de Acceso del Equipo (`APP_ACCESS_PASSWORD`)

Si defines la variable `APP_ACCESS_PASSWORD` en `.env.local` o en las variables de entorno de tu proveedor de hosting:

```env
APP_ACCESS_PASSWORD=mi_clave_secreta_de_equipo_2026
```

- La aplicación mostrará una pantalla de bloqueo antes de cargar el estudio y exigirá esta contraseña una sola vez.
- Al validarla en `POST /api/auth/access`, el servidor emite una cookie `httpOnly` firmada con **HMAC-SHA256** (`hf_team_access`) válida por 7 días.
- Todas las rutas `/api/generate`, `/api/status/[id]`, `/api/cancel/[id]` y `/api/credits` verifican criptográficamente esta cookie antes de ejecutarse.
- Si `APP_ACCESS_PASSWORD` se deja vacía o no se define, la aplicación es abierta (cada usuario sigue necesitando su propia API Key de Higgsfield).

---

## Cómo Agregar Nuevos Modelos

El catálogo de modelos está centralizado en [`lib/models.ts`](./lib/models.ts).  
Para agregar un nuevo modelo de imagen o video:

1. Abre `lib/models.ts`.
2. Añade un nuevo objeto al arreglo `MODELS` especificando:
   - `id`: El endpoint oficial en Higgsfield (ej. `'kling-video/v2.6/pro/text-to-video'`).
   - `name`, `provider`, `type` (`'image'` o `'video'`), `badge` y `description`.
   - `parameters`: Arreglo declarativo de parámetros (`select`, `number`, `boolean` o `url`).
   - `economyPreset`: Valores que se aplicarán automáticamente cuando el usuario active el botón **"Modo Económico"**.
   - `estimatedCost`: Etiquetas informativas de costo estimado.
3. **¡Listo!** No necesitas tocar ningún componente de React ni ruta de API: tanto el formulario dinámico del frontend como el validador de esquemas del backend (`POST /api/generate`) se adaptan automáticamente a los parámetros declarados.

---

## Despliegue en Producción (Vercel u otro hosting)

1. Sube este repositorio a GitHub / GitLab / Bitbucket.
2. Importa el proyecto en [Vercel](https://vercel.com) (o cualquier plataforma compatible con Next.js App Router).
3. *(Opcional)* En **Environment Variables**, define `APP_ACCESS_PASSWORD` si deseas restringir el acceso a tu equipo.
4. **Requisito crítico de seguridad (HTTPS)**:
   Asegúrate de servir siempre la aplicación bajo **HTTPS** (Vercel lo configura automáticamente). Esto garantiza que el header `x-hf-credentials` viaje cifrado por TLS entre el navegador del usuario y los Route Handlers de Next.js, que la API `window.crypto.subtle` (SHA-256) esté habilitada de forma nativa y que las cookies `Secure` funcionen adecuadamente.
