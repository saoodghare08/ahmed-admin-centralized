import express from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';

import users from './users.js';
import audit from './audit.js';
import countries from './countries.js';
import categories from './categories.js';
import products from './products.js';
import pricing from './pricing.js';
import media from './media.js';
import bundles from './bundles.js';
import sales from './sales.js';
import gallery from './gallery.js';
import importRoute from './import.js';
import analytics from './analytics.js';
import campaigns from './campaigns.js';
import sizes from './sizes.js';
import labels from './labels.js';

const router = express.Router();

// All admin routes require authentication
router.use(authenticate);

router.use('/users',       users);
router.use('/audit-logs',  audit);
router.use('/countries',   countries);
router.use('/categories',  authorize('categories'), categories);
router.use('/products',    authorize('products'),   products);
router.use('/sizes',       authorize('products'),   sizes);
router.use('/labels',      authorize('products'),   labels);
router.use('/pricing',     authorize('pricing'),    pricing);
router.use('/media',       authorize('products'),   media);
router.use('/bundles',     authorize('bundles'),    bundles);
router.use('/sales',       authorize('sales'),      sales);
router.use('/gallery',     authorize('gallery'),    gallery);
// 'products' permission is reused for imports
router.use('/import',      authorize('products'),   importRoute);
router.use('/analytics',   authorize('analytics'),  analytics);
router.use('/campaigns',   authorize('campaigns'),  campaigns);

export default router;
