import api from './client'

// ── Products ────────────────────────────────────────────────
export const getProducts = (params) => api.get('/products', { params });
export const getProduct = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post('/products', data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data);
export const toggleProduct = (id, country) => api.patch(`/products/${id}/toggle${country ? `?country=${country}` : ''}`);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

// ── Categories ──────────────────────────────────────────────
export const getCategories = (country) => api.get('/categories', { params: { country } });
export const getCategory = (id) => api.get(`/categories/${id}`);
export const createCategory = (data) => api.post('/categories', data);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data);
export const deleteCategory = (id) => api.delete(`/categories/${id}`);
export const createSubcategory = (catId, data) => api.post(`/categories/${catId}/subcategories`, data);
export const updateSubcategory = (subId, data) => api.put(`/categories/subcategories/${subId}`, data);
export const importCategories = (formData) => api.post('/categories/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const reorderCategories = (items) => api.put('/categories/reorder', { items });
export const reorderSubcategories = (items) => api.put('/categories/subcategories/reorder', { items });

// ── Countries ───────────────────────────────────────────────
export const getCountries = () => api.get('/countries');

// ── Pricing ─────────────────────────────────────────────────
export const getPricing = (productId) => api.get(`/pricing/${productId}`);
export const updateAllPrices = (productId, prices) => api.put(`/pricing/${productId}`, { prices });
export const updateOnePrice = (productId, countryId, data) =>
  api.patch(`/pricing/${productId}/country/${countryId}`, data);

// ── Media ───────────────────────────────────────────────────
export const getMedia = (productId) => api.get(`/media/${productId}`);
export const deleteMedia = (mediaId) => api.delete(`/media/${mediaId}`);
export const setPrimaryMedia = (mediaId) => api.patch(`/media/${mediaId}/primary`);
export const uploadMedia = (formData, productId) =>
  api.post(`/media/upload?type=product&product_id=${productId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ── Fragrance Notes ──────────────────────────────────────────
export const getFragranceNotes = (productId) => api.get(`/products/${productId}/notes`);
export const upsertFragranceNote = (productId, data) => api.put(`/products/${productId}/notes`, data);

// ── Product Sizes ────────────────────────────────────────────
export const getSizes = (productId) => api.get(`/products/${productId}/sizes`);
export const setSizes = (productId, sizes) => api.put(`/products/${productId}/sizes`, { sizes });

// ── Product Country Config ───────────────────────────────────
export const getCountryConfigs = (productId) => api.get(`/products/${productId}/countries`);
export const setCountryConfigs = (productId, configs) => api.put(`/products/${productId}/countries`, { configs });

// ── Bundles ─────────────────────────────────────────────────
export const getBundles = () => api.get('/bundles');
export const getBundle = (productId) => api.get(`/bundles/${productId}`);
export const createBundle = (data) => api.post('/bundles', data);
export const updateBundle = (bundleId, items) => api.put(`/bundles/${bundleId}/items`, { items });
export const deleteBundle = (productId) => api.delete(`/bundles/${productId}`);

// ── Sales ───────────────────────────────────────────────────
export const logSale = (data) => api.post('/sales/log', data);
export const logBulkSales = (records) => api.post('/sales/log/bulk', { records });
export const getSalesReport = (params) => api.get('/sales/report', { params });

// ── Analytics ───────────────────────────────────────────────
export const getAnalyticsSummary = (params) => api.get('/analytics/summary', { params });
export const getMonthlySales = (params) => api.get('/analytics/monthly-sales', { params });
export const getTopProducts = (params) => api.get('/analytics/top-products', { params });
export const getLeastProducts = (params) => api.get('/analytics/least-products', { params });
export const getOrderStatus = (params) => api.get('/analytics/order-status', { params });
export const getRecentOrders = (params) => api.get('/analytics/recent-orders', { params });
export const getDeliveryPerformance = (params) => api.get('/analytics/delivery-performance', { params });
export const getCategorySales = (params) => api.get('/analytics/category-sales', { params });
export const getSubcategorySales = (params) => api.get('/analytics/subcategory-sales', { params });
export const getCategoryMonthly = (params) => api.get('/analytics/category-monthly', { params });
export const getAnalyticsCategories = () => api.get('/analytics/categories');
export const searchProducts = (params) => api.get('/analytics/product-search', { params });
export const getProductMonthlySales = (params) => api.get('/analytics/product-monthly', { params });
