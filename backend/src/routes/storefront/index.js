import express from 'express';
import products from './products.js';
import subcategories from './subcategories.js';

const router = express.Router();

router.use('/products', products);
router.use('/subcategories', subcategories);

export default router;
