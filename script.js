(() => {
    'use strict';

    const fallbackBooks = [
        {
            id: 'laura-zelada',
            title: 'Libro 1',
            author: 'Laura Zelada',
            description: 'Lectura digital de la colección de Laura Zelada.',
            category: 'Libros',
            subcategory: '',
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
            subcategory: '',
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
            subcategory: '',
            file: 'documentos/MENUPRUEBA.pdf',
            size: '1.1 MB',
            color: 'green',
            icon: '▧'
        }
    ];

    let books = fallbackBooks;
    let categoryDefinitions = [];
    const elements = {};
    let activeCategory = 'all';
    let expandedCategories = [];
    const catalogPageSize = 10;
    let currentCatalogPage = 1;
    let catalogLoaded = false;
    let lastOpenedBookId = null;
    let activeBook = null;
    let pdfDocument = null;
    let loadingTask = null;
    let renderTask = null;
    let pageTurnAnimation = null;
    let renderSequence = 0;
    let zoom = 1;
    let resizeTimer = null;
    let pageStatusTimer = null;
    let lastPdfStageWidth = 0;
    let currentPageNumber = 1;
    let pdfLayoutReady = false;
    const themeStorageKey = 'genuino-library-theme-v1';
    const appStateStorageKey = 'luna-cloud-book-state-v1';
    const siteRefreshStorageKey = 'luna-cloud-book-site-refresh-v1';
    const progressStoragePrefix = 'genuino-library-progress-v1:';
    const bookmarkStoragePrefix = 'luna-cloud-book-bookmark-v1:';
    const zoomStoragePrefix = 'luna-cloud-book-zoom-v1:';

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
        return categoryDefinitions.length
            ? categoryDefinitions
            : [...new Set(books.map(book => book.category))].map(name => ({ name, subcategories: [] }));
    }

    function categoryFilterKey(category, subcategory = '') {
        return JSON.stringify([category, subcategory]);
    }

    function initializeElements() {
        [
            'side-navigation', 'book-search', 'book-count', 'category-count',
            'catalog-summary', 'category-filter', 'result-count', 'book-grid', 'catalog-pagination',
            'empty-state', 'catalog-notice', 'local-manager-link', 'catalog-view', 'reader-view', 'reader-title',
            'page-eyebrow', 'page-title-main', 'page-title-accent', 'page-subtitle', 'cover-display', 'cover-image',
            'reader-meta', 'breadcrumb-current', 'open-original', 'download-pdf',
            'page-input', 'page-count', 'prev-page', 'next-page', 'zoom-label',
            'zoom-out', 'zoom-in', 'toggle-fullscreen', 'pdf-stage', 'pdf-render',
            'pdf-page-stack', 'pdf-next-render', 'prev-page-overlay', 'next-page-overlay',
            'pdf-page-status', 'pdf-fullscreen-title',
            'reader-message', 'reader-error', 'reader-error-detail', 'retry-pdf',
            'back-to-catalog', 'toggle-sidebar', 'close-sidebar', 'sidebar', 'sidebar-backdrop',
            'theme-toggle', 'reading-progress-status', 'bookmark-page', 'bookmark-page-label',
            'bookmark-status'
        ].forEach(id => {
            elements[id] = byId(id);
        });
    }

    function setTheme(theme, persist = true) {
        const isDark = theme === 'dark';
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
        elements['theme-toggle'].setAttribute('aria-pressed', String(isDark));
        elements['theme-toggle'].setAttribute(
            'aria-label',
            isDark ? 'Activar modo claro' : 'Activar modo oscuro'
        );
        elements['theme-toggle'].title = isDark ? 'Modo oscuro · activar modo claro' : 'Modo claro · activar modo oscuro';
        if (!persist) return;
        try {
            localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light');
        } catch (error) {
            console.error('No se pudo guardar el tema en este navegador:', error);
            showStorageWarning('No se pudo guardar el modo de color en este navegador.');
        }
    }

    function initializeTheme() {
        let theme = 'light';
        try {
            theme = localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light';
        } catch (error) {
            console.error('No se pudo leer el modo de color guardado:', error);
            showStorageWarning('No se pudo leer la preferencia de color de este navegador.');
        }
        setTheme(theme, false);
    }

    function showStorageWarning(message) {
        elements['catalog-notice'].textContent = message;
        elements['catalog-notice'].hidden = false;
    }

    function restoreAppState() {
        try {
            const storedState = localStorage.getItem(appStateStorageKey);
            if (storedState === null) return;
            const state = JSON.parse(storedState);
            if (!state || typeof state !== 'object' || Array.isArray(state)) {
                throw new Error('El estado guardado no tiene un formato compatible.');
            }
            if (typeof state.category === 'string' && state.category.length <= 200) {
                activeCategory = state.category;
            }
            if (typeof state.search === 'string' && state.search.length <= 2000) {
                elements['book-search'].value = state.search;
            }
            if (Number.isInteger(state.catalogPage) && state.catalogPage > 0) {
                currentCatalogPage = state.catalogPage;
            }
            if (typeof state.lastBookId === 'string' && /^[a-z0-9-]+$/.test(state.lastBookId)) {
                lastOpenedBookId = state.lastBookId;
            }
            if (Array.isArray(state.expandedCategories)
                && state.expandedCategories.every(category =>
                    typeof category === 'string' && category.length <= 80)) {
                expandedCategories = [...new Set(state.expandedCategories)];
            }
            if (typeof state.sidebarCollapsed === 'boolean') {
                document.querySelector('.app-shell')
                    .classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
            }
        } catch (error) {
            console.error('No se pudo restaurar el estado guardado de la biblioteca:', error);
            showStorageWarning('No se pudo restaurar el estado guardado de esta biblioteca.');
        }
    }

    function persistAppState() {
        const state = {
            category: activeCategory,
            search: elements['book-search'].value,
            catalogPage: currentCatalogPage,
            sidebarCollapsed: document.querySelector('.app-shell')
                .classList.contains('sidebar-collapsed'),
            lastBookId: lastOpenedBookId,
            expandedCategories
        };
        try {
            localStorage.setItem(appStateStorageKey, JSON.stringify(state));
        } catch (error) {
            console.error('No se pudo guardar el estado de la biblioteca:', error);
            showStorageWarning('No se pudo guardar el estado. Revisa el almacenamiento de este navegador.');
        }
    }

    function savedZoomFor(book) {
        try {
            const storedZoom = Number.parseFloat(localStorage.getItem(zoomStoragePrefix + book.id));
            return Number.isFinite(storedZoom) && storedZoom >= 0.65 && storedZoom <= 2.5
                ? storedZoom
                : 1;
        } catch (error) {
            console.error('No se pudo leer el zoom guardado:', error);
            showStorageWarning('No se pudo leer el zoom guardado de este documento.');
            return 1;
        }
    }

    function saveZoomFor(book) {
        try {
            localStorage.setItem(zoomStoragePrefix + book.id, String(zoom));
        } catch (error) {
            console.error('No se pudo guardar el zoom del documento:', error);
            showStorageWarning('No se pudo guardar el zoom de este documento.');
        }
    }

    function savedPageFor(book) {
        try {
            const page = Number.parseInt(localStorage.getItem(progressStoragePrefix + book.id), 10);
            return Number.isInteger(page) && page > 0 ? page : 1;
        } catch (error) {
            console.error('No se pudo leer el avance guardado en este navegador:', error);
            elements['reading-progress-status'].textContent =
                'No se pudo leer el avance guardado en este navegador.';
            elements['reading-progress-status'].hidden = false;
            return 1;
        }
    }

    function saveCurrentPage(pageNumber) {
        if (!activeBook) return;
        try {
            localStorage.setItem(progressStoragePrefix + activeBook.id, String(pageNumber));
            elements['reading-progress-status'].textContent =
                'Avance guardado en este navegador y dispositivo.';
            elements['reading-progress-status'].hidden = false;
        } catch (error) {
            console.error('No se pudo guardar el avance de lectura:', error);
            elements['reading-progress-status'].textContent =
                'No se pudo guardar el avance. Revisa el almacenamiento de este navegador.';
            elements['reading-progress-status'].hidden = false;
        }
        elements['pdf-page-status'].textContent = elements['reading-progress-status'].textContent.includes('No se pudo')
            ? `Página ${pageNumber} de ${pdfDocument.numPages} · no se pudo guardar`
            : `Página ${pageNumber} de ${pdfDocument.numPages} · guardada en este dispositivo`;
        elements['pdf-page-status'].hidden = false;
        clearTimeout(pageStatusTimer);
        pageStatusTimer = setTimeout(() => {
            elements['pdf-page-status'].hidden = true;
            pageStatusTimer = null;
        }, 3000);
        updateBookmarkControl();
    }

    function updateBookmarkControl() {
        if (!activeBook) return;
        try {
            const value = localStorage.getItem(bookmarkStoragePrefix + activeBook.id);
            const bookmarkPage = value === null ? null : Number.parseInt(value, 10);
            const isMarked = Number.isInteger(bookmarkPage) && bookmarkPage > 0;
            const isCurrentPageMarked = isMarked && bookmarkPage === currentPageNumber;
            elements['bookmark-page'].disabled = !pdfDocument;
            elements['bookmark-page'].setAttribute('aria-pressed', String(isCurrentPageMarked));
            elements['bookmark-page-label'].textContent = isCurrentPageMarked
                ? 'Quitar marcador'
                : 'Marcar página';
            elements['bookmark-status'].textContent = isMarked
                ? `Marcador guardado en la página ${bookmarkPage}.`
                : 'Puedes marcar una página para volver a ella.';
            elements['bookmark-status'].hidden = false;
        } catch (error) {
            console.error('No se pudo leer el marcador guardado:', error);
            elements['bookmark-page'].disabled = true;
            elements['bookmark-status'].textContent =
                'No se pudo leer el marcador guardado en este navegador.';
            elements['bookmark-status'].hidden = false;
        }
    }

    function togglePageBookmark() {
        if (!activeBook || !pdfDocument) return;
        const key = bookmarkStoragePrefix + activeBook.id;
        try {
            const storedPage = Number.parseInt(localStorage.getItem(key), 10);
            if (storedPage === currentPageNumber) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, String(currentPageNumber));
            }
            updateBookmarkControl();
        } catch (error) {
            console.error('No se pudo guardar el marcador de página:', error);
            elements['bookmark-status'].textContent =
                'No se pudo guardar el marcador. Revisa el almacenamiento de este navegador.';
            elements['bookmark-status'].hidden = false;
        }
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
            option.value = categoryFilterKey(category.name);
            option.textContent = category.name;
            elements['category-filter'].appendChild(option);
            category.subcategories.forEach(subcategory => {
                const childOption = document.createElement('option');
                childOption.value = categoryFilterKey(category.name, subcategory);
                childOption.textContent = `${category.name} · ${subcategory}`;
                elements['category-filter'].appendChild(childOption);
            });
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

            const bookIds = new Set();
            const loadedBooks = manifest.books.map(book => {
                if (!book || !/^[a-z0-9-]+$/.test(book.id || '')
                    || !['title', 'author', 'description', 'category', 'size'].every(key =>
                        typeof book[key] === 'string' && book[key].trim())
                    || !/^documentos\/[A-Za-z0-9._-]+\.pdf$/i.test(book.file || '')
                    || !['blue', 'purple', 'green'].includes(book.color)
                    || !['▤', '▧'].includes(book.icon)
                    || (book.subcategory !== undefined
                        && (typeof book.subcategory !== 'string' || book.subcategory.length > 80))
                    || (book.cover !== undefined
                        && !/^img\/books\/[A-Za-z0-9._-]+\.webp$/i.test(book.cover))) {
                    throw new Error('El manifiesto contiene información de un documento inválida.');
                }
                if (bookIds.has(book.id)) {
                    throw new Error('El manifiesto contiene identificadores de documento repetidos.');
                }
                bookIds.add(book.id);
                return book;
            });
            let loadedCategories;
            if (manifest.categories === undefined) {
                loadedCategories = [...new Set(loadedBooks.map(book => book.category))]
                    .map(name => ({ name, subcategories: [] }));
            } else {
                if (!Array.isArray(manifest.categories)) {
                    throw new Error('Las categorías del manifiesto no tienen un formato compatible.');
                }
                loadedCategories = manifest.categories.map(category => {
                    if (!category || typeof category.name !== 'string' || !category.name.trim()
                        || category.name.length > 80 || !Array.isArray(category.subcategories)
                        || category.subcategories.some(name =>
                            typeof name !== 'string' || !name.trim() || name.length > 80)) {
                        throw new Error('El manifiesto contiene una categoría inválida.');
                    }
                    return { name: category.name, subcategories: category.subcategories };
                });
            }
            const categoryNames = new Set(loadedCategories.map(category => category.name.toLocaleLowerCase('es')));
            if (categoryNames.size !== loadedCategories.length
                || loadedCategories.some(category =>
                    new Set(category.subcategories.map(name => name.toLocaleLowerCase('es'))).size
                        !== category.subcategories.length)
                || loadedBooks.some(book => !categoryNames.has(book.category.toLocaleLowerCase('es'))
                    || (book.subcategory
                        && !loadedCategories.find(category => category.name === book.category)
                            ?.subcategories.includes(book.subcategory)))) {
                throw new Error('El manifiesto contiene categorías repetidas o asignaciones inválidas.');
            }
            books = loadedBooks;
            categoryDefinitions = loadedCategories;
            catalogLoaded = true;
            const availableFilters = new Set(['all']);
            loadedCategories.forEach(category => {
                availableFilters.add(categoryFilterKey(category.name));
                category.subcategories.forEach(subcategory => {
                    availableFilters.add(categoryFilterKey(category.name, subcategory));
                });
            });
            if (!availableFilters.has(activeCategory)) {
                activeCategory = 'all';
                currentCatalogPage = 1;
            }
            persistAppState();
        } catch (error) {
            catalogLoaded = true;
            console.error('No se pudo cargar el catálogo publicado:', error);
            elements['catalog-notice'].textContent =
                'No se pudo actualizar el catálogo desde el repositorio. Se muestra la última lista incluida en esta página.';
            elements['catalog-notice'].hidden = false;
            const availableFilters = new Set(['all']);
            const categories = getCategories();
            categories.forEach(category => {
                availableFilters.add(categoryFilterKey(category.name));
                category.subcategories.forEach(subcategory => {
                    availableFilters.add(categoryFilterKey(category.name, subcategory));
                });
            });
            if (!availableFilters.has(activeCategory)) {
                activeCategory = 'all';
                currentCatalogPage = 1;
                persistAppState();
            }
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
            elements['cover-image'].src = `${settings.cover}?v=${Date.now()}`;
            elements['cover-display'].hidden = false;
        } catch (error) {
            console.error('No se pudo cargar la configuración de la página:', error);
            elements['catalog-notice'].textContent =
                'No se pudieron cargar los textos o la imagen de portada de la página.';
            elements['catalog-notice'].hidden = false;
        }
    }

    async function refreshFromManager(scope) {
        if (scope === 'catalog' || scope === 'all') {
            await loadCatalog();
            initializeCatalog();
            if (activeBook && !books.some(book => book.id === activeBook.id)) {
                showCatalog();
            }
        }
        if (scope === 'page' || scope === 'all') {
            await loadPageSettings();
        }
    }

    function renderNavigation(categories) {
        elements['side-navigation'].replaceChildren();

        function createFilterButton(item, parentCategory = '') {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'nav-link';
            if (parentCategory) button.classList.add('nav-link-subcategory');
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
                if (parentCategory && !expandedCategories.includes(parentCategory)) {
                    expandedCategories.push(parentCategory);
                }
                currentCatalogPage = 1;
                elements['category-filter'].value = item.category;
                elements['book-search'].value = '';
                persistAppState();
                renderNavigation(categories);
                renderBooks();
                showCatalog();
                closeSidebar();
            });
            return button;
        }

        elements['side-navigation'].appendChild(createFilterButton({
            category: 'all',
            label: 'Todo el catálogo',
            icon: '▦',
            count: books.length
        }));

        categories.forEach((category, index) => {
            const group = document.createElement('section');
            group.className = 'nav-category-group';
            const heading = document.createElement('div');
            heading.className = 'nav-category-heading';
            heading.appendChild(createFilterButton({
                category: categoryFilterKey(category.name),
                label: category.name,
                icon: index === 0 ? '▤' : '▧',
                count: books.filter(book => book.category === category.name).length
            }));

            const subcategoryList = document.createElement('div');
            const subcategoryListId = `nav-subcategories-${index}`;
            const isExpanded = expandedCategories.includes(category.name);
            subcategoryList.className = 'nav-subcategory-list';
            subcategoryList.id = subcategoryListId;
            subcategoryList.hidden = !isExpanded;

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'nav-category-toggle';
            toggle.setAttribute('aria-expanded', String(isExpanded));
            toggle.setAttribute('aria-controls', subcategoryListId);
            toggle.setAttribute('aria-label', `${isExpanded ? 'Contraer' : 'Expandir'} ${category.name}`);
            toggle.title = `${isExpanded ? 'Contraer' : 'Expandir'} ${category.name}`;
            toggle.innerHTML =
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>';
            toggle.addEventListener('click', () => {
                const shouldExpand = toggle.getAttribute('aria-expanded') !== 'true';
                expandedCategories = shouldExpand
                    ? [...new Set([...expandedCategories, category.name])]
                    : expandedCategories.filter(name => name !== category.name);
                persistAppState();
                renderNavigation(categories);
                elements['side-navigation']
                    .querySelector(`[aria-controls="${subcategoryListId}"]`)
                    ?.focus({ preventScroll: true });
            });

            heading.appendChild(toggle);
            group.append(heading, subcategoryList);
            elements['side-navigation'].appendChild(group);

            category.subcategories.forEach(subcategory => {
                subcategoryList.appendChild(createFilterButton({
                    category: categoryFilterKey(category.name, subcategory),
                    label: subcategory,
                    icon: '·',
                    count: books.filter(book =>
                        book.category === category.name && book.subcategory === subcategory).length
                }, category.name));
            });
        });
    }

    function renderBooks() {
        const search = elements['book-search'].value.trim().toLocaleLowerCase('es');
        const filtered = books.filter(book => {
            let selectedParent = '';
            let selectedSubcategory = '';
            if (activeCategory !== 'all') {
                try {
                    [selectedParent, selectedSubcategory] = JSON.parse(activeCategory);
                } catch (error) {
                    console.error('El filtro de categoría seleccionado no es válido:', error);
                }
            }
            const matchesCategory = activeCategory === 'all'
                || (book.category === selectedParent
                    && (!selectedSubcategory || book.subcategory === selectedSubcategory));
            const text = `${book.title} ${book.author} ${book.description} ${book.category} ${book.subcategory || ''}`
                .toLocaleLowerCase('es');
            return matchesCategory && text.includes(search);
        });

        const totalPages = Math.ceil(filtered.length / catalogPageSize);
        if (catalogLoaded) {
            const validPage = Math.min(currentCatalogPage, Math.max(totalPages, 1));
            if (validPage !== currentCatalogPage) {
                currentCatalogPage = validPage;
                persistAppState();
            }
        }
        const firstBookIndex = (currentCatalogPage - 1) * catalogPageSize;
        const visibleBooks = filtered.slice(firstBookIndex, firstBookIndex + catalogPageSize);

        elements['book-grid'].replaceChildren();
        elements['catalog-summary'].textContent = search
            ? `Resultados de búsqueda para “${elements['book-search'].value.trim()}”.`
            : 'Selecciona un documento para comenzar a leer.';
        elements['result-count'].textContent = `${filtered.length} ${filtered.length === 1 ? 'documento' : 'documentos'}`;
        elements['empty-state'].hidden = filtered.length !== 0;
        renderCatalogPagination(totalPages, filtered.length, firstBookIndex, visibleBooks.length);

        visibleBooks.forEach(book => {
            const article = document.createElement('article');
            article.className = 'book-card';

            const art = document.createElement('div');
            art.className = `book-card-art art-${book.color}`;
            art.setAttribute('aria-hidden', 'true');
            const category = document.createElement('span');
            category.className = 'book-card-category';
            category.textContent = book.subcategory ? `${book.category} · ${book.subcategory}` : book.category;
            const icon = document.createElement('span');
            icon.className = 'book-art-icon';
            icon.textContent = book.icon;
            art.append(category, icon);
            if (book.cover) {
                art.classList.add('has-cover');
                art.removeAttribute('aria-hidden');
                const cover = document.createElement('img');
                cover.className = 'book-cover-image';
                cover.src = book.cover;
                cover.alt = `Portada de ${book.title}`;
                cover.loading = 'lazy';
                cover.decoding = 'async';
                cover.addEventListener('error', () => {
                    art.classList.remove('has-cover');
                    cover.remove();
                }, { once: true });
                art.appendChild(cover);
            }

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

    function renderCatalogPagination(totalPages, totalBooks, firstBookIndex, visibleBookCount) {
        const navigation = elements['catalog-pagination'];
        navigation.replaceChildren();
        navigation.hidden = totalPages <= 1;
        if (navigation.hidden) return;

        const summary = document.createElement('span');
        summary.className = 'pagination-summary';
        summary.textContent =
            `Mostrando ${firstBookIndex + 1}–${firstBookIndex + visibleBookCount} de ${totalBooks} documentos`;
        const controls = document.createElement('div');
        controls.className = 'pagination-controls';

        const addPageButton = (page, label, isCurrent = false) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pagination-button';
            button.textContent = label;
            button.setAttribute('aria-label', `Página ${page}`);
            if (isCurrent) button.setAttribute('aria-current', 'page');
            button.addEventListener('click', () => {
                goToCatalogPage(page);
            });
            controls.appendChild(button);
        };

        const addEllipsis = () => {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.setAttribute('aria-hidden', 'true');
            ellipsis.textContent = '…';
            controls.appendChild(ellipsis);
        };

        const previous = document.createElement('button');
        previous.type = 'button';
        previous.className = 'pagination-button pagination-direction';
        previous.textContent = 'Anterior';
        previous.setAttribute('aria-label', 'Página anterior');
        previous.disabled = currentCatalogPage === 1;
        previous.addEventListener('click', () => {
            goToCatalogPage(currentCatalogPage - 1);
        });
        controls.appendChild(previous);

        let firstPage = Math.max(1, currentCatalogPage - 2);
        let lastPage = Math.min(totalPages, firstPage + 4);
        firstPage = Math.max(1, lastPage - 4);
        if (firstPage > 1) {
            addPageButton(1, '1', currentCatalogPage === 1);
            if (firstPage > 2) addEllipsis();
        }
        for (let page = firstPage; page <= lastPage; page += 1) {
            addPageButton(page, String(page), currentCatalogPage === page);
        }
        if (lastPage < totalPages) {
            if (lastPage < totalPages - 1) addEllipsis();
            addPageButton(totalPages, String(totalPages), currentCatalogPage === totalPages);
        }

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'pagination-button pagination-direction';
        next.textContent = 'Siguiente';
        next.setAttribute('aria-label', 'Página siguiente');
        next.disabled = currentCatalogPage === totalPages;
        next.addEventListener('click', () => {
            goToCatalogPage(currentCatalogPage + 1);
        });
        controls.appendChild(next);

        navigation.append(summary, controls);
    }

    function goToCatalogPage(page) {
        currentCatalogPage = page;
        persistAppState();
        renderBooks();
        elements['catalog-pagination']
            .querySelector('[aria-current="page"]')
            ?.focus({ preventScroll: true });
        elements['book-grid'].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function showCatalog() {
        lastOpenedBookId = null;
        persistAppState();
        elements['catalog-view'].hidden = false;
        elements['reader-view'].hidden = true;
        elements['breadcrumb-current'].textContent = 'Catálogo';
        document.title = 'Luna Cloud Book | Biblioteca digital';
        closePdf();
    }

    async function openBook(book) {
        activeBook = book;
        lastOpenedBookId = book.id;
        persistAppState();
        currentPageNumber = 1;
        pdfLayoutReady = false;
        zoom = savedZoomFor(book);
        elements['catalog-view'].hidden = true;
        elements['reader-view'].hidden = false;
        elements['reader-title'].textContent = book.title;
        elements['reader-meta'].textContent =
            `${book.category}${book.subcategory ? ` · ${book.subcategory}` : ''} · ${book.author} · PDF`;
        elements['breadcrumb-current'].textContent = book.title;
        elements['open-original'].href = book.file;
        elements['download-pdf'].href = book.file;
        elements['download-pdf'].download = book.file.split('/').pop();
        elements['reader-error'].hidden = true;
        elements['reading-progress-status'].hidden = true;
        elements['bookmark-status'].hidden = true;
        elements['bookmark-page'].disabled = true;
        elements['bookmark-page'].setAttribute('aria-pressed', 'false');
        elements['bookmark-page-label'].textContent = 'Marcar página';
        elements['reader-message'].hidden = false;
        elements['reader-message'].querySelector('strong').textContent = 'Cargando documento...';
        elements['pdf-render'].style.display = 'none';
        elements['page-count'].textContent = '—';
        elements['page-input'].value = '1';
        elements['page-input'].max = '1';
        elements['prev-page'].disabled = true;
        elements['next-page'].disabled = true;
        elements['prev-page-overlay'].disabled = true;
        elements['next-page-overlay'].disabled = true;
        elements['pdf-page-status'].textContent = 'Cargando página…';
        elements['zoom-label'].textContent = 'Ajustar';
        document.title = `${book.title} | Luna Cloud Book`;
        elements['pdf-fullscreen-title'].textContent = book.title;
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
            elements['next-page-overlay'].disabled = pdfDocument.numPages <= 1;
            updateBookmarkControl();
            const savedPage = savedPageFor(book);
            const resumePage = Math.min(savedPage, pdfDocument.numPages);
            if (resumePage > 1) {
                elements['reading-progress-status'].textContent =
                    `Continuando desde la página ${resumePage}. El avance se guarda en este navegador y dispositivo.`;
                elements['reading-progress-status'].hidden = false;
            } else if (elements['reading-progress-status'].hidden) {
                elements['reading-progress-status'].textContent =
                    'El avance de lectura se guarda en este navegador y dispositivo.';
                elements['reading-progress-status'].hidden = false;
            }
            elements['reader-message'].hidden = true;
            elements['pdf-render'].style.display = 'block';
            await renderPage(resumePage);
            pdfLayoutReady = activeBook === book && currentPageNumber === resumePage;
            if (resumePage > 1 && pdfLayoutReady) {
                elements['reading-progress-status'].textContent =
                    `Continuando desde la página ${resumePage}. El avance se guarda en este navegador y dispositivo.`;
            }
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

    function resetPageTurn() {
        if (pageTurnAnimation) {
            pageTurnAnimation.cancel();
            pageTurnAnimation = null;
        }
        elements['pdf-render'].style.transform = '';
        elements['pdf-render'].style.transformOrigin = '';
        elements['pdf-render'].style.boxShadow = '';
        elements['pdf-next-render'].hidden = true;
    }

    async function renderPage(pageNumber, turnDirection = 0) {
        if (!pdfDocument || !activeBook) return;
        const sequence = ++renderSequence;
        resetPageTurn();
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
            canvas.classList.toggle('pdf-swipe-enabled', viewport.width <= availableWidth);

            if (turnDirection !== 0 && currentPageNumber !== pageNumber
                && typeof canvas.animate === 'function') {
                const nextCanvas = elements['pdf-next-render'];
                nextCanvas.width = renderCanvas.width;
                nextCanvas.height = renderCanvas.height;
                nextCanvas.style.width = `${Math.floor(viewport.width)}px`;
                nextCanvas.style.height = `${Math.floor(viewport.height)}px`;
                const nextContext = nextCanvas.getContext('2d', { alpha: false });
                if (!nextContext) throw new Error('No se pudo preparar la animación de página.');
                nextContext.drawImage(renderCanvas, 0, 0);
                elements['pdf-page-stack'].style.width = `${Math.floor(viewport.width)}px`;
                elements['pdf-page-stack'].style.height = `${Math.floor(viewport.height)}px`;
                nextCanvas.hidden = false;
                canvas.style.transformOrigin = turnDirection > 0 ? 'left center' : 'right center';
                pageTurnAnimation = canvas.animate(
                    [
                        { transform: 'rotateY(0deg)', boxShadow: '0 5px 18px #28364b26' },
                        {
                            transform: `rotateY(${turnDirection > 0 ? '-180deg' : '180deg'})`,
                            boxShadow: '0 2px 6px #10182710'
                        }
                    ],
                    {
                        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 420,
                        easing: 'cubic-bezier(.45, 0, .2, 1)',
                        fill: 'forwards'
                    }
                );
                await pageTurnAnimation.finished;
                if (sequence !== renderSequence) return;
                canvas.width = renderCanvas.width;
                canvas.height = renderCanvas.height;
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;
                const visibleContext = canvas.getContext('2d', { alpha: false });
                if (!visibleContext) throw new Error('No se pudo actualizar el visor PDF.');
                visibleContext.drawImage(renderCanvas, 0, 0);
                resetPageTurn();
            } else {
                canvas.width = renderCanvas.width;
                canvas.height = renderCanvas.height;
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;
                elements['pdf-page-stack'].style.width = `${Math.floor(viewport.width)}px`;
                elements['pdf-page-stack'].style.height = `${Math.floor(viewport.height)}px`;
                const visibleContext = canvas.getContext('2d', { alpha: false });
                if (!visibleContext) throw new Error('No se pudo actualizar el visor PDF.');
                visibleContext.drawImage(renderCanvas, 0, 0);
            }

            elements['page-input'].value = String(pageNumber);
            currentPageNumber = pageNumber;
            elements['prev-page'].disabled = pageNumber <= 1;
            elements['next-page'].disabled = pageNumber >= pdfDocument.numPages;
            elements['prev-page-overlay'].disabled = pageNumber <= 1;
            elements['next-page-overlay'].disabled = pageNumber >= pdfDocument.numPages;
            elements['zoom-label'].textContent = zoom === 1 ? 'Ajustar' : `${Math.round(zoom * 100)}%`;
            saveCurrentPage(pageNumber);
        } catch (error) {
            if (sequence !== renderSequence || error?.name === 'AbortError') return;
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
        resetPageTurn();
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
        pdfLayoutReady = false;
        elements['pdf-render'].style.display = 'none';
    }

    function goToPage(value) {
        if (!pdfDocument) return;
        const number = Number.parseInt(value, 10);
        if (!Number.isFinite(number)) return;
        const pageNumber = Math.min(Math.max(number, 1), pdfDocument.numPages);
        const currentPage = currentPageNumber;
        const direction = Math.abs(pageNumber - currentPage) === 1
            ? (pageNumber > currentPage ? 1 : -1)
            : 0;
        renderPage(pageNumber, direction);
    }

    function changeZoom(amount) {
        zoom = Math.min(2.5, Math.max(0.65, Math.round((zoom + amount) * 100) / 100));
        if (activeBook) saveZoomFor(activeBook);
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
        persistAppState();
        elements['toggle-sidebar'].setAttribute('aria-expanded', String(!collapsed));
        elements['toggle-sidebar'].setAttribute(
            'aria-label',
            collapsed ? 'Expandir navegación' : 'Plegar navegación'
        );
    }

    function connectEvents() {
        elements['theme-toggle'].addEventListener('click', () => {
            setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
        });
        elements['book-search'].addEventListener('input', () => {
            activeCategory = elements['category-filter'].value;
            currentCatalogPage = 1;
            persistAppState();
            renderNavigation(getCategories());
            renderBooks();
            showCatalog();
        });

        elements['category-filter'].addEventListener('change', event => {
            activeCategory = event.target.value;
            currentCatalogPage = 1;
            persistAppState();
            renderNavigation(getCategories());
            renderBooks();
        });

        elements['back-to-catalog'].addEventListener('click', showCatalog);
        elements['bookmark-page'].addEventListener('click', togglePageBookmark);
        elements['prev-page'].addEventListener('click', () => {
            goToPage(currentPageNumber - 1);
        });
        elements['next-page'].addEventListener('click', () => {
            goToPage(currentPageNumber + 1);
        });
        elements['prev-page-overlay'].addEventListener('click', () => {
            goToPage(currentPageNumber - 1);
        });
        elements['next-page-overlay'].addEventListener('click', () => {
            goToPage(currentPageNumber + 1);
        });
        let dragStart = null;
        elements['pdf-render'].addEventListener('pointerdown', event => {
            const pageFits = elements['pdf-render'].classList.contains('pdf-swipe-enabled');
            if (!event.isPrimary || (event.pointerType !== 'mouse' && !pageFits)) {
                dragStart = null;
                return;
            }
            dragStart = {
                x: event.clientX,
                y: event.clientY,
                scrollLeft: elements['pdf-stage'].scrollLeft,
                scrollTop: elements['pdf-stage'].scrollTop,
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                pageFits
            };
        });
        document.addEventListener('pointermove', event => {
            if (!dragStart || event.pointerId !== dragStart.pointerId
                || dragStart.pointerType !== 'mouse') return;
            const deltaX = event.clientX - dragStart.x;
            const deltaY = event.clientY - dragStart.y;
            if ((!dragStart.pageFits || Math.abs(deltaY) > Math.abs(deltaX) * 1.25)
                && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 6) {
                elements['pdf-stage'].classList.add('pdf-dragging');
                elements['pdf-stage'].scrollLeft = dragStart.scrollLeft - deltaX;
                elements['pdf-stage'].scrollTop = dragStart.scrollTop - deltaY;
            }
        });
        document.addEventListener('pointerup', event => {
            if (!dragStart || event.pointerId !== dragStart.pointerId) return;
            const deltaX = event.clientX - dragStart.x;
            const deltaY = event.clientY - dragStart.y;
            const { pageFits } = dragStart;
            dragStart = null;
            elements['pdf-stage'].classList.remove('pdf-dragging');
            if (!pageFits || Math.abs(deltaX) < 52
                || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
            const currentPage = currentPageNumber;
            goToPage(currentPage + (deltaX < 0 ? 1 : -1));
        });
        document.addEventListener('pointercancel', () => {
            dragStart = null;
            elements['pdf-stage'].classList.remove('pdf-dragging');
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
        const fallbackFullscreenExit = document.getElementById('exit-fullscreen-fallback');
        const setFallbackFullscreen = active => {
            elements['pdf-stage'].classList.toggle('pdf-stage--fullscreen-fallback', active);
            fallbackFullscreenExit.hidden = !active;
            if (active) return;
            clearTimeout(pageStatusTimer);
            pageStatusTimer = null;
            elements['pdf-page-status'].hidden = true;
        };
        elements['toggle-fullscreen'].addEventListener('click', async () => {
            try {
                if (elements['pdf-stage'].classList.contains('pdf-stage--fullscreen-fallback')) {
                    setFallbackFullscreen(false);
                } else if (document.fullscreenElement) {
                    await document.exitFullscreen();
                } else if (typeof elements['pdf-stage'].requestFullscreen === 'function') {
                    try {
                        await elements['pdf-stage'].requestFullscreen();
                    } catch (error) {
                        console.error('No se pudo activar la pantalla completa nativa:', error);
                        setFallbackFullscreen(true);
                    }
                } else {
                    setFallbackFullscreen(true);
                }
            } catch (error) {
                console.error('No se pudo activar la pantalla completa:', error);
            }
        });
        fallbackFullscreenExit.addEventListener('click', () => {
            setFallbackFullscreen(false);
        });
        document.addEventListener('fullscreenchange', () => {
            const isFullscreen = Boolean(document.fullscreenElement);
            elements['toggle-fullscreen'].setAttribute(
                'aria-label',
                isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'
            );
            elements['toggle-fullscreen'].title = isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
            if (isFullscreen) return;
            clearTimeout(pageStatusTimer);
            pageStatusTimer = null;
            elements['pdf-page-status'].hidden = true;
        });

        document.addEventListener('keydown', event => {
            if (event.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                event.preventDefault();
                elements['book-search'].focus();
            }
            if (elements['reader-view'].hidden || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            if (event.key === 'ArrowLeft' && pdfDocument && currentPageNumber > 1) {
                goToPage(currentPageNumber - 1);
            } else if (event.key === 'ArrowRight' && pdfDocument
                && currentPageNumber < pdfDocument.numPages) {
                goToPage(currentPageNumber + 1);
            } else if (event.key === 'Escape'
                && elements['pdf-stage'].classList.contains('pdf-stage--fullscreen-fallback')) {
                setFallbackFullscreen(false);
            } else if (event.key === 'Escape') {
                closeSidebar();
            }
        });

        function schedulePdfFit() {
            if (!pdfDocument || !pdfLayoutReady) return;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => goToPage(currentPageNumber), 120);
        }

        if ('ResizeObserver' in window) {
            const readerObserver = new ResizeObserver(entries => {
                const width = Math.round(entries[0].contentRect.width);
                if (width === lastPdfStageWidth) return;
                lastPdfStageWidth = width;
                schedulePdfFit();
            });
            readerObserver.observe(elements['reader-view']);
        } else {
            window.addEventListener('resize', schedulePdfFit);
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        initializeElements();
        initializeTheme();
        connectEvents();
        restoreAppState();
        const mobileLayout = window.matchMedia('(max-width: 760px)').matches;
        const sidebarCollapsed = !mobileLayout
            && document.querySelector('.app-shell').classList.contains('sidebar-collapsed');
        elements['toggle-sidebar'].setAttribute('aria-expanded', String(!mobileLayout && !sidebarCollapsed));
        elements['toggle-sidebar'].setAttribute(
            'aria-label',
            mobileLayout ? 'Abrir navegación' : sidebarCollapsed ? 'Expandir navegación' : 'Plegar navegación'
        );
        elements['local-manager-link'].hidden =
            !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
        window.addEventListener('storage', event => {
            if (event.key !== siteRefreshStorageKey || !event.newValue) return;
            try {
                const update = JSON.parse(event.newValue);
                if (['catalog', 'page', 'all'].includes(update.scope)) {
                    refreshFromManager(update.scope).catch(error => {
                        console.error('No se pudo sincronizar la página con el gestor:', error);
                        elements['catalog-notice'].textContent =
                            'No se pudo actualizar la página con los cambios del gestor. Recarga para volver a intentarlo.';
                        elements['catalog-notice'].hidden = false;
                    });
                }
            } catch (error) {
                console.error('La notificación del gestor no tiene un formato válido:', error);
            }
        });
        initializeCatalog();
        Promise.all([loadCatalog(), loadPageSettings()]).then(() => {
            initializeCatalog();
            const lastBook = books.find(book => book.id === lastOpenedBookId);
            if (lastBook) {
                openBook(lastBook);
            } else if (lastOpenedBookId !== null) {
                lastOpenedBookId = null;
                persistAppState();
            }
        });
    }, { once: true });
})();
