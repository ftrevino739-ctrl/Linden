# Linden Search — primera infraestructura

Linden Search es la capa de búsqueda propia de Linden: interfaz, API de normalización, categorías, reglas de seguridad, caché de mapas y conexión con fuentes independientes. Esta primera versión es un **metabuscador autohospedado**, no un índice mundial construido desde cero.

## Qué incluye

- **Web:** SearXNG autohospedado, configurado para usar el índice independiente de Brave y Wikipedia.
- **Imágenes:** categoría de imágenes de Brave a través de SearXNG.
- **Noticias:** búsqueda de noticias de Brave y Wikinews.
- **Vídeos:** búsqueda de vídeos de Brave.
- **Shopping:** resultados de Mercado Libre México; Open Food Facts sirve como respaldo limitado a alimentos y productos relacionados.
- **Mapas:** geocodificación de OpenStreetMap/Nominatim, con caché y límite de una consulta por segundo.
- **Sin Google ni Bing:** la lista `keep_only` de SearXNG admite exclusivamente Brave, Wikipedia y Wikinews. No se envían consultas a Google o Bing.

Linden no copia el logotipo ni la marca de Google. Adopta patrones de uso familiares —pestañas Todo, Imágenes, Noticias, Vídeos, Shopping y Mapas; resultados enlazados, miniaturas y tarjetas de productos— con el diseño propio de Linden.

## Requisitos

- Windows 10/11.
- Docker Desktop instalado y abierto.
- Firefox con la extensión de Linden cargada.
- Node.js no es necesario para el servicio, porque el gateway corre dentro de Docker.

## Iniciar en Windows

1. Abre Docker Desktop y espera a que indique que está ejecutándose.
2. Abre PowerShell.
3. Entra a la carpeta del repositorio:
   `cd $HOME\Linden-Firefox-Test\firefox\search-engine`
4. Ejecuta:
   `powershell -ExecutionPolicy Bypass -File .\start.ps1`
5. Comprueba que el servicio responde:
   `Invoke-RestMethod http://127.0.0.1:8787/health`
6. En Firefox abre `about:debugging#/runtime/this-firefox`, recarga Linden Start y abre una pestaña nueva.
7. Busca una consulta. La pestaña de resultados se consulta en el gateway local `127.0.0.1:8787`.

Para detener los servicios:
`docker compose down`

## Pruebas manuales del gateway

```powershell
Invoke-RestMethod "http://127.0.0.1:8787/api/search?q=Firefox&category=general"
Invoke-RestMethod "http://127.0.0.1:8787/api/search?q=montañas&category=images"
Invoke-RestMethod "http://127.0.0.1:8787/api/search?q=tecnología&category=news"
Invoke-RestMethod "http://127.0.0.1:8787/api/search?q=recetas&category=videos"
Invoke-RestMethod "http://127.0.0.1:8787/api/shopping?q=audífonos"
Invoke-RestMethod "http://127.0.0.1:8787/api/maps?q=Monterrey"
```

## Fuentes y límites actuales

- SearXNG agrega motores de búsqueda independientes. Brave aporta su propio índice web; no es una API de Google ni un proxy de Google. SearXNG es software de metabúsqueda, no un crawler con un índice global de Linden.
- Mercado Libre puede limitar o modificar su API pública. Si no responde, Linden muestra un respaldo de Open Food Facts y enlaces directos de búsqueda en marketplaces.
- Open Food Facts no es un catálogo general de electrónica, ropa o todos los productos.
- Nominatim impone límites de uso. El gateway mantiene caché de 15 minutos y espacia consultas para respetar aproximadamente una petición por segundo. Los mapas deben atribuir a OpenStreetMap.
- Las imágenes y vídeos se sirven desde sus sitios originales; disponibilidad, derechos, miniaturas y reproducción dependen de cada fuente.

## Próxima etapa para independizar el índice

1. Añadir un crawler propio que respete robots.txt, sitemaps y límites por dominio.
2. Extraer título, texto, enlaces canónicos, metadatos Open Graph, imágenes y datos estructurados Schema.org.
3. Guardar los documentos en un índice local con BM25 y señales de calidad.
4. Mezclar y volver a ordenar el índice Linden con fuentes externas, midiendo relevancia y frescura.
5. Crear un índice de productos y fuentes de vídeo con atribución y enlaces originales.

No se debe describir Linden como un buscador con índice mundial propio hasta que ese crawler y ese índice existan y se hayan probado.
