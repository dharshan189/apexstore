document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  // --- STATE MANAGEMENT ---
  const defaultProducts = [];

  let state = {
    darkMode: localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches),
    products: JSON.parse(localStorage.getItem('products')) || defaultProducts,
    orders: JSON.parse(localStorage.getItem('orders')) || [],
    logins: JSON.parse(localStorage.getItem('user_logins')) || [],
    editingProductId: null,
    sidebarCollapsed: false
  };

  // Load fresh data from Supabase on startup
  async function loadRemoteData() {
    if (!window.DB) return;
    const [products, orders, logins] = await Promise.all([
      window.DB.getProducts(),
      window.DB.getOrders(),
      window.DB.getLogins()
    ]);
    state.products = products;
    state.orders   = orders;
    state.logins   = logins;
    // Re-render whichever view is active
    switchTab(window.location.hash);
  }
  loadRemoteData();

  // Ensure default products are in localStorage if empty (for storefront sync)
  if (!localStorage.getItem('products')) {
    localStorage.setItem('products', JSON.stringify(state.products));
  }

  // --- UI ELEMENTS ---
  const htmlEl = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const sidebar = document.getElementById('sidebar');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileCloseBtn = document.getElementById('mobile-close-sidebar');

  // --- THEME ---
  let salesChartInst = null;

  function applyTheme() {
    if (state.darkMode) {
      htmlEl.classList.add('dark');
      themeIcon.setAttribute('data-lucide', 'sun');
    } else {
      htmlEl.classList.remove('dark');
      themeIcon.setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons();
    initChart(); // Re-render chart for colors
  }
  applyTheme();

  themeToggle.addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    localStorage.setItem('theme', state.darkMode ? 'dark' : 'light');
    applyTheme();
  });

  // --- SIDEBAR ---
  toggleSidebarBtn.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    if (state.sidebarCollapsed) {
      sidebar.classList.add('w-20');
      sidebar.classList.remove('w-64');
      document.querySelectorAll('.sidebar-text').forEach(el => el.classList.add('hidden'));
    } else {
      sidebar.classList.remove('w-20');
      sidebar.classList.add('w-64');
      document.querySelectorAll('.sidebar-text').forEach(el => el.classList.remove('hidden'));
    }
  });

  const mobileSidebarOverlay = document.getElementById('mobile-sidebar-overlay');

  mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0', 'shadow-2xl', 'fixed', 'inset-y-0', 'left-0');
    if (mobileSidebarOverlay) {
      mobileSidebarOverlay.classList.remove('hidden');
      setTimeout(() => mobileSidebarOverlay.classList.remove('opacity-0'), 10);
    }
  });

  const closeMobileSidebar = () => {
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0', 'shadow-2xl', 'fixed', 'inset-y-0', 'left-0');
    if (mobileSidebarOverlay) {
      mobileSidebarOverlay.classList.add('opacity-0');
      setTimeout(() => mobileSidebarOverlay.classList.add('hidden'), 300);
    }
  };

  mobileCloseBtn.addEventListener('click', closeMobileSidebar);
  if (mobileSidebarOverlay) {
    mobileSidebarOverlay.addEventListener('click', closeMobileSidebar);
  }

  // --- ROUTING ---
  const viewsMap = [
    { hash: '#dashboard', el: document.getElementById('view-dashboard'), render: renderDashboard },
    { hash: '#products', el: document.getElementById('view-products'), render: renderProducts },
    { hash: '#add-product', el: document.getElementById('view-add-product') },
    { hash: '#orders', el: document.getElementById('view-orders'), render: renderOrdersView },
    { hash: '#customers', el: document.getElementById('view-customers'), render: renderCustomers },
    { hash: '#logins', el: document.getElementById('view-logins'), render: renderLogins },
    { hash: '#reports', el: document.getElementById('view-reports') },
    { hash: '#settings', el: document.getElementById('view-settings') },
    { hash: '#banner', el: document.getElementById('view-banner'), render: renderBannerSettings }
  ];

  function switchTab(hash) {
    if (!hash) hash = '#dashboard';
    window.location.hash = hash;

    // Hide all views
    viewsMap.forEach(v => { if(v.el) v.el.classList.add('hidden'); });

    // Show active view
    const activeView = viewsMap.find(v => v.hash === hash) || viewsMap[0];
    if (activeView.el) {
      activeView.el.classList.remove('hidden');
      activeView.el.classList.remove('opacity-0');
      if (activeView.render) activeView.render();
    }

    // Active nav item styling
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('href') === hash) {
        item.classList.add('bg-primary-50', 'dark:bg-slate-700/50', 'text-primary-600', 'dark:text-white');
      } else {
        item.classList.remove('bg-primary-50', 'dark:bg-slate-700/50', 'text-primary-600', 'dark:text-white');
      }
    });
  }

  window.addEventListener('hashchange', () => switchTab(window.location.hash));
  switchTab(window.location.hash);

  // --- BANNER MANAGEMENT ---
  let currentBannerImage = 'banner.png';
  const bannerImgUpload = document.getElementById('banner-image-upload');
  const bannerImgPreviewContainer = document.getElementById('banner-image-preview-container');
  const bannerImgPreview = document.getElementById('banner-image-preview');
  const removeBannerImgBtn = document.getElementById('remove-banner-image-btn');

  async function renderBannerSettings() {
    const bannerData = window.DB
      ? await window.DB.getBanner()
      : (JSON.parse(localStorage.getItem('hero_banner')) || {
          enabled: true,
          title: 'The Minimal Collection',
          description: 'Curated premium essentials designed for a modern wardrobe. Clean lines, relaxed silhouettes, absolute quality.',
          image: 'banner.png'
        });
    
    document.getElementById('banner-enabled').checked = bannerData.enabled;
    document.getElementById('banner-title').value = bannerData.title;
    document.getElementById('banner-desc').value = bannerData.description;
    
    currentBannerImage = bannerData.image || '';
    updateBannerImagePreview();
  }

  function updateBannerImagePreview() {
    if (currentBannerImage) {
      bannerImgPreview.src = currentBannerImage;
      bannerImgPreviewContainer.classList.remove('hidden');
    } else {
      bannerImgPreview.src = '';
      bannerImgPreviewContainer.classList.add('hidden');
    }
  }

  if (bannerImgUpload) {
    bannerImgUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          currentBannerImage = evt.target.result;
          updateBannerImagePreview();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (removeBannerImgBtn) {
    removeBannerImgBtn.addEventListener('click', function() {
      currentBannerImage = '';
      if (bannerImgUpload) bannerImgUpload.value = '';
      updateBannerImagePreview();
    });
  }

  window.saveBannerSettings = async function(e) {
    e.preventDefault();
    if (!currentBannerImage && document.getElementById('banner-enabled').checked) {
      alert('Please upload a banner image.');
      return;
    }
    const bannerData = {
      enabled: document.getElementById('banner-enabled').checked,
      title:   document.getElementById('banner-title').value,
      description: document.getElementById('banner-desc').value,
      image:   currentBannerImage
    };

    if (window.DB) {
      await window.DB.saveBanner(bannerData);
    } else {
      localStorage.setItem('hero_banner', JSON.stringify(bannerData));
    }
    alert('Banner settings saved successfully!');
  };

  // --- DASHBOARD RENDER ---
  function renderDashboard() {
    let totalRev = state.orders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const offset = parseFloat(localStorage.getItem('revenue_reset_offset')) || 0;
    totalRev = Math.max(0, totalRev - offset);
    
    const revEl = document.getElementById('dash-revenue');
    if (revEl) revEl.textContent = `₹${totalRev.toFixed(2)}`;
    document.getElementById('dash-orders').textContent = state.orders.length;
    document.getElementById('dash-products').textContent = state.products.length;
    document.getElementById('dash-customers').textContent = Math.ceil(state.orders.length * 0.8);

    const chartsArea = document.getElementById('dash-charts-area');
    const emptyState = document.getElementById('dash-empty-state');
    
    if (state.orders.length === 0) {
      if(chartsArea) chartsArea.classList.add('hidden');
      if(emptyState) emptyState.classList.remove('hidden');
    } else {
      if(chartsArea) chartsArea.classList.remove('hidden');
      if(emptyState) emptyState.classList.add('hidden');
      initChart();
    }

    const tbody = document.getElementById('dash-recent-orders');
    tbody.innerHTML = '';
    state.orders.slice(0, 5).forEach(o => {
      tbody.innerHTML += `
        <div class="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0">
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-white">${o.id}</p>
            <p class="text-xs text-slate-500">${o.customerName}</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold text-slate-900 dark:text-white">₹${o.total}</p>
            <p class="text-xs ${o.status === 'Delivered' ? 'text-green-500' : 'text-brand-500'}">${o.status}</p>
          </div>
        </div>
      `;
    });
  }

  function initChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    if (salesChartInst) salesChartInst.destroy();

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#cbd5e1' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    salesChartInst = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'Revenue',
          data: [1200, 1900, 1500, 2200, 1800, 2800],
          borderColor: '#4f46e5',
          backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : 'rgba(79, 70, 229, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor } }
        }
      }
    });
  }

  // --- PRODUCTS RENDER ---
  function renderProducts() {
    document.getElementById('nav-product-count').textContent = state.products.length;
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = '';
    
    state.products.forEach(p => {
      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
          <td class="px-6 py-4 flex items-center gap-3">
            <img src="${p.image}" class="w-10 h-10 rounded-lg object-cover bg-slate-100">
            <div>
              <p class="font-semibold text-slate-900 dark:text-white">${p.title}</p>
              <p class="text-xs text-slate-500">ID: ${p.id}</p>
            </div>
          </td>
          <td class="px-6 py-4"><span class="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">${p.category}</span></td>
          <td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">₹${parseFloat(p.price).toFixed(2)}</td>
          <td class="px-6 py-4"><span class="text-green-600 dark:text-green-400 font-medium text-sm flex items-center gap-1"><i data-lucide="check-circle" class="w-4 h-4"></i> In Stock</span></td>
          <td class="px-6 py-4 text-right space-x-2">
            <button onclick="editProduct(${p.id})" class="text-primary-600 hover:text-primary-800 dark:hover:text-primary-400 p-1"><i data-lucide="edit" class="w-4 h-4"></i></button>
            <button onclick="deleteProduct(${p.id})" class="text-red-500 hover:text-red-700 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </td>
        </tr>
      `;
    });
    lucide.createIcons();
  }

  document.getElementById('search-products')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const rows = document.getElementById('products-tbody').querySelectorAll('tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  });

  // --- PRODUCT FORM LOGIC (Editing & Deleting) ---
  window.editProduct = function(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    
    state.editingProductId = id;
    
    // Switch to Add Product view
    switchTab('#add-product');
    
    // Update title
    document.querySelector('#view-add-product h1').textContent = 'Edit Product';
    
    // Fill the fields
    const titleEl = document.getElementById('new-prod-title');
    const catEl = document.getElementById('new-prod-category');
    const descEl = document.getElementById('new-prod-desc');
    const origPriceInput = document.getElementById('price-original');
    
    if (titleEl) titleEl.value = p.title;
    if (catEl) catEl.value = p.category;
    if (descEl) descEl.value = p.description || "";
    if (origPriceInput) {
      origPriceInput.value = p.price;
      const discountInput = document.getElementById('price-discount');
      if (discountInput) discountInput.value = 0;
      const finalPriceEl = document.getElementById('price-final');
      if (finalPriceEl) finalPriceEl.textContent = '₹' + parseFloat(p.price).toFixed(2);
    }
    
    // Reset size buttons, then activate the product's saved sizes
    document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
    if (p.sizes && p.sizes.length > 0) {
      document.querySelectorAll('.size-btn').forEach(btn => {
        if (p.sizes.includes(btn.textContent.trim())) btn.classList.add('active');
      });
    }
    
    if (p.images && p.images.length > 0) {
      uploadedImages = [...p.images];
    } else if (p.image) {
      uploadedImages = [p.image];
    } else {
      uploadedImages = [];
    }
    renderImagePreview();
    
    if (p.colors) {
      selectedColors = [...p.colors];
    } else {
      selectedColors = [];
    }
    renderColors();
  };

  // (Already replaced above)

  window.deleteProduct = async function(id) {
    if (confirm('Delete this product?')) {
      state.products = state.products.filter(p => p.id !== id);
      if (window.DB) {
        await window.DB.deleteProduct(id);
      } else {
        localStorage.setItem('products', JSON.stringify(state.products));
      }
      renderProducts();
    }
  };

  // --- ORDERS RENDER ---
  function renderOrdersView() {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = '';
    
    state.orders.forEach(o => {
      let badgeCls = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      if(o.status === 'Shipped') badgeCls = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      if(o.status === 'Delivered') badgeCls = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';

      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
          <td class="px-6 py-4 font-bold text-slate-900 dark:text-white">${o.id}</td>
          <td class="px-6 py-4">
            <p class="font-medium text-slate-900 dark:text-white">${o.customerName}</p>
            <p class="text-xs text-slate-500">${o.customerEmail}</p>
            <p class="text-xs text-slate-500">${o.customerPhone || 'No Phone'}</p>
          </td>
          <td class="px-6 py-4">
            <div class="max-w-[200px] whitespace-normal">
              <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mb-1 border border-slate-200 dark:border-slate-600">${o.paymentMethod || 'N/A'}</span>
              <p class="text-[10px] text-slate-500 line-clamp-2" title="${o.customerAddress}">${o.customerAddress || 'No Address'}</p>
            </div>
          </td>
          <td class="px-6 py-4 text-slate-500">${o.date}</td>
          <td class="px-6 py-4">
            <select onchange="updateOrderStatus('${o.id}', this.value)" class="text-xs font-semibold px-2.5 py-1 rounded-full border-0 ${badgeCls} cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50 appearance-none text-center">
              <option value="Processing" ${o.status==='Processing'?'selected':''} class="text-slate-900">Processing</option>
              <option value="Shipped" ${o.status==='Shipped'?'selected':''} class="text-slate-900">Shipped</option>
              <option value="Delivered" ${o.status==='Delivered'?'selected':''} class="text-slate-900">Delivered</option>
            </select>
          </td>
          <td class="px-6 py-4 font-bold text-slate-900 dark:text-white text-right">₹${o.total}</td>
          <td class="px-6 py-4 text-right">
            <button onclick="deleteOrder('${o.id}')"
              title="Delete Order"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-red-500 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              Delete
            </button>
          </td>
        </tr>
      `;
    });
  }

  window.updateOrderStatus = async function(id, status) {
    const order = state.orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      const now = new Date();
      const stamp = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
                    ', ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      if (status === 'Shipped'   && !order.shippedAt)   order.shippedAt   = stamp;
      if (status === 'Delivered' && !order.deliveredAt) order.deliveredAt = stamp;

      const updates = { status: order.status, shipped_at: order.shippedAt, delivered_at: order.deliveredAt };
      if (window.DB) {
        await window.DB.updateOrder(id, updates);
      } else {
        localStorage.setItem('orders', JSON.stringify(state.orders));
      }
      renderOrdersView();
    }
  };

  window.deleteOrder = async function(id) {
    const order = state.orders.find(o => o.id === id);
    if (!order) return;
    if (!confirm(`Delete order ${id} from ${order.customerName}? This cannot be undone.`)) return;
    state.orders = state.orders.filter(o => o.id !== id);
    if (window.DB) {
      await window.DB.deleteOrder(id);
    } else {
      localStorage.setItem('orders', JSON.stringify(state.orders));
    }
    renderOrdersView();
    renderDashboard();
  };

  // --- CUSTOMERS RENDER ---
  async function renderCustomers() {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const registrations = window.DB
      ? await window.DB.getRegistrations()
      : (JSON.parse(localStorage.getItem('customer_registrations')) || []);
    
    if (registrations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-8 text-center text-slate-500">No registered customers found.</td>
        </tr>
      `;
      return;
    }
    
    registrations.forEach(reg => {
      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
          <td class="px-6 py-4 font-bold text-slate-900 dark:text-white">${reg.name || 'N/A'}</td>
          <td class="px-6 py-4 text-slate-500">${reg.email || 'N/A'}</td>
          <td class="px-6 py-4 text-slate-500">${reg.phone || 'N/A'}</td>
          <td class="px-6 py-4 text-slate-500">${reg.gender || 'N/A'}</td>
          <td class="px-6 py-4 text-slate-500">${reg.date || 'N/A'}</td>
        </tr>
      `;
    });
  }

  // --- LOGINS RENDER ---
  async function renderLogins() {
    const tbody = document.getElementById('logins-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    state.logins = window.DB
      ? await window.DB.getLogins()
      : (JSON.parse(localStorage.getItem('user_logins')) || []);
    
    if (state.logins.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="px-6 py-8 text-center text-slate-500">No login records found.</td>
        </tr>
      `;
      return;
    }
    
    state.logins.forEach(login => {
      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
          <td class="px-6 py-4 flex items-center gap-3">
            <img src="${login.picture || 'https://via.placeholder.com/40'}" class="w-8 h-8 rounded-full object-cover bg-slate-100 dark:bg-slate-800">
            <span class="font-bold text-slate-900 dark:text-white">${login.name || 'Guest'}</span>
          </td>
          <td class="px-6 py-4 text-slate-500">${login.email || 'N/A'}</td>
          <td class="px-6 py-4 text-slate-500">${login.time}</td>
        </tr>
      `;
    });
  }

  window.downloadLoginsCSV = function() {
    const logins = JSON.parse(localStorage.getItem('user_logins')) || [];
    if (logins.length === 0) {
      alert("No login data to download.");
      return;
    }
    
    // Create CSV content
    const headers = ["Name", "Email", "Time"];
    const rows = logins.map(login => [
      `"${(login.name || 'Guest').replace(/"/g, '""')}"`,
      `"${(login.email || 'N/A').replace(/"/g, '""')}"`,
      `"${(login.time || '').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    // Create a Blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "customer_logins.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- IMAGE UPLOAD LOGIC ---
  let uploadedImages = [];
  const imgUploadInput = document.getElementById('product-image-upload');
  const imgPreviewsContainer = document.getElementById('product-image-previews');

  // Compress image to max 600px wide at 70% JPEG quality to stay within localStorage quota
  function compressImage(dataUrl, callback) {
    const img = new Image();
    img.onload = function() {
      const MAX_WIDTH = 600;
      const MAX_HEIGHT = 600;
      let width = img.width;
      let height = img.height;

      // Scale down proportionally
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG at 70% quality (dramatically smaller than original)
      const compressed = canvas.toDataURL('image/jpeg', 0.70);
      callback(compressed);
    };
    img.src = dataUrl;
  }

  if (imgUploadInput) {
    imgUploadInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        files.forEach(file => {
          const reader = new FileReader();
          reader.onload = function(evt) {
            // Compress before pushing to avoid localStorage quota error
            compressImage(evt.target.result, function(compressed) {
              uploadedImages.push(compressed);
              renderImagePreview();
            });
          };
          reader.readAsDataURL(file);
        });
      }
    });
  }

  function renderImagePreview() {
    if (!imgPreviewsContainer) return;
    if (uploadedImages.length > 0) {
      let html = '';
      uploadedImages.forEach((imgSrc, index) => {
        html += `
          <div class="relative group rounded-lg overflow-hidden border ${index === 0 ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-slate-200 dark:border-slate-700'} aspect-[4/5]">
            <img src="${imgSrc}" class="w-full h-full object-cover">
            ${index === 0 ? '<div class="absolute top-1 left-1 bg-primary-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Cover</div>' : ''}
            <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" onclick="removeUploadedImage(${index})" class="p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
          </div>
        `;
      });
      imgPreviewsContainer.innerHTML = html;
      lucide.createIcons();
    } else {
      imgPreviewsContainer.innerHTML = '';
    }
  }

  window.removeUploadedImage = function(index = -1) {
    if (index > -1) {
      uploadedImages.splice(index, 1);
    } else {
      uploadedImages = [];
    }
    if (imgUploadInput && uploadedImages.length === 0) imgUploadInput.value = "";
    renderImagePreview();
  };

  // --- COLOR PICKER LOGIC ---
  let selectedColors = [];
  const colorPickerInput = document.getElementById('color-picker-input');
  const colorsContainer = document.getElementById('product-colors-container');

  if (colorPickerInput) {
    colorPickerInput.addEventListener('input', function(e) {
      const color = e.target.value;
      if (!selectedColors.includes(color)) {
        selectedColors.push(color);
        renderColors();
      }
    });
  }

  function renderColors() {
    if (!colorsContainer) return;
    
    Array.from(colorsContainer.children).forEach(child => {
      if (child.id !== 'color-picker-label') {
        colorsContainer.removeChild(child);
      }
    });
    
    const addButtonLabel = document.getElementById('color-picker-label');
    
    selectedColors.forEach((color, index) => {
      const colorDiv = document.createElement('div');
      colorDiv.className = "relative w-8 h-8 rounded-full border-2 border-white ring-1 ring-slate-300 dark:ring-slate-600 cursor-pointer flex items-center justify-center group";
      colorDiv.style.backgroundColor = color;
      
      const deleteIcon = document.createElement('i');
      deleteIcon.setAttribute('data-lucide', 'x');
      deleteIcon.className = "w-4 h-4 text-white opacity-0 group-hover:opacity-100 drop-shadow-md";
      colorDiv.appendChild(deleteIcon);
      
      colorDiv.addEventListener('click', () => {
        selectedColors.splice(index, 1);
        renderColors();
      });
      
      if (addButtonLabel) {
        colorsContainer.insertBefore(colorDiv, addButtonLabel);
      } else {
        colorsContainer.appendChild(colorDiv);
      }
    });
    
    lucide.createIcons();
  }

  // --- ADD PRODUCT LOGIC ---
  const origPriceInput = document.getElementById('price-original');
  const discountInput = document.getElementById('price-discount');
  const finalPriceEl = document.getElementById('price-final');

  function calcPrice() {
    if (!origPriceInput || !discountInput || !finalPriceEl) return;
    const orig = parseFloat(origPriceInput.value) || 0;
    const disc = parseFloat(discountInput.value) || 0;
    const final = orig - (orig * (disc / 100));
    finalPriceEl.textContent = '₹' + final.toFixed(2);
  }

  if (origPriceInput) origPriceInput.addEventListener('input', calcPrice);
  if (discountInput) discountInput.addEventListener('input', calcPrice);
  
  // Toggle Size Buttons
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  // Prevent form from ever submitting/reloading
  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm) {
    addProductForm.addEventListener('submit', function(e) {
      e.preventDefault();
      return false;
    });
  }

  window.publishNewProduct = async function() {
    try {
    const titleEl = document.getElementById('new-prod-title');
    const categoryEl = document.getElementById('new-prod-category');
    
    if (!titleEl || !titleEl.value.trim()) {
      alert('Please enter a product name.');
      return;
    }
    
    const title       = titleEl.value.trim();
    const category    = categoryEl ? categoryEl.value : 'Apparel';
    const descEl      = document.getElementById('new-prod-desc');
    const description = descEl ? descEl.value.trim() : '';
    
    let price = 0;
    if (origPriceInput) {
       const orig = parseFloat(origPriceInput.value) || 0;
       const disc = parseFloat(discountInput.value) || 0;
       price = orig - (orig * (disc / 100));
    }
    
    const image  = uploadedImages.length > 0 ? uploadedImages[0] : '';
    const images = [...uploadedImages];
    const colors = [...selectedColors];
    const sizes  = Array.from(document.querySelectorAll('.size-btn.active')).map(btn => btn.textContent.trim());

    let product;
    if (state.editingProductId) {
      const idx = state.products.findIndex(p => p.id === state.editingProductId);
      product = { ...state.products[idx], title, price: price.toFixed(2), category, image, images, colors, sizes, description };
      if (idx > -1) state.products[idx] = product;
      state.editingProductId = null;
      document.querySelector('#view-add-product h1').textContent = 'Add New Clothing';
    } else {
      product = { id: Date.now(), title, price: price.toFixed(2), category, image, images, colors, sizes, description };
      state.products.push(product);
    }

    // Persist to Supabase or localStorage
    if (window.DB) {
      await window.DB.upsertProduct(product);
    } else {
      localStorage.setItem('products', JSON.stringify(state.products));
    }
    
    renderProducts();
    
    const form = document.getElementById('add-product-form');
    if (form) form.reset();
    uploadedImages = [];
    renderImagePreview();
    selectedColors = [];
    renderColors();
    document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
    if (finalPriceEl) finalPriceEl.textContent = '₹0.00';
    
    switchTab('#products');
    alert('Product published successfully!');
    } catch(err) {
      console.error('publishNewProduct error:', err);
      alert('Error publishing product: ' + err.message);
    }
  };

  // --- CONFIRM MODAL LOGIC ---
  const confirmModal = document.getElementById('confirm-modal');
  const confirmModalCard = document.getElementById('confirm-modal-card');
  const confirmTitle = document.getElementById('confirm-modal-title');
  const confirmDesc = document.getElementById('confirm-modal-desc');
  const confirmBtn = document.getElementById('confirm-modal-btn');
  let confirmAction = null;

  window.showConfirmModal = function(title, desc, action) {
    if(!confirmModal) return;
    confirmTitle.textContent = title;
    confirmDesc.textContent = desc;
    confirmAction = action;
    
    confirmModal.classList.remove('hidden');
    // Force reflow
    void confirmModal.offsetWidth;
    confirmModal.classList.remove('opacity-0');
    confirmModalCard.classList.remove('scale-95');
    confirmModalCard.classList.add('scale-100');
  };

  window.closeConfirmModal = function() {
    if(!confirmModal) return;
    confirmModal.classList.add('opacity-0');
    confirmModalCard.classList.remove('scale-100');
    confirmModalCard.classList.add('scale-95');
    setTimeout(() => {
      confirmModal.classList.add('hidden');
    }, 300);
  };

  if(confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if(confirmAction === 'resetRevenue') {
         localStorage.setItem('revenue_reset_offset', (JSON.parse(localStorage.getItem('orders')) || []).reduce((sum, o) => sum + parseFloat(o.total), 0)); 
         window.location.reload();
      } else if (confirmAction === 'factoryReset') {
         if (window.DB && window.DB.factoryReset) {
            await window.DB.factoryReset();
         } else {
            localStorage.clear(); 
         }
         window.location.reload();
      } else if (confirmAction === 'resetLogins') {
         if (window.DB && window.DB.deleteAllLogins) {
            await window.DB.deleteAllLogins();
         } else {
            localStorage.removeItem('user_logins');
         }
         state.logins = [];
         renderLogins();
      }
      closeConfirmModal();
    });
  }

});
