# Base de datos del registro de hostales (ISAM / ALMAR WATER)

Reemplaza los libros Excel mensuales por un esquema PostgreSQL normalizado,
con un ETL que carga los `.xlsx` existentes y vistas que recalculan los
reportes que hoy son fórmulas escritas a mano.

```
db/          DDL, en orden de ejecución (01 a 07)
etl/         lectura de los Excel, normalización y carga
Excels/      los libros originales, que el ETL nunca modifica
```

## Requisitos

- **Docker Desktop** (instalado, v29.7.2). El instalador lo deja en
  `%LOCALAPPDATA%/Programs/DockerDesktop/resources/bin`; si `docker` no se
  encuentra, abrir una terminal nueva para que tome el PATH actualizado.
- Python 3.11 o superior (hay 3.13 instalado).

## Puesta en marcha

```bash
cp .env.example .env          # y cambiar POSTGRES_PASSWORD
docker compose up -d          # levanta Postgres y corre db/*.sql una sola vez

python -m venv .venv
.venv/Scripts/pip install -r etl/requirements.txt

.venv/Scripts/python -m etl.verificar                      # chequeo sin base
.venv/Scripts/python -m etl.main --todos --mes 2026-07 --dry-run
.venv/Scripts/python -m etl.main --todos --mes 2026-07     # carga real
```

pgAdmin queda en http://localhost:5050, con el usuario y la clave de
`PGADMIN_EMAIL` / `PGADMIN_PASSWORD`. Tarda cerca de un minuto en levantar.

Dos detalles que hacen perder tiempo:

- El correo **no puede usar un dominio reservado** como `.local`: pgAdmin lo
  rechaza y el contenedor se queda reiniciando en bucle.
- Al conectar desde pgAdmin, el host **no** es `localhost` sino `db`, que es el
  nombre del servicio dentro de la red de Docker.

Los `db/*.sql` se ejecutan **solo cuando el volumen está vacío**. Para aplicar
un cambio en el DDL hay que recrear la base:

```bash
docker compose down -v && docker compose up -d
```

## Modelo

Tres esquemas: `staging` (crudo y auditable), `core` (normalizado), `rpt` (vistas).

| Tabla | Qué es |
|---|---|
| `core.persona` | El trabajador. Identidad por RUT; si no hay RUT, por nombre normalizado. |
| `core.estadia` | Una reserva: persona + empresa + hostal + habitación, con ingreso y salida. |
| `core.estadia_noche` | **Una fila por persona-noche.** Es la matriz de `R. OFICIAL` normalizada y la unidad que se cobra. |
| `core.servicio_consumo` | Desayunos, almuerzos, cenas y colaciones. Unifica las columnas de pensión de las hojas diarias con la hoja `ALMUERZOS ISAM`. |
| `core.estadia_evento` | Bitácora: cambio de sábanas, cambio de habitación, acreditación, avisos de salida. |

El total de noches, que en el Excel es un `COUNTA` por fila, aquí es un
`count(*)` sobre los mismos datos que se muestran: no puede descuadrar.

### Vistas

| Vista | Reemplaza a |
|---|---|
| `rpt.vw_registro_oficial` | La hoja `R. OFICIAL` completa |
| `rpt.vw_ocupacion_diaria` | Los `COUNTIFS` por empresa (`M171:AS183`) |
| `rpt.vw_pension_diaria` | El bloque de totales de cada hoja diaria (`K76:T82`) |
| `rpt.vw_facturacion_empresa_mes` | Base de cobro por empresa |
| `rpt.vw_ocupacion_actual` | Quién está alojado ahora |
| `rpt.vw_descuadre` | La fila 168 de `R. OFICIAL`, pero explicada |
| `rpt.vw_calidad_datos` | — (nuevo: qué quedó para revisión humana) |

## Lo que el ETL tuvo que resolver

Encontrado al analizar los libros de julio 2026:

1. **El bloque de ingreso y el de salida no son la misma persona.** Están uno
   al lado del otro en la misma fila, pero son dos listas independientes: en
   `01- JULIO` la fila 14 no tiene ingreso y sí registra la salida de ALAN
   CALDERON. Cada fila del Excel produce cero, uno o dos registros.
2. **Los encabezados cambian entre hojas.** Los días 05 y 06 meten
   `OBSERVACIONES` antes de la fecha de salida y corren todo el bloque una
   columna; del 16 al 31 `HOSTAL` pasa a `HOTEL` y `HAB TIPO DOBLE- SINGLE` a
   `TIPO`; ALMAR WATER usa otro orden completo. El ETL **no** codifica letras de
   columna: lee la fila de encabezado y la parea contra sinónimos, así que un
   mes con otro orden carga sin tocar código.
3. **Fechas en tres formatos** a la vez: texto `01-07-2026`, serial de Excel
   `46204`, y datetime real. Las horas van como fracción de día
   (`0.29166666666666669` = 07:00).
4. **RUT con y sin guion**, y personas sin RUT. Se normaliza a dígitos + DV, se
   valida por módulo 11 y **los inválidos se cargan igual**, marcados: la
   persona existe aunque el dato esté mal escrito.
5. **La misma empresa escrita de seis formas**: `LFT` por `LTF`, `MAS ERRAZ` y
   `M. ERRAZUDIZ` por `MAS ERRAZURIZ`, `ALMAR SUBT.` con punto, y cuatro
   escrituras de `ALMAR VP`. Se resuelven contra `core.empresa_alias`. Un alias
   desconocido va a `staging.rechazo`, nunca crea una empresa nueva: eso
   partiría la facturación en dos.
6. **Las noches salen de `R. OFICIAL`, no del rango ingreso–salida**, porque hay
   estadías con huecos: JUAN CORREA tiene 18 noches en tres tramos separados.
7. **El pie de cada hoja diaria** tiene un bloque de totales cuya primera
   columna cae justo en la columna NOMBRE. Sin cortar ahí se cargaban `HAB`,
   `TOTAL` e `ISAM` como si fueran huéspedes.
8. **La columna `CARGO` de ISAM a veces trae una hora** (`16:00:00`). Se descarta
   para no meterla al catálogo de cargos.
9. **`ALMUERZOS ISAM` no es solo de julio**: cubre de febrero a julio de 2026.
   Se carga con las fechas que trae, sin recortar al mes del libro.
10. **Las filas `SIN ALMUERZOS`** son marcadores de "ese día no hubo". Se saltan;
    la ausencia se deriva por ausencia de filas.

## Idempotencia

Recargar un archivo borra primero todo lo que ese archivo produjo
(`origen_archivo`) y lo vuelve a insertar. Las personas y los catálogos no se
borran: son compartidos entre archivos y meses.

Los libros de un mismo mes se cargan **juntos y en una sola transacción**, por
fases: primero los registros oficiales de todos, después las hojas diarias de
todos. Importa porque al resolver una hoja diaria el ETL busca el alojamiento
vigente de la persona para deducir el hostal y la empresa que faltan, y esa
búsqueda puede encontrar estadías del otro libro; los dos comparten el hostal
1724 y algunos trabajadores. Cargándolos por separado el resultado dependía del
orden y de lo ya cargado: dos corridas seguidas daban 471, luego 458, luego 457
estadías hasta converger. Por fases, una sola pasada da el resultado final y
repetirla no lo cambia.

## Verificación

Sin base de datos:

```bash
.venv/Scripts/python -m etl.verificar
```

Parsea el DDL con el parser real de PostgreSQL y comprueba que cada `INSERT`
del ETL apunte a tablas y columnas que existen.

Con la base cargada, contra los números del Excel:

```sql
-- 1. Noches de julio. R. OFICIAL da 707 en la fila 184 y 701 en la 164:
--    el propio Excel no cuadra consigo mismo.
SELECT count(*) FROM core.estadia_noche
WHERE fecha BETWEEN '2026-07-01' AND '2026-07-31';

-- 2. Noches por empresa, SOLO ISAM. Ojo: los dos libros comparten el hostal
--    1724, asi que hay que filtrar por archivo de origen, no por hostal.
--    Celdas reales de R. OFICIAL: MAS ERRAZURIZ 407, LTF 173, ALMAR SUBT 31,
--    ALMAR DMH 30, VALKO 28, ALMAR VP 25, ICEM 6
SELECT em.nombre AS empresa, count(*) AS noches
FROM core.estadia_noche n
JOIN core.estadia e  ON e.id  = n.estadia_id
JOIN core.empresa em ON em.id = e.empresa_id
WHERE e.origen_archivo LIKE 'ISAM%'
GROUP BY 1 ORDER BY 2 DESC;

-- 3. Pensiones del 01-07 en la hoja diaria de ISAM.
--    Celdas realmente escritas: 49 desayunos, 44 almuerzos, 48 cenas, 14 colación.
--    (El pie del Excel dice 44/38/42/11 por errores en sus propias fórmulas.)
SELECT tipo_servicio, sum(cantidad)
FROM core.servicio_consumo
WHERE origen_archivo LIKE 'ISAM%' AND fecha = '2026-07-01'
  AND origen_hoja NOT ILIKE '%ALMUERZOS%'
GROUP BY 1 ORDER BY 1;

-- 4. Ocupación del 01-07, solo ISAM: 55 noches en total, igual que el Excel.
SELECT h.codigo, count(*)
FROM core.estadia_noche n
JOIN core.estadia e ON e.id = n.estadia_id
JOIN core.hostal  h ON h.id = e.hostal_id
WHERE e.origen_archivo LIKE 'ISAM%' AND n.fecha = '2026-07-01'
GROUP BY 1 ORDER BY 1;

-- 5. Nada debería quedar sin promover
SELECT motivo, count(*) FROM staging.rechazo GROUP BY 1;

-- 6. El descuadre queda explícito, no escondido
SELECT * FROM rpt.vw_descuadre WHERE diferencia <> 0 ORDER BY fecha;

-- 7. Qué quedó para revisión humana
SELECT * FROM rpt.vw_calidad_datos;
```

Criterio de aceptación: los puntos 1 a 4 cuadran con las celdas reales del
Excel, o toda diferencia queda listada y explicada. Los resultados están abajo.

### Estado de la verificación

Ejecutado el 2026-08-30 contra PostgreSQL 17.11 en Docker. Ambos libros cargados.

| | Filas |
|---|---|
| staging | 4.548 |
| estadías | 458 |
| noches | 1.650 |
| servicios | 2.673 |
| personas | 397 |
| rechazos | 35 (0,8 %) |

**Noches de julio por empresa, solo ISAM** — contra los `COUNTIFS` de `R. OFICIAL`:

| Empresa | Excel dice | Celdas reales | Cargado |
|---|---|---|---|
| MAS ERRAZURIZ | 407 | 407 | **407** |
| LTF | 179 | 173 | 170 |
| ALMAR SUBT | 31 | 31 | **31** |
| ALMAR DMH | 31 | 30 | **30** |
| VALKO | 28 | 28 | **28** |
| ALMAR VP | 25 | 25 | **25** |
| ICEM | 6 | 6 | **6** |
| **Total** | **707** | **700** | **697** |

La columna del medio son las marcas D/N/E que de verdad están escritas en la
hoja. **Los totales del Excel no coinciden con sus propias celdas**: sobran 7.
La hoja ya se contradice sola, la fila 164 dice 701 y la 184 dice 707.

Las 3 noches restantes son de dos filas de `R. OFICIAL` (ALAIN VEAS y JOSE LUIS
ARANCIBIA, ambos LTF) que tienen la celda de hostal vacía. Están en
`staging.rechazo`.

**Ocupación del 01-07, solo ISAM**: 55 noches, igual que el Excel. El reparto
por hostal difiere (BD 6/49, Excel 11/44) porque las fórmulas del pie de la hoja
diaria asumen que las filas 2 a 21 son del 1724, mientras que `R. OFICIAL`
asigna el hostal fila por fila; hay filas de MAS ERRAZURIZ marcadas como 1724.

**Pensiones del 01-07, hoja diaria de ISAM**:

| | Excel dice | Celdas reales | Cargado |
|---|---|---|---|
| Desayunos | 44 | 49 | 49 |
| Almuerzos | 38 | 44 | 44 |
| Cenas | 42 | 48 | 48 |
| Colación normal | 11 | 14 | 14 |

Otra vez el Excel se equivoca contra sus propias celdas, y cada diferencia tiene
una causa identificable en las fórmulas del pie:

- `P77` usa `COUNT` en vez de `COUNTA` sobre una columna de texto, así que
  **siempre da 0**: se pierden los 5 desayunos del hostal 1724.
- `Q78` es `COUNTA(Q26:Q67)` y `R78` es `COUNTA(R26:R67)`: los rangos empiezan
  en la fila 26 y terminan en la 67, dejando fuera las filas 22 a 25 y 68 a 69.
  Son exactamente las 6 cenas y los 6 almuerzos que faltan.
- `S77`, que rotula colación normal, **lee la columna T**, que es colación
  especial.

La hoja `ALMUERZOS ISAM` suma otros 44 almuerzos ese día, que el pie de la hoja
diaria no considera porque son un registro aparte.

**Idempotencia**: recargar los dos libros completos deja exactamente los mismos
conteos (458 / 1.650 / 2.673 / 397 / 35).

### Bugs encontrados y corregidos durante la carga

1. `unaccent('unaccent', txt)` necesitaba el cast explícito a `regdictionary`.
   Sin él, Postgres no resuelve la función al hacer inlining dentro de un
   índice, y abortaba toda la inicialización.
2. Las hojas escriben `Nª FOLIO` y `Nº HAB` con indicadores ordinales, que la
   descomposición NFKD convertía en `NA FOLIO` y `NO HAB`. **Ninguna de las dos
   columnas pareaba: folio y habitación se perdían en todo el libro.**
3. Los días 16 y 17 tienen la cabecera `HOSTAL` escrita como `p`. Se resuelve
   por posición, anclando en la columna `EMPRESA`.
4. El bloque de salida marca la pensión con `SI`/`NO`, no con la palabra del
   servicio. Un `NO` se estaba por contar como comida servida, y la pensión de
   ALMAR WATER (que solo se anota al salir) se perdía entera.
5. El bloque de salida de ALMAR WATER no tiene columnas de hostal ni empresa.
   Se deducen del alojamiento vigente de esa persona.

### Lo que queda en `staging.rechazo`

35 filas, todas por la misma causa de fondo: la celda de hostal está vacía y no
hay forma de deducirla.

- 19 de la hoja `ALMUERZOS ISAM`, con fechas de mayo y junio. Ese libro no tiene
  hojas diarias de esos meses, así que no hay alojamiento del cual inferir.
- 12 salidas y 2 ingresos de personas sin alojamiento registrado.
- 2 filas de `R. OFICIAL` (LTF) sin hostal.
- 2 filas de almuerzo sin fecha legible.

Ninguna se inventó: todas quedan listadas con su motivo.

## Desplegar en Supabase

Supabase entrega un Postgres administrado. Sirve tal cual, con tres diferencias
respecto de Docker que ya están resueltas en el código:

1. **El esquema de las extensiones varía.** Supabase trae las suyas
   (`pgcrypto`, `uuid-ossp`) en `extensions`, pero un `CREATE EXTENSION` propio
   puede caer en `public` según el `search_path` del proyecto: en el despliegue
   real `unaccent` y `pg_trgm` quedaron en `public`. Por eso no se puede dejar
   fijo. `core.norm_texto` averigua dónde quedó `unaccent` y hornea el nombre
   completo dentro de la función, y los archivos que usan `gin_trgm_ops` suman
   `extensions` al `search_path`. Probado en ambas ubicaciones.
2. **El pooler rompe los prepared statements** de psycopg3 en modo transacción.
   El ETL los desactiva con `prepare_threshold=None`, así que funciona igual por
   conexión directa o por cualquiera de los dos poolers.
3. **Hay que usar el Session pooler.** La cadena de conexión directa
   (`db.<ref>.supabase.co`) puede no resolver en absoluto: en este proyecto no
   tenía registro DNS ni IPv4 ni IPv6 hasta activar el pooler. El *Session
   pooler* es IPv4 y funciona; el de transacción también, porque el ETL ya no
   usa prepared statements.

### Pasos

1. Crear el proyecto en [supabase.com](https://supabase.com) y guardar la clave
   de la base de datos que muestra al crearlo (después no se puede volver a ver).

2. En *Project Settings* → *Database* → *Connection string* → **URI**, elegir
   **Session pooler**. Queda de esta forma:

   ```
   postgresql://postgres.ABCDEFGH:LA_CLAVE@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

3. Aplicar el esquema. No hace falta instalar `psql`: el contenedor de Postgres
   ya lo trae, y tiene salida a internet.

   ```bash
   export DATABASE_URL="postgresql://postgres.ABCDEFGH:LA_CLAVE@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

   for f in db/*.sql; do
     echo "--- $f"
     docker compose exec -T db psql "$DATABASE_URL" -v ON_ERROR_STOP=1 < "$f" || break
   done
   ```

4. **Cargar los datos: primero en local, después migrar.**

   No ejecutes el ETL apuntando a Supabase. Falla, y ya está comprobado:

   ```
   psycopg.OperationalError: consuming input failed:
   server closed the connection unexpectedly
   ```

   El ETL hace una consulta por fila dentro de una sola transacción. En local
   son 20 segundos, pero contra Supabase son más de 10.000 viajes de ida y
   vuelta, y el pooler corta la conexión antes de que termine. Al ser una única
   transacción, el rollback deja la base vacía: no queda a medias, pero tampoco
   avanza.

   La forma que sí funciona es cargar en local, donde el ETL es rápido y ya está
   verificado, y migrar el resultado con `pg_dump`. Además garantiza que
   Supabase quede con exactamente los mismos datos que conciliaste.

   ```bash
   # a) cargar en local
   .venv/Scripts/python -m etl.main --todos --mes 2026-07

   # b) vaciar el destino: el DDL ya sembró los catálogos y chocarían
   docker compose exec -T db psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
     TRUNCATE core.hostal, core.empresa, core.empresa_alias, core.cargo,
              core.habitacion, core.persona, core.estadia, core.estadia_noche,
              core.servicio_consumo, core.estadia_evento,
              staging.registro_crudo, staging.registro_oficial_crudo,
              staging.almuerzo_crudo, staging.rechazo, staging.carga
     RESTART IDENTITY CASCADE;"

   # c) migrar los datos
   docker compose exec -T -e URL="$DATABASE_URL" db sh -c      'pg_dump -U hostal -d hostal_isan --data-only --schema=core --schema=staging       | psql "$URL" -q -v ON_ERROR_STOP=1'
   ```

   `pg_dump` deja las secuencias de identidad avanzadas, así que las
   inserciones nuevas siguen la numeración sin chocar. Comprobado.

   Ojo al verificar: si encadenas la salida a `| tail` o `| head`, el código de
   salida que ves es el del `tail`, no el del comando. Un fallo se ve como
   éxito. Revisa siempre los conteos al final.

5. Consultar desde el *SQL Editor* del panel de Supabase, o con la misma URL
   desde pgAdmin o DBeaver. En el *Table Editor* hay que cambiar el desplegable
   de `schema public` a `core`: en `public` no hay nada, a propósito.

### Antes de meter datos reales

- **No expongas los esquemas por la API.** Supabase publica por PostgREST solo
  los esquemas de la lista de *Exposed schemas*, que por defecto es `public`.
  Como todo está en `core`, `staging` y `rpt`, no queda expuesto. Si algún día
  agregas alguno a esa lista, **hay que activar RLS primero**: si no, los datos
  de los trabajadores (nombre, RUT, celular) quedan legibles desde internet con
  la clave anónima.
- Los proyectos gratuitos **se pausan tras una semana sin uso**; hay que
  reactivarlos desde el panel.
- La clave de la base va en `.env`, que está en `.gitignore`. No la pegues en
  ningún archivo que se versione.

## Fuera de alcance

La aplicación de captura que reemplace operativamente el Excel. Con `core`
estable, es un paso posterior sobre estas mismas tablas.
