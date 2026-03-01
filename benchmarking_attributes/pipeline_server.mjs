import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runPipelineWithCache } from '../stylist_pipeline/run_pipeline.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    // Serve the HTML file
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
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
    if (req.method === 'POST' && req.url === '/run-pipeline') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { product_text, product_image_url } = JSON.parse(body);

                console.log('\n=== PIPELINE REQUEST ===');
                console.log('Product Image URL:', product_image_url);
                console.log('Product Text Length:', product_text?.length || 0);

                const productProfile = {
                    product_text: product_text || '',
                    product_image_url: product_image_url || '',
                    merged_attrs: {}
                };

                // Run the pipeline with cache (handles extraction and caching automatically)
                const result = await runPipelineWithCache(
                    DEFAULT_USER_MEASUREMENTS,
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
