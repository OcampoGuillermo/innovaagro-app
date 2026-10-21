/* ===================== InnovaAgro-App · vistas ===================== */

/* ---------- piezas compartidas ---------- */
function brandMark(size = 38) {
  return `<img class="brand-mark" src="${BRAND.logoSmall || BRAND.logo}" width="${size}" height="${size}" alt="InnovaAgro-App">`;
}
function sectionHead(title, text, linkHref = '', linkLabel = '') {
  return `<div class="section-head">
    <div><h2 class="h2">${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div>
    ${linkHref ? `<a class="section-link" href="${linkHref}">${esc(linkLabel)} ${icon('arrow-right', 'icon-sm')}</a>` : ''}
  </div>`;
}
function producerAvatar(producer, size = 54) {
  return seal(producer, size, '');
}
function emptyPage(title, text, actionHref, actionLabel) {
  return `<div class="wrap page">${emptyState('leaf', title, text, actionHref ? `<a class="btn btn-primary" href="${actionHref}">${esc(actionLabel)}</a>` : '')}</div>`;
}
function qtyControl(qty, max, attrs = '') {
  const limit = Math.max(1, Number(max) || 1);
  return `<div class="qty" ${attrs}>
    <button type="button" data-action="qty-step" data-delta="-1" aria-label="Restar una unidad" ${qty <= 1 ? 'disabled' : ''}>${icon('minus', 'icon-sm')}</button>
    <span aria-live="polite">${qty}</span>
    <button type="button" data-action="qty-step" data-delta="1" aria-label="Sumar una unidad" ${qty >= limit ? 'disabled' : ''}>${icon('plus', 'icon-sm')}</button>
  </div>`;
}
function fieldError(name) {
  if (!checkoutErrors[name]) return '';
  return `<span class="field-error" id="err-${name}">${esc(checkoutErrors[name])}</span>`;
}
function invalid(name) {
  return checkoutErrors[name] ? 'aria-invalid="true" aria-describedby="err-' + name + '"' : '';
}
function factRow(label, value) {
  return `<div class="fact-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}
function statusIndex(status) {
  return ['nuevo', 'preparando', 'en_ruta', 'entregado'].indexOf(status);
}
function timeline(status) {
  const labels = ['Pedido', 'Preparando', 'En ruta', 'Entregado'];
  const at = statusIndex(status);
  return `<div class="timeline">${labels.map((label, i) => `<div class="timeline-step ${i <= at ? 'is-done' : ''}"><span>${label}</span></div>`).join('')}</div>`;
}
function producerGroupCard(order, producerId) {
  const producer = producerById(producerId) || { name: 'Productor', owner: 'Productor', initials: 'IA', place: 'Formosa' };
  const group = (order.groups || {})[producerId] || { status: 'nuevo', subtotal: 0 };
  const items = order.items.filter((it) => it.producerId === producerId);
  return `<div class="order-card">
    <div class="order-card-head">
      <div class="flex center gap-12">
        ${seal(producer, 42)}
        <div>
          <div class="mono-label">Sello de origen</div>
          <h2>${esc(producer.name)}</h2>
        </div>
      </div>
      ${statusBadge(group.status)}
    </div>
    <div class="order-card-body">
      ${items.map((it) => `<div class="order-item"><span>${it.qty} ${esc(it.unit)} · ${esc(it.name)}</span><span>${money(it.price * it.qty)}</span></div>`).join('')}
      <div class="order-item" style="border-top:1px solid var(--line);margin-top:6px;padding-top:9px"><strong>Subtotal</strong><strong>${money(group.subtotal)}</strong></div>
    </div>
    <div class="order-actions">
      <button class="btn btn-sm btn-ghost" type="button" data-action="order-wa" data-order="${order.id}" data-producer="${producerId}">${icon('chat', 'icon-sm')} Escribir por WhatsApp</button>
      ${producer.whatsapp ? '' : '<span class="tiny muted" style="align-self:center">El productor todavía no cargó su número: se abre el selector de contactos.</span>'}
    </div>
  </div>`;
}

/* ---------- bienvenida ---------- */
function viewWelcome() {
  const login = authMode === 'login';
  const cities = CITIES.length ? CITIES : ['Formosa Capital', 'Herradura', 'El Colorado', 'Clorinda', 'Pirané', 'Laguna Blanca', 'Las Lomitas', 'Villa Dos Trece'];
  return `<div class="welcome">
    <div class="welcome-left">
      <div>
        <img class="welcome-logo" src="${BRAND.logo}" alt="InnovaAgro-App" width="108" height="108">
      </div>
      <div>
        <p class="mono-label" style="color:#c9d6ca;margin-bottom:14px">Tecnología &amp; Naturaleza · Formosa</p>
        <h1>Del surco<br>a tu mesa,<br><em>sin vueltas.</em></h1>
        <p>Una red directa entre productores de Formosa y quienes compran: frutas, raíces, miel, quesos, pesca y artesanías con origen conocido.</p>
      </div>
      <div>
        <div class="welcome-foot">${icon('shield', 'icon-sm')} Cuentas con contraseña, datos en servidor y copia local para consultar sin conexión.</div>
        <div class="welcome-credits">El catálogo inicial es de demostración. Los productores pueden editar su perfil, stock y precios desde el panel. No se procesan pagos dentro de la app.</div>
      </div>
    </div>
    <div class="welcome-right">
      <div class="auth-shell">
        <div>
          <h2>${login ? 'Entrá a tu cuenta' : 'Creá tu cuenta'}</h2>
          <p>${login ? 'Compradores, comercios y productores usan la misma puerta.' : 'Elegí cómo vas a usar InnovaAgro-App. El rol queda asociado a tu cuenta.'}</p>
        </div>
        <div class="auth-tabs" role="tablist" aria-label="Entrar o crear cuenta">
          <button class="auth-tab ${login ? 'is-active' : ''}" type="button" role="tab" aria-selected="${login}" data-action="auth-mode" data-mode="login">Entrar</button>
          <button class="auth-tab ${!login ? 'is-active' : ''}" type="button" role="tab" aria-selected="${!login}" data-action="auth-mode" data-mode="register">Crear cuenta</button>
        </div>
        ${authError ? `<div class="auth-alert" role="alert">${icon('info', 'icon-sm')}<span>${esc(authError)}</span></div>` : ''}
        ${bootError ? `<div class="auth-alert" role="alert">${icon('info', 'icon-sm')}<span>${esc(bootError)}</span></div>` : ''}

        ${login ? `
        <form class="auth-form" data-form="login" novalidate>
          <div class="field">
            <label for="auth-email">Correo electrónico</label>
            <input id="auth-email" name="email" type="email" inputmode="email" autocomplete="email" value="${esc(authFields.email || '')}" placeholder="vos@correo.com" required>
            <span class="field-error" data-err="email" hidden></span>
          </div>
          <div class="field">
            <label for="auth-password">Contraseña</label>
            <input id="auth-password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required>
            <span class="field-error" data-err="password" hidden></span>
          </div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">${icon('user', 'icon-sm')} Entrar</button>
        </form>
        <div class="auth-demo">
          <strong>Probar con cuentas de demostración</strong>
          <p>El catálogo inicial, los siete pedidos y los perfiles son ficticios. Las cuentas, la sesión y los cambios que hagas son reales en este servidor.</p>
          <div class="auth-demo-btns">
            <button class="btn btn-sm btn-ghost" type="button" data-action="demo-login" data-role="buyer">Entrar como compradora</button>
            <button class="btn btn-sm btn-ghost" type="button" data-action="demo-login" data-role="producer">Entrar como productor</button>
          </div>
        </div>
        <p class="auth-switch">¿Primera vez? <button type="button" data-action="auth-mode" data-mode="register">Creá una cuenta</button></p>
        ` : `
        <form class="auth-form" data-form="register" novalidate>
          <div class="auth-role-pick" role="group" aria-label="Tipo de cuenta">
            <button type="button" class="${authRole === 'buyer' ? 'is-active' : ''}" data-action="auth-role" data-role="buyer"><strong>Quiero comprar</strong><span>Catálogo, canasta, favoritos y pedidos.</span></button>
            <button type="button" class="${authRole === 'producer' ? 'is-active' : ''}" data-action="auth-role" data-role="producer"><strong>Soy productor/a</strong><span>Panel de productos, stock, pedidos y perfil público.</span></button>
          </div>
          <div class="field">
            <label for="reg-name">Nombre y apellido</label>
            <input id="reg-name" name="name" autocomplete="name" value="${esc(authFields.name || '')}" placeholder="Cómo te llamás" required>
            <span class="field-error" data-err="name" hidden></span>
          </div>
          <div class="field">
            <label for="reg-email">Correo electrónico</label>
            <input id="reg-email" name="email" type="email" inputmode="email" autocomplete="email" value="${esc(authFields.email || '')}" placeholder="vos@correo.com" required>
            <span class="field-error" data-err="email" hidden></span>
          </div>
          <div class="field">
            <label for="reg-password">Contraseña <span class="hint">(mínimo 8 caracteres)</span></label>
            <input id="reg-password" name="password" type="password" autocomplete="new-password" placeholder="Elegí una contraseña" minlength="8" required>
            <span class="field-error" data-err="password" hidden></span>
          </div>
          ${authRole === 'producer' ? `
          <div class="field">
            <label for="reg-farm">Nombre de la finca o emprendimiento</label>
            <input id="reg-farm" name="farmName" value="${esc(authFields.farmName || '')}" placeholder="Ej.: Huerta La Isla" required>
            <span class="field-error" data-err="farmName" hidden></span>
          </div>
          <div class="form-grid-2">
            <div class="field">
              <label for="reg-place">Localidad</label>
              <input id="reg-place" name="place" value="${esc(authFields.place || '')}" placeholder="Ej.: Herradura" required>
              <span class="field-error" data-err="place" hidden></span>
            </div>
            <div class="field">
              <label for="reg-zone">Zona de reparto</label>
              <select id="reg-zone" name="zone" required>
                <option value="">Elegí una zona</option>
                ${ROUTES.length ? ROUTES.map((r) => `<option value="${esc(r.zone)}" ${authFields.zone === r.zone ? 'selected' : ''}>${esc(r.zone)}</option>`).join('') : '<option value="Formosa Capital">Formosa Capital</option>'}
              </select>
              <span class="field-error" data-err="zone" hidden></span>
            </div>
          </div>
          ` : `
          <div class="field">
            <label for="reg-city">Localidad <span class="hint">(opcional)</span></label>
            <select id="reg-city" name="city">${cities.map((c) => `<option ${((authFields.city || 'Formosa Capital') === c) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          </div>
          `}
          <button class="btn btn-primary btn-block btn-lg" type="submit">${icon('arrow-right', 'icon-sm')} ${authRole === 'producer' ? 'Crear cuenta de productor' : 'Crear cuenta'}</button>
          <p class="auth-legal">Al crear una cuenta aceptás que tus datos se guarden en este servidor para gestionar pedidos y tu perfil. Podés descargar tu información desde Mi perfil.</p>
        </form>
        <p class="auth-switch">¿Ya tenés cuenta? <button type="button" data-action="auth-mode" data-mode="login">Entrá</button></p>
        `}
        <p class="auth-legal">Fotografías de referencia con licencias abiertas. <button type="button" class="link-btn" data-action="open-credits">Créditos y alcance</button>.</p>
      </div>
    </div>
  </div>`;
}

/* ---------- inicio ---------- */
function viewHome() {
  const featured = activeProducts().filter((p) => p.featured).slice(0, 6);
  const p1 = producerById('p1') || db.producers[0] || null;
  const route = ROUTES[0];
  const next = routeNextDate(route.id);
  const counts = categoryCounts();
  return `<div>
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="mono-label" style="color:#c9d6ca;margin-bottom:14px">Mercado directo · Formosa</p>
          <h1>Lo que da<br>la tierra,<br><em>con nombre.</em></h1>
          <p>Cada producto llega con su sello de origen: quién lo hizo, dónde y cuándo se cosechó. Sin intermediarios que borren el nombre del productor.</p>
          <form class="hero-search" data-form="hero-search" role="search">
            ${icon('search')}
            <input type="search" name="q" placeholder="Buscar pomelo, miel, mandioca…" aria-label="Buscar productos" autocomplete="off">
            <button class="btn btn-primary" type="submit">Buscar</button>
          </form>
          <div class="hero-links">
            <button type="button" data-action="quick-search" data-q="miel">Miel de monte</button>
            <button type="button" data-action="quick-search" data-q="mandioca">Mandioca fresca</button>
            <button type="button" data-action="quick-search" data-q="queso">Quesos de cabra</button>
            <button type="button" data-action="quick-search" data-q="artesanías">Artesanías</button>
          </div>
        </div>
        <div class="hero-media">
          <img src="${PHOTOS.hero}" alt="Algodón nativo de Formosa, imagen de referencia" fetchpriority="high">
          <div class="hero-stamp"><img src="${BRAND.logo}" alt=""></div>
          <div class="hero-caption"><strong>Lote MA-2662 · Pirané</strong>Algodón nativo en rama, cardado a mano por la cooperativa Mujeres del Algodón.</div>
        </div>
      </div>
    </section>

    <div class="harvest">
      <div class="wrap">
        <div class="harvest-head">
          <div><h2>Esta semana en cosecha</h2><p>Disponibilidad real de los productores · temporada de primavera</p></div>
          <a class="section-link" href="#/market">Ver todo ${icon('arrow-right', 'icon-sm')}</a>
        </div>
        <div class="rail-scroll">${featured.map(productCard).join('')}</div>
      </div>
    </div>

    <div class="wrap">
      <div class="section">
        <div class="section-head">
          <div><h2 class="h2">Buscá por lo que hay</h2><p>${CATEGORIES.length} categorías, ${db.producers.length} productores y una sola regla: lo que se publica está disponible.</p></div>
        </div>
        <div class="chips">
          ${CATEGORIES.map((c) => `<button class="chip" type="button" data-action="home-cat" data-cat="${esc(c)}">${esc(c)} <span class="count">${counts[c] || 0}</span></button>`).join('')}
          <button class="chip" type="button" data-action="home-cat" data-cat="Todos">${icon('market', 'icon-sm')} Todo el catálogo</button>
        </div>
      </div>
    </div>

    <div class="wrap">
      <div class="route-band">
        <div class="route-band-copy">
          <p class="mono-label" style="color:var(--copper)">Entrega programada</p>
          <h3>Tu pedido viaja en la ruta del ${esc(dayName(next))}.</h3>
          <p>${esc(route.note)} El cierre de pedidos es el <strong>${esc(route.cutoff)}</strong>. Podés retirar en un punto fijo o recibir en tu casa.</p>
          <a class="btn btn-primary" href="#/routes">Ver rutas y paradas ${icon('arrow-right', 'icon-sm')}</a>
        </div>
        <div class="route-band-map">
          <div class="flex between center">
            <span class="mono-label" style="color:var(--sun)">${esc(route.name)}</span>
            <span class="tiny">${fmtShort(next)}</span>
          </div>
          <div class="route-line-mini">
            ${route.stops.map((s, i) => `${i ? '<span class="bar"></span>' : ''}<span class="route-node-mini"><span class="dot-node"></span><span>${esc(s)}</span></span>`).join('')}
          </div>
          <div class="route-meta"><span>Salida <strong>${esc(route.dayLabel)}</strong></span><span>Cierre <strong>${esc(route.cutoff)}</strong></span><span>Envío <strong>${money(SHIPPING)}</strong></span></div>
        </div>
      </div>
    </div>

    <div class="wrap">
      <div class="section">
        ${p1 ? `<div class="producer-feature">
          <div class="producer-feature-media">
            <img src="${photoSrc(p1.photo)}" alt="${esc(p1.name)}, imagen de referencia" loading="lazy">
          </div>
          <div class="producer-feature-body">
            <div class="flex center gap-12">
              ${seal(p1, 64)}
              <div><p class="mono-label" style="color:var(--copper)">Productor destacado</p><h2 class="h2" style="margin-top:5px">${esc(p1.name)}</h2></div>
            </div>
            <p>${esc((p1.story || '').split('\n\n')[0])}</p>
            <div class="producer-meta">${(p1.practices || []).map((x) => tag(x, 'tag-ok')).join('')}${tag(p1.place, 'tag-copper')}${p1.demo ? '<span class="demo-pill">Ejemplo</span>' : ''}</div>
            <div class="flex gap-8 flex-wrap">
              <a class="btn btn-primary" href="#/producer/${p1.id}">Conocer la finca ${icon('arrow-right', 'icon-sm')}</a>
              <a class="btn btn-ghost" href="#/market">Ver sus productos</a>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>

    <div class="wrap">
      <section class="section">
        ${sectionHead('Aprender también es parte del oficio', 'Cápsulas cortas para grabar, contar y vender mejor. Con audio, ejercicios y un constructor de pitch.', '#/learn', 'Ver las 4 cápsulas')}
        <div class="course-grid">${COURSES.map(courseGridCard).join('')}</div>
      </section>
    </div>

    <div class="wrap">
      <div class="confidence">
        <div class="confidence-item">${icon('pin')}<div><strong>Origen con nombre y lote</strong><span>Cada ficha muestra el lugar, la temporada y el código del lote.</span></div></div>
        <div class="confidence-item">${icon('truck')}<div><strong>Rutas programadas</strong><span>Retiro en puntos fijos o envío a domicilio según la zona.</span></div></div>
        <div class="confidence-item">${icon('chat')}<div><strong>Trato directo</strong><span>El pedido se confirma por WhatsApp con el productor. Sin comisiones ocultas.</span></div></div>
      </div>
    </div>
  </div>`;
}

/* ---------- mercado ---------- */
function viewMarket() {
  const list = filteredProducts();
  const m = db.market;
  const counts = categoryCounts();
  const active = activeFilterCount();
  const producer = m.producerId ? producerById(m.producerId) : null;
  return `<div>
    <section class="market-band">
      <div class="wrap market-band-inner">
        <div>
          <p class="mono-label" style="color:var(--sun)">Catálogo de temporada</p>
          <h1>El mercado de<br>los que producen.</h1>
          <p>Precios por unidad, stock actualizado por cada productor y retiro o entrega en la próxima ruta.</p>
        </div>
        <div class="season"><span>Actualizado</span><strong>${fmtShort(today())}</strong><span>${activeProducts().length} productos activos</span></div>
      </div>
    </section>
    <div class="wrap">
      <div class="market-toolbar">
        <form class="search-field" data-form="market-search" role="search">
          ${icon('search')}
          <input id="market-search" type="search" name="q" value="${esc(m.q)}" placeholder="Buscar producto, productor o lugar" aria-label="Buscar en el mercado" autocomplete="off">
          ${m.q ? `<button class="clear-search" type="button" data-action="clear-search" aria-label="Borrar búsqueda">${icon('x', 'icon-sm')}</button>` : ''}
        </form>
        <button class="btn btn-ghost filter-btn" type="button" data-action="open-filters">
          ${icon('filter', 'icon-sm')} Filtros ${active ? `<span class="filter-count">${active}</span>` : ''}
        </button>
      </div>
      <div class="chips">
        <button class="chip ${m.cat === 'Todos' ? 'is-active' : ''}" type="button" data-action="set-cat" data-cat="Todos">Todos <span class="count">${counts.Todos}</span></button>
        ${CATEGORIES.map((c) => `<button class="chip ${m.cat === c ? 'is-active' : ''}" type="button" data-action="set-cat" data-cat="${esc(c)}">${esc(c)} <span class="count">${counts[c] || 0}</span></button>`).join('')}
      </div>
      <div class="market-meta">
        <h2 class="result">${list.length} ${list.length === 1 ? 'producto' : 'productos'}${producer ? ` de <strong>${esc(producer.name)}</strong>` : ''}${m.q ? ` para «${esc(m.q)}»` : ''}</h2>
        <div class="flex center gap-8">
          ${active || m.q ? `<button class="link-btn" type="button" data-action="clear-filters">Limpiar</button>` : ''}
          <label class="select-wrap">
            <span class="sr-only">Ordenar</span>
            <select data-action="market-sort">
              <option value="relevance" ${m.sort === 'relevance' ? 'selected' : ''}>Relevancia</option>
              <option value="price-asc" ${m.sort === 'price-asc' ? 'selected' : ''}>Menor precio</option>
              <option value="price-desc" ${m.sort === 'price-desc' ? 'selected' : ''}>Mayor precio</option>
              <option value="producer" ${m.sort === 'producer' ? 'selected' : ''}>Productor</option>
            </select>
          </label>
        </div>
      </div>
      ${list.length ? `<div class="grid-products">${list.map(productCard).join('')}</div>` : emptyState('search', 'No encontramos eso esta semana', 'Probá con otra palabra, quitá un filtro o mirá todo el catálogo. La disponibilidad cambia con la cosecha.', `<button class="btn btn-primary" type="button" data-action="clear-filters">Ver todo el catálogo</button>`)}
      <div class="notice mt-24">${icon('info')}<span>Cada productor actualiza precio y stock. El pedido queda registrado y el pago se coordina por WhatsApp. La app no cobra ni retiene dinero.</span></div>
    </div>
  </div>`;
}

/* ---------- producto ---------- */
function viewProduct(id) {
  const product = productById(id);
  if (!product || !product.active) return emptyPage('Ese producto ya no está', 'Puede haber salido de temporada o estar pausado por el productor.', '#/market', 'Volver al mercado');
  const producer = producerById(product.producerId);
  const max = Math.max(0, product.stock);
  const qty = Math.max(1, Math.min(detailQty, max || 1));
  const isFav = (db.buyer.favorites || []).includes(product.id);
  const related = activeProducts().filter((p) => p.id !== product.id && (p.category === product.category || p.producerId === product.producerId)).slice(0, 4);
  return `<div class="wrap page-tight">
    <div class="detail-top"><a class="back-link" href="#/market">${icon('arrow-left', 'icon-sm')} Volver al mercado</a></div>
    <div class="detail-grid">
      <div class="detail-media">
        <img src="${photoSrc(product.photo)}" alt="${esc(product.name)}, imagen de referencia">
        ${tag(product.available || product.season, product.stock <= 0 ? 'tag-danger' : 'tag-sun')}
        <span class="lot">Lote ${esc(product.lot)}</span>
        ${producer ? `<span class="detail-seal">${seal(producer, 76)}</span>` : ''}
      </div>
      <div class="detail-info">
        <p class="mono-label">${esc(product.category)} · ${esc(product.season)}</p>
        <h1>${esc(product.name)}</h1>
        <div class="detail-sub">${esc(product.unit)} · ${esc(product.short)}</div>
        ${producer ? `<a class="detail-producer" href="#/producer/${producer.id}">
          ${seal(producer, 42)}
          <div><strong>${esc(producer.name)}</strong><span>${esc(producer.place)} · ${esc(producer.role)}</span></div>
          ${icon('chevron-right', 'icon-sm')}
        </a>` : ''}
        <div class="detail-price"><span class="price">${money(product.price)}</span><small>/ ${esc(product.unit)}</small></div>
        <div class="stock-line">${product.stock > 0 ? `${icon('check', 'icon-sm')} ${product.stock} ${product.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}` : `${icon('info', 'icon-sm')} Sin stock esta semana`}</div>
        ${product.stock > 0 ? `<div class="detail-actions">
          ${qtyControl(qty, max)}
          <button class="btn btn-primary btn-lg" type="button" data-action="add-detail" data-id="${product.id}">${icon('bag', 'icon-sm')} Agregar a la canasta</button>
          <button class="btn btn-ghost btn-lg ${isFav ? 'is-on' : ''}" type="button" data-action="toggle-fav" data-id="${product.id}" aria-pressed="${isFav}" aria-label="${isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}">${icon('heart', 'icon-sm')}</button>
        </div>` : `<div class="notice mt-16">${icon('info')}<span>Este producto no tiene stock esta semana. Escribile al productor para saber cuándo vuelve.</span></div>`}
        <div class="flex gap-8 flex-wrap">
          <button class="btn btn-ghost" type="button" data-action="product-wa" data-id="${product.id}">${icon('chat', 'icon-sm')} Consultar por WhatsApp</button>
          <button class="btn btn-ghost" type="button" data-action="share-product" data-id="${product.id}">${icon('share', 'icon-sm')} Compartir</button>
        </div>
        <dl class="detail-facts mt-24">
          ${factRow('Productor', producer ? producer.name : '—')}
          ${factRow('Origen', producer ? producer.place + ', Formosa' : 'Formosa')}
          ${factRow('Cosecha', product.harvest || '—')}
          ${factRow('Temporada', product.season || '—')}
          ${factRow('Unidad', product.unit)}
          ${factRow('Lote', product.lot)}
          ${product.demo ? factRow('Contenido', 'Ficha de ejemplo para probar la app') : ''}
        </dl>
        <div class="detail-accordions">
          <details open>
            <summary>Descripción del producto ${icon('plus', 'icon-sm')}</summary>
            <div class="acc-body">${esc(product.description)}</div>
          </details>
          <details>
            <summary>Qué lo hace distinto ${icon('plus', 'icon-sm')}</summary>
            <div class="acc-body"><ul style="display:grid;gap:5px">${(product.highlights || []).map((h) => `<li>· ${esc(h)}</li>`).join('')}</ul></div>
          </details>
          <details>
            <summary>Entrega, pago y conservación ${icon('plus', 'icon-sm')}</summary>
            <div class="acc-body">El pedido se entrega en la próxima ruta de la zona o se retira en un punto fijo. El pago se coordina por WhatsApp: efectivo, transferencia o Mercado Pago. La app no procesa el cobro. ${product.category === 'Lácteos' || product.category === 'Pesca' ? 'Mantener refrigerado y respetar la cadena de frío.' : 'Conservar en un lugar fresco, seco y protegido del sol.'}</div>
          </details>
        </div>
      </div>
    </div>
    ${related.length ? `<section class="related"><div class="section-head"><div><h2 class="h2">También de la zona</h2><p>Productos de la misma categoría o del mismo productor.</p></div></div><div class="grid-products">${related.map(productCard).join('')}</div></section>` : ''}
    <div class="detail-mobile-bar">
      <div><span class="tiny muted">${esc(product.unit)}</span><div class="price">${money(product.price)}</div></div>
      <button class="btn btn-primary" type="button" data-action="add-detail" data-id="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>${icon('bag', 'icon-sm')} ${product.stock <= 0 ? 'Sin stock' : 'Agregar'}</button>
    </div>
  </div>`;
}

/* ---------- productor ---------- */
function viewProducer(id) {
  const producer = producerById(id);
  if (!producer) return emptyPage('No encontramos ese productor', 'El perfil puede haber cambiado de dirección.', '#/market', 'Volver al mercado');
  const products = producerProducts(producer.id);
  const sold = db.orders.filter((o) => (o.items || []).some((it) => it.producerId === producer.id)).length;
  const story = String(producer.story || '').split('\n\n').filter(Boolean);
  const practices = producer.practices || [];
  return `<div class="wrap page-tight">
    <a class="back-link" href="#/market">${icon('arrow-left', 'icon-sm')} Volver al mercado</a>
    <div class="producer-feature mt-8">
      <div class="producer-feature-media">
        <img src="${photoSrc(producer.photo)}" alt="${esc(producer.name)}, imagen de referencia">
      </div>
      <div class="producer-feature-body">
        <div class="flex center gap-12">
          ${seal(producer, 78)}
          <div>
            <p class="mono-label" style="color:var(--copper)">${esc(producer.role)} · desde ${producer.since}</p>
            <h1 class="h2" style="margin-top:5px">${esc(producer.name)}</h1>
            <p class="small muted" style="margin-top:4px">${esc(producer.place)} · ${esc(producer.zone)} ${producer.verified ? '· Perfil verificado' : ''}</p>
          </div>
        </div>
        <div class="producer-meta mt-16">${practices.map((x) => tag(x, 'tag-ok')).join('')}${producer.demo ? '<span class="demo-pill">Perfil de ejemplo</span>' : ''}</div>
        ${story.map((p) => `<p>${esc(p)}</p>`).join('')}
        <div class="flex gap-8 flex-wrap">
          <button class="btn btn-primary" type="button" data-action="producer-wa" data-id="${producer.id}">${icon('chat', 'icon-sm')} Escribir a ${esc(producer.owner.split(' ')[0])}</button>
          <button class="btn btn-ghost" type="button" data-action="share-producer" data-id="${producer.id}">${icon('share', 'icon-sm')} Compartir perfil</button>
        </div>
      </div>
    </div>

    <div class="grid-2 mt-24">
      <div class="about-card">
        <h2 class="h4">Ficha de origen</h2>
        <dl class="detail-facts mt-12">
          ${factRow('Responsable', producer.owner)}
          ${factRow('Localidad', producer.place)}
          ${factRow('Zona de reparto', producer.zone)}
          ${factRow('Superficie', producer.hectares ? producer.hectares + ' hectáreas' : 'Producción sin tierra propia')}
          ${factRow('Punto de retiro', producer.pickup || 'A coordinar')}
          ${factRow('Pedidos', String(sold))}
        </dl>
      </div>
      <div class="about-card">
        <h2 class="h4">Cómo trabajo</h2>
        <div class="producer-meta mt-12">${practices.map((x) => tag(x, 'tag-copper')).join('')}</div>
        <p class="mt-12">${esc((producer.story || '').split('\n\n')[1] || producer.story || 'Todavía no cargó una descripción de su trabajo.')}</p>
        <div class="notice mt-16">${icon('shield')}<span>El sello de origen reúne el lugar, la práctica y la temporada. Es una marca de trazabilidad de InnovaAgro-App, no una certificación oficial.</span></div>
      </div>
    </div>

    <div class="section-head mt-24">
      <div><h2 class="h2">Productos de ${esc(producer.name)}</h2><p>${products.length} ${products.length === 1 ? 'producto activo' : 'productos activos'} con stock y lote.</p></div>
      <a class="section-link" href="#/routes">Ver entrega ${icon('arrow-right', 'icon-sm')}</a>
    </div>
    ${products.length ? `<div class="grid-products">${products.map(productCard).join('')}</div>` : emptyState('leaf', 'Sin productos publicados', 'Este perfil todavía no cargó su catálogo.', '#/market', 'Ver otros productos')}
    <div class="harvest-head mt-24"><div><h2>Galería de la finca</h2><p>Imágenes de referencia de la producción.</p></div></div>
    <div class="grid-2">${(producer.gallery || []).length ? (producer.gallery || []).map((g) => `<div class="detail-media"><img src="${photoSrc(g)}" alt="Galería de ${esc(producer.name)}, imagen de referencia" loading="lazy" style="aspect-ratio:16/9"></div>`).join('') : '<p class="small muted">El productor todavía no cargó fotos de su finca.</p>'}</div>
  </div>`;
}

/* ---------- canasta ---------- */
function viewCart() {
  const items = cartDetails();
  if (!items.length) {
    return emptyPage('Tu canasta está vacía', 'Empezá por lo que hay esta semana. Podés guardar productos en favoritos y volver cuando quieras.', '#/market', 'Ir al mercado');
  }
  const groups = {};
  items.forEach((it) => {
    const pid = it.product.producerId;
    if (!groups[pid]) groups[pid] = { producer: it.producer, items: [], subtotal: 0 };
    groups[pid].items.push(it);
    groups[pid].subtotal += it.line;
  });
  const subtotal = cartSubtotal();
  const shipping = shippingFor(subtotal, 'delivery');
  const remaining = Math.max(0, FREE_SHIPPING - subtotal);
  const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING) * 100));
  return `<div class="wrap page">
    <div class="page-head"><div class="page-head-row"><div><h1>Tu canasta</h1><p>${items.length} ${items.length === 1 ? 'producto' : 'productos'} de ${Object.keys(groups).length} ${Object.keys(groups).length === 1 ? 'productor' : 'productores'}. Revisá cantidades antes de continuar.</p></div><div class="aside"><strong>${money(subtotal)}</strong>subtotal</div></div></div>
    <div class="cart-grid">
      <div>
        ${Object.values(groups).map((g) => `<section class="cart-group">
          <div class="cart-group-head">
            ${seal(g.producer, 34)}
            <div><strong>${esc(g.producer.name)}</strong><span>${esc(g.producer.place)} · ${esc(g.producer.zone)}</span></div>
            <span style="margin-left:auto;font-size:12.5px;font-weight:700">${money(g.subtotal)}</span>
          </div>
          ${g.items.map((it) => `<div class="cart-item">
            <a class="cart-thumb" href="#/product/${it.product.id}"><img src="${photoSrc(it.product.photo)}" alt="" loading="lazy"></a>
            <div>
              <h3><a href="#/product/${it.product.id}">${esc(it.product.name)}</a></h3>
              <div class="meta">${money(it.product.price)} / ${esc(it.product.unit)} · Lote ${esc(it.product.lot)}</div>
              ${qtyControl(it.qty, it.product.stock, `data-cart-qty="${it.product.id}"`)}
            </div>
            <div class="cart-item-side">
              <div class="line-price">${money(it.line)}</div>
              <button class="remove-btn" type="button" data-action="remove-line" data-id="${it.product.id}">Quitar</button>
            </div>
          </div>`).join('')}
        </section>`).join('')}
        <div class="notice">${icon('truck')}<span>El envío se calcula sobre el total de la canasta. Si superás ${money(FREE_SHIPPING)}, el envío a domicilio es sin cargo. El retiro en punto fijo siempre es gratis.</span></div>
      </div>
      <aside class="summary">
        <h2>Resumen</h2>
        <div class="summary-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
        <div class="summary-row"><span>Envío a domicilio</span><strong>${shipping === 0 ? 'Sin cargo' : money(shipping)}</strong></div>
        <div class="summary-row"><span>Retiro en punto fijo</span><strong>Sin cargo</strong></div>
        <div class="summary-total"><span>Total estimado</span><strong>${money(subtotal + shipping)}</strong></div>
        <div class="progress-bar mt-16" aria-label="Progreso hacia envío gratis"><i style="width:${pct}%"></i></div>
        <p class="tiny muted mt-8">${remaining > 0 ? `Te faltan ${money(remaining)} para el envío gratis.` : 'Ya tenés envío a domicilio sin cargo.'}</p>
        <a class="btn btn-primary btn-block btn-lg" href="#/checkout">Continuar al pedido ${icon('arrow-right', 'icon-sm')}</a>
        <a class="btn btn-ghost btn-block mt-8" href="#/market">Seguir comprando</a>
        <div class="summary-note">${icon('info')}<span>No se cobra nada en la app. Al confirmar, el pedido queda registrado en tu cuenta y se abre WhatsApp para coordinar con cada productor.</span></div>
      </aside>
    </div>
  </div>`;
}

/* ---------- checkout ---------- */
function viewCheckout() {
  const items = cartDetails();
  if (!items.length) return emptyPage('No hay nada para pedir', 'Tu canasta está vacía. Elegí productos de temporada y volvé a esta pantalla.', '#/market', 'Ir al mercado');
  if (!checkoutDraft) checkoutDraft = {
    name: db.buyer.name || '', phone: db.buyer.phone || '', city: db.buyer.city || 'Formosa Capital',
    address: db.buyer.address || '', mode: 'pickup', pointId: PICKUPS[0].id, routeId: ROUTES[0].id,
    payment: 'efectivo', note: '', terms: false
  };
  const d = checkoutDraft;
  const subtotal = cartSubtotal();
  const shipping = shippingFor(subtotal, d.mode);
  const groups = [...new Set(items.map((it) => it.product.producerId))];
  const pointsForRoute = PICKUPS;
  const route = ROUTES.find((r) => r.id === d.routeId) || ROUTES[0];
  const point = pointsForRoute.find((p) => p.id === d.pointId) || pointsForRoute[0];
  return `<div class="wrap page">
    <div class="page-head"><div><h1>Finalizar pedido</h1><p>Revisá tus datos, elegí cómo recibirlo y coordiná el pago con cada productor. La app registra el pedido; el cobro se hace fuera.</p></div></div>
    <form class="checkout-grid" data-form="checkout" novalidate>
      <div>
        <section class="checkout-section">
          <h2><span class="step-num">1</span> Tus datos</h2>
          <div class="form-row">
            <div class="field">
              <label for="co-name">Nombre y apellido</label>
              <input id="co-name" name="name" value="${esc(d.name)}" autocomplete="name" ${invalid('name')}>
              ${fieldError('name')}
            </div>
            <div class="field">
              <label for="co-phone">WhatsApp</label>
              <input id="co-phone" name="phone" type="tel" inputmode="tel" value="${esc(d.phone)}" placeholder="370 400 0000" autocomplete="tel" ${invalid('phone')}>
              ${fieldError('phone')}
            </div>
          </div>
          <div class="field">
            <label for="co-city">Localidad</label>
            <select id="co-city" name="city">${CITIES.map((c) => `<option ${d.city === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="co-note">Nota para los productores <span class="hint">(opcional)</span></label>
            <textarea id="co-note" name="note" placeholder="Ej.: tocar timbre, dejar en portería, facturar a nombre de…">${esc(d.note)}</textarea>
          </div>
        </section>

        <section class="checkout-section">
          <h2><span class="step-num">2</span> Cómo lo recibís</h2>
          <div class="choice-grid">
            <label class="choice"><input type="radio" name="mode" value="pickup" ${d.mode === 'pickup' ? 'checked' : ''} data-action="checkout-mode"><span class="choice-mark"></span><span><strong>Retiro en punto fijo</strong><span>Sin cargo. Elegís día, lugar y horario.</span></span>${icon('pin', 'icon-sm')}</label>
            <label class="choice"><input type="radio" name="mode" value="delivery" ${d.mode === 'delivery' ? 'checked' : ''} data-action="checkout-mode"><span class="choice-mark"></span><span><strong>Envío a domicilio</strong><span>${money(SHIPPING)} · gratis desde ${money(FREE_SHIPPING)}.</span></span>${icon('truck', 'icon-sm')}</label>
          </div>
          <div class="mt-16" data-checkout-pickup ${d.mode === 'pickup' ? '' : 'hidden'}>
            <div class="field">
              <label for="co-point">Punto de retiro</label>
              <select id="co-point" name="pointId">
                ${pointsForRoute.map((p) => `<option value="${p.id}" ${d.pointId === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.time)} (${esc(routeById(p.routeId).dayLabel)})</option>`).join('')}
              </select>
              <span class="hint">${esc(point.address)}. ${esc(point.note)}</span>
            </div>
            <div class="delivery-box"><div class="row">${icon('calendar')}<div><strong>Retiro estimado: ${fmtLong(routeNextDate(point.routeId))}</strong><span>${esc(point.time)} · ${esc(point.name)}</span></div></div></div>
          </div>
          <div class="mt-16" data-checkout-delivery ${d.mode === 'delivery' ? '' : 'hidden'}>
            <div class="field">
              <label for="co-address">Dirección de entrega</label>
              <input id="co-address" name="address" value="${esc(d.address)}" placeholder="Calle, número, barrio" autocomplete="street-address" ${invalid('address')}>
              ${fieldError('address')}
            </div>
            <div class="field">
              <label for="co-route">Ruta de entrega</label>
              <select id="co-route" name="routeId" data-action="checkout-route">
                ${ROUTES.map((r) => `<option value="${r.id}" ${d.routeId === r.id ? 'selected' : ''}>${esc(r.name)} · ${esc(r.dayLabel)} · ${esc(r.zone)}</option>`).join('')}
              </select>
              <span class="hint">La entrega se hace en la próxima salida de esa ruta. Cierre de pedidos: ${esc(route.cutoff)}.</span>
            </div>
            <div class="delivery-box"><div class="row">${icon('calendar')}<div><strong>Entrega estimada: ${fmtLong(routeNextDate(route.id))}</strong><span>Ventana de 14:00 a 19:00 · ${esc(route.zone)}</span></div></div></div>
          </div>
        </section>

        <section class="checkout-section">
          <h2><span class="step-num">3</span> Cómo coordinás el pago</h2>
          <div class="choice-grid" style="grid-template-columns:1fr">
            <label class="choice"><input type="radio" name="payment" value="efectivo" ${d.payment === 'efectivo' ? 'checked' : ''}><span class="choice-mark"></span><span><strong>Efectivo al recibir</strong><span>Pagás cuando retirás o cuando llega el pedido.</span></span>${icon('bag', 'icon-sm')}</label>
            <label class="choice"><input type="radio" name="payment" value="transferencia" ${d.payment === 'transferencia' ? 'checked' : ''}><span class="choice-mark"></span><span><strong>Transferencia</strong><span>El productor te pasa el alias por WhatsApp antes de la entrega.</span></span>${icon('upload', 'icon-sm')}</label>
            <label class="choice"><input type="radio" name="payment" value="mercadopago" ${d.payment === 'mercadopago' ? 'checked' : ''}><span class="choice-mark"></span><span><strong>Mercado Pago</strong><span>Link de pago enviado por el productor. La app no procesa el cobro.</span></span>${icon('shield', 'icon-sm')}</label>
          </div>
          <div class="pay-note">${icon('info')}<span><strong>El pago se coordina fuera de la app.</strong> Al confirmar, el pedido queda como «pendiente» y se abre WhatsApp para coordinar con cada productor. No se procesa ningún cobro.</span></div>
          <label class="check-row mt-16">
            <input type="checkbox" name="terms" ${d.terms ? 'checked' : ''} ${invalid('terms')}>
            <span>Entiendo que debo confirmar disponibilidad, entrega y forma de pago por WhatsApp. Los precios y el stock pueden cambiar hasta la confirmación del productor. ${fieldError('terms')}</span>
          </label>
        </section>
      </div>
      <aside class="summary checkout-summary">
        <h2>Tu pedido</h2>
        ${items.map((it) => `<div class="cart-line"><span>${it.qty} × ${esc(it.product.name)}</span><strong>${money(it.line)}</strong></div>`).join('')}
        <div class="summary-row mt-8"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
        <div class="summary-row"><span>${d.mode === 'pickup' ? 'Retiro en punto fijo' : 'Envío a domicilio'}</span><strong>${shipping === 0 ? 'Sin cargo' : money(shipping)}</strong></div>
        <div class="summary-total"><span>Total</span><strong>${money(subtotal + shipping)}</strong></div>
        <p class="summary-producers">Pedido dividido en ${groups.length} ${groups.length === 1 ? 'productor' : 'productores'}: ${groups.map((id) => esc(producerName(id))).join(', ')}.</p>
        <button class="btn btn-primary btn-block btn-lg mt-16" type="submit">${icon('check', 'icon-sm')} Confirmar pedido</button>
        <a class="btn btn-ghost btn-block mt-8" href="#/cart">Volver a la canasta</a>
        <div class="summary-note">${icon('lock')}<span>Tus datos se guardan en tu cuenta y se comparten solo con los productores del pedido.</span></div>
      </aside>
    </form>
  </div>`;
}

/* ---------- pedido ---------- */
function viewOrder(id) {
  const order = orderById(id);
  if (!order) return emptyPage('No encontramos ese pedido', 'Puede que ya no esté disponible o no pertenezca a tu cuenta.', '#/orders', 'Ver mis pedidos');
  const status = statusOrder(order);
  const producerIds = [...new Set(order.items.map((it) => it.producerId))];
  return `<div class="wrap page">
    <a class="back-link" href="#/orders">${icon('arrow-left', 'icon-sm')} Mis pedidos</a>
    <div class="order-hero mt-8">
      <div class="check-badge">${icon(status === 'cancelado' ? 'info' : 'check')}</div>
      <div style="flex:1;min-width:0">
        <p class="mono-label" style="color:var(--copper)">${order.demo ? 'Pedido de demostración' : 'Pedido'}</p>
        <h1>${status === 'cancelado' ? 'Pedido cancelado' : status === 'entregado' ? 'Pedido entregado' : 'Pedido registrado'}</h1>
        <p>${status === 'nuevo' ? 'Quedó pendiente de confirmación. Escribile a cada productor para coordinar disponibilidad y pago.' : 'Podés seguir el estado por productor y escribirle por WhatsApp. Los cambios de estado los actualiza cada productor desde su panel.'}</p>
        <div class="flex flex-wrap gap-8 mt-8">
          <span class="order-code">${esc(order.code)} <button class="link-btn" type="button" data-action="copy-order" data-id="${order.id}" aria-label="Copiar código">${icon('copy', 'icon-sm')}</button></span>
          ${statusBadge(status)}
        </div>
      </div>
      <div style="text-align:right;flex:none"><span class="tiny muted">${order.demo ? 'Total demo' : 'Total'}</span><div class="h3">${money(order.total)}</div></div>
    </div>
    ${timeline(status)}
    <div class="order-layout mt-16">
      <div>
        ${producerIds.map((pid) => producerGroupCard(order, pid)).join('')}
        <div class="order-card">
          <div class="order-card-head"><div><div class="mono-label">Entrega</div><h2>${order.delivery.mode === 'pickup' ? 'Retiro en punto fijo' : 'Envío a domicilio'}</h2></div>${icon('truck')}</div>
          <div class="order-card-body">
            <div class="delivery-box" style="margin-top:0"><div class="row">${icon('pin')}<div><strong>${esc(orderDeliveryText(order).split(' · ')[0])}</strong><span>${esc(orderDeliveryText(order).split(' · ').slice(1).join(' · '))}</span></div></div></div>
            <div class="summary-row mt-12"><span>Subtotal</span><strong>${money(order.subtotal)}</strong></div>
            <div class="summary-row"><span>Envío</span><strong>${order.shipping === 0 ? 'Sin cargo' : money(order.shipping)}</strong></div>
            <div class="summary-row"><span>Pago</span><strong>${esc(paymentLabel(order.payment))} · pendiente</strong></div>
            <div class="summary-total"><span>Total</span><strong>${money(order.total)}</strong></div>
            ${order.note ? `<p class="small muted mt-8">Nota: ${esc(order.note)}</p>` : ''}
          </div>
        </div>
        <div class="notice">${icon('info')}<span>El pedido no generó un cobro dentro de la app. Cada productor actualiza el estado de su parte desde el panel.</span></div>
      </div>
      <aside class="summary">
        <h2>Acciones</h2>
        <button class="btn btn-primary btn-block" type="button" data-action="order-buyer-wa" data-id="${order.id}">${icon('chat', 'icon-sm')} Consultar el pedido</button>
        <button class="btn btn-ghost btn-block mt-8" type="button" data-action="share-order" data-id="${order.id}">${icon('share', 'icon-sm')} Compartir resumen</button>
        <button class="btn btn-ghost btn-block mt-8" type="button" data-action="ics-order" data-id="${order.id}">${icon('calendar', 'icon-sm')} Agregar al calendario</button>
        <button class="btn btn-ghost btn-block mt-8" type="button" data-action="repeat-order" data-id="${order.id}">${icon('bag', 'icon-sm')} Volver a pedir</button>
        <hr class="divider">
        <p class="tiny muted">Fecha del pedido: ${fmtDateTime(order.createdAt)}</p>
        <p class="tiny muted mt-8">Comprador: ${esc(order.buyer.name || 'Sin nombre')} · ${esc(order.buyer.city || 'Formosa')}</p>
        <p class="tiny muted mt-8">Código para seguimiento: ${esc(order.code)}</p>
      </aside>
    </div>
  </div>`;
}

function viewOrders() {
  const tabs = [['all', 'Todos'], ['nuevo', 'Nuevos'], ['preparando', 'Preparando'], ['en_ruta', 'En ruta'], ['entregado', 'Entregados']];
  let orders = db.orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (ordersTab !== 'all') orders = orders.filter((o) => statusOrder(o) === ordersTab);
  return `<div class="wrap page">
    <div class="page-head"><div class="page-head-row"><div><h1>Mis pedidos</h1><p>Historial de tu cuenta. Los pedidos nuevos quedan pendientes hasta que cada productor confirme por WhatsApp.</p></div><div class="aside"><strong>${db.orders.length}</strong>pedidos</div></div></div>
    <div class="chips">${tabs.map(([id, label]) => `<button class="chip ${ordersTab === id ? 'is-active' : ''}" type="button" data-action="orders-tab" data-tab="${id}">${label}</button>`).join('')}</div>
    ${orders.length ? orders.map((order) => {
      const status = statusOrder(order);
      const producers = [...new Set(order.items.map((it) => it.producerId))];
      return `<a class="order-card" href="#/order/${order.id}" style="display:block">
        <div class="order-card-head">
          <div><div class="mono-label">${esc(order.code)}</div><h2>${money(order.total)} · ${order.items.length} ${order.items.length === 1 ? 'producto' : 'productos'}</h2><p class="tiny muted mt-8">${fmtDateTime(order.createdAt)} · ${producers.map((pid) => esc(producerName(pid))).join(' · ')}</p></div>
          ${statusBadge(status)}
        </div>
        <div class="order-card-body">
          ${order.items.slice(0, 3).map((it) => `<div class="order-item"><span>${it.qty} ${esc(it.unit)} · ${esc(it.name)}</span><span>${money(it.price * it.qty)}</span></div>`).join('')}
          ${order.items.length > 3 ? `<p class="tiny muted mt-8">+ ${order.items.length - 3} más</p>` : ''}
          <div class="delivery-box"><div class="row">${icon(order.delivery.mode === 'pickup' ? 'pin' : 'truck')}<div><strong>${order.delivery.mode === 'pickup' ? 'Retiro' : 'Envío'} · ${fmtLong(order.delivery.date)}</strong><span>${esc(orderDeliveryText(order))}</span></div></div></div>
        </div>
      </a>`;
    }).join('') : emptyState('bag', ordersTab === 'all' ? 'Todavía no hay pedidos' : 'No hay pedidos en este estado', 'Cuando confirmes tu primera canasta, el pedido aparece acá y queda asociado a tu cuenta.', '#/market', 'Ir al mercado')}
  </div>`;
}

/* ---------- rutas ---------- */
function routesMap() {
  const cities = [
    ['Formosa', 300, 118], ['Herradura', 258, 158], ['Villa Dos Trece', 196, 214],
    ['El Colorado', 392, 150], ['Pirané', 448, 210], ['Clorinda', 548, 72],
    ['Laguna Blanca', 486, 128], ['Las Lomitas', 414, 282]
  ];
  return `<svg viewBox="0 0 700 350" role="img" aria-label="Mapa esquemático de las rutas de entrega en Formosa">
    <defs>
      <pattern id="mapgrid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="rgba(24,37,33,.07)" stroke-width=".7"/></pattern>
      <linearGradient id="river" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c9aa0"/><stop offset="1" stop-color="#4c747c"/></linearGradient>
    </defs>
    <rect width="700" height="350" fill="#e8e8dc"></rect>
    <rect width="700" height="350" fill="url(#mapgrid)"></rect>
    <path d="M-10 42 C 120 80, 190 36, 286 70 S 420 40, 540 18 S 660 38, 716 26" fill="none" stroke="url(#river)" stroke-width="26" opacity=".55"></path>
    <path d="M-10 42 C 120 80, 190 36, 286 70 S 420 40, 540 18 S 660 38, 716 26" fill="none" stroke="#d9e3df" stroke-width="2" opacity=".5"></path>
    <text x="18" y="30" font-size="9" letter-spacing="2" fill="#50635a" font-family="Public Sans, sans-serif">RÍO PARAGUAY · ESQUEMA NO A ESCALA</text>
    <path d="M300 118 L258 158 L196 214" fill="none" stroke="#9b6239" stroke-width="3.5" stroke-dasharray="1 7" stroke-linecap="round"></path>
    <path d="M300 118 L392 150 L448 210" fill="none" stroke="#3e6b51" stroke-width="3.5" stroke-dasharray="1 7" stroke-linecap="round"></path>
    <path d="M300 118 L486 128 L548 72" fill="none" stroke="#2b4b5d" stroke-width="3.5" stroke-dasharray="1 7" stroke-linecap="round"></path>
    <path d="M300 118 L414 282" fill="none" stroke="#2b4b5d" stroke-width="3.5" stroke-dasharray="1 7" stroke-linecap="round"></path>
    ${cities.map(([name, x, y]) => {
      const labelX = name === 'Formosa' ? x : x + 12;
      const labelY = name === 'Formosa' ? y - 12 : y + 4;
      const anchor = name === 'Formosa' ? 'middle' : 'start';
      return `<g><circle cx="${x}" cy="${y}" r="7" fill="#f1b84b" stroke="#132c2a" stroke-width="2"></circle><text x="${labelX}" y="${labelY}" text-anchor="${anchor}" font-size="10.5" font-weight="600" fill="#182521" font-family="Public Sans, sans-serif">${esc(name)}</text></g>`;
    }).join('')}
    <g transform="translate(526 282)">
      <rect x="-8" y="-16" width="168" height="66" rx="8" fill="#fbfaf4" stroke="rgba(24,37,33,.18)"></rect>
      <circle cx="8" cy="0" r="4" fill="#9b6239"></circle><text x="18" y="4" font-size="9.5" fill="#182521">Ruta del río</text>
      <circle cx="8" cy="18" r="4" fill="#3e6b51"></circle><text x="18" y="22" font-size="9.5" fill="#182521">Ruta del centro</text>
      <circle cx="8" cy="36" r="4" fill="#2b4b5d"></circle><text x="18" y="40" font-size="9.5" fill="#182521">Ruta del norte</text>
    </g>
  </svg>`;
}
function viewRoutes() {
  const nextKey = upcomingDates(1)[0].route.id;
  return `<div class="wrap page">
    <div class="page-head"><div class="page-head-row"><div><h1>Entregas con fecha.</h1><p>Tres rutas semanales, ocho puntos de retiro y envío a domicilio en las zonas de reparto. Elegí lo que te quede cerca.</p></div><div class="aside"><strong>${money(SHIPPING)}</strong>envío · gratis desde ${money(FREE_SHIPPING)}</div></div></div>
    <div class="map-shell">
      <div class="map-head"><div><h2>Mapa de rutas</h2><p>Esquema de referencia, no es un mapa geográfico exacto. En el celular, deslizá el mapa para ver todas las localidades.</p></div>${tag('Formosa', 'tag-copper')}</div>
      <div class="map-scroll">${routesMap()}</div>
      <div class="map-legend"><span><i class="legend-dot" style="background:#9b6239"></i>Ruta del río · jueves</span><span><i class="legend-dot" style="background:#3e6b51"></i>Ruta del centro · viernes</span><span><i class="legend-dot" style="background:#2b4b5d"></i>Ruta del norte · sábado</span><span>${icon('info', 'icon-sm')} Cierre de pedidos 24 h antes de cada salida.</span></div>
    </div>
    <div class="route-list">${ROUTES.map((r) => routeCard(r, r.id === nextKey)).join('')}</div>
    <div class="section-head mt-24"><div><h2 class="h2">Puntos de retiro</h2><p>Sin cargo. Presentá el código del pedido y tu nombre.</p></div></div>
    <div class="pickup-grid">${PICKUPS.map((p) => `<div class="pickup"><h4>${esc(p.name)}</h4><p>${esc(p.address)}<br>${esc(p.note)}</p><div class="flex between center gap-8">${tag(routeById(p.routeId).dayLabel, 'tag-ink')}${tag(p.time, 'tag-copper')}</div></div>`).join('')}</div>
    <div class="notice mt-24">${icon('shield')}<span>Las direcciones, horarios y rutas se configuran con cada productor y la cooperativa. Confirmá el punto de retiro antes de salir.</span></div>
  </div>`;
}

/* ---------- aprender ---------- */
function viewLearn() {
  const route = parseRoute();
  if (route.param) return viewCourse(route.param);
  const done = totalCourseDone();
  const total = totalLessons();
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div>
    <section class="learn-hero">
      <div class="wrap learn-hero-inner">
        <div>
          <p class="mono-label" style="color:var(--sun)">Escuela de productores</p>
          <h1>Aprender a contar<br>lo que hacés.</h1>
          <p>Cuatro cápsulas breves, con audio y ejercicios, para grabar con el celular, contar el origen y cerrar una venta por WhatsApp. Tu avance queda guardado en tu cuenta.</p>
        </div>
        <div class="learn-progress">
          <div class="row"><strong>${pct}%</strong><span>${done} de ${total} clases completadas</span></div>
          <div class="progress-bar"><i style="width:${pct}%"></i></div>
          <p class="tiny mt-12" style="color:#c9d7dd">Podés hacerlas en orden o entrar directo a la que necesitás. Los audios usan la voz del teléfono.</p>
        </div>
      </div>
    </section>
    <div class="wrap page">
      <div class="section-head"><div><h2 class="h2">Cápsulas disponibles</h2><p>Duración corta, ejercicios concretos. Sin videos pesados ni conexión permanente.</p></div><a class="section-link" href="#/pitch">Constructor de pitch ${icon('arrow-right', 'icon-sm')}</a></div>
      <div class="course-list">${COURSES.map(courseRowCard).join('')}</div>
      <div class="about-card mt-24" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div class="role-icon" style="width:52px;height:52px;border-radius:12px;background:var(--cotton);display:grid;place-items:center;color:var(--monte)">${icon('mic')}</div>
        <div style="flex:1;min-width:220px"><h2 class="h4">Constructor de pitch de 60 segundos</h2><p class="small muted mt-8">Completá cuatro campos y obtené un guion para grabar o decir en una feria. Incluye temporizador y audio.</p></div>
        <a class="btn btn-primary" href="#/pitch">Abrir constructor</a>
      </div>
    </div>
  </div>`;
}
function viewCourse(id) {
  const course = courseById(id);
  if (!course) return emptyPage('No encontramos esa cápsula', 'Puede que el enlace esté incompleto.', '#/learn', 'Volver a aprender');
  const done = courseDone(course);
  const pct = Math.round((done / course.lessonsData.length) * 100);
  return `<div class="wrap page">
    <a class="back-link" href="#/learn">${icon('arrow-left', 'icon-sm')} Todas las cápsulas</a>
    <div class="course-hero mt-8">
      <div class="course-hero-media"><img src="${photoSrc(course.photo)}" alt="Imagen de referencia de la cápsula" loading="lazy"></div>
      <div class="course-hero-body">
        <div class="flex gap-8 flex-wrap">${tag(course.category, 'tag-copper')}${tag(course.level, 'tag-ink')}${tag(course.duration, 'tag-sun')}</div>
        <h1>${esc(course.title)}</h1>
        <p>${esc(course.summary)}</p>
        <div class="course-progress"><div class="flex between center small"><span>${done} de ${course.lessonsData.length} clases</span><strong>${pct}%</strong></div><div class="progress-bar mt-8"><i style="width:${pct}%"></i></div></div>
      </div>
    </div>
    <div class="lesson-list">
      ${course.lessonsData.map((lesson, i) => {
        const isDone = db.training.done.includes(lesson.id);
        return `<details class="lesson ${isDone ? 'is-done' : ''}" data-lesson="${lesson.id}" ${i === 0 && !isDone ? 'open' : ''}>
          <summary>
            <span class="lesson-num">${isDone ? icon('check', 'icon-sm') : i + 1}</span>
            <span class="lesson-title">${esc(lesson.title)}<span>${esc(lesson.dur)} · ${esc(lesson.summary)}</span></span>
            ${icon('plus')}
          </summary>
          <div class="lesson-body">
            ${lesson.body.map((p) => `<p>${esc(p)}</p>`).join('')}
            <ul>${lesson.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
            <div class="notice"><span><strong>Ejercicio.</strong> ${esc(lesson.exercise)}</span></div>
            <div class="lesson-actions mt-12">
              <button class="btn btn-sm ${isDone ? 'btn-ghost' : 'btn-primary'}" type="button" data-action="lesson-done" data-id="${lesson.id}">${icon('check', 'icon-sm')} ${isDone ? 'Marcar como pendiente' : 'Marcar como hecha'}</button>
              <button class="btn btn-sm btn-ghost" type="button" data-action="speak-lesson" data-course="${course.id}" data-id="${lesson.id}">${icon('play', 'icon-sm')} Escuchar</button>
              <button class="btn btn-sm btn-ghost" type="button" data-action="stop-speech">${icon('pause', 'icon-sm')} Detener</button>
              <button class="btn btn-sm btn-ghost" type="button" data-action="copy-exercise" data-course="${course.id}" data-id="${lesson.id}">${icon('copy', 'icon-sm')} Copiar ejercicio</button>
            </div>
          </div>
        </details>`;
      }).join('')}
    </div>
    <div class="flex between center gap-12 mt-24 flex-wrap">
      <a class="btn btn-ghost" href="#/learn">${icon('arrow-left', 'icon-sm')} Volver a las cápsulas</a>
      <a class="btn btn-primary" href="#/pitch">Armar mi pitch ${icon('arrow-right', 'icon-sm')}</a>
    </div>
  </div>`;
}

/* ---------- pitch ---------- */
function pitchScript() {
  const p = db.training.pitch || {};
  const parts = [];
  if (p.hook) parts.push(p.hook.trim());
  if (p.story) parts.push(p.story.trim());
  if (p.product) parts.push(p.product.trim());
  if (p.cta) parts.push(p.cta.trim());
  return parts.join('\n\n');
}
function viewPitch() {
  const p = db.training.pitch || {};
  const script = pitchScript();
  const complete = !!(p.hook && p.story && p.product && p.cta);
  return `<div class="wrap page">
    <div class="page-head"><div class="page-head-row"><div><h1>Tu pitch en 60 segundos.</h1><p>Cuatro campos, un guion. Empezá por el deseo, seguí por el trabajo y cerrá con una acción concreta. Después practicá con el temporizador.</p></div><div class="aside"><strong>${complete ? 'Listo' : 'Borrador'}</strong>${complete ? 'para grabar' : 'completá los 4 campos'}</div></div></div>
    <div class="profile-grid">
      <form class="pitch-box" data-form="pitch" style="margin-top:0">
        <h2>Armá el guion</h2>
        <p>Escribí como hablás. Frases cortas. Nada de «producto de calidad» sin una prueba.</p>
        <div class="field"><label for="pi-hook">1. El gancho <span class="hint">(15 segundos)</span></label><textarea id="pi-hook" name="hook" placeholder="¿Qué situación concreta hace que alguien quiera probar lo que hacés?">${esc(p.hook)}</textarea><span class="hint">Ej.: «¿Sabés lo que es un pomelo que larga jugo hasta el codo?»</span></div>
        <div class="field"><label for="pi-story">2. El trabajo detrás <span class="hint">(20 segundos)</span></label><textarea id="pi-story" name="story" placeholder="Una escena concreta de tu semana: la cosecha, el galpón, las manos.">${esc(p.story)}</textarea><span class="hint">Un detalle sensorial vale más que tres adjetivos.</span></div>
        <div class="field"><label for="pi-product">3. Qué ofrecés y cuánto <span class="hint">(15 segundos)</span></label><textarea id="pi-product" name="product" placeholder="Producto, unidad, precio y qué incluye.">${esc(p.product)}</textarea><span class="hint">Precio claro. Si es más caro, explicá por qué.</span></div>
        <div class="field"><label for="pi-cta">4. La acción <span class="hint">(10 segundos)</span></label><textarea id="pi-cta" name="cta" placeholder="Dónde te encuentran y hasta cuándo tomás pedidos.">${esc(p.cta)}</textarea><span class="hint">Un solo destino: WhatsApp, tu perfil o la próxima feria.</span></div>
        <div class="flex gap-8 flex-wrap">
          <button class="btn btn-primary" type="submit">${icon('check', 'icon-sm')} Guardar guion</button>
          <button class="btn btn-ghost" type="button" data-action="copy-pitch" ${script ? '' : 'disabled'}>${icon('copy', 'icon-sm')} Copiar</button>
          <button class="btn btn-ghost" type="button" data-action="speak-pitch" ${script ? '' : 'disabled'}>${icon('play', 'icon-sm')} Escuchar</button>
          <button class="btn btn-ghost" type="button" data-action="open-timer" data-sec="60">${icon('clock', 'icon-sm')} Temporizador</button>
        </div>
      </form>
      <div>
        <div class="pitch-box" style="margin-top:0">
          <div class="flex between center gap-12"><h2>Tu guion</h2>${tag(script.split(/\s+/).filter(Boolean).length + ' palabras', 'tag-copper')}</div>
          <p>Leelo en voz alta. Si te trabás, acortá. Un pitch de 60 segundos tiene entre 120 y 150 palabras.</p>
          <div class="pitch-script" id="pitch-preview">${script ? esc(script) : 'Todavía no escribiste nada. Completá los cuatro campos y el guion aparece acá.'}</div>
          <div class="flex gap-8 flex-wrap mt-12">
            <button class="btn btn-sm btn-ghost" type="button" data-action="open-timer" data-sec="30">30 s</button>
            <button class="btn btn-sm btn-ghost" type="button" data-action="open-timer" data-sec="60">60 s</button>
            <button class="btn btn-sm btn-ghost" type="button" data-action="open-timer" data-sec="120">120 s</button>
            <button class="btn btn-sm btn-danger" type="button" data-action="clear-pitch">Borrar borrador</button>
          </div>
        </div>
        <div class="about-card mt-16">
          <h2 class="h4">Tres reglas que no fallan</h2>
          <ul class="small muted mt-8" style="display:grid;gap:7px;line-height:1.5">
            <li><strong>1.</strong> Una idea por frase. Si podés sacar una palabra, sacala.</li>
            <li><strong>2.</strong> Mostrá una prueba: el lote, la mano, la fecha de cosecha.</li>
            <li><strong>3.</strong> Terminá con una acción: «escribime antes del miércoles».</li>
          </ul>
          <a class="link-btn mt-12" href="#/learn/oratoria">Ver la cápsula de oratoria ${icon('arrow-right', 'icon-sm')}</a>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- perfil ---------- */
function viewProfile() {
  const isProducer = db.role === 'producer';
  const producer = ownProducer();
  const orders = db.orders.length;
  const favs = (db.buyer.favorites || []).length;
  const done = totalCourseDone();
  const user = db.user || {};
  return `<div class="wrap page">
    <div class="profile-head">
      <div class="profile-avatar">${isProducer ? esc((producer || {}).initials || 'PD') : esc(initials(db.buyer.name || 'Innova Agro'))}</div>
      <div>
        <h1>${esc(isProducer ? (producer || {}).owner || user.name || 'Productor' : db.buyer.name || 'Mi perfil')}</h1>
        <p>${isProducer ? esc(((producer || {}).name || 'Mi emprendimiento') + ' · ' + ((producer || {}).place || 'Formosa')) : esc(db.buyer.city || 'Formosa Capital')} · ${isProducer ? 'Panel de productor' : 'Comprador'}</p>
        <p class="account-email mt-8">${icon('user', 'icon-sm')} ${esc(user.email || '')}</p>
      </div>
      <span class="role">${tag(isProducer ? 'Productor' : 'Comprador', 'tag-copper')}</span>
    </div>
    <div class="stat-row">
      <div class="stat-cell"><span>Pedidos</span><strong>${orders}</strong><small>en tu cuenta</small></div>
      <div class="stat-cell"><span>Favoritos</span><strong>${favs}</strong><small>productos guardados</small></div>
      <div class="stat-cell"><span>Aprendizaje</span><strong>${done}</strong><small>clases completadas</small></div>
    </div>
    <div class="profile-grid">
      <div>
        <div class="profile-section">
          <h2>Mi cuenta</h2>
          <div class="menu-list">
            <a class="menu-item" href="#/orders">${icon('bag')}<span><strong>Mis pedidos</strong><span>Historial, estados y contacto por WhatsApp</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></a>
            <button class="menu-item" type="button" data-action="show-favorites">${icon('heart')}<span><strong>Favoritos</strong><span>${favs ? favs + ' productos guardados' : 'Guardá productos para después'}</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></button>
            <a class="menu-item" href="#/routes">${icon('truck')}<span><strong>Entregas y retiros</strong><span>Rutas, horarios y puntos fijos</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></a>
            <a class="menu-item" href="#/learn">${icon('book')}<span><strong>Aprender</strong><span>Cápsulas, audio y constructor de pitch</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></a>
            ${isProducer ? `<a class="menu-item" href="#/panel">${icon('store')}<span><strong>Panel del productor</strong><span>Productos, stock y pedidos</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></a>
            <a class="menu-item" href="#/panel/profile">${icon('leaf')}<span><strong>Perfil público de la finca</strong><span>Historia, WhatsApp, foto y zona de reparto</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></a>` : ''}
          </div>
        </div>

        <div class="profile-section">
          <h2>Datos personales</h2>
          <form class="form-card account-form" data-form="buyer-profile" novalidate>
            <p>Estos datos se usan para completar tus pedidos y que el productor pueda contactarte.</p>
            <div class="form-grid-2">
              <div class="field"><label for="me-name">Nombre y apellido</label><input id="me-name" name="name" value="${esc(user.name || '')}" autocomplete="name"><span class="field-error" data-err="name" hidden></span></div>
              <div class="field"><label for="me-phone">WhatsApp</label><input id="me-phone" name="phone" type="tel" inputmode="tel" value="${esc(user.phone || '')}" placeholder="370 400 0000" autocomplete="tel"><span class="field-error" data-err="phone" hidden></span></div>
            </div>
            <div class="form-grid-2">
              <div class="field"><label for="me-city">Localidad</label><select id="me-city" name="city">${CITIES.map((c) => `<option ${((user.city || 'Formosa Capital') === c) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
              <div class="field"><label for="me-address">Dirección habitual <span class="hint">(opcional)</span></label><input id="me-address" name="address" value="${esc(user.address || '')}" placeholder="Calle, número, barrio" autocomplete="street-address"></div>
            </div>
            <div class="field"><label>Correo electrónico</label><input value="${esc(user.email || '')}" disabled><span class="inline-hint">El correo identifica tu cuenta y no se puede cambiar desde acá.</span></div>
            <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check', 'icon-sm')} Guardar datos</button><span class="session-note">${icon('shield', 'icon-sm')} Solo lo ven los productores de tus pedidos.</span></div>
          </form>
        </div>

        <div class="profile-section">
          <h2>Contraseña</h2>
          <form class="form-card account-form" data-form="change-password" novalidate>
            <p>Si cambiás la contraseña, las demás sesiones abiertas dejan de ser válidas.</p>
            <div class="form-grid-2">
              <div class="field"><label for="pw-current">Contraseña actual</label><input id="pw-current" name="currentPassword" type="password" autocomplete="current-password"><span class="field-error" data-err="currentPassword" hidden></span></div>
              <div class="field"><label for="pw-new">Contraseña nueva</label><input id="pw-new" name="newPassword" type="password" autocomplete="new-password" minlength="8"><span class="field-error" data-err="newPassword" hidden></span></div>
            </div>
            <div class="field"><label for="pw-repeat">Repetir contraseña nueva</label><input id="pw-repeat" name="repeatPassword" type="password" autocomplete="new-password"><span class="field-error" data-err="repeatPassword" hidden></span></div>
            <div class="form-actions"><button class="btn btn-ghost" type="submit">${icon('lock', 'icon-sm')} Cambiar contraseña</button></div>
          </form>
        </div>
      </div>

      <div>
        <div class="profile-section">
          <h2>Preferencias</h2>
          <div class="about-card">
            <div class="switch-row" style="padding-top:0"><div><strong>Avisos de rutas</strong><span>Recordatorios de cierre de pedidos y salidas.</span></div><label class="switch"><input type="checkbox" data-action="setting-toggle" data-key="notifyRoutes" ${db.settings.notifyRoutes ? 'checked' : ''}><i></i><span class="sr-only">Avisos de rutas</span></label></div>
            <div class="switch-row" style="border-bottom:0;padding-bottom:0"><div><strong>Ofertas de temporada</strong><span>Cuando un productor publica un lote nuevo.</span></div><label class="switch"><input type="checkbox" data-action="setting-toggle" data-key="notifyOffers" ${db.settings.notifyOffers ? 'checked' : ''}><i></i><span class="sr-only">Ofertas de temporada</span></label></div>
          </div>
        </div>
        <div class="profile-section">
          <h2>La app</h2>
          <div class="menu-list">
            <a class="menu-item" href="#/publish">${icon('download')}<span><strong>Instalar o publicar</strong><span>Android, iOS, hosting y PWA</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></a>
            <a class="menu-item" href="#/about">${icon('info')}<span><strong>Acerca de InnovaAgro</strong><span>Misión, alcance del catálogo y créditos</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></a>
            <button class="menu-item" type="button" data-action="install-app">${icon('download')}<span><strong>Agregar a la pantalla de inicio</strong><span>Acceso directo y catálogo disponible sin conexión</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></button>
            <a class="menu-item" href="/api/me/export" download>${icon('download')}<span><strong>Descargar mis datos</strong><span>Cuenta, pedidos, favoritos y avance en un archivo JSON</span></span><span class="chev">${icon('chevron-right', 'icon-sm')}</span></a>
          </div>
        </div>
        <div class="profile-section">
          <h2>Sesión y datos</h2>
          <div class="about-card">
            <p>Tus pedidos, favoritos y avance se guardan en este servidor. También mantenemos una copia local para que puedas consultar el catálogo si se corta la conexión.</p>
            <div class="flex gap-8 flex-wrap mt-12">
              <button class="btn btn-sm btn-ghost" type="button" data-action="copy-state">${icon('copy', 'icon-sm')} Copiar resumen de cuenta</button>
              <button class="btn btn-sm btn-danger" type="button" data-action="logout">${icon('arrow-right', 'icon-sm')} Cerrar sesión</button>
            </div>
            <p class="tiny muted mt-12">${isDemoCatalog() ? 'El catálogo inicial es de demostración; los cambios que hagas y los pedidos nuevos son reales en este servidor.' : 'Catálogo gestionado por productores.'}</p>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- publicar ---------- */
function viewPublish() {
  return `<div class="wrap page">
    <div class="page-head"><div class="page-head-row"><div><h1>De la demo a producción.</h1><p>InnovaAgro-App es una aplicación web con servidor, base de datos y sesiones. Se ejecuta con Node.js y se puede publicar en cualquier hosting que soporte procesos y disco persistente.</p></div><div class="aside"><strong>Node + SQLite</strong>sin servicios externos</div></div></div>
    <div class="notice">${icon('info')}<span><strong>Importante:</strong> GitHub Pages solo sirve archivos estáticos y no puede ejecutar el backend. Para una versión real, publicá el servidor en Render, Railway, Fly.io, un VPS o un contenedor Docker. GitHub puede guardar el código y activar el despliegue automático.</span></div>
    <div class="publish-steps">
      <div class="publish-step"><div><h3>1. Probala en tu computadora</h3><p>Con Node.js 24 o superior, instalá dependencias y arrancá el servidor. La base se crea sola en <code>data/innovaagro.db</code> con el catálogo inicial y las cuentas demo.</p><div class="code-block">npm install
npm start</div><p>Abrí <code>http://localhost:3000</code>. Para usar otro puerto: <code>PORT=8080 npm start</code>.</p><button class="btn btn-sm btn-ghost mt-8" type="button" data-action="copy-command" data-cmd="npm install&#10;npm start">${icon('copy', 'icon-sm')} Copiar comandos</button></div></div>
      <div class="publish-step"><div><h3>2. Revisá las cuentas demo</h3><p>Compradora: <code>demo@innovaagro.app</code> · <code>demo1234</code>. Productor: <code>finca@innovaagro.app</code> · <code>demo1234</code>. Cada uno de los nueve productores iniciales tiene su cuenta. Cambiá estas contraseñas o desactivá las cuentas demo antes de abrir la app al público.</p></div></div>
      <div class="publish-step"><div><h3>3. Configurá el servidor</h3><p>Variables principales: <code>PORT</code>, <code>DATA_DIR</code> y <code>UPLOADS_DIR</code> en el disco persistente; <code>SEED_CATALOG=false</code> y <code>SEED_DEMO=false</code> para una instalación sin datos de ejemplo; <code>COOKIE_SECURE=true</code> detrás de HTTPS y <code>TRUST_PROXY=true</code> si hay proxy inverso. Guardá respaldos de la base y de las fotos.</p><div class="code-block">DATA_DIR=/var/lib/innovaagro
UPLOADS_DIR=/var/lib/innovaagro/uploads
SEED_CATALOG=false
SEED_DEMO=false
COOKIE_SECURE=true
TRUST_PROXY=true
NODE_ENV=production</div></div></div>
      <div class="publish-step"><div><h3>4. Publicá el backend</h3><p>Subí el proyecto a un repositorio y desplegalo en un hosting con disco persistente. El <code>Dockerfile</code> incluido sirve para Render, Railway, Fly.io o un VPS. Verificá que <code>/api/health</code> responda y que la base y las fotos sobrevivan a cada despliegue.</p><div class="code-block">docker build -t innovaagro .
docker run -p 3000:3000 -v innovaagro-data:/app/data -v innovaagro-uploads:/app/uploads innovaagro</div><button class="btn btn-sm btn-ghost mt-8" type="button" data-action="copy-command" data-cmd="docker build -t innovaagro .&#10;docker run -p 3000:3000 -v innovaagro-data:/app/data -v innovaagro-uploads:/app/uploads innovaagro">${icon('copy', 'icon-sm')} Copiar Docker</button></div></div>
      <div class="publish-step"><div><h3>5. Envolvé con Floot</h3><p>En Floot, creá una app del tipo <strong>Website / WebView</strong> y pegá la URL pública del servidor (por ejemplo, <code>https://innovaagro.onrender.com</code>). Nombre: <strong>InnovaAgro-App</strong>; ícono: la medalla; color <code>#132c2a</code>. Generá el APK/AAB de Android y el proyecto iOS. La app nativa solo abre el sitio: todas las cuentas y pedidos viven en el servidor.</p><div class="notice mt-8">${icon('info')}<span>Floot Storage no acepta <code>.html</code> ni ejecuta Node. No subas el proyecto ahí: usá la URL del backend.</span></div></div></div>
      <div class="publish-step"><div><h3>6. Antes de abrir al público</h3><p>Reemplazá productores, precios, fotos, puntos de retiro y teléfonos por datos reales; configurá el WhatsApp de cada productor desde su panel; revisá los créditos de las fotos de referencia; acordá quién administra los respaldos; y publicá una política de privacidad con un correo de contacto. Los pagos siguen coordinándose por WhatsApp: la app no cobra ni retiene dinero.</p></div></div>
    </div>
    <div class="grid-2 mt-24">
      <div class="about-card"><h2 class="h4">Qué funciona sin conexión</h2><ul class="small muted mt-8" style="display:grid;gap:6px"><li>· Última copia del catálogo y de tus pedidos.</li><li>· Búsqueda y fichas ya visitadas.</li><li>· Cápsulas y guiones guardados en el teléfono.</li><li>· Acceso directo instalado como PWA.</li></ul></div>
      <div class="about-card"><h2 class="h4">Qué necesita conexión</h2><ul class="small muted mt-8" style="display:grid;gap:6px"><li>· Iniciar sesión y crear una cuenta.</li><li>· Confirmar pedidos, favoritos y avance.</li><li>· Editar productos, stock y perfil de productor.</li><li>· Abrir WhatsApp y compartir con el sistema.</li></ul></div>
    </div>
    <div class="notice mt-24">${icon('shield')}<span><strong>Datos y respaldo:</strong> la base SQLite vive en el disco del servidor. Programá copias de seguridad diarias y probá la restauración. Si usás un hosting efímero sin volumen persistente, los usuarios y pedidos se pierden en cada despliegue.</span></div>
  </div>`;
}

/* ---------- acerca de ---------- */
function viewAbout() {
  return `<div class="wrap page">
    <div class="page-head"><div><h1>Una red corta,<br>con nombre y origen.</h1><p>InnovaAgro-App conecta a productores de Formosa con consumidores, comercios y distribuidores. Sin intermediarios que se queden con el nombre de quien produce.</p></div></div>
    <div class="producer-feature">
      <div class="producer-feature-media"><img src="${PHOTOS.hero}" alt="Algodón nativo, imagen de referencia"></div>
      <div class="producer-feature-body">
        <div class="brand">${brandMark(46)}<div class="brand-text"><span class="brand-name">InnovaAgro<span>-App</span></span><span class="brand-sub">Tecnología &amp; Naturaleza · Formosa</span></div></div>
        <p>La app ordena la oferta de una semana, muestra el origen de cada lote y lleva el pedido al WhatsApp del productor. Cada cuenta tiene su panel: los productores cargan stock y precios; los compradores arman su canasta y siguen el estado. El pago se coordina directo: la app no cobra comisiones ni retiene dinero.</p>
        <div class="producer-meta">${tag('Catálogo de temporada', 'tag-ok')}${tag('Rutas semanales', 'tag-copper')}${tag('Cuentas reales', 'tag-indigo')}</div>
        <div class="flex gap-8 flex-wrap"><a class="btn btn-primary" href="#/market">Ver el mercado</a><a class="btn btn-ghost" href="#/publish">Cómo publicarla</a></div>
      </div>
    </div>
    <div class="grid-2 mt-24">
      <div class="about-card"><h2 class="h4">Qué es contenido de ejemplo</h2><p class="mt-8">Los nueve productores iniciales, sus historias, los 23 productos, los precios, el stock, las rutas y los siete pedidos de la cuenta demo son contenido ficticio creado para probar el producto. No representan a personas ni establecimientos reales. Las fotos son imágenes de referencia con licencias abiertas y no corresponden necesariamente a los productos o lugares descritos.</p><p class="mt-8">Los productores pueden editar su perfil y catálogo desde el panel. Los pedidos nuevos, las cuentas, los favoritos y el avance de las cápsulas son reales dentro de este servidor.</p><p class="mt-8">No se procesan pagos. Mercado Pago, transferencia y efectivo son opciones de coordinación, no integraciones de cobro.</p></div>
      <div class="about-card"><h2 class="h4">Privacidad y datos</h2><p class="mt-8">La cuenta se protege con contraseña y una cookie de sesión HttpOnly. Guardamos nombre, correo, teléfono, localidad, dirección, pedidos, favoritos y avance de las cápsulas para que la app funcione. No usamos analítica ni publicidad de terceros.</p><p class="mt-8">Los datos de entrega se comparten únicamente con los productores que participan de cada pedido. Podés descargar tu información desde <strong>Mi perfil → Descargar mis datos</strong> y cerrar sesión en cualquier momento.</p><p class="mt-8">Antes de abrir la app al público, el responsable del despliegue debe publicar una política de privacidad con un correo de contacto y definir cuánto tiempo conserva los datos.</p></div>
    </div>
    <div class="about-card mt-24">
      <h2 class="h4">Créditos de imágenes</h2>
      <p class="small muted mt-8">Fotografías de referencia obtenidas de Wikimedia Commons, bajo licencias Creative Commons o dominio público. Se muestran como imágenes ilustrativas. Antes de publicar, reemplazalas por fotografías propias o verificá la atribución exigida por cada licencia.</p>
      <div class="credits mt-12">${CREDITS.map((c) => `<div>· ${esc(c.title)} — ${esc(c.creator || 'Autoría no identificada')} · ${esc(c.license || 'Licencia abierta')}${c.source ? ` · <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">fuente</a>` : ''}</div>`).join('')}</div>
    </div>
    <div class="notice mt-24">${icon('info')}<span>InnovaAgro-App · versión 1.0 · Formosa, Argentina. Aplicación web con servidor Node.js, base SQLite y catálogo inicial de demostración.</span></div>
  </div>`;
}

function viewNotFound() {
  return emptyPage('Esta página no existe', 'Puede que el enlace esté mal escrito o que el contenido haya cambiado.', '#/home', 'Volver al inicio');
}
