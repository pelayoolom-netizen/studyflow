# StudyFlow — Central Académica Personal en la Nube

**StudyFlow** es una aplicación web progresiva (PWA) de nivel profesional diseñada para centralizar y optimizar la vida académica de estudiantes: deberes, exámenes con notas y ponderaciones exactas, calendario interactivo, temporizador de estudio Pomodoro y notificaciones push en tiempo real respaldadas por Supabase PostgreSQL.

---

## 🚀 Características Principales

1. **Dashboard «Mi Día»**:
   - Saludo personalizado dinámico según la hora del día.
   - Resumen visual inmediato de deberes atrasados, entregas de hoy y cuenta atrás para el próximo examen.
   - Marcado de tareas completadas en un solo toque con animación de celebración.
   - Indicador de minutos estudiados hoy frente a la meta diaria.

2. **Gestión Completa de Deberes**:
   - Creación, edición, duplicación y eliminación con confirmación.
   - Filtros por materia, estado (`pendiente`, `en_progreso`, `completado`), prioridad (`baja`, `media`, `alta`) y búsqueda por texto.
   - Histórico de tareas completadas y balance diario de tareas creadas vs. finalizadas en los últimos 7 días.

3. **Calendario Académico Integrado**:
   - Vistas Mensual, Semanal y Diaria sin desfases de zona horaria.
   - Eventos diferenciados por color (exámenes, deberes, sesiones).
   - Selección de día para inspeccionar la agenda detallada y crear nuevos eventos.
   - Resumen de los próximos 7 días en el horizonte.

4. **Asignaturas y Expediente por Materia**:
   - Código de colores personalizable, profesor/a, meta semanal de estudio y notas.
   - Vista detallada individual por cada materia con media de calificaciones, total de horas de estudio y tareas asociadas.

5. **Exámenes y Calificaciones**:
   - Cálculo exacto de nota media (aritmética o ponderada según los porcentajes asignados).
   - Las pruebas pendientes **no** penalizan ni reducen la nota media como un cero.
   - Seguimiento de temarios y fechas de convocatoria.

6. **Temporizador de Concentración Pomodoro**:
   - Modo de 25 minutos configurable con descansos cortos (5m) y largos (15m).
   - Recuperación automática de la sesión activa tras recargar la página.
   - Vinculación directa con asignaturas y deberes.
   - Registro permanente de sesiones de estudio en la base de datos.

7. **Dashboard de Analíticas**:
   - 4 escalas temporales: Semanal (con comparativa frente a la semana previa), Mensual, Trimestral (con periodos académicos seleccionables) e Historial Completo filtrable.

8. **Web Push API y Notificaciones Reales**:
   - Notificaciones push auténticas mediante Service Worker (`/public/sw.js`) y `web-push`.
   - Recordatorio diario programable (por defecto a las 14:15, configurable).
   - Filtro por categorías y días de la semana seleccionables.
   - Botón para enviar notificación de prueba real a tu dispositivo.

9. **PWA Instalable**:
   - Instalación en iPhone/iPad vía Safari («Añadir a la pantalla de inicio»).
   - Instalación nativa en Windows, Mac y Android vía Chrome/Edge.
   - Funcionamiento sin conexión (offline fallback) y sincronización al recuperar cobertura.

---

## 🛠️ Conexión con Supabase PostgreSQL

Para conectar tu propio proyecto en la nube:

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. Entra en el **SQL Editor** de Supabase y copia/pega el contenido del archivo:
   ```
   supabase/migrations/20261018_initial_studyflow_schema.sql
   ```
   Esto creará todas las tablas con sus políticas **Row Level Security (RLS)** y el trigger de usuarios.
3. Copia tu `Project URL` y tu `Anon Public Key` desde **Project Settings > API**.
4. Puedes añadirlas a tu archivo `.env`:
   ```env
   VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
   VITE_SUPABASE_ANON_KEY="tu-anon-key"
   ```
   O bien introducirlas directamente desde la propia interfaz de StudyFlow en **Ajustes > Conexión Supabase**.

---

## 🔔 Configuración de Notificaciones en Segundo Plano

- **Service Worker**: Ubicado en `/public/sw.js`, gestiona la recepción en background de eventos `push` y la apertura de StudyFlow al pulsar (`notificationclick`).
- **Edge Function para envío programado**: Ubicada en `supabase/functions/send-daily-reminder/index.ts`.
- **Programación mediante cron**: En Supabase puedes programar la ejecución periódica con `pg_cron`:
  ```sql
  SELECT cron.schedule(
    'studyflow-daily-reminders',
    '*/15 * * * *',
    $$ SELECT net.http_post(
        url:='https://<tu-proyecto>.functions.supabase.co/send-daily-reminder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
    ) $$
  );
  ```

---

## 📦 Despliegue en Vercel

StudyFlow está preparado para publicarse en Vercel:
1. Conecta tu repositorio Git en el panel de Vercel.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Variables de entorno en Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
