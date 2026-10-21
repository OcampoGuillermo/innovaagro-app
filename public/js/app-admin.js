/* ===================== InnovaAgro-App · administración ===================== */

function adminGate() {
  return `<div class="wrap page">${emptyState('shield', 'Acceso reservado', 'Esta sección requiere una cuenta con permisos de administración.', '<a class="btn btn-primary" href="#/home">Volver al inicio</a>')}</div>`;
}

function adminLoadingView() {
  return `<div class="wrap page"><div class="admin-loading"><div class="auth-spinner"></div><p>Cargando el panel de administración…</p></div></div>`;
}

function adminServicePill(label, ok, detail = '') {
  return `<span class="service-pill ${ok ? 'is-on' : 'is-off'}" title="${esc(detail)}">${icon(ok ? 'check' : 'x', 'icon-sm')} ${esc(label)}: ${ok ? 'activo' : 'sin configurar'}</span>`;
}

function viewAdmin(page = 'admin') {
  if (!isAdmin()) return adminGate();
  if (!adminData && !adminError) return adminLoadingView();
  if (!adminData) {
    return `<div class="wrap page">${emptyState('info', 'No se pudo cargar el panel', adminError || 'Revisá la conexión e intentá de nuevo.', '<button class="btn btn-primary" type="button" data-action="admin-reload">Reintentar</button>')}</div>`;
  }
  const stats = adminData.stats || {};
  const services = adminData.services || {};
  const active = page === 'admin/users' ? 'users' : page === 'admin/orders' ? 'orders' : 'overview';
  const tabs = [
    ['overview', 'Resumen', '#/admin'],
    ['users', 'Cuentas', '#/admin/users'],
    ['orders', 'Pedidos y pagos', '#/admin/orders']
  ];
  return `<div class="wrap page admin-page">
    <div class="admin-head">
      <div>
        <p class="mono-label">Administración · InnovaAgro-App</p>
        <h1>Control del marketplace</h1>
        <p>Cuentas, pedidos, pagos, comprobantes y avisos. Cada cambio queda registrado en la auditoría.</p>
      </div>
      <div class="admin-head-actions">
        <span class="admin-live">${icon('shield', 'icon-sm')} Sesión administrativa</span>
        <button class="btn btn-sm btn-ghost" type="button" data-action="admin-reload">${icon('refresh', 'icon-sm')} Actualizar</button>
      </div>
    </div>
    <div class="admin-services">
      ${adminServicePill('Mercado Pago', !!services.payments)}
      ${adminServicePill('Correo SMTP', !!services.smtp)}
      ${adminServicePill('Push VAPID', !!services.push)}
      ${adminServicePill('Comprobantes fiscales', !!services.invoicesFiscal, 'Los comprobantes internos están disponibles; la facturación fiscal requiere AFIP/ARCA.')}
    </div>
    <div class="admin-tabs" role="tablist" aria-label="Secciones de administración">
      ${tabs.map(([id, label, href]) => `<a role="tab" aria-selected="${active === id}" class="admin-tab ${active === id ? 'is-active' : ''}" href="${href}">${label}</a>`).join('')}
    </div>
    <div class="admin-stats">
      <div class="admin-stat"><span>Cuentas</span><strong>${stats.users || 0}</strong><small>${stats.producers || 0} productores · ${stats.buyers || 0} compradores</small></div>
      <div class="admin-stat"><span>Pedidos</span><strong>${stats.orders || 0}</strong><small>${stats.paidOrders || 0} pagos confirmados</small></div>
      <div class="admin-stat"><span>Ingresos confirmados</span><strong>${money(stats.revenue || 0)}</strong><small>solo pedidos marcados como pagados</small></div>
      <div class="admin-stat"><span>Comprobantes</span><strong>${stats.invoices || 0}</strong><small>internos, no fiscales</small></div>
      <div class="admin-stat"><span>Sin verificar</span><strong>${stats.unverified || 0}</strong><small>${stats.suspended || 0} cuentas suspendidas</small></div>
      <div class="admin-stat"><span>Push</span><strong>${stats.pushSubscriptions || 0}</strong><small>dispositivos suscriptos</small></div>
    </div>
    ${active === 'overview' ? adminOverview() : active === 'users' ? adminUsers() : adminOrders()}
  </div>`;
}

function adminOverview() {
  const orders = (adminData.orders || []).slice(0, 6);
  const invoices = (adminData.invoices || []).slice(0, 6);
  const audit = (adminData.audit || []).slice(0, 10);
  return `<div class="admin-grid">
    <section class="admin-panel admin-panel-wide">
      <div class="admin-panel-head"><div><h2>Últimos pedidos</h2><p>Los más recientes de todo el marketplace.</p></div><a class="section-link" href="#/admin/orders">Ver todos ${icon('arrow-right', 'icon-sm')}</a></div>
      ${orders.length ? `<div class="admin-list">${orders.map((order) => `<a class="admin-order-row" href="#/order/${order.id}">
        <span class="admin-order-code">${esc(order.code)}</span>
        <span class="admin-order-main"><strong>${money(order.total)}</strong><small>${esc(order.buyerEmail || order.buyer.name)} · ${fmtDateTime(order.createdAt)}</small></span>
        <span class="status ${paymentStatusClass(order.paymentStatus)}">${esc(paymentStatusLabel(order.paymentStatus))}</span>
        ${statusBadge(statusOrder(order))}
      </a>`).join('')}</div>` : '<p class="muted">Todavía no hay pedidos.</p>'}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><h2>Aviso push</h2><p>Llega solo a dispositivos suscriptos.</p></div></div>
      <form class="admin-form" data-form="admin-push" novalidate>
        <div class="field"><label for="push-title">Título</label><input id="push-title" name="title" maxlength="120" placeholder="Ej.: Nueva ruta de entrega" required></div>
        <div class="field"><label for="push-body">Mensaje</label><textarea id="push-body" name="body" maxlength="280" placeholder="Contale a la comunidad qué cambió." required></textarea></div>
        <div class="field"><label for="push-url">Enlace <span class="hint">(opcional)</span></label><input id="push-url" name="url" placeholder="/#/routes"></div>
        <button class="btn btn-primary btn-block" type="submit">${icon('share', 'icon-sm')} Enviar aviso</button>
        <p class="tiny muted mt-8">Si no hay suscripciones o faltan claves VAPID, el servidor lo informa sin simular envíos.</p>
      </form>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><h2>Comprobantes recientes</h2><p>Documentos internos emitidos.</p></div></div>
      ${invoices.length ? `<div class="admin-list">${invoices.map((inv) => `<div class="admin-invoice-row"><span><strong>${esc(inv.number)}</strong><small>${esc(inv.sellerName)} · ${money(inv.total)}</small></span><a class="btn btn-sm btn-ghost" href="${inv.pdfUrl}">${icon('download', 'icon-sm')} PDF</a></div>`).join('')}</div>` : '<p class="muted">Todavía no se emitieron comprobantes.</p>'}
    </section>
    <section class="admin-panel admin-panel-wide">
      <div class="admin-panel-head"><div><h2>Auditoría</h2><p>Últimas acciones sensibles registradas.</p></div></div>
      ${audit.length ? `<div class="audit-list">${audit.map((item) => `<div class="audit-row">
        <span class="audit-dot"></span>
        <span><strong>${esc(item.action)}</strong><small>${esc(item.userEmail || 'Sistema')} · ${esc(item.entity)} ${esc(item.entityId)}</small></span>
        <time>${fmtDateTime(item.createdAt)}</time>
      </div>`).join('')}</div>` : '<p class="muted">Sin acciones registradas.</p>'}
    </section>
  </div>`;
}

function adminUsers() {
  const users = adminData.users || [];
  return `<section class="admin-panel">
    <div class="admin-panel-head">
      <div><h2>Cuentas</h2><p>Buscá, verificá, suspendé o promové permisos. No podés suspenderte ni quitarte permisos a vos mismo.</p></div>
      <span class="tiny muted">${users.length} resultados</span>
    </div>
    <form class="admin-filter" data-form="admin-search">
      <div class="field"><label class="sr-only" for="admin-q">Buscar cuenta</label><input id="admin-q" name="q" type="search" value="${esc(adminQuery)}" placeholder="Buscar por nombre o correo"></div>
      <div class="field"><label class="sr-only" for="admin-role">Filtrar por rol</label><select id="admin-role" name="role">
        <option value="">Todos los roles</option>
        <option value="buyer" ${adminRoleFilter === 'buyer' ? 'selected' : ''}>Compradores</option>
        <option value="producer" ${adminRoleFilter === 'producer' ? 'selected' : ''}>Productores</option>
        <option value="admin" ${adminRoleFilter === 'admin' ? 'selected' : ''}>Administración</option>
      </select></div>
      <button class="btn btn-primary" type="submit">${icon('search', 'icon-sm')} Buscar</button>
    </form>
    ${users.length ? `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Cuenta</th><th>Rol</th><th>Correo</th><th>Último acceso</th><th>Acciones</th></tr></thead>
      <tbody>${users.map((user) => `<tr>
        <td><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small>${user.isAdmin ? '<span class="tag tag-indigo">Admin</span>' : ''}</td>
        <td>${user.isAdmin ? 'Administración' : user.role === 'producer' ? 'Productor' : 'Comprador'}</td>
        <td><span class="status ${user.emailVerified ? 'status-entregado' : 'status-nuevo'}">${user.emailVerified ? 'Verificado' : 'Pendiente'}</span>${user.suspended ? '<span class="status status-cancelado">Suspendida</span>' : ''}</td>
        <td>${user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : 'Nunca'}</td>
        <td><div class="admin-actions">
          <button class="btn btn-xs btn-ghost" type="button" data-action="admin-user-field" data-id="${user.id}" data-field="emailVerified" data-value="${user.emailVerified ? 'false' : 'true'}">${user.emailVerified ? 'Quitar verificación' : 'Verificar'}</button>
          <button class="btn btn-xs ${user.suspended ? 'btn-ghost' : 'btn-danger'}" type="button" data-action="admin-user-field" data-id="${user.id}" data-field="suspended" data-value="${user.suspended ? 'false' : 'true'}">${user.suspended ? 'Reactivar' : 'Suspender'}</button>
          <button class="btn btn-xs btn-ghost" type="button" data-action="admin-user-field" data-id="${user.id}" data-field="isAdmin" data-value="${user.isAdmin ? 'false' : 'true'}">${user.isAdmin ? 'Quitar admin' : 'Hacer admin'}</button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">No hay cuentas que coincidan con la búsqueda.</p>'}
  </section>`;
}

function adminOrders() {
  const orders = adminData.orders || [];
  return `<section class="admin-panel">
    <div class="admin-panel-head"><div><h2>Pedidos y pagos</h2><p>Verificá pagos coordinados y emití comprobantes internos por productor.</p></div><span class="tiny muted">${orders.length} pedidos recientes</span></div>
    ${orders.length ? `<div class="admin-orders">${orders.map((order) => {
      const producerIds = [...new Set(order.items.map((item) => item.producerId))];
      return `<article class="admin-order-card">
        <div class="admin-order-top">
          <div><span class="mono-label">${esc(order.code)} · ${fmtDateTime(order.createdAt)}</span><h3>${money(order.total)} · ${order.items.length} ${order.items.length === 1 ? 'producto' : 'productos'}</h3><p class="tiny muted">${esc(order.buyerEmail || '')} · ${esc(order.buyer.name)} · ${esc(order.buyer.phone)}</p></div>
          <div class="admin-order-badges"><span class="status ${paymentStatusClass(order.paymentStatus)}">${esc(paymentStatusLabel(order.paymentStatus))}</span>${statusBadge(statusOrder(order))}</div>
        </div>
        <div class="admin-order-details">
          <div><span class="tiny muted">Pago elegido</span><strong>${esc(paymentLabel(order.payment))}</strong></div>
          <div><span class="tiny muted">Entrega</span><strong>${order.delivery.mode === 'pickup' ? 'Retiro' : 'Envío'} · ${fmtLong(order.delivery.date)}</strong></div>
          <div><span class="tiny muted">Productores</span><strong>${producerIds.map((id) => esc(producerName(id))).join(', ')}</strong></div>
        </div>
        <div class="admin-order-groups">
          ${producerIds.map((pid) => {
            const inv = (order.invoices || []).find((item) => item.producerId === pid);
            const group = (order.groups || {})[pid] || { status: 'nuevo' };
            return `<div class="admin-group-row">
              <span><strong>${esc(producerName(pid))}</strong><small>${statusLabel(group.status)} · ${money(group.subtotal || 0)}</small></span>
              ${inv ? `<a class="btn btn-xs btn-ghost" href="${inv.pdfUrl}">${icon('download', 'icon-sm')} ${esc(inv.number)}</a>` : `<button class="btn btn-xs btn-ghost" type="button" data-action="admin-invoice" data-order="${order.id}" data-producer="${pid}">Emitir comprobante</button>`}
            </div>`;
          }).join('')}
        </div>
        <div class="admin-order-actions">
          <label class="admin-inline-field"><span>Estado del pago</span>
            <select data-admin-payment="${order.id}">
              ${['pendiente', 'pagado', 'rechazado', 'reembolsado', 'contracargo'].map((status) => `<option value="${status}" ${order.paymentStatus === status ? 'selected' : ''}>${paymentStatusLabel(status)}</option>`).join('')}
            </select>
          </label>
          <button class="btn btn-sm btn-primary" type="button" data-action="admin-payment" data-id="${order.id}">Aplicar</button>
          <a class="btn btn-sm btn-ghost" href="#/order/${order.id}">Ver pedido</a>
        </div>
      </article>`;
    }).join('')}</div>` : '<p class="muted">No hay pedidos todavía.</p>'}
  </section>`;
}
