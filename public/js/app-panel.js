/* ===================== InnovaAgro-App · panel del productor ===================== */

function panelGate() {
  return `<div class="wrap page">${emptyState('store', 'Necesitás una cuenta de productor', 'Esta sección es para productores y productoras. Si tenés un emprendimiento, creá una cuenta de productor desde la pantalla de ingreso.', '<a class="btn btn-primary" href="#/profile">Ir a mi perfil</a>')}</div>`;
}

function producerGroup(order, producerId) {
  return (order.groups || {})[producerId] || { status: 'nuevo', subtotal: 0 };
}

function viewPanel() {
  if (db.role !== 'producer' || !db.producerId) return panelGate();
  const producer = ownProducer();
  if (!producer) return panelGate();
  const products = producerProducts(producer.id, true);
  const active = products.filter((p) => p.active);
  const orders = producerOrders(producer.id);
  const pending = orders.filter((o) => producerGroup(o, producer.id).status === 'nuevo').length;
  const preparing = orders.filter((o) => producerGroup(o, producer.id).status === 'preparando').length;
  const delivered = orders.filter((o) => producerGroup(o, producer.id).status === 'entregado');
  const revenue = delivered.reduce((sum, o) => sum + (producerGroup(o, producer.id).subtotal || 0), 0);
  const lowStock = active.filter((p) => p.stock <= 4);
  const route = ROUTES.find((r) => r.zone === producer.zone) || ROUTES[0];
  const nextDate = routeNextDate(route.id);
  const recent = orders.slice(0, 4);
  const done = totalCourseDone();
  const total = totalLessons();
  return `<div class="wrap page panel-page">
    <section class="panel-hero">
      <div class="panel-hero-copy">
        <p class="mono-label">Panel del productor · ${esc(producer.place)}</p>
        <h1>${esc(producer.name)}</h1>
        <p>${producer.demo ? 'Este es un perfil de ejemplo. Podés editar todo para convertir tu cuenta en un catálogo real. ' : ''}Gestioná stock, pedidos y tu perfil público. Los compradores ven los cambios en cuanto guardás.</p>
        <div class="panel-hero-actions">
          <a class="btn btn-sun" href="#/panel/product/new">${icon('plus', 'icon-sm')} Publicar producto</a>
          <a class="btn btn-ghost btn-white" href="#/producer/${producer.id}">Ver mi tienda ${icon('arrow-right', 'icon-sm')}</a>
          <a class="btn btn-ghost btn-white" href="#/panel/profile">Editar perfil</a>
        </div>
      </div>
      <div class="panel-hero-side">
        <div class="panel-next"><span>Próxima ruta</span><strong>${esc(route.name)}</strong><small>${esc(route.dayLabel)} ${fmtShort(nextDate)} · cierre ${esc(route.cutoff)}</small></div>
        <div class="panel-next"><span>Aprendizaje</span><strong>${done} de ${total} clases</strong><small>${done ? 'Seguí con la próxima cápsula' : 'Empezá por oratoria o storytelling'}</small></div>
      </div>
    </section>

    <div class="stat-grid">
      <div class="stat-card"><span>Pedidos nuevos</span><strong>${pending}</strong><small>esperando confirmación</small></div>
      <div class="stat-card"><span>En preparación</span><strong>${preparing}</strong><small>para la próxima salida</small></div>
      <div class="stat-card"><span>Productos activos</span><strong>${active.length}</strong><small>${products.length - active.length} pausados</small></div>
      <div class="stat-card"><span>Vendido entregado</span><strong>${money(revenue)}</strong><small>${delivered.length} pedidos entregados</small></div>
    </div>

    <div class="panel-grid">
      <div class="panel-card">
        <div class="flex between center gap-12 flex-wrap"><div><h2>Pedidos recientes</h2><p>Lo que necesita tu atención esta semana.</p></div><a class="link-btn" href="#/panel/orders">Ver todos ${icon('arrow-right', 'icon-sm')}</a></div>
        ${recent.length ? `<div class="panel-order-list">${recent.map((order) => {
          const group = producerGroup(order, producer.id);
          const items = (order.items || []).filter((it) => it.producerId === producer.id);
          return `<div class="panel-order">
            <div class="panel-order-head"><div><strong>${esc(order.code)}</strong><span>${esc(order.buyer.name)} · ${fmtDateTime(order.createdAt)}</span></div>${statusBadge(group.status)}</div>
            <div class="panel-order-body">
              <div class="panel-order-items">${items.map((it) => `<div><span>${it.qty} ${esc(it.unit)} · ${esc(it.name)}</span><span>${money(it.price * it.qty)}</span></div>`).join('')}</div>
              <div class="panel-order-foot" style="padding:0;border:0"><strong>${money(group.subtotal)}</strong><a class="btn btn-sm btn-ghost" href="#/panel/orders">Gestionar</a></div>
            </div>
          </div>`;
        }).join('')}</div>` : `<div class="panel-empty">${icon('bag', 'icon-lg')}<p>Todavía no recibiste pedidos. Cuando un comprador confirme una canasta, aparece acá.</p></div>`}
      </div>

      <div style="display:grid;gap:16px">
        <div class="panel-card">
          <h2>Stock bajo</h2>
          <p>Productos con cuatro unidades o menos.</p>
          ${lowStock.length ? `<div style="display:grid;gap:9px">${lowStock.map((p) => `<div class="flex between center gap-8"><span class="small">${esc(p.name)}</span><span class="status ${p.stock === 0 ? 'status-cancelado' : 'status-preparando'}">${p.stock === 0 ? 'Agotado' : p.stock + ' u.'}</span></div>`).join('')}</div><a class="btn btn-sm btn-ghost btn-block mt-12" href="#/panel/products">Actualizar stock</a>` : `<p class="small muted">Todo el catálogo tiene stock suficiente.</p>`}
        </div>
        <div class="panel-card">
          <h2>Perfil público</h2>
          <p>Tu sello de origen y tu historia son lo primero que ve el comprador.</p>
          <div class="flex center gap-12">${seal(producer, 54)}<div><strong class="small">${esc(producer.name)}</strong><span class="tiny muted" style="display:block">${esc(producer.place)} · ${producer.whatsapp ? 'WhatsApp cargado' : 'WhatsApp pendiente'}</span></div></div>
          <a class="btn btn-sm btn-ghost btn-block mt-12" href="#/panel/profile">Editar perfil y WhatsApp</a>
        </div>
      </div>
    </div>
  </div>`;
}

function viewPanelProducts() {
  if (db.role !== 'producer' || !db.producerId) return panelGate();
  const producer = ownProducer();
  if (!producer) return panelGate();
  const all = producerProducts(producer.id, true);
  const q = panelProductQuery.trim().toLowerCase();
  const list = q ? all.filter((p) => [p.name, p.category, p.lot, p.short].join(' ').toLowerCase().includes(q)) : all;
  return `<div class="wrap page panel-page">
    <div class="page-head"><div class="page-head-row"><div><h1>Productos y stock.</h1><p>Lo que publicás acá aparece en el mercado y en tu perfil. El stock se descuenta automáticamente cuando se confirma un pedido.</p></div><div class="aside"><strong>${all.filter((p) => p.active).length}</strong>activos</div></div></div>
    <div class="panel-card">
      <div class="panel-toolbar">
        <form class="search-field" data-form="panel-product-search" role="search">
          ${icon('search')}
          <input type="search" name="q" value="${esc(panelProductQuery)}" placeholder="Buscar por nombre, lote o categoría" aria-label="Buscar producto">
        </form>
        <a class="btn btn-primary btn-sm" href="#/panel/product/new">${icon('plus', 'icon-sm')} Nuevo producto</a>
      </div>
      ${list.length ? `<div class="panel-product-list">${list.map((p) => `<div class="panel-product-row">
        <img class="panel-thumb" src="${photoSrc(p.photo)}" alt="" loading="lazy">
        <div class="panel-product-main">
          <strong>${esc(p.name)} ${p.active ? '' : '<span class="demo-pill">Pausado</span>'}</strong>
          <span>${esc(p.category)} · Lote ${esc(p.lot)} · ${esc(p.unit)}</span>
        </div>
        <div class="panel-price">${money(p.price)}<small>${p.stock} disponibles</small></div>
        <div class="panel-row-actions">
          <form class="stock-form" data-form="panel-stock" data-id="${p.id}">
            <input type="number" name="stock" min="0" max="1000000" value="${p.stock}" aria-label="Stock de ${esc(p.name)}">
            <button class="btn btn-sm btn-ghost" type="submit" aria-label="Guardar stock">${icon('check', 'icon-sm')}</button>
          </form>
          <a class="btn btn-sm btn-ghost" href="#/panel/product/${p.id}" aria-label="Editar ${esc(p.name)}">${icon('edit', 'icon-sm')}</a>
          <button class="btn btn-sm ${p.active ? 'btn-ghost' : 'btn-primary'}" type="button" data-action="panel-product-toggle" data-id="${p.id}" aria-label="${p.active ? 'Pausar' : 'Publicar'} ${esc(p.name)}">${icon(p.active ? 'pause' : 'play', 'icon-sm')}</button>
        </div>
      </div>`).join('')}</div>` : `<div class="panel-empty">${icon('market', 'icon-lg')}<p>${q ? 'No hay productos que coincidan con la búsqueda.' : 'Todavía no publicaste productos. Empezá con uno que tengas disponible esta semana.'}</p><a class="btn btn-primary mt-12" href="#/panel/product/new">Publicar el primero</a></div>`}
    </div>
    <div class="panel-alert">${icon('info', 'icon-sm')}<span>Consejo: publicá solo lo que podés entregar en la próxima ruta. Si un producto se agota, pausalo en lugar de borrarlo para conservar su historial de pedidos.</span></div>
  </div>`;
}

function viewPanelProduct(id) {
  if (db.role !== 'producer' || !db.producerId) return panelGate();
  const producer = ownProducer();
  if (!producer) return panelGate();
  const isNew = !id || id === 'new';
  const product = isNew ? null : productById(id);
  if (!isNew && (!product || product.producerId !== producer.id)) {
    return emptyPage('No encontramos ese producto', 'Puede que pertenezca a otro productor o que ya no exista.', '#/panel/products', 'Volver a productos');
  }
  const p = product || {
    id: '', name: '', category: CATEGORIES[0] || '', price: '', unit: 'unidad', stock: 1,
    photo: 'hero', lot: `L-${new Date().getFullYear()}-`, short: '', description: '',
    highlights: [], harvest: '', season: 'Primavera', available: 'Esta semana', organic: false, active: true
  };
  return `<div class="wrap page panel-page">
    <a class="back-link" href="#/panel/products">${icon('arrow-left', 'icon-sm')} Productos</a>
    <form class="form-card" data-form="panel-product" data-id="${esc(p.id)}" novalidate>
      <div class="flex between center gap-12 flex-wrap"><div><h2>${isNew ? 'Publicar producto' : 'Editar producto'}</h2><p>Los campos marcados con * son obligatorios. La foto se muestra en el catálogo y en la ficha.</p></div>${!isNew ? `<button class="btn btn-sm btn-danger" type="button" data-action="panel-product-delete" data-id="${esc(p.id)}">${icon('trash', 'icon-sm')} Pausar</button>` : ''}</div>
      <div class="form-grid">
        <div class="upload-box">
          <img class="upload-preview" id="product-photo-preview" src="${photoSrc(p.photo)}" alt="Vista previa de la foto">
          <div class="upload-copy">
            <strong>Foto del producto</strong>
            <span>JPG, PNG o WebP de hasta 6 MB. Ideal: horizontal, buena luz.</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" data-upload="product-photo">
            <input type="hidden" name="photo" value="${esc(p.photo)}">
            <span class="field-error" data-err="photo" hidden></span>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label for="pp-name">Nombre *</label><input id="pp-name" name="name" value="${esc(p.name)}" placeholder="Ej.: Pomelo rosado de Herradura"><span class="field-error" data-err="name" hidden></span></div>
          <div class="field"><label for="pp-category">Categoría *</label><select id="pp-category" name="category">${CATEGORIES.map((c) => `<option ${p.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="field-error" data-err="category" hidden></span></div>
        </div>
        <div class="form-grid-3">
          <div class="field"><label for="pp-price">Precio en pesos *</label><input id="pp-price" name="price" type="number" min="1" max="10000000" step="1" inputmode="numeric" value="${p.price}" placeholder="4500"><span class="field-error" data-err="price" hidden></span></div>
          <div class="field"><label for="pp-unit">Unidad de venta *</label><input id="pp-unit" name="unit" value="${esc(p.unit)}" placeholder="kg, docena, 500 g"><span class="field-error" data-err="unit" hidden></span></div>
          <div class="field"><label for="pp-stock">Stock disponible *</label><input id="pp-stock" name="stock" type="number" min="0" max="1000000" step="1" inputmode="numeric" value="${p.stock}"><span class="field-error" data-err="stock" hidden></span></div>
        </div>
        <div class="form-grid-3">
          <div class="field"><label for="pp-lot">Código de lote *</label><input id="pp-lot" name="lot" value="${esc(p.lot)}" placeholder="L-2026-01"><span class="field-error" data-err="lot" hidden></span></div>
          <div class="field"><label for="pp-harvest">Cosecha</label><input id="pp-harvest" name="harvest" value="${esc(p.harvest)}" placeholder="Ej.: 18 de octubre"><span class="field-error" data-err="harvest" hidden></span></div>
          <div class="field"><label for="pp-season">Temporada</label><input id="pp-season" name="season" value="${esc(p.season)}" placeholder="Primavera"><span class="field-error" data-err="season" hidden></span></div>
        </div>
        <div class="field"><label for="pp-short">Descripción breve *</label><input id="pp-short" name="short" value="${esc(p.short)}" maxlength="240" placeholder="Una línea que explique qué hace especial a este producto."><span class="field-error" data-err="short" hidden></span></div>
        <div class="field"><label for="pp-description">Descripción completa *</label><textarea id="pp-description" name="description" placeholder="Origen, sabor, cómo se produjo, cómo conservarlo…">${esc(p.description)}</textarea><span class="field-error" data-err="description" hidden></span></div>
        <div class="field"><label for="pp-highlights">Lo que lo hace distinto <span class="hint">(separado por comas)</span></label><input id="pp-highlights" name="highlights" value="${esc((p.highlights || []).join(', '))}" placeholder="Cosecha manual, sin conservantes, cultivo familiar"><span class="field-error" data-err="highlights" hidden></span></div>
        <div class="form-grid-2">
          <div class="field"><label for="pp-available">Disponibilidad</label><select id="pp-available" name="available">${['Esta semana', 'Próxima semana', 'Por temporada', 'A pedido'].map((x) => `<option ${p.available === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <div class="field" style="display:grid;gap:9px;align-content:end"><label class="checkbox-line"><input type="checkbox" name="organic" ${p.organic ? 'checked' : ''}> Producción agroecológica u orgánica</label><label class="checkbox-line"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Visible en el catálogo</label></div>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check', 'icon-sm')} ${isNew ? 'Publicar producto' : 'Guardar cambios'}</button><a class="btn btn-ghost" href="#/panel/products">Cancelar</a><span class="spacer"></span><span class="inline-hint">${isNew ? 'El producto aparece en el mercado al guardar.' : 'Los pedidos ya confirmados conservan el precio original.'}</span></div>
      </div>
    </form>
  </div>`;
}

function viewPanelOrders() {
  if (db.role !== 'producer' || !db.producerId) return panelGate();
  const producer = ownProducer();
  if (!producer) return panelGate();
  const all = producerOrders(producer.id);
  const tabs = [['all', 'Todos'], ['nuevo', 'Nuevos'], ['preparando', 'Preparando'], ['en_ruta', 'En ruta'], ['entregado', 'Entregados'], ['cancelado', 'Cancelados']];
  const list = panelOrdersTab === 'all' ? all : all.filter((o) => producerGroup(o, producer.id).status === panelOrdersTab);
  return `<div class="wrap page panel-page">
    <div class="page-head"><div class="page-head-row"><div><h1>Pedidos recibidos.</h1><p>Confirmá, prepará y marcá la entrega de tu parte. El comprador ve el estado en su cuenta. El pago se coordina por WhatsApp.</p></div><div class="aside"><strong>${all.filter((o) => producerGroup(o, producer.id).status === 'nuevo').length}</strong>nuevos</div></div></div>
    <div class="chips">${tabs.map(([id, label]) => `<button class="chip ${panelOrdersTab === id ? 'is-active' : ''}" type="button" data-action="panel-orders-tab" data-tab="${id}">${label}</button>`).join('')}</div>
    ${list.length ? `<div class="panel-order-list">${list.map((order) => {
      const group = producerGroup(order, producer.id);
      const items = (order.items || []).filter((it) => it.producerId === producer.id);
      const next = nextStatus(group.status);
      return `<article class="panel-order">
        <div class="panel-order-head">
          <div><strong>${esc(order.code)}</strong><span>${esc(order.buyer.name)} · ${esc(order.buyer.city || 'Formosa')} · ${fmtDateTime(order.createdAt)}</span></div>
          ${statusBadge(group.status)}
        </div>
        <div class="panel-order-body">
          <div class="panel-order-items">${items.map((it) => `<div><span>${it.qty} ${esc(it.unit)} · ${esc(it.name)}</span><span>${money(it.price * it.qty)}</span></div>`).join('')}</div>
          <div class="panel-order-meta">
            <span>${icon(order.delivery.mode === 'pickup' ? 'pin' : 'truck', 'icon-sm')} ${esc(orderDeliveryText(order))}</span>
            <span>${icon('bag', 'icon-sm')} ${esc(paymentLabel(order.payment))}</span>
            <span>${icon('user', 'icon-sm')} ${esc(order.buyer.phone || 'Sin teléfono cargado')}</span>
          </div>
          ${order.note ? `<p class="small muted" style="margin:0"><strong>Nota:</strong> ${esc(order.note)}</p>` : ''}
          <div class="panel-order-foot" style="padding:0;border:0">
            <strong>Subtotal: ${money(group.subtotal)}</strong>
            <div class="status-actions">
              <button class="btn btn-sm btn-ghost" type="button" data-action="panel-order-wa" data-order="${order.id}" ${order.buyer.phone ? '' : 'disabled title="El comprador no cargó un teléfono"'}>${icon('chat', 'icon-sm')} WhatsApp</button>
              ${next !== group.status ? `<button class="btn btn-sm btn-primary" type="button" data-action="panel-status" data-order="${order.id}" data-status="${next}">${icon('arrow-right', 'icon-sm')} ${next === 'preparando' ? 'Empezar preparación' : next === 'en_ruta' ? 'Marcar en ruta' : 'Marcar entregado'}</button>` : ''}
              ${group.status !== 'entregado' && group.status !== 'cancelado' ? `<button class="btn btn-sm btn-danger" type="button" data-action="panel-status" data-order="${order.id}" data-status="cancelado">Cancelar</button>` : ''}
            </div>
          </div>
        </div>
      </article>`;
    }).join('')}</div>` : `<div class="panel-card"><div class="panel-empty">${icon('bag', 'icon-lg')}<p>${panelOrdersTab === 'all' ? 'Todavía no recibiste pedidos. Compartí tu perfil para que te encuentren.' : 'No hay pedidos en este estado.'}</p><a class="btn btn-sm btn-ghost mt-12" href="#/producer/${producer.id}">Ver mi tienda</a></div></div>`}
  </div>`;
}

function viewPanelProfile() {
  if (db.role !== 'producer' || !db.producerId) return panelGate();
  const p = ownProducer();
  if (!p) return panelGate();
  return `<div class="wrap page panel-page">
    <a class="back-link" href="#/panel">${icon('arrow-left', 'icon-sm')} Panel</a>
    <form class="form-card" data-form="producer-profile" novalidate>
      <div class="flex between center gap-12 flex-wrap"><div><h2>Perfil público</h2><p>Así te ven los compradores. El sello de origen usa tus iniciales, tu localidad y tu color.</p></div><a class="btn btn-sm btn-ghost" href="#/producer/${p.id}">Ver perfil ${icon('arrow-right', 'icon-sm')}</a></div>
      <div class="form-grid">
        <div class="upload-box">
          <img class="upload-preview" id="producer-photo-preview" src="${photoSrc(p.photo)}" alt="Vista previa de la portada">
          <div class="upload-copy">
            <strong>Foto de portada</strong>
            <span>JPG, PNG o WebP de hasta 6 MB. Una foto horizontal de la finca, el taller o el producto.</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" data-upload="producer-photo">
            <input type="hidden" name="photo" value="${esc(p.photo)}">
            <span class="field-error" data-err="photo" hidden></span>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label for="pf-name">Nombre público *</label><input id="pf-name" name="name" value="${esc(p.name)}" placeholder="Finca, cooperativa o emprendimiento"><span class="field-error" data-err="name" hidden></span></div>
          <div class="field"><label for="pf-owner">Responsable *</label><input id="pf-owner" name="owner" value="${esc(p.owner)}" placeholder="Nombre y apellido"><span class="field-error" data-err="owner" hidden></span></div>
        </div>
        <div class="form-grid-3">
          <div class="field"><label for="pf-place">Localidad *</label><input id="pf-place" name="place" value="${esc(p.place)}" placeholder="Herradura"><span class="field-error" data-err="place" hidden></span></div>
          <div class="field"><label for="pf-zone">Zona de reparto *</label><select id="pf-zone" name="zone">${ROUTES.map((r) => `<option value="${esc(r.zone)}" ${p.zone === r.zone ? 'selected' : ''}>${esc(r.zone)}</option>`).join('')}</select><span class="field-error" data-err="zone" hidden></span></div>
          <div class="field"><label for="pf-role">Tipo de producción</label><input id="pf-role" name="role" value="${esc(p.role)}" placeholder="Productora familiar, cooperativa…"><span class="field-error" data-err="role" hidden></span></div>
        </div>
        <div class="form-grid-3">
          <div class="field"><label for="pf-since">Desde el año *</label><input id="pf-since" name="since" type="number" min="1900" max="2100" value="${p.since || ''}"><span class="field-error" data-err="since" hidden></span></div>
          <div class="field"><label for="pf-hectares">Hectáreas</label><input id="pf-hectares" name="hectares" type="number" min="0" max="100000" step="0.1" value="${p.hectares || 0}"><span class="field-error" data-err="hectares" hidden></span></div>
          <div class="field"><label for="pf-accent">Color del sello</label><input id="pf-accent" name="accent" type="color" value="${esc(p.accent || '#9b6239')}" style="height:42px;padding:4px"><span class="field-error" data-err="accent" hidden></span></div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label for="pf-whatsapp">WhatsApp para pedidos</label><input id="pf-whatsapp" name="whatsapp" type="tel" inputmode="tel" value="${esc(p.whatsapp || '')}" placeholder="5493704000000"><span class="field-error" data-err="whatsapp" hidden></span><span class="inline-hint">Solo números, con código de país. Sin +, espacios ni guiones. Ej.: 5493704000000.</span></div>
          <div class="field"><label for="pf-alias">Alias o CBU <span class="hint">(opcional)</span></label><input id="pf-alias" name="alias" value="${esc(p.alias || '')}" placeholder="Se comparte solo cuando el comprador pregunta por el pago."><span class="field-error" data-err="alias" hidden></span></div>
        </div>
        <div class="field"><label for="pf-pickup">Punto de retiro habitual</label><input id="pf-pickup" name="pickup" value="${esc(p.pickup || '')}" placeholder="Ej.: Delegación de Herradura"><span class="field-error" data-err="pickup" hidden></span></div>
        <div class="field"><label for="pf-practices">Prácticas <span class="hint">(separadas por comas)</span></label><input id="pf-practices" name="practices" value="${esc((p.practices || []).join(', '))}" placeholder="Agroecológico, cosecha manual, sin conservantes"><span class="field-error" data-err="practices" hidden></span></div>
        <div class="field"><label for="pf-story">Historia *</label><textarea id="pf-story" name="story" placeholder="Contá el origen, el trabajo de la semana y lo que hace distinta a tu producción. Separá los párrafos con una línea en blanco.">${esc(p.story || '')}</textarea><span class="field-error" data-err="story" hidden></span></div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check', 'icon-sm')} Guardar perfil</button><a class="btn btn-ghost" href="#/panel">Cancelar</a><span class="spacer"></span><span class="session-note">${icon('shield', 'icon-sm')} Tu WhatsApp solo se muestra a compradores con sesión.</span></div>
      </div>
    </form>
    <div class="panel-card">
      <h2>Galería de la finca</h2>
      <p>Las fotos de la galería se muestran en tu perfil público. Para cambiarlas, subí una nueva portada y escribinos; la gestión de galería múltiple queda para la próxima versión.</p>
      <div class="grid-2">${(p.gallery || []).map((g) => `<div class="detail-media"><img src="${photoSrc(g)}" alt="Galería de ${esc(p.name)}" loading="lazy" style="aspect-ratio:16/9"></div>`).join('')}</div>
    </div>
  </div>`;
}
