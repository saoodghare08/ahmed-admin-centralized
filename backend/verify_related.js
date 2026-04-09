import fetch from 'node-fetch';

async function verify() {
  try {
    // Assuming product ID 1 exists and has a category
    const res = await fetch('http://localhost:4000/api/storefront/products/1');
    const data = await res.json();
    console.log("Product ID 1 Related Products:", data.related_prods?.length);
    if (data.related_prods?.length > 0) {
      console.log("First related product:", data.related_prods[0].product_name);
    }
  } catch (err) {
    console.error("Verification failed:", err.message);
  }
}

verify();
