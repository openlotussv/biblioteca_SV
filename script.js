(() => {
    'use strict';

    const fallbackBooks = [
        {
            id: 'laura-zelada',
            title: 'Libro 1',
            author: 'Laura Zelada',
            description: 'Lectura digital de la colección de Laura Zelada.',
            category: 'Libros',
            file: 'documentos/pruebaLauraZelada.pdf',
            size: '2.8 MB',
            color: 'blue',
            icon: '▤'
        },
        {
            id: 'ben-reilly',
            title: 'Ben Reilly Spider-Man · Tomo #1',
            author: 'Colección de lectura',
            description: 'Documento de lectura en formato PDF.',
            category: 'Libros',
            file: 'documentos/BENREILYSPIDERMANTOMO1.pdf',
            size: '22.6 MB',
            color: 'purple',
            icon: '▤'
        },
        {
            id: 'menu-prueba',
            title: 'Menú de prueba',
            author: 'Material adicional',
            description: 'Documento PDF adicional disponible en la biblioteca.',
            category: 'Material adicional',
            file: 'documentos/MENUPRUEBA.pdf',
            size: '1.1 MB',
            color: 'green',
            icon: '▧'
        }
    ];

    let books = fallbackBooks;
    const elements = {};
    let activeCategory = 'all';
    let activeBook = null;
    let pdfDocument = null;
    let loadingTask = null;
    let renderTask = null;
    let renderSequence = 0;
    let zoom = 1;
    let resizeTimer = null;
    let lastPdfStageWidth = 0;

    function byId(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    function getCategories() {
        return [...new Set(books.map(book => book.category))];
    }

    function initializeElements() {
        [
            'side-navigation', 'book-search', 'book-count', 'category-count',
            'catalog-summary', 'category-filter', 'result-count', 'book-grid',
            'empty-state', 'catalog-notice', 'local-manager-link', 'catalog-view', 'reader-view', 'reader-title',
            'page-eyebrow', 'page-title-main', 'page-title-accent', 'page-subtitle', 'cover-link', 'cover-image',
            'reader-meta', 'breadcrumb-current', 'open-original', 'download-pdf',
            'page-input', 'page-count', 'prev-page', 'next-page', 'zoom-label',
            'zoom-out', 'zoom-in', 'toggle-fullscreen', 'pdf-stage', 'pdf-render',
            'reader-message', 'reader-error', 'reader-error-detail', 'retry-pdf',
            'back-to-catalog', 'toggle-sidebar', 'close-sidebar', 'sidebar', 'sidebar-backdrop'
        ].forEach(id => {
            elements[id] = byId(id);
        });
    }

    function initializeCatalog() {
        const categories = getCategories();
        elements['book-count'].textContent = String(books.length);
        elements['category-count'].textContent = String(categories.length);

        elements['category-filter'].replaceChildren();
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Todas las colecciones';
        elements['category-filter'].appendChild(allOption);

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            elements['category-filter'].appendChild(option);
        });

        elements['category-filter'].value = activeCategory;
        renderNavigation(categories);
        renderBooks();
    }

    async function loadCatalog() {
        try {
            const response = await fetch(`manifest.json?v=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const manifest = await response.json();
            if (manifest?.version !== 1 || !Array.isArray(manifest.books)) {
                throw new Error('El manifiesto no tiene un formato compatible.');
            }

            books = manifest.books.map(book => {
                if (!book || !/^[a-z0-9-]+$/.test(book.id || '')
                    || !['title', 'author', 'description', 'category', 'size'].every(key =>
                        typeof book[key] === 'string' && book[key].trim())
                    || !/^documentos\/[A-Za-z0-9._-]+\.pdf$/i.test(book.file || '')
                    || !['blue', 'purple', 'green'].includes(book.color)
                    || !['▤', '▧'].includes(book.icon)) {
                    throw new Error('El manifiesto contiene información de un documento inválida.');
                }
                return book;
            });
            if (activeCategory !== 'all' && !books.some(book => book.category === activeCategory)) {
                activeCategory = 'all';
            }
        } catch (error) {
            console.error('No se pudo cargar el catálogo publicado:', error);
            elements['catalog-notice'].textContent =
                'No se pudo actualizar el catálogo desde el repositorio. Se muestra la última lista incluida en esta página.';
            elements['catalog-notice'].hidden = false;
        }
    }

    async function loadPageSettings() {
        try {
            const response = await fetch(`site-settings.json?v=${Date.now()}`, { cache: 'no-store' });
            if (response.status === 404) return;
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const settings = await response.json();
            if (settings?.version !== 1
                || !['eyebrow', 'title', 'accent', 'subtitle'].every(key =>
                    typeof settings[key] === 'string' && settings[key].trim())
                || !/^img\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i.test(settings.cover || '')) {
                throw new Error('El archivo de configuración visual no tiene un formato compatible.');
            }

            elements['page-eyebrow'].textContent = settings.eyebrow;
            elements['page-title-main'].textContent = settings.title;
            elements['page-title-accent'].textContent = settings.accent;
            elements['page-subtitle'].textContent = settings.subtitle;
            elements['cover-link'].href = settings.cover;
            elements['cover-image'].src = settings.cover;
            elements['cover-link'].hidden = false;
        } catch (error) {
            console.error('No se pudo cargar la configuración de la página:', error);
            elements['catalog-notice'].textContent =
                'No se pudieron cargar los textos o la imagen de portada de la página.';
            elements['catalog-notice'].hidden = false;
        }
    }

    function renderNavigation(categories) {
        const navigationItems = [
            { category: 'all', label: 'Todo el catálogo', icon: '▦', count: books.length },
            ...categories.map((category, index) => ({
                category,
                label: category,
                icon: index === 0 ? '▤' : '▧',
                count: books.filter(book => book.category === category).length
            }))
        ];
        elements['side-navigation'].replaceChildren();

        navigationItems.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'nav-link';
            button.dataset.category = item.category;
            button.setAttribute('aria-current', item.category === activeCategory ? 'page' : 'false');
            if (item.category === activeCategory) button.classList.add('active');

            const icon = document.createElement('span');
            icon.className = 'nav-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = item.icon;
            const label = document.createElement('span');
            label.textContent = item.label;
            const count = document.createElement('span');
            count.className = 'nav-count';
            count.textContent = String(item.count);

            button.append(icon, label, count);
            button.addEventListener('click', () => {
                activeCategory = item.category;
                elements['category-filter'].value = item.category;
                elements['book-search'].value = '';
                renderNavigation(categories);
                renderBooks();
                showCatalog();
                closeSidebar();
            });
            elements['side-navigation'].appendChild(button);
        });
    }

    function renderBooks() {
        const search = elements['book-search'].value.trim().toLocaleLowerCase('es');
        const filtered = books.filter(book => {
            const matchesCategory = activeCategory === 'all' || book.category === activeCategory;
            const text = `${book.title} ${book.author} ${book.description} ${book.category}`.toLocaleLowerCase('es');
            return matchesCategory && text.includes(search);
        });

        elements['book-grid'].replaceChildren();
        elements['catalog-summary'].textContent = search
            ? `Resultados de búsqueda para “${elements['book-search'].value.trim()}”.`
            : 'Selecciona un documento para comenzar a leer.';
        elements['result-count'].textContent = `${filtered.length} ${filtered.length === 1 ? 'documento' : 'documentos'}`;
        elements['empty-state'].hidden = filtered.length !== 0;

        filtered.forEach(book => {
            const article = document.createElement('article');
            article.className = 'book-card';

            const art = document.createElement('div');
            art.className = `book-card-art art-${book.color}`;
            art.setAttribute('aria-hidden', 'true');
            const category = document.createElement('span');
            category.className = 'book-card-category';
            category.textContent = book.category;
            const icon = document.createElement('span');
            icon.className = 'book-art-icon';
            icon.textContent = book.icon;
            art.append(category, icon);

            const body = document.createElement('div');
            body.className = 'book-card-body';
            const title = document.createElement('h3');
            title.textContent = book.title;
            const description = document.createElement('p');
            description.textContent = `${book.author} · ${book.description}`;
            const footer = document.createElement('div');
            footer.className = 'book-card-footer';
            const size = document.createElement('span');
            size.className = 'book-file-size';
            size.textContent = `PDF · ${book.size}`;
            const readButton = document.createElement('button');
            readButton.type = 'button';
            readButton.className = 'read-button';
            readButton.textContent = 'Leer documento →';
            readButton.setAttribute('aria-label', `Leer ${book.title}`);
            readButton.addEventListener('click', () => openBook(book));
            footer.append(size, readButton);
            body.append(title, description, footer);
            article.append(art, body);
            elements['book-grid'].appendChild(article);
        });
    }

    function showCatalog() {
        elements['catalog-view'].hidden = false;
        elements['reader-view'].hidden = true;
        elements['breadcrumb-current'].textContent = 'Catálogo';
        document.title = 'Genuino | Biblioteca digital';
        closePdf();
    }

    async function openBook(book) {
        activeBook = book;
        zoom = 1;
        elements['catalog-view'].hidden = true;
        elements['reader-view'].hidden = false;
        elements['reader-title'].textContent = book.title;
        elements['reader-meta'].textContent = `${book.category} · ${book.author} · PDF`;
        elements['breadcrumb-current'].textContent = book.title;
        elements['open-original'].href = book.file;
        elements['download-pdf'].href = book.file;
        elements['download-pdf'].download = book.file.split('/').pop();
        elements['reader-error'].hidden = true;
        elements['reader-message'].hidden = false;
        elements['reader-message'].querySelector('strong').textContent = 'Cargando documento...';
        elements['pdf-render'].style.display = 'none';
        elements['page-count'].textContent = '—';
        elements['page-input'].value = '1';
        elements['page-input'].max = '1';
        elements['prev-page'].disabled = true;
        elements['next-page'].disabled = true;
        elements['zoom-label'].textContent = 'Ajustar';
        document.title = `${book.title} | Genuino`;
        closeSidebar();
        cancelCurrentPdf();

        if (!window.pdfjsLib) {
            showReaderError('No se pudo cargar el visor PDF. Revisa tu conexión a Internet o abre el archivo directamente.');
            return;
        }

        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        const sequence = renderSequence;
        try {
            const task = window.pdfjsLib.getDocument(book.file);
            loadingTask = task;
            pdfDocument = await task.promise;
            if (sequence !== renderSequence) return;
            if (loadingTask === task) loadingTask = null;

            elements['page-count'].textContent = String(pdfDocument.numPages);
            elements['page-input'].max = String(pdfDocument.numPages);
            elements['next-page'].disabled = pdfDocument.numPages <= 1;
            elements['reader-message'].hidden = true;
            elements['pdf-render'].style.display = 'block';
            await renderPage(1);
        } catch (error) {
            if (sequence !== renderSequence || error?.name === 'RenderingCancelledException') return;
            loadingTask = null;
            console.error('Error al cargar el PDF:', error);
            const isMissing = error?.name === 'MissingPDFException' || /404|not found/i.test(error?.message || '');
            showReaderError(isMissing
                ? `No se encontró “${book.file}”. Verifica el nombre y la ruta del PDF en el repositorio.`
                : 'No se pudo cargar el documento. Comprueba tu conexión e inténtalo de nuevo.');
        }
    }

    async function renderPage(pageNumber) {
        if (!pdfDocument || !activeBook) return;
        const sequence = ++renderSequence;
        if (renderTask) {
            renderTask.cancel();
            renderTask = null;
        }

        let currentTask = null;
        let renderCanvas = null;
        try {
            const page = await pdfDocument.getPage(pageNumber);
            if (sequence !== renderSequence) return;

            const baseViewport = page.getViewport({ scale: 1 });
            const availableWidth = Math.max(260, elements['pdf-stage'].clientWidth - 40);
            const fitScale = Math.min(availableWidth / baseViewport.width, 1.8);
            const scale = fitScale * zoom;
            const viewport = page.getViewport({ scale });
            const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

            renderCanvas = document.createElement('canvas');
            renderCanvas.width = Math.floor(viewport.width * pixelRatio);
            renderCanvas.height = Math.floor(viewport.height * pixelRatio);
            const context = renderCanvas.getContext('2d', { alpha: false });
            if (!context) throw new Error('No se pudo crear el contexto del visor PDF.');

            currentTask = page.render({
                canvasContext: context,
                viewport,
                transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0]
            });
            renderTask = currentTask;
            await currentTask.promise;
            if (sequence !== renderSequence) return;

            const canvas = elements['pdf-render'];
            canvas.width = renderCanvas.width;
            canvas.height = renderCanvas.height;
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;
            const visibleContext = canvas.getContext('2d', { alpha: false });
            if (!visibleContext) throw new Error('No se pudo actualizar el visor PDF.');
            visibleContext.drawImage(renderCanvas, 0, 0);

            elements['page-input'].value = String(pageNumber);
            elements['prev-page'].disabled = pageNumber <= 1;
            elements['next-page'].disabled = pageNumber >= pdfDocument.numPages;
            elements['zoom-label'].textContent = zoom === 1 ? 'Ajustar' : `${Math.round(zoom * 100)}%`;
        } catch (error) {
            if (error?.name !== 'RenderingCancelledException') {
                console.error('Error al renderizar la página:', error);
                showReaderError('No se pudo mostrar esta página del documento.');
            }
        } finally {
            if (renderTask === currentTask) renderTask = null;
            if (renderCanvas) {
                renderCanvas.width = 0;
                renderCanvas.height = 0;
            }
        }
    }

    function showReaderError(message) {
        elements['reader-message'].hidden = true;
        elements['pdf-render'].style.display = 'none';
        elements['reader-error-detail'].textContent = message;
        elements['reader-error'].hidden = false;
    }

    function cancelCurrentPdf() {
        renderSequence++;
        if (renderTask) {
            renderTask.cancel();
            renderTask = null;
        }
        if (loadingTask) {
            loadingTask.destroy();
            loadingTask = null;
        }
        pdfDocument = null;
    }

    function closePdf() {
        cancelCurrentPdf();
        activeBook = null;
        elements['pdf-render'].style.display = 'none';
    }

    function goToPage(value) {
        if (!pdfDocument) return;
        const number = Number.parseInt(value, 10);
        if (!Number.isFinite(number)) return;
        const pageNumber = Math.min(Math.max(number, 1), pdfDocument.numPages);
        renderPage(pageNumber);
    }

    function changeZoom(amount) {
        zoom = Math.min(2.5, Math.max(0.65, Math.round((zoom + amount) * 100) / 100));
        if (pdfDocument) renderPage(Number(elements['page-input'].value) || 1);
    }

    function openSidebar() {
        elements['sidebar'].classList.add('open');
        elements['sidebar-backdrop'].hidden = false;
        elements['toggle-sidebar'].setAttribute('aria-expanded', 'true');
        elements['toggle-sidebar'].setAttribute('aria-label', 'Cerrar navegación');
    }

    function closeSidebar() {
        elements['sidebar'].classList.remove('open');
        elements['sidebar-backdrop'].hidden = true;
        if (window.matchMedia('(max-width: 760px)').matches) {
            elements['toggle-sidebar'].setAttribute('aria-expanded', 'false');
            elements['toggle-sidebar'].setAttribute('aria-label', 'Abrir navegación');
        }
    }

    function toggleDesktopSidebar() {
        const collapsed = document.querySelector('.app-shell').classList.toggle('sidebar-collapsed');
        elements['toggle-sidebar'].setAttribute('aria-expanded', String(!collapsed));
        elements['toggle-sidebar'].setAttribute(
            'aria-label',
            collapsed ? 'Expandir navegación' : 'Plegar navegación'
        );
    }

    function connectEvents() {
        elements['book-search'].addEventListener('input', () => {
            activeCategory = elements['category-filter'].value;
            renderNavigation(getCategories());
            renderBooks();
            showCatalog();
        });

        elements['category-filter'].addEventListener('change', event => {
            activeCategory = event.target.value;
            renderNavigation(getCategories());
            renderBooks();
        });

        elements['back-to-catalog'].addEventListener('click', showCatalog);
        elements['prev-page'].addEventListener('click', () => {
            goToPage((Number(elements['page-input'].value) || 1) - 1);
        });
        elements['next-page'].addEventListener('click', () => {
            goToPage((Number(elements['page-input'].value) || 1) + 1);
        });
        elements['page-input'].addEventListener('change', event => goToPage(event.target.value));
        elements['page-input'].addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                goToPage(event.target.value);
                event.target.blur();
            }
        });
        elements['zoom-out'].addEventListener('click', () => changeZoom(-0.15));
        elements['zoom-in'].addEventListener('click', () => changeZoom(0.15));
        elements['retry-pdf'].addEventListener('click', () => {
            if (activeBook) openBook(activeBook);
        });
        elements['toggle-sidebar'].addEventListener('click', () => {
            if (window.matchMedia('(max-width: 760px)').matches) {
                if (elements['sidebar'].classList.contains('open')) closeSidebar();
                else openSidebar();
            } else {
                toggleDesktopSidebar();
            }
        });
        elements['close-sidebar'].addEventListener('click', closeSidebar);
        elements['sidebar-backdrop'].addEventListener('click', closeSidebar);
        elements['toggle-fullscreen'].addEventListener('click', async () => {
            try {
                if (!document.fullscreenElement) await elements['pdf-stage'].requestFullscreen();
                else await document.exitFullscreen();
            } catch (error) {
                console.error('No se pudo activar la pantalla completa:', error);
            }
        });

        document.addEventListener('keydown', event => {
            if (event.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                event.preventDefault();
                elements['book-search'].focus();
            }
            if (elements['reader-view'].hidden || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            if (event.key === 'ArrowLeft' && pdfDocument && Number(elements['page-input'].value) > 1) {
                goToPage(Number(elements['page-input'].value) - 1);
            } else if (event.key === 'ArrowRight' && pdfDocument
                && Number(elements['page-input'].value) < pdfDocument.numPages) {
                goToPage(Number(elements['page-input'].value) + 1);
            } else if (event.key === 'Escape') {
                closeSidebar();
            }
        });

        function schedulePdfFit() {
            if (!pdfDocument) return;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => goToPage(elements['page-input'].value), 120);
        }

        if ('ResizeObserver' in window) {
            const stageObserver = new ResizeObserver(entries => {
                const width = Math.round(entries[0].contentRect.width);
                if (width === lastPdfStageWidth) return;
                lastPdfStageWidth = width;
                schedulePdfFit();
            });
            stageObserver.observe(elements['pdf-stage']);
        } else {
            window.addEventListener('resize', schedulePdfFit);
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        initializeElements();
        connectEvents();
        const mobileLayout = window.matchMedia('(max-width: 760px)').matches;
        elements['toggle-sidebar'].setAttribute('aria-expanded', String(!mobileLayout));
        elements['toggle-sidebar'].setAttribute(
            'aria-label',
            mobileLayout ? 'Abrir navegación' : 'Plegar navegación'
        );
        elements['local-manager-link'].hidden =
            !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
        initializeCatalog();
        Promise.all([loadCatalog(), loadPageSettings()]).then(initializeCatalog);
    }, { once: true });
})();
