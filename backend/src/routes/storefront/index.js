import express from 'express';
import products from './products.js';
import subcategories from './subcategories.js';
import categories from './categories.js';

const router = express.Router();

router.use('/products', products);
router.use('/subcategories', subcategories);
router.use('/categories', categories);

export default router;

