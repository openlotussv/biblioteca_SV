# Genuino · Biblioteca digital

Sitio estático para explorar y leer documentos PDF. Se publica en GitHub Pages
y lee la lista de documentos desde `manifest.json`.

## Archivos

- `index.html`, `styles.css` y `script.js`: catálogo responsive y lector PDF.
- `manifest.json`: datos de los libros activos.
- `documentos/`: archivos PDF publicados.
- `img/portada.jpg`: imagen de portada.

## Gestionar libros desde el equipo local

El gestor no se incluye en el repositorio público. En este equipo se abre desde
`http://localhost/biblioteca_admin/`; la opción aparece en el menú lateral solo
cuando la biblioteca se visita en `localhost`.

La primera vez:

1. Crea un token fine-grained de GitHub limitado a `openlotussv/biblioteca_SV`
   con permiso `Contents: Read and write`.
2. Ingresa el token directamente en el gestor local. No lo compartas ni lo
   agregues a este repositorio.
3. Usa **Publicar sitio inicial** para copiar el sitio y los PDFs locales a la
   rama `main`.

Después, desde el gestor puedes agregar, editar y retirar libros. La publicación
actualiza el manifiesto y los PDFs en un mismo commit. GitHub Pages puede tardar
unos minutos en reflejar los cambios.

El token se conserva en la carpeta local de configuración de Windows, fuera de
`htdocs` y del repositorio. El gestor solo admite solicitudes originadas en el
equipo local.

## Agregar un PDF

Usa **Gestionar biblioteca** desde la página local. El formulario carga el PDF,
los metadatos y la publicación; no es necesario editar `manifest.json` a mano.
Las rutas de los documentos deben conservar sus mayúsculas y minúsculas porque
GitHub Pages las distingue.

## Uso del lector

- Busca con el campo superior o presiona `/` para enfocarlo.
- Filtra por colección desde la navegación lateral o el selector.
- Cambia de página con los controles o las flechas izquierda/derecha.
- Ajusta el zoom, abre el PDF original o descárgalo.
- En pantallas pequeñas, abre el menú con el botón superior izquierdo.

PDF.js se carga desde CDN, por lo que la lectura en el visor requiere conexión
a Internet. El enlace **Abrir PDF** también permite usar el visor nativo del
navegador.
