import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runPipelineWithCache } from '../stylist_pipeline/run_pipeline.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Products JSON file path (same folder as cache.json)
const PRODUCTS_DIR = join(__dirname, '..', 'stylist_pipeline', 'cache_json');
const PRODUCTS_FILE = join(PRODUCTS_DIR, 'products.json');
const USERS_FILE = join(PRODUCTS_DIR, 'users.json');

function loadProducts() {
    try {
        if (existsSync(PRODUCTS_FILE)) {
            return JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));
        }
    } catch (err) {
        console.error('[PRODUCTS] Error loading products:', err.message);
    }
    return [];
}

function saveProducts(products) {
    try {
        if (!existsSync(PRODUCTS_DIR)) {
            mkdirSync(PRODUCTS_DIR, { recursive: true });
        }
        writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
        console.log('[PRODUCTS] Saved products to:', PRODUCTS_FILE);
        return true;
    } catch (err) {
        console.error('[PRODUCTS] Error saving products:', err.message);
        return false;
    }
}

function loadUsers() {
    try {
        if (existsSync(USERS_FILE)) {
            return JSON.parse(readFileSync(USERS_FILE, 'utf-8'));
        }
    } catch (err) {
        console.error('[USERS] Error loading users:', err.message);
    }
    return [];
}

function saveUsers(users) {
    try {
        if (!existsSync(PRODUCTS_DIR)) {
            mkdirSync(PRODUCTS_DIR, { recursive: true });
        }
        writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log('[USERS] Saved users to:', USERS_FILE);
        return true;
    } catch (err) {
        console.error('[USERS] Error saving users:', err.message);
        return false;
    }
}

// Default user body measurements for testing
const DEFAULT_USER_MEASUREMENTS = {
    chest_circumference: 112.7,
    waist_circumference: 102.76,
    hip_circumference: 107.5,
    shoulder_breadth: 42.3164,
    neck_circumference: 44.97,
    thigh_left_circumference: 67.01,
    ankle_left_circumference: 28.64,
    arm_right_length: 75.9968,
    inside_leg_height: 77.66,
    height: 172.72,
    styling_goals: ["look_taller", "look_slimmer"],
};

const PORT = 3456;

const server = createServer(async (req, res) => {
    // Parse URL to handle query strings
    const urlPath = req.url.split('?')[0];
    console.log(`[${req.method}] ${urlPath}`);

    // Serve the HTML file
    if (req.method === 'GET' && (urlPath === '/' || urlPath === '/index.html')) {
        try {
            const html = readFileSync(join(__dirname, 'pipeline_ui.html'), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading HTML: ' + err.message);
        }
        return;
    }

    // API endpoint to run pipeline
    if (req.method === 'POST' && urlPath === '/run-pipeline') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { product_text, product_image_url, user_measurements } = JSON.parse(body);

                console.log('\n=== PIPELINE REQUEST ===');
                console.log('Product Image URL:', product_image_url);
                console.log('Product Text Length:', product_text?.length || 0);
                console.log('User Measurements:', user_measurements ? 'provided' : 'using defaults');

                const productProfile = {
                    product_text: product_text || '',
                    product_image_url: product_image_url || '',
                    merged_attrs: {}
                };

                // Use provided user measurements or fall back to defaults
                const userMeasurements = user_measurements || DEFAULT_USER_MEASUREMENTS;

                // Run the pipeline with cache (handles extraction and caching automatically)
                const result = await runPipelineWithCache(
                    userMeasurements,
                    productProfile
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result, null, 2));
            } catch (err) {
                console.error('Pipeline error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message, stack: err.stack }));
            }
        });
        return;
    }

    // API endpoint to get products
    if (req.method === 'GET' && urlPath === '/products') {
        try {
            const products = loadProducts();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(products));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // API endpoint to add a product
    if (req.method === 'POST' && urlPath === '/add-product') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { name, product_text, product_image_url } = JSON.parse(body);

                if (!name || !name.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Product name is required' }));
                    return;
                }

                const products = loadProducts();

                // Check if product with same name exists
                const existingIndex = products.findIndex(p => p.name.toLowerCase() === name.trim().toLowerCase());

                const newProduct = {
                    name: name.trim(),
                    product_text: product_text || '',
                    product_image_url: product_image_url || '',
                    added_at: new Date().toISOString()
                };

                if (existingIndex >= 0) {
                    // Update existing product
                    products[existingIndex] = newProduct;
                    console.log('[PRODUCTS] Updated product:', name);
                } else {
                    // Add new product
                    products.push(newProduct);
                    console.log('[PRODUCTS] Added product:', name);
                }

                if (saveProducts(products)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, product: newProduct, total: products.length }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to save product' }));
                }
            } catch (err) {
                console.error('Add product error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // API endpoint to delete a product
    if (req.method === 'DELETE' && urlPath === '/delete-product') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { name } = JSON.parse(body);

                if (!name) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Product name is required' }));
                    return;
                }

                const products = loadProducts();
                const index = products.findIndex(p => p.name.toLowerCase() === name.toLowerCase());

                if (index === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Product not found' }));
                    return;
                }

                products.splice(index, 1);
                console.log('[PRODUCTS] Deleted product:', name);

                if (saveProducts(products)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, deleted: name, total: products.length }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to save after delete' }));
                }
            } catch (err) {
                console.error('Delete product error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // API endpoint to get users
    if (req.method === 'GET' && urlPath === '/users') {
        try {
            const users = loadUsers();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(users));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // API endpoint to add/update a user
    if (req.method === 'POST' && urlPath === '/add-user') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const userData = JSON.parse(body);
                const { name } = userData;

                if (!name || !name.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'User name is required' }));
                    return;
                }

                const users = loadUsers();

                // Check if user with same name exists
                const existingIndex = users.findIndex(u => u.name.toLowerCase() === name.trim().toLowerCase());

                const newUser = {
                    ...userData,
                    name: name.trim(),
                    updated_at: new Date().toISOString()
                };

                if (existingIndex >= 0) {
                    // Update existing user
                    users[existingIndex] = newUser;
                    console.log('[USERS] Updated user:', name);
                } else {
                    // Add new user
                    newUser.created_at = new Date().toISOString();
                    users.push(newUser);
                    console.log('[USERS] Added user:', name);
                }

                if (saveUsers(users)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, user: newUser, total: users.length }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to save user' }));
                }
            } catch (err) {
                console.error('Add user error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // API endpoint to delete a user
    if (req.method === 'DELETE' && urlPath === '/delete-user') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { name } = JSON.parse(body);

                if (!name) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'User name is required' }));
                    return;
                }

                const users = loadUsers();
                const index = users.findIndex(u => u.name.toLowerCase() === name.toLowerCase());

                if (index === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'User not found' }));
                    return;
                }

                users.splice(index, 1);
                console.log('[USERS] Deleted user:', name);

                if (saveUsers(users)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, deleted: name, total: users.length }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to save after delete' }));
                }
            } catch (err) {
                console.error('Delete user error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // 404 for everything else
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  Pipeline UI Server running at:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`========================================\n`);
});
