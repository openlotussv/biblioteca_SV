# Luna Cloud Book · Biblioteca digital

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

Después, desde el gestor puedes crear categorías y subcategorías, agregar o
editar documentos, asignarles una portada y retirar contenido. Las categorías,
el manifiesto, los PDF optimizados y las portadas se publican en un mismo commit.
GitHub Pages puede tardar unos minutos en reflejar los cambios.

Antes de cargar documentos, instala el optimizador local desde PowerShell:

```powershell
python -m pip install --target C:\Users\Laulotus94\AppData\Local\GenuinoBiblioteca\python-packages -r C:\Apache24\htdocs\biblioteca_admin\requirements.txt
```

Los PDF se reescriben y linealizan sin rasterizar ni perder texto seleccionable.
Las portadas se convierten a WebP, se redimensionan y se optimizan
automáticamente. Una carga no se publica si falla la optimización o validación.

El token se conserva en la carpeta local de configuración de Windows, fuera de
`htdocs` y del repositorio. El gestor solo admite solicitudes originadas en el
equipo local.

## Agregar un PDF

Usa **Gestionar biblioteca** desde la página local. Crea categorías como
“Libros” y subcategorías como “Novelas”, y asígnalas a cada documento. Puedes
subir una portada para reemplazar el icono de la tarjeta; sin portada se
mantiene el icono. El gestor actualiza `manifest.json` y publica los archivos;
no es necesario editar el repositorio a mano. Las rutas de los PDF deben
conservar sus mayúsculas y minúsculas porque GitHub Pages las distingue.

## Uso del lector

- Busca con el campo superior o presiona `/` para enfocarlo.
- Filtra por colección desde la navegación lateral o el selector.
- Cuando una búsqueda o colección tiene más de 10 documentos, navega el catálogo con los controles de paginación.
- Cambia de página con los controles o las flechas izquierda/derecha.
- La búsqueda, colección, página del catálogo y último documento abierto se recuerdan al volver desde el mismo navegador y dispositivo. El zoom, avance de lectura y marcador también se guardan por documento; el tema y el menú lateral conservan sus preferencias.
- Los datos guardados viven en `localStorage` de este navegador: no se sincronizan con GitHub ni con otros dispositivos o navegadores.
- En el equipo local, la página abierta recibe automáticamente los cambios de
  categorías, documentos, textos y portada guardados desde el gestor. Los
  cambios de diseño se publican en GitHub al pulsar **Actualizar página**;
  las categorías y documentos se publican al guardarlos.
- Ajusta el zoom, abre el PDF original o descárgalo.
- En el móvil, amplía con los controles y desliza la página para recorrerla
  horizontal o verticalmente; al ajustar la página, un deslizamiento lateral
  cambia de página.
- En pantallas pequeñas, abre el menú con el botón superior izquierdo.

PDF.js se carga desde CDN, por lo que la lectura en el visor requiere conexión
a Internet. El enlace **Abrir PDF** también permite usar el visor nativo del
navegador.
