// Storefront Catalog, Cart & Checkout Logic

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // Load state (products & orders are refreshed from Supabase after init)
  let state = {
    darkMode: localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches),
    products: JSON.parse(localStorage.getItem('products')) || [],
    orders: JSON.parse(localStorage.getItem('orders')) || [],
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    searchQuery: '',
    selectedCategory: 'all',
    sortOption: 'default'
  };

  // Security Helper to prevent XSS
  function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Active Product for Quick View
  let activeQuickViewProduct = null;

  // DOM Elements
  const htmlEl = document.documentElement;
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  
  const productsGrid = document.getElementById('products-grid');
  
  // Cart elements
  const cartBtn = document.getElementById('cart-btn');
  const cartCountEl = document.getElementById('cart-count');
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  const cartPanel = document.getElementById('cart-panel');
  const cartCloseBtn = document.getElementById('cart-close-btn');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartDrawerCount = document.getElementById('cart-drawer-count');
  const cartSubtotal = document.getElementById('cart-subtotal');
  const cartTotal = document.getElementById('cart-total');
  const cartCheckoutBtn = document.getElementById('cart-checkout-btn');

  // Product modal elements
  const productModal = document.getElementById('product-modal');
  const productModalOverlay = document.getElementById('product-modal-overlay');
  const productModalCard = document.getElementById('product-modal-card');
  const productModalClose = document.getElementById('product-modal-close');
  const productModalImage = document.getElementById('product-modal-image');
  const productModalCategory = document.getElementById('product-modal-category');
  const productModalTitle = document.getElementById('product-modal-title');
  const productModalPrice = document.getElementById('product-modal-price');
  const productModalDesc = document.getElementById('product-modal-desc');
  const pmQtyMinus = document.getElementById('pm-qty-minus');
  const pmQtyPlus = document.getElementById('pm-qty-plus');
  const pmQty = document.getElementById('pm-qty');
  const pmAddToCart = document.getElementById('pm-add-to-cart');

  // Checkout modal elements
  const checkoutModal = document.getElementById('checkout-modal');
  const checkoutModalCard = document.getElementById('checkout-modal-card');
  const checkoutForm = document.getElementById('checkout-form');
  const checkoutItemsList = document.getElementById('checkout-items-list');
  const checkoutSubtotal = document.getElementById('checkout-subtotal');
  const checkoutShipping = document.getElementById('checkout-shipping');
  const checkoutTotal = document.getElementById('checkout-total');
  
  const stepShippingIndicator = document.getElementById('step-shipping-indicator');
  const stepPaymentIndicator = document.getElementById('step-payment-indicator');
  const checkoutStepShipping = document.getElementById('checkout-step-shipping');
  const checkoutStepPayment = document.getElementById('checkout-step-payment');
  const btnNextToPayment = document.getElementById('btn-next-to-payment');
  const btnBackToShipping = document.getElementById('btn-back-to-shipping');
  const btnSubmitOrder = document.getElementById('btn-submit-order');

  // Checkout form inputs
  const checkoutName = document.getElementById('checkout-name');
  const checkoutEmail = document.getElementById('checkout-email');
  const checkoutAddress = document.getElementById('checkout-address');
  const checkoutCity = document.getElementById('checkout-city');
  const checkoutPostal = document.getElementById('checkout-postal');

  // User elements
  const navSigninBtn = document.getElementById('nav-signin-btn');
  const navOrdersBtn = document.getElementById('nav-orders-btn');
  const userDropdown = document.getElementById('user-dropdown');
  const btnShowOrders = document.getElementById('btn-show-orders');
  const btnSignout = document.getElementById('btn-signout');

  // Orders modal elements
  const ordersModal = document.getElementById('orders-modal');
  const ordersModalOverlay = document.getElementById('orders-modal-overlay');
  const ordersModalCard = document.getElementById('orders-modal-card');
  const ordersModalClose = document.getElementById('orders-modal-close');
  const ordersListContainer = document.getElementById('orders-list-container');

  // Filter, search & sort
  const searchInput = document.getElementById('search-input');
  const categoryFilters = document.getElementById('category-filters');
  const sortSelect = document.getElementById('sort-select');

  // Toast
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');


  // Default Fallback Catalog
  const defaultProducts = [];

  // ================= 1. INITIALIZATION =================
  async function init() {
    // Apply Theme
    if (state.darkMode) {
      htmlEl.classList.add('dark');
      themeIcon.setAttribute('data-lucide', 'sun');
    } else {
      htmlEl.classList.remove('dark');
      themeIcon.setAttribute('data-lucide', 'moon');
    }

    // ── Fetch fresh data from Supabase (falls back to localStorage) ──
    if (window.DB) {
      const [products, orders] = await Promise.all([
        window.DB.getProducts(),
        window.DB.getOrders()
      ]);
      state.products = products;
      state.orders   = orders;
    }

    renderCatalog();
    renderCart();

    // Load hero banner from DB / localStorage
    await renderHeroBanner();
    
    // Automatically flag that storefront has been viewed
    let checklist = JSON.parse(localStorage.getItem('checklist')) || {};
    checklist['storefront'] = true;
    localStorage.setItem('checklist', JSON.stringify(checklist));

    // Restore user profile if authenticated
    const savedUser = JSON.parse(localStorage.getItem('auth_user'));
    if (savedUser && savedUser.name) {
      updateUserHeader(savedUser.name, savedUser.picture);
    }

    // Initialize Google Identity Services
    initGoogleSignIn();

    // Show registration popup after 10–20 seconds for non-registered users
    const hasRealAccount = savedUser && savedUser.name && savedUser.email && savedUser.email !== 'N/A';
    if (!hasRealAccount) {
      const delay = Math.floor(Math.random() * 10000) + 10000;
      setTimeout(() => { openAuthModal(); }, delay);
    }
  }

  // ================= 1.5 DYNAMIC HERO BANNER =================
  async function renderHeroBanner() {
    const container = document.getElementById('hero-banner-container');
    if (!container) return;

    // Prefer Supabase, fall back to localStorage
    const bannerData = window.DB
      ? await window.DB.getBanner()
      : (JSON.parse(localStorage.getItem('hero_banner')) || {
          enabled: true,
          title: 'The Minimal Collection',
          description: 'Curated premium essentials designed for a modern wardrobe. Clean lines, relaxed silhouettes, absolute quality.',
          image: 'banner.png'
        });

    if (!bannerData.enabled) {
      container.style.display = 'none';
      return;
    }

    const img = new Image();
    img.src = bannerData.image;
    
    // Inject the HTML immediately so the text shows up, but keep the skeleton pulse classes on the container until the image loads.
    container.innerHTML = `
      <img src="${escapeHTML(bannerData.image)}" alt="${escapeHTML(bannerData.title)}" class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-700" id="hero-banner-img">
      <div class="absolute inset-0 bg-black/35"></div>
      <div class="absolute inset-0 flex flex-col justify-end px-4 sm:px-8 md:px-16 pb-8 sm:pb-16 z-10 text-white max-w-7xl mx-auto w-full">
        <div class="space-y-2 sm:space-y-4 max-w-2xl">
          <h1 class="text-2xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">${escapeHTML(bannerData.title)}</h1>
          <p class="text-xs sm:text-base md:text-lg text-zinc-100 max-w-xl hidden sm:block">${escapeHTML(bannerData.description)}</p>
          <div class="pt-2 sm:pt-4">
            <a href="#products-section" class="inline-block px-5 py-2.5 sm:px-8 sm:py-4 bg-white text-black text-xs sm:text-sm font-semibold rounded-full transition-transform hover:scale-105">Shop Now</a>
          </div>
        </div>
      </div>
    `;

    img.onload = () => {
      container.classList.remove('animate-pulse', 'bg-zinc-100', 'dark:bg-zinc-900');
      const renderedImg = document.getElementById('hero-banner-img');
      if (renderedImg) {
        renderedImg.classList.remove('opacity-0');
      }
    };
    
    // Fallback if image fails or is already cached
    if (img.complete) {
      img.onload();
    }
  }

  // ================= 2. THEME SWITCHER =================
  themeToggleBtn.addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    if (state.darkMode) {
      htmlEl.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      htmlEl.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    // Swap icon dynamically
    themeIcon.outerHTML = state.darkMode 
      ? '<i data-lucide="sun" id="theme-icon" class="w-4 h-4"></i>' 
      : '<i data-lucide="moon" id="theme-icon" class="w-4 h-4"></i>';
    lucide.createIcons();
  });

  // ================= 3. RENDER CATALOG =================
  function renderCatalog() {
    const allProducts = [...state.products, ...defaultProducts];
    
    // Filter by Category & Search Query
    let filtered = allProducts.filter(p => {
      const cat = p.category.toLowerCase().trim();
      const sel = state.selectedCategory.toLowerCase().trim();
      const matchCategory = state.selectedCategory === 'all' || cat === sel || cat.startsWith(sel + ' ') || cat.startsWith(sel + "'") || cat.startsWith(sel + "-");
      const matchSearch = p.title.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(state.searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });

    // Sort options
    if (state.sortOption === 'price-asc') {
      filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (state.sortOption === 'price-desc') {
      filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    }

    productsGrid.innerHTML = '';

    if (filtered.length === 0) {
      productsGrid.innerHTML = `
        <div class="col-span-full py-16 text-center">
          <i data-lucide="help-circle" class="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2"></i>
          <p class="text-xs text-zinc-400 dark:text-zinc-500">No items match your search filters.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    filtered.forEach(product => {
      const hasImage = product.image ? product.image : '';
      
      // Generate dynamic badges HTML based on admin panel flags
      let badgesHTML = '';
      if (product.newArrival !== false) { // Default is true for new arrival
        badgesHTML += `<span class="bg-black text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">New</span>`;
      }
      if (product.bestSeller) {
        badgesHTML += `<span class="bg-amber-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Best Seller</span>`;
      }
      if (product.featured) {
        badgesHTML += `<span class="bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Featured</span>`;
      }

      // Discount badge (top-right of image)
      const discountValue = parseFloat(product.discount) || 0;
      const discountBadgeHTML = discountValue > 0
        ? `<div class="absolute top-2 right-2 z-10">
             <span class="bg-green-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow-md">${discountValue}% OFF</span>
           </div>`
        : '';

      // Price row — show struck-through original price when discount exists
      const priceHTML = discountValue > 0 && product.originalPrice
        ? `<div class="flex items-baseline gap-1.5">
             <span class="text-sm font-bold text-zinc-900 dark:text-white">₹${escapeHTML(product.price)}</span>
             <span class="text-xs text-zinc-400 line-through">₹${parseFloat(product.originalPrice).toFixed(2)}</span>
           </div>`
        : `<span class="text-sm font-bold text-zinc-900 dark:text-white">₹${escapeHTML(product.price)}</span>`;

      const cardHTML = `
        <div class="group flex flex-col cursor-pointer transition-opacity">
          <!-- Product Image (click opens quick view) -->
          <div class="relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 aspect-[4/5] rounded-lg quick-view-trigger" data-id="${escapeHTML(product.id)}">
            <img src="${escapeHTML(hasImage)}" alt="${escapeHTML(product.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
            <!-- Top-left badges (New, Best Seller, Featured) -->
            <div class="absolute top-2 left-2 flex flex-col gap-1 z-10">
              ${badgesHTML}
            </div>
            <!-- Top-right discount badge -->
            ${discountBadgeHTML}
          </div>

          <!-- Product Info -->
          <div class="mt-3 flex flex-col space-y-1 quick-view-trigger" data-id="${escapeHTML(product.id)}">
            <div class="text-[10px] text-zinc-400 uppercase tracking-wider">${escapeHTML(product.category)}</div>
            <h3 class="font-semibold text-sm text-zinc-900 dark:text-white leading-tight">${escapeHTML(product.title)}</h3>
            ${priceHTML}
          </div>

          <!-- Always-visible Action Buttons -->
          <div class="mt-3 flex gap-2">
            <button class="add-to-cart-btn flex-1 py-2 bg-amber-400 hover:bg-amber-500 text-black font-bold text-[10px] uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1"
              data-id="${escapeHTML(product.id)}" data-title="${escapeHTML(product.title)}" data-price="${escapeHTML(product.price)}" data-image="${escapeHTML(hasImage)}">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 6h13M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z"/></svg>
              Add to Cart
            </button>
            <button class="buy-now-btn flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1"
              data-id="${escapeHTML(product.id)}">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Buy Now
            </button>
          </div>
        </div>
      `;
      productsGrid.insertAdjacentHTML('beforeend', cardHTML);
    });


    lucide.createIcons();

    // Add to Cart buttons (opens modal for size selection if product has sizes)
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        // Try matching by both strict and loose id comparison
        const product = allProducts.find(p => p.id != null && p.id.toString() === id.toString());
        if (!product) {
          // Fallback: read directly from button data attributes
          const title = e.currentTarget.getAttribute('data-title');
          const price = e.currentTarget.getAttribute('data-price');
          const image = e.currentTarget.getAttribute('data-image');
          addToCart({ id, title, price, image });
          return;
        }
        if (product.sizes && product.sizes.length > 0) {
          // Open modal for size selection
          openProductModal(product);
        } else {
          addToCart({ id: product.id, title: product.title, price: product.price, image: product.image });
        }
      });
    });

    // Buy Now buttons — require login
    document.querySelectorAll('.buy-now-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Auth guard: redirect to login if not signed in
        const savedUser = JSON.parse(localStorage.getItem('auth_user'));
        const isLoggedIn = savedUser && savedUser.name && savedUser.email && savedUser.email !== 'N/A';
        if (!isLoggedIn) {
          openAuthModal();
          return;
        }
        const id = e.currentTarget.getAttribute('data-id');
        const product = allProducts.find(p => p.id.toString() === id.toString());
        if (product) openProductModal(product, true); // true = buy now mode
      });
    });

    document.querySelectorAll('.quick-view-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const id = trigger.getAttribute('data-id');
        const product = allProducts.find(p => p.id.toString() === id.toString());
        if (product) openProductModal(product);
      });
    });
  }

  // ================= 4. SHOPPING CART LOGIC =================
  function addToCart(product, quantity = 1) {
    const existing = state.cart.find(item => item.id.toString() === product.id.toString());
    if (existing) {
      existing.quantity += quantity;
      existing.selected = true;
    } else {
      state.cart.push({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        quantity: quantity,
        selected: true
      });
    }

    localStorage.setItem('cart', JSON.stringify(state.cart));
    renderCart();

    // Pulse Cart Icon
    cartCountEl.classList.remove('animate-pulse');
    void cartCountEl.offsetWidth; // Trigger reflow
    cartCountEl.classList.add('animate-bounce');
    setTimeout(() => cartCountEl.classList.remove('animate-bounce'), 1000);

    showToast(`Added ${product.title} to cart!`, 'shopping-cart');
  }

  function renderCart() {
    const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountEl.textContent = totalCount;
    cartDrawerCount.textContent = totalCount;

    cartItemsContainer.innerHTML = '';

    if (state.cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center space-y-3 py-20">
          <i data-lucide="shopping-bag" class="w-10 h-10 text-zinc-300 dark:text-zinc-650"></i>
          <p class="text-xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Your cart is empty</p>
          <button id="cart-drawer-shop-btn" class="px-5 py-2 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-black text-[10px] font-bold uppercase tracking-wider rounded transition-colors">Shop Catalog</button>
        </div>
      `;
      cartSubtotal.textContent = '₹0.00';
      cartTotal.textContent = '₹0.00';
      cartCheckoutBtn.disabled = true;
      cartCheckoutBtn.classList.add('opacity-50', 'cursor-not-allowed');

      const shopBtn = document.getElementById('cart-drawer-shop-btn');
      if (shopBtn) {
        shopBtn.addEventListener('click', closeCartDrawer);
      }
      lucide.createIcons();
      return;
    }

    let subtotal = 0;

    state.cart.forEach(item => {
      const isSelected = item.selected !== false;
      const itemSubtotal = parseFloat(item.price) * item.quantity;
      if (isSelected) {
        subtotal += itemSubtotal;
      }

      const itemHTML = `
        <div class="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-darkBorder">
          <!-- Checkbox for item selection -->
          <input type="checkbox" class="cart-item-checkbox accent-black dark:accent-white w-4 h-4 cursor-pointer flex-shrink-0 rounded border-zinc-300 dark:border-zinc-700" data-id="${escapeHTML(item.id)}" ${isSelected ? 'checked' : ''}>
          
          <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" class="w-14 h-14 object-cover rounded bg-zinc-55 dark:bg-zinc-900 border border-zinc-150 dark:border-darkBorder flex-shrink-0">
          
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider truncate">${escapeHTML(item.title)}</h4>
            <p class="text-[10px] text-zinc-450 dark:text-zinc-500 mt-0.5">₹${escapeHTML(item.price)} each</p>
            
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center border border-zinc-200 dark:border-darkBorder rounded">
                <button class="cart-qty-minus px-2 py-0.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors" data-id="${escapeHTML(item.id)}">-</button>
                <span class="px-2.5 py-0.5 text-[10px] font-bold text-zinc-950 dark:text-white min-w-[20px] text-center">${escapeHTML(item.quantity)}</span>
                <button class="cart-qty-plus px-2 py-0.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors" data-id="${escapeHTML(item.id)}">+</button>
              </div>
              
              <button class="cart-remove-item text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-350 uppercase tracking-widest font-bold flex items-center gap-1" data-id="${escapeHTML(item.id)}">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                Remove
              </button>
            </div>
          </div>
        </div>
      `;
      cartItemsContainer.insertAdjacentHTML('beforeend', itemHTML);
    });

    // Disable checkout if subtotal is 0 (i.e. no items are selected)
    if (subtotal === 0) {
      cartCheckoutBtn.disabled = true;
      cartCheckoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      cartCheckoutBtn.disabled = false;
      cartCheckoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    cartSubtotal.textContent = `₹${subtotal.toFixed(2)}`;
    cartTotal.textContent = `₹${subtotal.toFixed(2)}`;
    lucide.createIcons();

    // Listeners for checkbox selection changes
    document.querySelectorAll('.cart-item-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-id');
        const item = state.cart.find(i => i.id.toString() === id.toString());
        if (item) {
          item.selected = cb.checked;
          localStorage.setItem('cart', JSON.stringify(state.cart));
          renderCart();
        }
      });
    });

    // Listeners for quantity actions
    document.querySelectorAll('.cart-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        updateCartQuantity(id, -1);
      });
    });

    document.querySelectorAll('.cart-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        updateCartQuantity(id, 1);
      });
    });

    document.querySelectorAll('.cart-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        removeFromCart(id);
      });
    });
  }

  function updateCartQuantity(id, delta) {
    const item = state.cart.find(i => i.id.toString() === id.toString());
    if (item) {
      item.quantity += delta;
      if (item.quantity <= 0) {
        state.cart = state.cart.filter(i => i.id.toString() !== id.toString());
      }
      localStorage.setItem('cart', JSON.stringify(state.cart));
      renderCart();
    }
  }

  function removeFromCart(id) {
    const item = state.cart.find(i => i.id.toString() === id.toString());
    const name = item ? item.title : 'Item';
    state.cart = state.cart.filter(i => i.id.toString() !== id.toString());
    localStorage.setItem('cart', JSON.stringify(state.cart));
    renderCart();
    showToast(`Removed ${name} from cart`, 'info');
  }

  // ================= 5. CART DRAWER ANIMATION =================
  function openCartDrawer() {
    cartDrawer.classList.remove('hidden');
    setTimeout(() => {
      cartOverlay.classList.remove('opacity-0');
      cartOverlay.classList.add('opacity-100');
      cartPanel.classList.remove('translate-x-full');
      cartPanel.classList.add('translate-x-0');
    }, 10);
  }

  function closeCartDrawer() {
    cartOverlay.classList.add('opacity-0');
    cartOverlay.classList.remove('opacity-100');
    cartPanel.classList.add('translate-x-full');
    cartPanel.classList.remove('translate-x-0');
    setTimeout(() => {
      cartDrawer.classList.add('hidden');
    }, 300);
  }

  cartBtn.addEventListener('click', openCartDrawer);
  cartCloseBtn.addEventListener('click', closeCartDrawer);
  cartOverlay.addEventListener('click', closeCartDrawer);

  // ================= 6. PRODUCT QUICK VIEW MODAL =================
  function openProductModal(product) {
    activeQuickViewProduct = product;
    productModalImage.src = product.image;
    productModalCategory.textContent = product.category;
    productModalTitle.textContent = product.title;
    productModalPrice.textContent = `₹${product.price}`;
    productModalDesc.textContent = product.description || "";
    pmQty.textContent = '1';

    // Subcategory
    const subcatEl = document.getElementById('product-modal-subcategory');
    const dividerEl = document.getElementById('product-modal-subcat-divider');
    if (subcatEl && dividerEl) {
      if (product.subcategory) {
        subcatEl.textContent = product.subcategory;
        subcatEl.classList.remove('hidden');
        dividerEl.classList.remove('hidden');
      } else {
        subcatEl.classList.add('hidden');
        dividerEl.classList.add('hidden');
      }
    }

    // SKU
    const skuEl = document.getElementById('product-modal-sku');
    if (skuEl) {
      if (product.sku) {
        skuEl.textContent = `SKU: ${product.sku}`;
        skuEl.classList.remove('hidden');
      } else {
        skuEl.classList.add('hidden');
      }
    }

    // Brand
    const brandEl = document.getElementById('product-modal-brand');
    if (brandEl) {
      if (product.brand) {
        brandEl.textContent = product.brand;
        brandEl.classList.remove('hidden');
      } else {
        brandEl.classList.add('hidden');
      }
    }

    // Pricing (Original, discount)
    const origPriceEl = document.getElementById('product-modal-price-original');
    const discountEl = document.getElementById('product-modal-discount');
    if (origPriceEl && discountEl) {
      if (product.discount && parseFloat(product.discount) > 0 && product.originalPrice) {
        origPriceEl.textContent = `₹${parseFloat(product.originalPrice).toFixed(2)}`;
        origPriceEl.classList.remove('hidden');
        discountEl.textContent = `${parseFloat(product.discount)}% OFF`;
        discountEl.classList.remove('hidden');
      } else {
        origPriceEl.classList.add('hidden');
        discountEl.classList.add('hidden');
      }
    }

    // Stock & Availability
    const stockContainer = document.getElementById('product-modal-stock-container');
    const stockStatus = document.getElementById('product-modal-stock-status');
    const stockQty = document.getElementById('product-modal-stock-qty');
    if (stockContainer && stockStatus && stockQty) {
      if (product.availabilityStatus || product.stock !== undefined) {
        const avail = product.availabilityStatus || 'In Stock';
        stockStatus.textContent = avail;
        
        // Colors & backgrounds for availability status
        stockStatus.className = 'font-bold px-2 py-0.5 rounded-full text-[10px] ';
        if (avail === 'In Stock') {
          stockStatus.className += 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
        } else if (avail === 'Out of Stock') {
          stockStatus.className += 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
        } else {
          stockStatus.className += 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400';
        }

        if (product.stock !== undefined && product.stock !== null) {
          stockQty.textContent = `(${product.stock} left)`;
          stockQty.classList.remove('hidden');
        } else {
          stockQty.classList.add('hidden');
        }
        stockContainer.classList.remove('hidden');
      } else {
        stockContainer.classList.add('hidden');
      }
    }

    // Specifications
    const specsContainer = document.getElementById('product-modal-specs-container');
    const specMat = document.getElementById('pm-spec-material');
    const specFit = document.getElementById('pm-spec-fit');
    const specSleeve = document.getElementById('pm-spec-sleeve');
    const specNeck = document.getElementById('pm-spec-neck');
    const specOccasion = document.getElementById('pm-spec-occasion');
    const specOrigin = document.getElementById('pm-spec-origin');
    const specWashing = document.getElementById('pm-spec-washing');

    if (specsContainer) {
      let hasSpecs = false;

      // Helper to show/hide specific spec rows
      const setSpecField = (val, el, rowId) => {
        const row = document.getElementById(rowId);
        if (val && el) {
          el.textContent = val;
          if (row) row.classList.remove('hidden');
          hasSpecs = true;
        } else if (row) {
          row.classList.add('hidden');
        }
      };

      setSpecField(product.material, specMat, 'spec-material-row');
      setSpecField(product.fitType, specFit, 'spec-fit-row');
      setSpecField(product.sleeveType, specSleeve, 'spec-sleeve-row');
      setSpecField(product.neckType, specNeck, 'spec-neck-row');
      setSpecField(product.occasion, specOccasion, 'spec-occasion-row');
      setSpecField(product.origin, specOrigin, 'spec-origin-row');
      setSpecField(product.washingInstructions, specWashing, 'spec-washing-row');

      if (hasSpecs) {
        specsContainer.classList.remove('hidden');
      } else {
        specsContainer.classList.add('hidden');
      }
    }

    const thumbnailsContainer = document.getElementById('product-modal-thumbnails');
    if (thumbnailsContainer) {
      if (product.images && product.images.length > 1) {
        thumbnailsContainer.innerHTML = '';
        product.images.forEach((img, idx) => {
          const thumb = document.createElement('img');
          thumb.src = img;
          thumb.className = `h-full aspect-square object-cover rounded cursor-pointer border-2 ${idx === 0 ? 'border-zinc-950 dark:border-white' : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'} transition-colors`;
          thumb.onclick = () => {
            productModalImage.src = img;
            Array.from(thumbnailsContainer.children).forEach(c => {
              c.classList.remove('border-zinc-950', 'dark:border-white');
              c.classList.add('border-transparent');
            });
            thumb.classList.remove('border-transparent');
            thumb.classList.add('border-zinc-950', 'dark:border-white');
          };
          thumbnailsContainer.appendChild(thumb);
        });
        thumbnailsContainer.classList.remove('hidden');
      } else {
        thumbnailsContainer.classList.add('hidden');
      }
    }

    const colorsContainer = document.getElementById('product-modal-colors-container');
    const colorsList = document.getElementById('product-modal-colors');
    if (colorsContainer && colorsList) {
      if (product.colors && product.colors.length > 0) {
        colorsList.innerHTML = '';
        product.colors.forEach(color => {
          colorsList.innerHTML += `<div class="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:scale-110 transition-transform" style="background-color: ${color}"></div>`;
        });
        colorsContainer.classList.remove('hidden');
      } else {
        colorsContainer.classList.add('hidden');
      }
    }

    const sizesContainer = document.getElementById('product-modal-sizes-container');
    const sizesList = document.getElementById('product-modal-sizes');
    if (sizesContainer && sizesList) {
      if (product.sizes && product.sizes.length > 0) {
        sizesList.innerHTML = '';
        product.sizes.forEach(size => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = size;
          btn.className = 'size-option px-3 py-1.5 text-xs font-bold border border-zinc-300 dark:border-zinc-600 rounded text-zinc-700 dark:text-zinc-200 hover:border-zinc-950 dark:hover:border-white hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-all';
          btn.addEventListener('click', () => {
            // Toggle active
            sizesList.querySelectorAll('.size-option').forEach(b => {
              b.classList.remove('bg-zinc-950', 'dark:bg-white', 'text-white', 'dark:text-black', 'border-zinc-950');
            });
            btn.classList.add('bg-zinc-950', 'dark:bg-white', 'text-white', 'dark:text-black', 'border-zinc-950');
          });
          sizesList.appendChild(btn);
        });
        sizesContainer.classList.remove('hidden');
      } else {
        sizesContainer.classList.add('hidden');
      }
    }

    productModal.classList.remove('hidden');
    setTimeout(() => {
      productModalOverlay.classList.remove('opacity-0');
      productModalOverlay.classList.add('opacity-100');
      productModalCard.classList.remove('scale-95', 'opacity-0');
      productModalCard.classList.add('scale-100', 'opacity-100');
    }, 10);
  }

  function closeProductModal() {
    productModalOverlay.classList.add('opacity-0');
    productModalOverlay.classList.remove('opacity-100');
    productModalCard.classList.add('scale-95', 'opacity-0');
    productModalCard.classList.remove('scale-100', 'opacity-100');
    setTimeout(() => {
      productModal.classList.add('hidden');
      activeQuickViewProduct = null;
    }, 300);
  }

  productModalClose.addEventListener('click', closeProductModal);
  productModalOverlay.addEventListener('click', closeProductModal);

  pmQtyMinus.addEventListener('click', () => {
    let q = parseInt(pmQty.textContent);
    if (q > 1) {
      pmQty.textContent = (q - 1).toString();
    }
  });

  pmQtyPlus.addEventListener('click', () => {
    let q = parseInt(pmQty.textContent);
    pmQty.textContent = (q + 1).toString();
  });

  pmAddToCart.addEventListener('click', () => {
    if (activeQuickViewProduct) {
      // Auth guard
      const savedUser = JSON.parse(localStorage.getItem('auth_user'));
      const isLoggedIn = savedUser && savedUser.name && savedUser.email && savedUser.email !== 'N/A';
      if (!isLoggedIn) {
        closeProductModal();
        openAuthModal();
        return;
      }
      const sizesList = document.getElementById('product-modal-sizes');
      const selectedSizeBtn = sizesList ? sizesList.querySelector('.size-option[class*="bg-zinc-950"]') : null;
      const hasSizes = activeQuickViewProduct.sizes && activeQuickViewProduct.sizes.length > 0;
      const selectedSize = selectedSizeBtn ? selectedSizeBtn.textContent : null;
      if (hasSizes && !selectedSize) {
        showToast('Please select a size first!', 'alert-circle');
        return;
      }
      const quantity = parseInt(pmQty.textContent);
      addToCart({ ...activeQuickViewProduct, selectedSize }, quantity);
      closeProductModal();
    }
  });

  const pmBuyNow = document.getElementById('pm-buy-now');
  if (pmBuyNow) {
    pmBuyNow.addEventListener('click', () => {
      if (activeQuickViewProduct) {
        // Auth guard
        const savedUser = JSON.parse(localStorage.getItem('auth_user'));
        const isLoggedIn = savedUser && savedUser.name && savedUser.email && savedUser.email !== 'N/A';
        if (!isLoggedIn) {
          closeProductModal();
          openAuthModal();
          return;
        }
        const sizesList = document.getElementById('product-modal-sizes');
        const selectedSizeBtn = sizesList ? sizesList.querySelector('.size-option[class*="bg-zinc-950"]') : null;
        const hasizes = activeQuickViewProduct.sizes && activeQuickViewProduct.sizes.length > 0;
        const selectedSize = selectedSizeBtn ? selectedSizeBtn.textContent : null;
        if (hasizes && !selectedSize) {
          showToast('Please select a size first!', 'alert-circle');
          return;
        }
        const quantity = parseInt(pmQty.textContent);
        const directItem = { ...activeQuickViewProduct, selectedSize, quantity };
        closeProductModal();
        openCheckoutModal(directItem);
      }
    });
  }

  // ================= 7. SECURE CHECKOUT FLOW =================
  let directCheckoutItem = null;

  function openCheckoutModal(directItem = null) {
    if (directItem && !directItem.id) directItem = null; // safety check
    directCheckoutItem = directItem;
    // Populate Order Summary
    checkoutItemsList.innerHTML = '';
    let subtotal = 0;
    
    const itemsToCheckout = directItem ? [directItem] : state.cart.filter(item => item.selected !== false);

    itemsToCheckout.forEach(item => {
      const itemSubtotal = parseFloat(item.price) * item.quantity;
      subtotal += itemSubtotal;
      
      const itemHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-darkBorder rounded overflow-hidden flex-shrink-0">
            <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" class="w-full h-full object-cover">
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-[11px] font-bold uppercase tracking-wider truncate">${escapeHTML(item.title)}</h4>
            <p class="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">${escapeHTML(item.quantity)} x ₹${escapeHTML(item.price)}</p>
          </div>
          <span class="text-[11px] font-bold text-zinc-900 dark:text-white flex-shrink-0">₹${itemSubtotal.toFixed(2)}</span>
        </div>
      `;
      checkoutItemsList.insertAdjacentHTML('beforeend', itemHTML);
    });

    const shippingCost = 15.00;
    const totalCost = subtotal + shippingCost;

    checkoutSubtotal.textContent = `₹${subtotal.toFixed(2)}`;
    checkoutShipping.textContent = `₹${shippingCost.toFixed(2)}`;
    checkoutTotal.textContent = `₹${totalCost.toFixed(2)}`;

    // Reset steps
    stepShippingIndicator.className = "text-black dark:text-white border-b-2 border-black dark:border-white pb-1";
    stepPaymentIndicator.className = "text-zinc-400 pb-1";
    checkoutStepShipping.classList.remove('hidden');
    checkoutStepPayment.classList.add('hidden');

    // Prefill user details if authenticated
    const savedUser = JSON.parse(localStorage.getItem('auth_user'));
    if (savedUser) {
      checkoutName.value = savedUser.name || '';
      checkoutEmail.value = savedUser.email || '';
    }

    checkoutModal.classList.remove('hidden');
    setTimeout(() => {
      checkoutModalCard.classList.remove('scale-95', 'opacity-0');
      checkoutModalCard.classList.add('scale-100', 'opacity-100');
    }, 10);
  }

  function closeCheckoutModal() {
    checkoutModalCard.classList.add('scale-95', 'opacity-0');
    checkoutModalCard.classList.remove('scale-100', 'opacity-100');
    setTimeout(() => {
      checkoutModal.classList.add('hidden');
      checkoutForm.reset();
    }, 300);
  }

  cartCheckoutBtn.addEventListener('click', () => {
    // Auth guard: require login before checkout
    const savedUser = JSON.parse(localStorage.getItem('auth_user'));
    const isLoggedIn = savedUser && savedUser.name && savedUser.email && savedUser.email !== 'N/A';
    if (!isLoggedIn) {
      closeCartDrawer();
      openAuthModal();
      return;
    }
    closeCartDrawer();
    openCheckoutModal();
  });

  document.querySelectorAll('.checkout-close-btn, .checkout-close-overlay').forEach(el => {
    el.addEventListener('click', closeCheckoutModal);
  });

  // Step Switchers
  btnNextToPayment.addEventListener('click', () => {
    const checkoutPhone = document.getElementById('checkout-phone');
    const checkoutLocality = document.getElementById('checkout-locality');
    const checkoutState = document.getElementById('checkout-state');
    // Validate Step 1 Inputs
    if (checkoutName.reportValidity() && checkoutPhone.reportValidity() && checkoutAddress.reportValidity() && checkoutLocality.reportValidity() && checkoutCity.reportValidity() && checkoutState.reportValidity() && checkoutPostal.reportValidity()) {
      checkoutStepShipping.classList.add('hidden');
      checkoutStepPayment.classList.remove('hidden');
      stepShippingIndicator.className = "text-zinc-400 pb-1";
      stepPaymentIndicator.className = "text-black dark:text-white border-b-2 border-black dark:border-white pb-1";
    }
  });

  btnBackToShipping.addEventListener('click', () => {
    checkoutStepPayment.classList.add('hidden');
    checkoutStepShipping.classList.remove('hidden');
    stepPaymentIndicator.className = "text-zinc-400 pb-1";
    stepShippingIndicator.className = "text-black dark:text-white border-b-2 border-black dark:border-white pb-1";
  });

  // Payment Options Accordion Logic
  const paymentRadios = document.querySelectorAll('input[name="payment_method"]');
  const paymentDetails = document.querySelectorAll('.payment-details');
  const paymentContainers = document.querySelectorAll('#payment-methods-accordion > div');

  paymentRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      // Hide all details and remove active bg
      paymentDetails.forEach(detail => detail.classList.add('hidden'));
      paymentContainers.forEach(container => {
        container.classList.remove('bg-zinc-50', 'dark:bg-zinc-800/50');
      });

      // Show selected detail and add active bg
      if (e.target.checked) {
        const detailId = `pay-details-${e.target.value}`;
        const detailEl = document.getElementById(detailId);
        if (detailEl) {
          detailEl.classList.remove('hidden');
          detailEl.parentElement.classList.add('bg-zinc-50', 'dark:bg-zinc-800/50');
        }
      }
    });
  });

  checkoutForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = checkoutName.value;
    const email = checkoutEmail.value;
    const phone = document.getElementById('checkout-phone').value;
    const address = checkoutAddress.value;
    const locality = document.getElementById('checkout-locality').value;
    const city = checkoutCity.value;
    const stateVal = document.getElementById('checkout-state').value;
    const postal = checkoutPostal.value;
    const landmark = document.getElementById('checkout-landmark').value;
    const altPhone = document.getElementById('checkout-alt-phone').value;
    const addressType = document.querySelector('input[name="address_type"]:checked')?.value || 'Home';
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'upi';

    const date = new Date();

    const itemsToCheckout = directCheckoutItem ? [directCheckoutItem] : state.cart.filter(item => item.selected !== false);
    const subtotal = itemsToCheckout.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
    const shippingCost = 15.00;
    const totalCost = subtotal + shippingCost;
    const orderId = 'ORD-' + Math.floor(Math.random() * 90000 + 10000);

    const newOrder = {
      id: orderId,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      customerAddress: `${address}, ${locality}, ${city}, ${stateVal} - ${postal}`,
      landmark: landmark,
      altPhone: altPhone,
      addressType: addressType,
      paymentMethod: paymentMethod.toUpperCase(),
      total: totalCost.toFixed(2),
      itemsCount: itemsToCheckout.reduce((sum, item) => sum + item.quantity, 0),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      status: 'Processing',
      items: itemsToCheckout.map(i => ({ title: i.title, quantity: i.quantity, price: i.price }))
    };

    // Save order – Supabase first, localStorage as fallback
    state.orders.unshift(newOrder);
    if (window.DB) {
      window.DB.insertOrder(newOrder); // async – fire-and-forget
    } else {
      localStorage.setItem('orders', JSON.stringify(state.orders));
    }

    if (!directCheckoutItem) {
      // Clear only checked out items from Cart
      state.cart = state.cart.filter(item => item.selected === false);
      localStorage.setItem('cart', JSON.stringify(state.cart));
      renderCart();
    }
    
    directCheckoutItem = null;

    // Checkoff dashboard checklist triggers
    let checklist = JSON.parse(localStorage.getItem('checklist')) || {};
    checklist['stripe'] = true;
    localStorage.setItem('checklist', JSON.stringify(checklist));

    closeCheckoutModal();
    showOrderSuccessModal(orderId, `₹${totalCost.toFixed(2)}`, paymentMethod.toUpperCase());
  });

  // ================= 8. USER PROFILE DROPDOWN MENU =================
  function openAuthModal() {
    const authModal = document.getElementById('auth-modal');
    const authModalCard = document.getElementById('auth-modal-card');
    if (!authModal || !authModalCard) return;
    authModal.classList.remove('hidden');
    setTimeout(() => {
      authModalCard.classList.remove('scale-95', 'opacity-0');
      authModalCard.classList.add('scale-100', 'opacity-100');
    }, 10);
  }

  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;

  function closeAuthModal() {
    const authModal = document.getElementById('auth-modal');
    const authModalCard = document.getElementById('auth-modal-card');
    authModalCard.classList.add('scale-95', 'opacity-0');
    authModalCard.classList.remove('scale-100', 'opacity-100');
    setTimeout(() => {
      authModal.classList.add('hidden');
    }, 300);
  }

  navSigninBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isAuth = localStorage.getItem('auth_completed') === 'true';
    if (isAuth) {
      userDropdown.classList.toggle('hidden');
    } else if (typeof window.openAuthModal === 'function') {
      window.openAuthModal();
    } else {
      openAuthModal();
    }
  });

  // Click outside to close dropdown
  document.addEventListener('click', () => {
    userDropdown.classList.add('hidden');
  });

  userDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Sign out
  btnSignout.addEventListener('click', () => {
    localStorage.removeItem('auth_completed');
    localStorage.removeItem('auth_user');
    
    // Reset Header UI
    navSigninBtn.innerHTML = `<i data-lucide="user" class="w-3.5 h-3.5"></i> <span>Sign In</span>`;
    navOrdersBtn.classList.add('hidden');
    navOrdersBtn.classList.remove('flex');
    lucide.createIcons();
    userDropdown.classList.add('hidden');
    
    showToast("Successfully signed out.", 'info');
  });

  // Google GSI integration callback handler
  window.handleCredentialResponse = function(response) {
    const payload = decodeJwtResponse(response.credential);
    if (payload) {
      localStorage.setItem('auth_completed', 'true');
      localStorage.setItem('auth_user', JSON.stringify({
        name: payload.name,
        email: payload.email,
        picture: payload.picture
      }));
      
      const loginEntry = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        time: new Date().toLocaleString()
      };
      // Persist login to Supabase
      if (window.DB) {
        window.DB.insertLogin(loginEntry);
      } else {
        const logins = JSON.parse(localStorage.getItem('user_logins')) || [];
        logins.unshift(loginEntry);
        localStorage.setItem('user_logins', JSON.stringify(logins));
      }
      
      closeAuthModal();
      updateUserHeader(payload.name, payload.picture);
      showRegistrationSuccess(payload.name);
    }
  }

  function decodeJwtResponse(token) {
    try {
      let base64Url = token.split('.')[1];
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      let jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch(e) {
      return null;
    }
  }

  function updateUserHeader(name, pictureUrl) {
    if (pictureUrl) {
      navSigninBtn.innerHTML = `<img src="${escapeHTML(pictureUrl)}" class="w-5 h-5 rounded-full object-cover flex-shrink-0"> <span class="truncate max-w-[80px]">${escapeHTML(name.split(' ')[0])}</span>`;
    } else {
      navSigninBtn.innerHTML = `<i data-lucide="user" class="w-3.5 h-3.5 flex-shrink-0"></i> <span>${escapeHTML(name.split(' ')[0])}</span>`;
    }
    navSigninBtn.classList.add('flex', 'items-center', 'gap-1.5');
    navOrdersBtn.classList.remove('hidden');
    navOrdersBtn.classList.add('flex');
    lucide.createIcons();
  }

  if (navOrdersBtn) {
    navOrdersBtn.addEventListener('click', openOrdersModal);
  }



  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name   = document.getElementById('reg-name').value;
      const email  = document.getElementById('reg-email').value;
      const phone  = document.getElementById('reg-phone').value;
      const gender = document.getElementById('reg-gender').value;
      const now    = new Date().toLocaleString();

      const regEntry = { name, email, phone, gender, date: now };
      const loginEntry = { name, email, picture: '', time: now };

      // Persist registration & login to Supabase (fire-and-forget)
      if (window.DB) {
        window.DB.insertRegistration(regEntry);
        window.DB.insertLogin(loginEntry);
      } else {
        const registrations = JSON.parse(localStorage.getItem('customer_registrations')) || [];
        registrations.unshift(regEntry);
        localStorage.setItem('customer_registrations', JSON.stringify(registrations));

        const logins = JSON.parse(localStorage.getItem('user_logins')) || [];
        logins.unshift(loginEntry);
        localStorage.setItem('user_logins', JSON.stringify(logins));
      }

      // Log them in locally
      localStorage.setItem('auth_completed', 'true');
      localStorage.setItem('auth_user', JSON.stringify({ name, email, picture: '' }));

      closeAuthModal();
      updateUserHeader(name, '');
      showRegistrationSuccess(name);
    });
  }



  // ====== COLORFUL REGISTRATION SUCCESS CELEBRATION ======
  function showRegistrationSuccess(name) {
    const overlay = document.getElementById('reg-success-overlay');
    const card = document.getElementById('reg-success-card');
    const nameEl = document.getElementById('reg-success-name');
    const closeBtn = document.getElementById('reg-success-close');
    const confettiContainer = document.getElementById('confetti-container');

    if (!overlay || !card) return;

    // Set personalized name
    if (nameEl) nameEl.textContent = `Hey, ${name}! 👋`;

    // Generate confetti pieces
    if (confettiContainer) {
      confettiContainer.innerHTML = '';
      const colors = ['#a855f7','#ec4899','#f97316','#eab308','#22c55e','#3b82f6','#ef4444','#14b8a6'];
      for (let i = 0; i < 60; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.top = '-20px';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.width = (Math.random() * 8 + 6) + 'px';
        piece.style.height = (Math.random() * 8 + 6) + 'px';
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
        piece.style.animationDelay = (Math.random() * 1.5) + 's';
        confettiContainer.appendChild(piece);
      }
    }

    // Show overlay
    overlay.classList.remove('hidden');

    // Animate card in
    setTimeout(() => {
      card.classList.remove('scale-50', 'opacity-0');
      card.classList.add('scale-100', 'opacity-100', 'shown');
    }, 30);

    // Close handler
    function closeSuccess() {
      card.classList.remove('scale-100', 'opacity-100', 'shown');
      card.classList.add('scale-50', 'opacity-0');
      setTimeout(() => {
        overlay.classList.add('hidden');
        if (confettiContainer) confettiContainer.innerHTML = '';
      }, 400);
    }

    if (closeBtn) {
      closeBtn.onclick = closeSuccess;
    }

    // Auto-dismiss after 4 seconds
    setTimeout(closeSuccess, 4000);
  }


  function initGoogleSignIn() {
    const container = document.getElementById("google-signin-btn-container");
    if (container && window.google && window.google.accounts) {
      google.accounts.id.initialize({
        client_id: "447597510034-duiln6tn6rjc8bhfcsh89j7cdfms561a.apps.googleusercontent.com",
        callback: window.handleCredentialResponse
      });
      google.accounts.id.renderButton(
        container,
        { 
          theme: state.darkMode ? "filled_black" : "outline", 
          size: "large", 
          text: "signup_with",
          shape: "rectangular",
          width: "280"
        }
      );
    } else if (container) {
      setTimeout(initGoogleSignIn, 500);
    }
  }

  // ================= 9. ORDERS HISTORY MODAL =================
  function openOrdersModal() {
    ordersListContainer.innerHTML = '';
    userDropdown.classList.add('hidden');

    if (state.orders.length === 0) {
      ordersListContainer.innerHTML = `
        <div class="py-12 text-center text-xs text-zinc-400">
          <i data-lucide="package" class="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-650"></i>
          No orders placed yet.
        </div>
      `;
      lucide.createIcons();
    } else {
      state.orders.forEach(order => {
        let itemsHtml = (order.items || []).map(i => `<li class="flex justify-between"><span>${escapeHTML(i.title)} (x${escapeHTML(i.quantity)})</span><span>₹${escapeHTML((parseFloat(i.price)*i.quantity).toFixed(2))}</span></li>`).join('');
        if (!itemsHtml) {
          itemsHtml = `<li class="flex justify-between"><span>Sandbox Item</span><span>₹${escapeHTML(order.total)}</span></li>`;
        }

        let processingActive = true;
        let shippedActive = (order.status === 'Shipped' || order.status === 'Delivered');
        let deliveredActive = (order.status === 'Delivered');

        let progressWidth = '0%';
        if (order.status === 'Shipped') progressWidth = '50%';
        if (order.status === 'Delivered') progressWidth = '100%';

        const confirmedTime = order.date || '—';
        const shippedTime   = order.shippedAt   || 'Pending';
        const deliveredTime = order.deliveredAt || 'Pending';

        const orderHTML = `
          <div class="border border-zinc-200 dark:border-darkBorder rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-zinc-950 dark:text-white">${escapeHTML(order.id)}</span>
              <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                ${order.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                  order.status === 'Shipped'   ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}">${escapeHTML(order.status)}</span>
            </div>

            <div class="h-px bg-zinc-200 dark:bg-darkBorder"></div>

            <ul class="text-[10px] text-zinc-500 space-y-1">
              ${itemsHtml}
            </ul>

            <div class="h-px bg-zinc-200 dark:border-darkBorder"></div>

            <div class="flex items-center justify-between text-[10px] font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              <span>Date: ${escapeHTML(order.date)}</span>
              <span>Total Paid: ₹${escapeHTML(order.total)}</span>
            </div>

            <!-- Tracking Timeline -->
            <div class="mt-3 pt-3 border-t border-zinc-200 dark:border-darkBorder">
              <p class="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Order Tracking</p>
              <div class="relative flex items-start justify-between px-1">

                <!-- Connector background -->
                <div class="absolute top-3.5 left-[calc(16.66%)] right-[calc(16.66%)] h-0.5 bg-zinc-200 dark:bg-zinc-800 z-0">
                  <div class="h-full bg-green-500 transition-all duration-500 rounded"
                    style="width: ${progressWidth};"></div>
                </div>

                <!-- Step 1: Confirmed -->
                <div class="flex flex-col items-center z-10 flex-1">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center bg-green-500 shadow shadow-green-200 dark:shadow-green-900">
                    <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <span class="text-[8px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400 mt-1.5 leading-tight text-center">Confirmed</span>
                  <span class="text-[7px] text-zinc-400 mt-0.5 text-center leading-tight max-w-[60px]">${confirmedTime}</span>
                </div>

                <!-- Step 2: Shipped -->
                <div class="flex flex-col items-center z-10 flex-1">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center
                    ${shippedActive ? 'bg-green-500 shadow shadow-green-200 dark:shadow-green-900' : 'bg-zinc-200 dark:bg-zinc-700 border-2 border-zinc-300 dark:border-zinc-600'}">
                    <svg class="w-3.5 h-3.5 ${shippedActive ? 'text-white' : 'text-zinc-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                  <span class="text-[8px] font-bold uppercase tracking-wide ${shippedActive ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'} mt-1.5 leading-tight text-center">Shipped</span>
                  <span class="text-[7px] ${shippedActive ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-300 dark:text-zinc-600'} mt-0.5 text-center leading-tight max-w-[60px]">${shippedTime}</span>
                </div>

                <!-- Step 3: Delivered -->
                <div class="flex flex-col items-center z-10 flex-1">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center
                    ${deliveredActive ? 'bg-green-500 shadow shadow-green-200 dark:shadow-green-900' : 'bg-zinc-200 dark:bg-zinc-700 border-2 border-zinc-300 dark:border-zinc-600'}">
                    <svg class="w-3.5 h-3.5 ${deliveredActive ? 'text-white' : 'text-zinc-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  <span class="text-[8px] font-bold uppercase tracking-wide ${deliveredActive ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'} mt-1.5 leading-tight text-center">Delivered</span>
                  <span class="text-[7px] ${deliveredActive ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-300 dark:text-zinc-600'} mt-0.5 text-center leading-tight max-w-[60px]">${deliveredTime}</span>
                </div>

              </div>
            </div>
          </div>
        `;
        ordersListContainer.insertAdjacentHTML('beforeend', orderHTML);
      });
    }

    ordersModal.classList.remove('hidden');
    setTimeout(() => {
      ordersModalOverlay.classList.remove('opacity-0');
      ordersModalOverlay.classList.add('opacity-100');
      ordersModalCard.classList.remove('scale-95', 'opacity-0');
      ordersModalCard.classList.add('scale-100', 'opacity-100');
    }, 10);
  }

  function closeOrdersModal() {
    ordersModalOverlay.classList.add('opacity-0');
    ordersModalOverlay.classList.remove('opacity-100');
    ordersModalCard.classList.add('scale-95', 'opacity-0');
    ordersModalCard.classList.remove('scale-100', 'opacity-100');
    setTimeout(() => {
      ordersModal.classList.add('hidden');
    }, 300);
  }

  btnShowOrders.addEventListener('click', openOrdersModal);
  ordersModalClose.addEventListener('click', closeOrdersModal);
  ordersModalOverlay.addEventListener('click', closeOrdersModal);

  // ================= 10. FILTERING & SEARCH & SORT =================
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderCatalog();
  });

  categoryFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    
    // Toggle active classes
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.className = "filter-btn px-3 py-2 rounded bg-white dark:bg-darkCard hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-darkBorder text-zinc-600 dark:text-zinc-300";
    });
    btn.className = "filter-btn px-3 py-2 rounded bg-black dark:bg-white text-white dark:text-black";

    state.selectedCategory = btn.getAttribute('data-category');
    renderCatalog();
  });

  sortSelect.addEventListener('change', (e) => {
    state.sortOption = e.target.value;
    renderCatalog();
  });

  // ================= 11. TOAST SYSTEM =================
  function showToast(message, iconName = 'check-circle', duration = 4000) {
    toastMsg.textContent = message;
    toastIcon.outerHTML = `<i data-lucide="${iconName}" id="toast-icon" class="w-4 h-4 text-white dark:text-black"></i>`;
    lucide.createIcons();

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, duration);
  }

  // ================= 12. SIDE NAVIGATION DRAWER =================
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const navDrawer = document.getElementById('nav-drawer');
  const navOverlay = document.getElementById('nav-overlay');
  const navPanel = document.getElementById('nav-panel');
  const navCloseBtn = document.getElementById('nav-close-btn');
  const navDrawerLinks = document.querySelectorAll('.nav-drawer-link');
  const mobileDrawerOrders = document.getElementById('mobile-drawer-orders');
  const mobileDrawerCart = document.getElementById('mobile-drawer-cart');

  function openNavDrawer() {
    navDrawer.classList.remove('hidden');
    setTimeout(() => {
      navOverlay.classList.remove('opacity-0');
      navOverlay.classList.add('opacity-100');
      navPanel.classList.remove('-translate-x-full');
      navPanel.classList.add('translate-x-0');
    }, 10);
  }

  function closeNavDrawer() {
    navOverlay.classList.remove('opacity-100');
    navOverlay.classList.add('opacity-0');
    navPanel.classList.remove('translate-x-0');
    navPanel.classList.add('-translate-x-full');
    setTimeout(() => {
      navDrawer.classList.add('hidden');
    }, 300);
  }

  // Bind mobile drawer events
  if (menuToggleBtn && navDrawer) {
    menuToggleBtn.addEventListener('click', openNavDrawer);
    navCloseBtn.addEventListener('click', closeNavDrawer);
    navOverlay.addEventListener('click', closeNavDrawer);
    
    if (mobileDrawerOrders) {
      mobileDrawerOrders.addEventListener('click', (e) => {
        e.preventDefault();
        closeNavDrawer();
        const isAuth = localStorage.getItem('auth_completed') === 'true';
        if (isAuth) {
          openOrdersModal();
        } else {
          openAuthModal();
        }
      });
    }
    if (mobileDrawerCart) {
      mobileDrawerCart.addEventListener('click', (e) => {
        e.preventDefault();
        closeNavDrawer();
        openCart();
      });
    }
  }

  navDrawerLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const cat = link.getAttribute('data-category');
      if (cat) {
        state.selectedCategory = cat;
        // Update active class on catalog page filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
          if (btn.getAttribute('data-category') === cat) {
            btn.className = "filter-btn px-3 py-2 rounded bg-black dark:bg-white text-white dark:text-black";
          } else {
            btn.className = "filter-btn px-3 py-2 rounded bg-white dark:bg-darkCard hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-darkBorder text-zinc-650 dark:text-zinc-300";
          }
        });
        renderCatalog();
      }
      closeNavDrawer();
    });
  });

  // ================= ORDER SUCCESS MODAL =================
  function showOrderSuccessModal(orderId, total, paymentMethod) {
    const modal    = document.getElementById('order-success-modal');
    const card     = document.getElementById('order-success-card');
    const circle   = document.getElementById('order-circle-draw');
    const ripple   = document.getElementById('order-ripple-ring');
    const closeBtn = document.getElementById('order-success-close');

    if (!modal || !card) return;

    // Format current date & time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const shortTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Fill in dynamic values
    document.getElementById('os-order-id').textContent      = orderId;
    document.getElementById('os-total').textContent         = total;
    document.getElementById('os-payment').textContent       = paymentMethod;
    document.getElementById('os-date').textContent          = `${dateStr}, ${timeStr}`;
    document.getElementById('os-confirmed-time').textContent = shortTime;

    // Reset animation state
    card.classList.remove('order-success-pop');
    card.style.opacity = '0';
    if (circle) { circle.style.strokeDashoffset = '226'; }
    if (ripple) { ripple.classList.remove('order-ripple'); }

    modal.classList.remove('hidden');

    // Trigger animations on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.classList.add('order-success-pop');
        card.style.opacity = '1';

        if (circle) {
          setTimeout(() => { circle.style.strokeDashoffset = '0'; }, 80);
        }
        if (ripple) {
          setTimeout(() => { ripple.classList.add('order-ripple'); }, 100);
        }
      });
    });

    // Close handler
    function closeModal() {
      card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9)';
      setTimeout(() => {
        modal.classList.add('hidden');
        card.style.transform = '';
        card.style.transition = '';
      }, 260);
    }

    closeBtn.onclick = closeModal;
    document.getElementById('order-success-overlay').onclick = closeModal;
  }

  // Initialize storefront UI
  init();
});
