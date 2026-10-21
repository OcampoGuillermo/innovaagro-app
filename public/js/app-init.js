/* ===================== InnovaAgro-App · arranque y acciones ===================== */
(function () {
  'use strict';

  let searchTimer = null;
  let panelSearchTimer = null;
  let initialized = false;

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('hashchange', () => { if (initialized && db) render(); });

  function init() {
    if (initialized) return;
    initialized = true;
    bindEvents();
    fillCredits();
    setupInstall();
    registerServiceWorker();
    boot();
  }

  async function boot() {
    try {
      await loadSession();
    } catch (error) {
      const snapshot = loadSnapshot();
      if (snapshot) {
        bootError = '';
        render();
        toast('Sin conexión. Estás viendo la última copia guardada en este teléfono.', false);
      } else {
        bootError = error.message || 'No se pudo conectar con el servidor.';
        setGuest();
        render();
      }
    }
  }

  async function loadSession() {
    const data = await api('/bootstrap');
    applyConfig(data.config);
    bootError = '';
    if (data.user) {
      hydrate(data);
      render();
    } else {
      setGuest();
      render();
    }
  }

  async function completeAuth() {
    const data = await api('/bootstrap');
    applyConfig(data.config);
    hydrate(data);
    authMode = 'login';
    authRole = data.user.role === 'producer' ? 'producer' : 'buyer';
    authError = '';
    authFields = {};
    checkoutDraft = null;
    checkoutErrors = {};
    panelProductQuery = '';
    ordersTab = 'all';
    panelOrdersTab = 'all';
    const target = data.user.role === 'producer' ? '#/panel' : '#/home';
    if (location.hash === target) render();
    else go(target);
    toast(data.user.role === 'producer' ? 'Panel listo. Cargá tu primer producto.' : 'Sesión iniciada. Ya podés armar tu canasta.');
  }

  function bindEvents() {
    document.addEventListener('submit', onSubmit);
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        dialog.close();
        if (dialog.id === 'timer-dialog') stopTimer();
      });
    });
    const timerDialog = document.getElementById('timer-dialog');
    if (timerDialog) {
      timerDialog.addEventListener('close', stopTimer);
      timerDialog.addEventListener('cancel', stopTimer);
    }
    window.addEventListener('online', () => {
      if (db) { db.offline = false; updateChrome(parseRoute().parts); }
      toast('Conexión restablecida.');
      if (db && !db.user && bootError) boot();
    });
    window.addEventListener('offline', () => {
      if (db) { db.offline = true; updateChrome(parseRoute().parts); }
      toast('Sin conexión. Podés consultar el catálogo guardado; los pedidos necesitan internet.', true);
    });
  }

  /* ---------- envío de formularios ---------- */
  async function onSubmit(event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const type = form.dataset.form;
    try {
      if (type === 'login') return await submitLogin(form);
      if (type === 'register') return await submitRegister(form);
      if (type === 'hero-search') return submitHeroSearch(form);
      if (type === 'market-search') return submitMarketSearch(form);
      if (type === 'filters') return submitFilters(form);
      if (type === 'checkout') return await submitCheckout(form);
      if (type === 'pitch') return await submitPitch(form);
      if (type === 'buyer-profile') return await submitBuyerProfile(form);
      if (type === 'change-password') return await submitPassword(form);
      if (type === 'panel-stock') return await submitStock(form);
      if (type === 'panel-product-search') return submitPanelSearch(form);
      if (type === 'panel-product') return await submitProduct(form);
      if (type === 'producer-profile') return await submitProducerProfile(form);
    } catch (error) {
      handleError(error, form, type);
    }
  }

  async function submitLogin(form) {
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    authFields = Object.assign({}, authFields, { email });
    authError = '';
    const button = form.querySelector('[type="submit"]');
    clearFieldErrors(form);
    setBusy(button, true, 'Entrando…');
    try {
      await api('/auth/login', { method: 'POST', body: { email, password } });
      await completeAuth();
    } finally {
      setBusy(button, false);
    }
  }

  async function submitRegister(form) {
    const data = new FormData(form);
    const password = String(data.get('password') || '');
    const payload = {
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      password,
      role: authRole
    };
    if (authRole === 'producer') {
      payload.farmName = String(data.get('farmName') || '').trim();
      payload.place = String(data.get('place') || '').trim();
      payload.zone = String(data.get('zone') || '').trim();
    } else {
      payload.city = String(data.get('city') || 'Formosa Capital');
    }
    authFields = Object.assign({}, authFields, {
      name: payload.name, email: payload.email, farmName: payload.farmName,
      place: payload.place, zone: payload.zone, city: payload.city
    });
    authError = '';
    clearFieldErrors(form);
    if (password.length < 8) {
      showFieldErrors(form, { password: 'La contraseña debe tener al menos 8 caracteres.' });
      toast('La contraseña debe tener al menos 8 caracteres.', true);
      return;
    }
    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, 'Creando cuenta…');
    try {
      await api('/auth/register', { method: 'POST', body: payload });
      await completeAuth();
    } finally {
      setBusy(button, false);
    }
  }

  function submitHeroSearch(form) {
    const q = String(new FormData(form).get('q') || '').trim();
    db.market = Object.assign({}, db.market, { q, cat: 'Todos', onlyFav: false, producerId: '', maxPrice: 0 });
    save();
    marketFocusPending = true;
    go('#/market');
  }

  function submitMarketSearch(form) {
    db.market.q = String(new FormData(form).get('q') || '').trim();
    save();
    marketFocusPending = true;
    render();
  }

  function submitPanelSearch(form) {
    panelProductQuery = String(new FormData(form).get('q') || '').trim();
    rerenderKeepScroll();
    focusPanelSearch();
  }

  function submitFilters(form) {
    const data = new FormData(form);
    const maxPrice = Number(data.get('maxPrice'));
    db.market.cat = String(data.get('cat') || 'Todos');
    db.market.producerId = String(data.get('producerId') || '');
    db.market.maxPrice = Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : 0;
    db.market.onlyAvailable = data.get('onlyAvailable') === 'on';
    db.market.onlyOrganic = data.get('onlyOrganic') === 'on';
    db.market.onlyFav = data.get('onlyFav') === 'on';
    save();
    closeDialog('filters-dialog');
    if (parseRoute().page !== 'market') go('#/market');
    else rerenderKeepScroll();
  }

  async function submitCheckout(form) {
    const draft = readCheckout(form);
    checkoutDraft = Object.assign({}, checkoutDraft, draft);
    const errors = {};
    if (!draft.name || draft.name.length < 2) errors.name = 'Ingresá el nombre de quien recibe.';
    if (!/^[0-9+()\s-]{6,20}$/.test(draft.phone)) errors.phone = 'Ingresá un WhatsApp válido.';
    if (draft.mode === 'delivery' && draft.address.trim().length < 5) errors.address = 'Ingresá la dirección de entrega.';
    if (draft.mode === 'pickup' && !draft.pointId) errors.pointId = 'Elegí un punto de retiro.';
    if (!draft.terms) errors.terms = 'Confirmá que coordinás la entrega y el pago por WhatsApp.';
    if (!cartDetails().length) errors.items = 'Tu canasta está vacía o cambió el stock.';
    checkoutErrors = errors;
    if (Object.keys(errors).length) {
      render();
      toast(Object.values(errors)[0], true);
      return;
    }
    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, 'Confirmando…');
    try {
      const response = await api('/orders', {
        method: 'POST',
        body: {
          items: db.cart.map((line) => ({ productId: line.productId, qty: line.qty })),
          name: draft.name,
          phone: draft.phone,
          city: draft.city,
          note: draft.note,
          mode: draft.mode,
          pointId: draft.pointId,
          routeId: draft.routeId,
          address: draft.address,
          payment: draft.payment
        }
      });
      const order = response.order;
      db.orders = [order, ...db.orders.filter((o) => o.id !== order.id)];
      order.items.forEach((item) => {
        const product = productById(item.productId);
        if (product) product.stock = Math.max(0, product.stock - item.qty);
      });
      db.buyer = Object.assign({}, db.buyer, {
        name: draft.name,
        phone: draft.phone,
        city: draft.city,
        address: draft.mode === 'delivery' ? draft.address : db.buyer.address
      });
      if (db.user) Object.assign(db.user, { name: draft.name, phone: draft.phone, city: draft.city, address: db.buyer.address });
      db.cart = [];
      saveCart();
      checkoutDraft = null;
      checkoutErrors = {};
      save();
      toast(`Pedido ${order.code} registrado. Coordiná el pago con cada productor.`);
      go('#/order/' + order.id);
    } finally {
      setBusy(button, false);
    }
  }

  async function submitPitch(form) {
    const data = new FormData(form);
    const pitch = {
      hook: String(data.get('hook') || '').trim(),
      story: String(data.get('story') || '').trim(),
      product: String(data.get('product') || '').trim(),
      cta: String(data.get('cta') || '').trim()
    };
    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, 'Guardando…');
    try {
      const response = await api('/pitch', { method: 'PUT', body: pitch });
      db.training.pitch = response.pitch;
      save();
      rerenderKeepScroll();
      toast('Guion guardado en tu cuenta.');
    } finally {
      setBusy(button, false);
    }
  }

  async function submitBuyerProfile(form) {
    const data = new FormData(form);
    const body = {
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      city: String(data.get('city') || 'Formosa Capital'),
      address: String(data.get('address') || '').trim()
    };
    const button = form.querySelector('[type="submit"]');
    clearFieldErrors(form);
    setBusy(button, true, 'Guardando…');
    try {
      const response = await api('/me', { method: 'PATCH', body });
      db.user = Object.assign({}, db.user, response.user);
      db.buyer = Object.assign({}, db.buyer, {
        name: response.user.name, phone: response.user.phone,
        city: response.user.city, address: response.user.address
      });
      save();
      rerenderKeepScroll();
      toast('Datos guardados.');
    } finally {
      setBusy(button, false);
    }
  }

  async function submitPassword(form) {
    const data = new FormData(form);
    const currentPassword = String(data.get('currentPassword') || '');
    const newPassword = String(data.get('newPassword') || '');
    const repeatPassword = String(data.get('repeatPassword') || '');
    const errors = {};
    if (!currentPassword) errors.currentPassword = 'Ingresá tu contraseña actual.';
    if (newPassword.length < 8) errors.newPassword = 'La contraseña nueva debe tener al menos 8 caracteres.';
    if (newPassword !== repeatPassword) errors.repeatPassword = 'Las contraseñas nuevas no coinciden.';
    clearFieldErrors(form);
    if (Object.keys(errors).length) {
      showFieldErrors(form, errors);
      toast(Object.values(errors)[0], true);
      return;
    }
    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, 'Cambiando…');
    try {
      await api('/me/password', { method: 'POST', body: { currentPassword, newPassword } });
      form.reset();
      toast('Contraseña actualizada. Las demás sesiones se cerraron.');
    } finally {
      setBusy(button, false);
    }
  }

  async function submitStock(form) {
    const data = new FormData(form);
    const stock = Number(data.get('stock'));
    const id = form.dataset.id;
    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, '…');
    try {
      const response = await api('/products/' + encodeURIComponent(id) + '/stock', {
        method: 'PATCH', body: { stock }
      });
      replaceProduct(response.product);
      save();
      rerenderKeepScroll();
      toast('Stock actualizado.');
    } finally {
      setBusy(button, false);
    }
  }

  async function submitProduct(form) {
    const data = new FormData(form);
    const id = form.dataset.id || '';
    const payload = {
      name: String(data.get('name') || '').trim(),
      category: String(data.get('category') || ''),
      price: Number(data.get('price')),
      unit: String(data.get('unit') || '').trim(),
      stock: Number(data.get('stock')),
      photo: String(data.get('photo') || 'hero'),
      lot: String(data.get('lot') || '').trim(),
      short: String(data.get('short') || '').trim(),
      description: String(data.get('description') || '').trim(),
      highlights: String(data.get('highlights') || '').split(',').map((x) => x.trim()).filter(Boolean),
      harvest: String(data.get('harvest') || '').trim(),
      season: String(data.get('season') || '').trim(),
      available: String(data.get('available') || 'Esta semana'),
      organic: !!(form.elements.organic && form.elements.organic.checked),
      active: !!(form.elements.active && form.elements.active.checked)
    };
    const button = form.querySelector('[type="submit"]');
    clearFieldErrors(form);
    setBusy(button, true, 'Guardando…');
    try {
      const response = id
        ? await api('/products/' + encodeURIComponent(id), { method: 'PATCH', body: payload })
        : await api('/products', { method: 'POST', body: payload });
      replaceProduct(response.product);
      save();
      toast(id ? 'Producto actualizado.' : 'Producto publicado en el mercado.');
      go('#/panel/products');
    } finally {
      setBusy(button, false);
    }
  }

  async function submitProducerProfile(form) {
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') || '').trim(),
      owner: String(data.get('owner') || '').trim(),
      place: String(data.get('place') || '').trim(),
      zone: String(data.get('zone') || ''),
      since: Number(data.get('since')),
      hectares: Number(data.get('hectares')),
      photo: String(data.get('photo') || 'farmer_field'),
      role: String(data.get('role') || '').trim(),
      whatsapp: String(data.get('whatsapp') || '').replace(/[^\d]/g, ''),
      alias: String(data.get('alias') || '').trim(),
      pickup: String(data.get('pickup') || '').trim(),
      practices: String(data.get('practices') || '').split(',').map((x) => x.trim()).filter(Boolean),
      accent: String(data.get('accent') || '#9b6239'),
      story: String(data.get('story') || '').trim()
    };
    const button = form.querySelector('[type="submit"]');
    clearFieldErrors(form);
    setBusy(button, true, 'Guardando…');
    try {
      const response = await api('/producer/me', { method: 'PATCH', body: payload });
      const index = db.producers.findIndex((p) => p.id === response.producer.id);
      if (index >= 0) db.producers[index] = response.producer;
      else db.producers.push(response.producer);
      save();
      rerenderKeepScroll();
      toast('Perfil público actualizado.');
    } finally {
      setBusy(button, false);
    }
  }

  /* ---------- lectura / validación ---------- */
  function readCheckout(form) {
    const data = new FormData(form);
    return {
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      city: String(data.get('city') || 'Formosa Capital'),
      note: String(data.get('note') || '').trim(),
      mode: String(data.get('mode') || 'pickup'),
      pointId: String(data.get('pointId') || ''),
      routeId: String(data.get('routeId') || ''),
      address: String(data.get('address') || '').trim(),
      payment: String(data.get('payment') || 'efectivo'),
      terms: !!(form.elements.terms && form.elements.terms.checked)
    };
  }

  function handleError(error, form, type) {
    if (error && error.status === 401) {
      toast('Tu sesión venció. Volvé a entrar.', true);
      logoutLocal();
      return;
    }
    if (error && error.fields) {
      if (type === 'checkout') {
        checkoutErrors = error.fields;
        render();
        toast(error.message || 'Revisá los datos del pedido.', true);
        return;
      }
      if (form) {
        showFieldErrors(form, error.fields);
        const first = Object.values(error.fields)[0];
        toast(first || error.message || 'Revisá los datos.', true);
        return;
      }
    }
    if (type === 'login' || type === 'register') {
      authError = (error && error.message) || 'No se pudo iniciar sesión.';
      render();
      return;
    }
    toast((error && error.message) || 'No se pudo completar la operación.', true);
  }

  /* ---------- clicks ---------- */
  function onClick(event) {
    const dialog = event.target.closest('dialog');
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (['SELECT', 'INPUT', 'TEXTAREA'].includes(actionEl.tagName)) return;
    const handled = actions[action];
    if (!handled) return;
    if (actionEl.tagName === 'BUTTON' || actionEl.tagName === 'A') event.preventDefault();
    Promise.resolve(handled(actionEl)).catch((error) => handleError(error, null, action));
  }

  const actions = {
    'auth-mode'(el) {
      captureAuthFields();
      authMode = el.dataset.mode === 'register' ? 'register' : 'login';
      authError = '';
      render();
      const focus = authMode === 'login' ? '#auth-email' : '#reg-name';
      const input = $(focus);
      if (input) input.focus();
    },
    'auth-role'(el) {
      captureAuthFields();
      authRole = el.dataset.role === 'producer' ? 'producer' : 'buyer';
      authError = '';
      render();
    },
    async 'demo-login'(el) {
      const role = el.dataset.role === 'producer' ? 'producer' : 'buyer';
      const email = role === 'producer' ? 'finca@innovaagro.app' : 'demo@innovaagro.app';
      authFields = { email };
      authError = '';
      setBusy(el, true, 'Entrando…');
      try {
        await api('/auth/login', { method: 'POST', body: { email, password: 'demo1234' } });
        await completeAuth();
      } catch (error) {
        authError = error.message || 'No se pudo entrar con la cuenta de demostración.';
        render();
      } finally {
        setBusy(el, false);
      }
    },
    'quick-search'(el) {
      db.market = Object.assign({}, db.market, {
        q: el.dataset.q || '', cat: 'Todos', producerId: '', maxPrice: 0,
        onlyAvailable: false, onlyOrganic: false, onlyFav: false
      });
      save();
      marketFocusPending = true;
      go('#/market');
    },
    'home-cat'(el) {
      db.market = Object.assign({}, db.market, {
        q: '', cat: el.dataset.cat || 'Todos', producerId: '', maxPrice: 0,
        onlyAvailable: false, onlyOrganic: false, onlyFav: false
      });
      save();
      go('#/market');
    },
    'set-cat'(el) {
      db.market.cat = el.dataset.cat || 'Todos';
      save();
      rerenderKeepScroll();
    },
    'market-sort'(el) {
      db.market.sort = el.value || 'relevance';
      save();
      rerenderKeepScroll();
    },
    'clear-search'() {
      db.market.q = '';
      save();
      marketFocusPending = true;
      rerenderKeepScroll();
    },
    'clear-filters'() {
      const dialog = document.getElementById('filters-dialog');
      if (dialog && dialog.open) dialog.close();
      db.market = Object.assign({}, db.market, {
        q: '', cat: 'Todos', sort: 'relevance', producerId: '', maxPrice: 0,
        onlyAvailable: false, onlyOrganic: false, onlyFav: false
      });
      save();
      rerenderKeepScroll();
    },
    'open-filters'() { openFilters(); },
    'close-dialog'(el) {
      const dialog = document.getElementById(el.dataset.dialog || '');
      if (dialog) dialog.close();
      if (dialog && dialog.id === 'timer-dialog') stopTimer();
    },
    'toggle-fav': async function (el) {
      const id = el.dataset.id;
      const response = await api('/favorites/' + encodeURIComponent(id), { method: 'POST' });
      db.buyer.favorites = response.favorites || [];
      save();
      syncFavoriteButtons();
      toast(response.favorite ? 'Guardado en favoritos.' : 'Quitado de favoritos.');
      if (db.market.onlyFav) rerenderKeepScroll();
    },
    'add-cart'(el) { addToCart(el.dataset.id, 1); },
    'add-detail'(el) { addToCart(el.dataset.id, detailQty); },
    'qty-step'(el) {
      const cartBox = el.closest('[data-cart-qty]');
      if (cartBox) {
        const id = cartBox.dataset.cartQty;
        const line = db.cart.find((l) => l.productId === id);
        const product = productById(id);
        if (!line || !product) return;
        const next = Math.max(1, Math.min(product.stock, line.qty + Number(el.dataset.delta || 0), 50));
        line.qty = next;
        saveCart();
        save();
        rerenderKeepScroll();
        return;
      }
      const box = el.closest('.qty');
      if (box) {
        const addButton = document.querySelector('[data-action="add-detail"]');
        const product = addButton ? productById(addButton.dataset.id) : null;
        if (!product) return;
        detailQty = Math.max(1, Math.min(product.stock, detailQty + Number(el.dataset.delta || 0)));
        const value = box.querySelector('span');
        if (value) value.textContent = String(detailQty);
        const buttons = box.querySelectorAll('button');
        if (buttons[0]) buttons[0].disabled = detailQty <= 1;
        if (buttons[1]) buttons[1].disabled = detailQty >= product.stock;
      }
    },
    'remove-line'(el) {
      db.cart = db.cart.filter((l) => l.productId !== el.dataset.id);
      saveCart();
      save();
      rerenderKeepScroll();
    },
    'product-wa'(el) {
      const product = productById(el.dataset.id);
      const producer = product ? producerById(product.producerId) : null;
      if (!product || !producer) return;
      if (!producer.whatsapp) { toast('El productor todavía no cargó su WhatsApp. Probá desde su perfil o más tarde.', true); return; }
      openWhatsApp(producer.whatsapp, producerContactMessage(producer, product));
    },
    'producer-wa'(el) {
      const producer = producerById(el.dataset.id);
      if (!producer) return;
      if (!producer.whatsapp) { toast('El productor todavía no cargó su WhatsApp.', true); return; }
      openWhatsApp(producer.whatsapp, producerContactMessage(producer, null));
    },
    async 'share-product'(el) {
      const product = productById(el.dataset.id);
      if (!product) return;
      const url = location.origin + '/#/product/' + product.id;
      const text = `${product.name} · ${producerName(product.producerId)} · ${money(product.price)} por ${product.unit}. Miralo en InnovaAgro-App: ${url}`;
      if (navigator.share) {
        try { await navigator.share({ title: product.name, text, url }); return; } catch (_) { return; }
      }
      copyText(text, 'Ficha copiada para compartir');
    },
    async 'share-producer'(el) {
      const producer = producerById(el.dataset.id);
      if (!producer) return;
      const url = location.origin + '/#/producer/' + producer.id;
      const text = `${producer.name} · ${producer.place}, Formosa. Conocé su historia y sus productos en InnovaAgro-App: ${url}`;
      if (navigator.share) {
        try { await navigator.share({ title: producer.name, text, url }); return; } catch (_) { return; }
      }
      copyText(text, 'Perfil copiado para compartir');
    },
    'orders-tab'(el) {
      ordersTab = el.dataset.tab || 'all';
      rerenderKeepScroll();
    },
    'order-wa'(el) {
      const order = orderById(el.dataset.order);
      const producer = producerById(el.dataset.producer);
      if (!order || !producer) return;
      if (!producer.whatsapp) { toast('El productor todavía no cargó su WhatsApp.', true); return; }
      openWhatsApp(producer.whatsapp, orderMessage(order, producer.id));
    },
    'order-buyer-wa'(el) {
      const order = orderById(el.dataset.id);
      if (!order) return;
      const producerIds = [...new Set(order.items.map((it) => it.producerId))];
      const producer = producerIds.map(producerById).find((p) => p && p.whatsapp);
      if (producer) openWhatsApp(producer.whatsapp, buyerOrderMessage(order));
      else copyText(buyerOrderMessage(order), 'Mensaje copiado');
    },
    'share-order'(el) {
      const order = orderById(el.dataset.id);
      if (order) shareOrder(order);
    },
    'ics-order'(el) {
      const order = orderById(el.dataset.id);
      if (order) downloadICS(order);
    },
    'copy-order'(el) {
      const order = orderById(el.dataset.id);
      if (order) copyText(order.code, 'Código copiado');
    },
    'repeat-order'(el) {
      const order = orderById(el.dataset.id);
      if (!order) return;
      const next = [];
      let unavailable = 0;
      order.items.forEach((item) => {
        const product = productById(item.productId);
        if (!product || !product.active || product.stock <= 0) { unavailable++; return; }
        next.push({ productId: product.id, qty: Math.min(item.qty, product.stock, 50) });
      });
      if (!next.length) { toast('Ninguno de esos productos está disponible ahora.', true); return; }
      db.cart = next;
      saveCart();
      save();
      toast(unavailable ? 'Agregamos lo disponible. Algunos productos ya no están.' : 'Productos agregados a tu canasta.');
      go('#/cart');
    },
    'lesson-done': async function (el) {
      const open = $$('#view details.lesson[open]').map((d) => d.dataset.lesson);
      const response = await api('/training/' + encodeURIComponent(el.dataset.id), { method: 'POST' });
      db.training.done = response.training || [];
      save();
      rerenderKeepScroll(open);
      toast(response.done ? 'Clase marcada como hecha.' : 'Clase marcada como pendiente.');
    },
    'speak-lesson'(el) {
      const course = courseById(el.dataset.course);
      const lesson = course && course.lessonsData.find((l) => l.id === el.dataset.id);
      if (!lesson) return;
      speak([lesson.title, ...lesson.body, ...lesson.bullets, 'Ejercicio. ' + lesson.exercise].join('. '));
    },
    'stop-speech'() { stopSpeech(); toast('Audio detenido.'); },
    'copy-exercise'(el) {
      const course = courseById(el.dataset.course);
      const lesson = course && course.lessonsData.find((l) => l.id === el.dataset.id);
      if (!lesson) return;
      copyText(`${lesson.title}\n\nEjercicio: ${lesson.exercise}`, 'Ejercicio copiado');
    },
    'copy-pitch'() { copyText(pitchScript(), 'Guion copiado'); },
    'speak-pitch'() { speak(pitchScript()); },
    async 'clear-pitch'() {
      if (!confirm('¿Borrar el guion guardado? Esta acción no se puede deshacer.')) return;
      const response = await api('/pitch', { method: 'PUT', body: { hook: '', story: '', product: '', cta: '' } });
      db.training.pitch = response.pitch;
      save();
      rerenderKeepScroll();
      toast('Guion borrado.');
    },
    'open-timer'(el) { openTimer(Number(el.dataset.sec) || 60); },
    'timer-toggle'() { toggleTimer(); },
    'timer-reset'() { resetTimer(); },
    'show-favorites'() {
      if (!(db.buyer.favorites || []).length) { toast('Todavía no guardaste favoritos.'); return; }
      db.market = Object.assign({}, db.market, {
        q: '', cat: 'Todos', onlyFav: true, onlyAvailable: false,
        onlyOrganic: false, producerId: '', maxPrice: 0
      });
      save();
      go('#/market');
    },
    async 'logout'() {
      if (!confirm('¿Cerrar sesión en este teléfono?')) return;
      try { await api('/auth/logout', { method: 'POST' }); } catch (_) {}
      checkoutDraft = null;
      checkoutErrors = {};
      ordersTab = 'all';
      panelOrdersTab = 'all';
      panelProductQuery = '';
      detailQty = 1;
      stopSpeech();
      logoutLocal();
      toast('Sesión cerrada.');
    },
    'copy-state'() {
      const summary = [
        `InnovaAgro-App · ${db.role === 'producer' ? 'Productor' : 'Comprador'}`,
        `Cuenta: ${db.buyer.name || '—'} · ${db.user ? db.user.email : '—'}`,
        `Localidad: ${db.buyer.city || '—'}`,
        `Pedidos: ${db.orders.length} · Favoritos: ${(db.buyer.favorites || []).length}`,
        `Clases completadas: ${totalCourseDone()} de ${totalLessons()}`,
        db.role === 'producer' ? `Productos: ${producerProducts(db.producerId, true).length}` : '',
        `Pantalla: ${location.hash || '#/home'}`
      ].filter(Boolean).join('\n');
      copyText(summary, 'Resumen copiado');
    },
    'copy-command'(el) { copyText(el.dataset.cmd || '', 'Comando copiado'); },
    'install-app'() { installApp(); },
    'open-credits'() { fillCredits(); openDialog('credits-dialog'); },
    'panel-orders-tab'(el) {
      panelOrdersTab = el.dataset.tab || 'all';
      rerenderKeepScroll();
    },
    async 'panel-status'(el) {
      const order = orderById(el.dataset.order);
      const status = el.dataset.status;
      if (!order || !status) return;
      if (status === 'cancelado' && !confirm(`¿Cancelar tu parte del pedido ${order.code}?`)) return;
      setBusy(el, true, '…');
      try {
        const response = await api('/orders/' + encodeURIComponent(order.id) + '/groups/' + encodeURIComponent(db.producerId), {
          method: 'PATCH', body: { status }
        });
        const index = db.orders.findIndex((o) => o.id === order.id);
        if (index >= 0) {
          const current = db.orders[index];
          db.orders[index] = Object.assign({}, current, response.order, {
            groups: Object.assign({}, current.groups || {}, response.order.groups || {})
          });
        }
        save();
        rerenderKeepScroll();
        toast(`Pedido ${order.code}: ${statusLabel(status)}.`);
      } finally {
        setBusy(el, false);
      }
    },
    'panel-order-wa'(el) {
      const order = orderById(el.dataset.order);
      if (!order) return;
      if (!order.buyer.phone) { toast('El comprador no cargó un teléfono.', true); return; }
      openWhatsApp(order.buyer.phone, orderMessage(order, db.producerId));
    },
    async 'panel-product-toggle'(el) {
      const product = productById(el.dataset.id);
      if (!product) return;
      setBusy(el, true, '…');
      try {
        const response = await api('/products/' + encodeURIComponent(product.id), {
          method: 'PATCH',
          body: Object.assign({}, product, { active: !product.active, highlights: product.highlights || [] })
        });
        replaceProduct(response.product);
        save();
        rerenderKeepScroll();
        toast(response.product.active ? 'Producto publicado.' : 'Producto pausado.');
      } finally {
        setBusy(el, false);
      }
    },
    async 'panel-product-delete'(el) {
      if (!confirm('El producto se pausará y dejará de aparecer en el catálogo. Los pedidos anteriores se conservan. ¿Continuar?')) return;
      setBusy(el, true, '…');
      try {
        await api('/products/' + encodeURIComponent(el.dataset.id), { method: 'DELETE' });
        const product = productById(el.dataset.id);
        if (product) product.active = false;
        save();
        toast('Producto pausado.');
        go('#/panel/products');
      } finally {
        setBusy(el, false);
      }
    }
  };

  /* ---------- cambios ---------- */
  function onChange(event) {
    const el = event.target;
    if (el.matches('[data-action="market-sort"]')) {
      db.market.sort = el.value || 'relevance';
      save();
      rerenderKeepScroll();
      return;
    }
    if (el.matches('[data-action="checkout-mode"]')) {
      captureCheckout();
      rerenderKeepScroll();
      return;
    }
    if (el.matches('[data-action="checkout-route"]')) {
      captureCheckout();
      rerenderKeepScroll();
      return;
    }
    if (el.matches('[data-action="setting-toggle"]')) {
      updateSetting(el);
      return;
    }
    if (el.matches('[data-upload="product-photo"]')) {
      uploadPhoto(el, 'product');
      return;
    }
    if (el.matches('[data-upload="producer-photo"]')) {
      uploadPhoto(el, 'producer');
    }
  }

  function onInput(event) {
    const el = event.target;
    if (el.id === 'market-search') {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        db.market.q = el.value.trim();
        save();
        marketFocusPending = true;
        rerenderKeepScroll();
      }, 380);
      return;
    }
    if (el.closest('form[data-form="panel-product-search"]')) {
      clearTimeout(panelSearchTimer);
      panelSearchTimer = setTimeout(() => {
        panelProductQuery = el.value.trim();
        rerenderKeepScroll();
        focusPanelSearch();
      }, 320);
    }
  }

  /* ---------- helpers de UI ---------- */
  function rerenderKeepScroll(openLessons) {
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    if (openLessons && openLessons.length) {
      $$('#view details.lesson').forEach((detail) => {
        if (openLessons.includes(detail.dataset.lesson)) detail.open = true;
      });
    }
  }

  function focusPanelSearch() {
    const input = document.querySelector('form[data-form="panel-product-search"] input[name="q"]');
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function captureAuthFields() {
    const form = document.querySelector('#view form[data-form="login"], #view form[data-form="register"]');
    if (!form) return;
    const data = new FormData(form);
    ['name', 'email', 'farmName', 'place', 'zone', 'city'].forEach((key) => {
      const value = data.get(key);
      if (value !== null) authFields[key] = String(value);
    });
  }

  function captureCheckout() {
    const form = document.querySelector('#view form[data-form="checkout"]');
    if (!form) return;
    checkoutDraft = Object.assign({}, checkoutDraft, readCheckout(form));
  }

  function addToCart(id, qty) {
    const product = productById(id);
    if (!product) return;
    if (product.stock <= 0) { toast('Ese producto se agotó esta semana.', true); return; }
    const amount = Math.max(1, Math.round(Number(qty) || 1));
    let line = db.cart.find((l) => l.productId === id);
    const current = line ? line.qty : 0;
    const next = Math.min(product.stock, current + amount, 50);
    if (next === current) {
      toast(`No podés agregar más: quedan ${product.stock} unidades.`, true);
      return;
    }
    if (line) line.qty = next;
    else { line = { productId: id, qty: next }; db.cart.push(line); }
    saveCart();
    save();
    updateChrome(parseRoute().parts);
    toast(`${product.name} agregado a la canasta.`);
  }

  function replaceProduct(product) {
    if (!product) return;
    const index = db.products.findIndex((p) => p.id === product.id);
    if (index >= 0) db.products[index] = product;
    else db.products.push(product);
  }

  function syncFavoriteButtons() {
    const favorites = db.buyer.favorites || [];
    $$('[data-action="toggle-fav"]').forEach((button) => {
      const on = favorites.includes(button.dataset.id);
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.setAttribute('aria-label', on ? 'Quitar de favoritos' : 'Guardar en favoritos');
      button.title = on ? 'Quitar de favoritos' : 'Guardar en favoritos';
    });
  }

  async function updateSetting(input) {
    const key = input.dataset.key;
    if (!key) return;
    const value = !!input.checked;
    const previous = db.settings[key];
    db.settings[key] = value;
    save();
    try {
      const response = await api('/settings', { method: 'PATCH', body: { [key]: value } });
      db.settings = Object.assign({}, db.settings, response.settings);
      save();
      toast('Preferencia guardada.');
    } catch (error) {
      db.settings[key] = previous;
      input.checked = !!previous;
      save();
      handleError(error, null, 'settings');
    }
  }

  async function uploadPhoto(input, kind) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast('Elegí una imagen JPG, PNG o WebP.', true);
      input.value = '';
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast('La imagen supera los 6 MB.', true);
      input.value = '';
      return;
    }
    const form = input.closest('form');
    const hidden = form ? form.querySelector('input[name="photo"]') : null;
    const preview = document.getElementById(kind === 'producer' ? 'producer-photo-preview' : 'product-photo-preview');
    input.disabled = true;
    try {
      toast('Subiendo imagen…');
      const url = await uploadImage(file);
      if (hidden) hidden.value = url;
      if (preview) preview.src = url;
      toast('Imagen subida. Guardá el formulario para aplicarla.');
    } catch (error) {
      handleError(error, form, 'upload');
    } finally {
      input.disabled = false;
    }
  }

  function openFilters() {
    const dialog = document.getElementById('filters-dialog');
    if (!dialog) return;
    const cat = dialog.querySelector('[name="cat"]');
    const producer = dialog.querySelector('[name="producerId"]');
    if (cat) {
      cat.innerHTML = ['Todos'].concat(CATEGORIES).map((c) => `<option value="${esc(c)}" ${db.market.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
    }
    if (producer) {
      producer.innerHTML = '<option value="">Todos los productores</option>' + db.producers
        .map((p) => `<option value="${esc(p.id)}" ${db.market.producerId === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.place)}</option>`).join('');
    }
    const price = dialog.querySelector('[name="maxPrice"]');
    if (price) price.value = db.market.maxPrice > 0 ? String(db.market.maxPrice) : '';
    const available = dialog.querySelector('[name="onlyAvailable"]');
    const organic = dialog.querySelector('[name="onlyOrganic"]');
    const fav = dialog.querySelector('[name="onlyFav"]');
    if (available) available.checked = !!db.market.onlyAvailable;
    if (organic) organic.checked = !!db.market.onlyOrganic;
    if (fav) fav.checked = !!db.market.onlyFav;
    if (!dialog.open) dialog.showModal();
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && dialog.open) dialog.close();
  }

  function fillCredits() {
    const list = document.getElementById('credits-list');
    if (!list) return;
    list.innerHTML = CREDITS.map((credit) => `<div>· ${esc(credit.title)} — ${esc(credit.creator || 'Autoría no identificada')} · ${esc(credit.license || 'Licencia abierta')}${credit.source ? ` · <a href="${esc(credit.source)}" target="_blank" rel="noopener noreferrer">fuente</a>` : ''}</div>`).join('');
  }

  function openInfo(title, subtitle, html) {
    const dialog = document.getElementById('info-dialog');
    if (!dialog) return;
    const titleEl = document.getElementById('info-title');
    const subEl = document.getElementById('info-sub');
    const bodyEl = document.getElementById('info-body');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle || 'InnovaAgro-App';
    if (bodyEl) bodyEl.innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }

  /* ---------- instalar ---------- */
  function setupInstall() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstall = event;
    });
    window.addEventListener('appinstalled', () => {
      deferredInstall = null;
      toast('InnovaAgro-App instalada en tu teléfono.');
    });
  }

  async function installApp() {
    if (deferredInstall) {
      const prompt = deferredInstall;
      deferredInstall = null;
      prompt.prompt();
      try {
        const choice = await prompt.userChoice;
        toast(choice && choice.outcome === 'accepted' ? 'Instalación aceptada.' : 'Podés instalarla más tarde desde el menú del navegador.');
      } catch (_) {}
      return;
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const html = ios
      ? `<ol class="small muted" style="display:grid;gap:8px;padding-left:18px"><li>Abrí esta página en <strong>Safari</strong>.</li><li>Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha).</li><li>Elegí <strong>Agregar a inicio</strong> y confirmá el nombre.</li></ol><p class="small muted mt-12">La app quedará como acceso directo. El catálogo se guarda para consultarlo sin conexión.</p>`
      : `<ol class="small muted" style="display:grid;gap:8px;padding-left:18px"><li>Abrí esta página en <strong>Chrome</strong> o Edge.</li><li>Tocá el menú de tres puntos.</li><li>Elegí <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>.</li></ol><p class="small muted mt-12">Si no aparece la opción, el sitio tiene que estar publicado por <strong>HTTPS</strong>. En localhost también funciona.</p>`;
    openInfo('Instalar en el teléfono', 'Acceso directo y copia offline', html);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!secure) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* La app sigue funcionando sin caché del service worker. */
      });
    });
  }

  /* ---------- temporizador ---------- */
  function openTimer(seconds) {
    const dialog = document.getElementById('timer-dialog');
    if (!dialog) return;
    stopTimer();
    timerState = { seconds, left: seconds, running: false, id: null };
    renderTimer();
    if (!dialog.open) dialog.showModal();
  }

  function renderTimer() {
    const value = document.getElementById('timer-value');
    const bar = document.getElementById('timer-bar-fill');
    const toggle = document.getElementById('timer-toggle');
    const prompt = document.getElementById('timer-prompt');
    if (value) value.textContent = String(timerState.left);
    if (bar) bar.style.width = Math.max(0, (timerState.left / timerState.seconds) * 100) + '%';
    if (toggle) toggle.textContent = timerState.running ? 'Pausar' : (timerState.left === 0 ? 'Reiniciar' : 'Empezar');
    if (prompt) {
      prompt.textContent = timerState.left === 0
        ? 'Tiempo. Cerrá con una acción concreta y una sola frase.'
        : timerState.left <= 10
          ? 'Cierre: quién sos, dónde te encuentran y hasta cuándo tomás pedidos.'
          : timerState.left <= timerState.seconds * 0.6
            ? 'Contá el trabajo concreto: la cosecha, el galpón, las manos.'
            : 'Empezá por el gancho. Una idea por frase.';
    }
  }

  function toggleTimer() {
    if (timerState.running) { stopTimer(); return; }
    if (timerState.left <= 0) timerState.left = timerState.seconds;
    timerState.running = true;
    timerState.id = setInterval(() => {
      timerState.left = Math.max(0, timerState.left - 1);
      renderTimer();
      if (timerState.left === 0) {
        stopTimer();
        toast('Tiempo. Practicá el cierre una vez más.');
      }
    }, 1000);
    renderTimer();
  }

  function stopTimer() {
    if (timerState.id) clearInterval(timerState.id);
    timerState.id = null;
    timerState.running = false;
    renderTimer();
  }

  function resetTimer() {
    stopTimer();
    timerState.left = timerState.seconds;
    renderTimer();
  }
})();
