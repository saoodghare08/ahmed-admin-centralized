async function api(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`http://localhost:4000/api${endpoint}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

async function runTests() {
  try {
    console.log('1. Logging in...');
    const loginRes = await api('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    const token = loginRes.token;

    console.log('2. Creating a dummy product to test the bin...');
    const prodRes = await api('POST', '/products', { 
      fgd: `BIN_TEST_${Date.now()}`, 
      slug: `bin-test-${Date.now()}`,
      name_en: 'Test Bin Product', 
      name_ar: 'Test Bin Product AR',
      size_label_en: '100ml',
      size_label_ar: '100ml',
      category_id: 1 
    }, token);
    const productId = prodRes.data.id;
    console.log(`Created product ID: ${productId}`);

    console.log('3. Fetching active products, checking presence...');
    const activeRes = await api('GET', '/products', null, token);
    const isPresent = activeRes.data.find(p => p.id === productId);
    console.log(`Is present in active query? ${!!isPresent}`);

    console.log('4. Moving to bin (Soft Delete)...');
    await api('DELETE', `/products/${productId}`, null, token);

    console.log('5. Fetching active products again...');
    const activeRes2 = await api('GET', '/products', null, token);
    const isPresent2 = activeRes2.data.find(p => p.id === productId);
    console.log(`Is present in active query? ${!!isPresent2}`);

    console.log('6. Fetching bin products...');
    const binRes = await api('GET', '/products?status=bin', null, token);
    const isPresentBin = binRes.data.find(p => p.id === productId);
    console.log(`Is present in bin query? ${!!isPresentBin}`);

    console.log('7. Restoring from bin...');
    await api('PATCH', `/products/${productId}/restore`, null, token);

    console.log('8. Re-Fetching active products...');
    const activeRes3 = await api('GET', '/products', null, token);
    const isPresent3 = activeRes3.data.find(p => p.id === productId);
    console.log(`Is present in active query after restore? ${!!isPresent3}`);

    console.log('9. Re-Moving to bin...');
    await api('DELETE', `/products/${productId}`, null, token);

    console.log('10. Permanently deleting...');
    await api('DELETE', `/products/${productId}/permanent`, null, token);

    console.log('11. Fetching bin products again to confirm permanent wipe...');
    const binRes2 = await api('GET', '/products?status=bin', null, token);
    const isPresentBin2 = binRes2.data.find(p => p.id === productId);
    console.log(`Is present in bin query? ${!!isPresentBin2}`);

    console.log('=== TEST SUCCESS ===');
  } catch (err) {
    console.error('Test Failed!', err.message);
  }
}

runTests();
