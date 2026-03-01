/**
 * Benchmarking Script - Run Gemini extraction on all images
 *
 * Usage: node benchmarking.mjs -i ./images -o ./output_json -c 10
 *
 * Options:
 *   -i, --images   Images folder (default: ./images)
 *   -o, --output   Output folder (default: ./output_json)
 *   -c, --count    Number of images to process (default: all)
 *   -h, --help     Show help
 */

import { extractGarmentAttributesGeminiTieredKV } from './gemini_tiered.mjs';
import { extractGarmentAttributesGeminiOptimised } from './gemini_single_call.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_IMAGES_FOLDER = './images';
const DEFAULT_OUTPUT_FOLDER = './output_json';
const DELAY_BETWEEN_IMAGES_MS = 1000; // 1 second delay to avoid rate limiting

/**
 * Parse command line arguments
 * @returns {Object} - Parsed arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {
        imagesFolder: DEFAULT_IMAGES_FOLDER,
        outputFolder: DEFAULT_OUTPUT_FOLDER,
        count: null, // null means all images
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];

        switch (arg) {
            case '-i':
            case '--images':
                parsed.imagesFolder = nextArg;
                i++;
                break;
            case '-o':
            case '--output':
                parsed.outputFolder = nextArg;
                i++;
                break;
            case '-c':
            case '--count':
                parsed.count = parseInt(nextArg, 10);
                i++;
                break;
            case '-h':
            case '--help':
                parsed.help = true;
                break;
        }
    }

    return parsed;
}

function printHelp() {
    console.log(`
Benchmarking Script - Run Gemini extraction on all images

Usage: node benchmarking.mjs [options]

Options:
  -i, --images <folder>   Images folder (default: ./images)
  -o, --output <folder>   Output folder (default: ./output_json)
  -c, --count <number>    Number of images to process (default: all)
  -h, --help              Show this help message

Examples:
  node benchmarking.mjs                           # Process all images with defaults
  node benchmarking.mjs -c 5                      # Process first 5 images
  node benchmarking.mjs -i ./my_images -o ./out   # Custom folders
  node benchmarking.mjs -i ./images -o ./out -c 10
`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get all image files from a folder
 * @param {string} folderPath - Path to images folder
 * @returns {string[]} - Array of image file paths
 */
function getImageFiles(folderPath) {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const files = fs.readdirSync(folderPath);

    return files
        .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return validExtensions.includes(ext);
        })
        .sort() // Sort alphabetically for consistent ordering
        .map(file => path.join(folderPath, file));
}

/**
 * Run extraction on a single image and save results
 * @param {string} imagePath - Path to image file
 * @param {string} outputFolder - Path to output folder
 * @returns {Promise<Object>} - Extraction result
 */
async function processImage(imagePath, outputFolder) {
    const imageFileName = path.basename(imagePath);
    const imageId = path.basename(imagePath, path.extname(imagePath));
    const outputPath = path.join(outputFolder, `${imageId}.json`);

    console.log(`\nProcessing: ${imageFileName}`);
    const startTime = Date.now();

    try {
        const result = await extractGarmentAttributesGeminiTieredKV(imagePath);
        // const result = await extractGarmentAttributesGeminiOptimised(imagePath);
        const elapsed = Date.now() - startTime;

        if (result.success) {
            // Create output JSON matching ground truth format
            const outputJson = {
                image_id: imageId,
                extracted_attributes: result.attributes,
                metadata: {
                    extraction_time_ms: elapsed,
                    usage: result.usage,
                    image_used: imagePath,
                    attempts: result.attempts || 1,
                    quality_warning: result.quality_warning || false
                }
            };

            fs.writeFileSync(outputPath, JSON.stringify(outputJson, null, 2));
            console.log(`  ✓ Success (${elapsed}ms) -> ${outputPath}`);

            return { success: true, imageId, elapsed, attributes: result.attributes };
        } else {
            const elapsed = Date.now() - startTime;
            console.log(`  ✗ Failed: ${result.error}`);
            // Save error JSON to track rate limits and other errors
            const errorJson = {
                image_id: imageId,
                error: result.error,
                metadata: {
                    extraction_time_ms: elapsed,
                    image_used: imagePath
                }
            };
            fs.writeFileSync(outputPath, JSON.stringify(errorJson, null, 2));
            return { success: false, imageId, error: result.error };
        }
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.log(`  ✗ Error: ${error.message}`);
        // Save error JSON to track rate limits and other errors
        const errorJson = {
            image_id: imageId,
            error: error.message,
            metadata: {
                extraction_time_ms: elapsed,
                image_used: imagePath
            }
        };
        fs.writeFileSync(outputPath, JSON.stringify(errorJson, null, 2));
        return { success: false, imageId, error: error.message };
    }
}

/**
 * Run benchmarking on all images in a folder
 * @param {string} imagesFolder - Path to images folder
 * @param {string} outputFolder - Path to output folder
 * @param {number|null} count - Number of images to process (null = all)
 */
async function runBenchmark(imagesFolder, outputFolder, count = null) {
    // Resolve paths
    const imagesFolderPath = path.resolve(__dirname, imagesFolder);
    const outputFolderPath = path.resolve(__dirname, outputFolder);

    // Validate images folder exists
    if (!fs.existsSync(imagesFolderPath)) {
        console.error(`Error: Images folder not found: ${imagesFolderPath}`);
        process.exit(1);
    }

    // Create output folder if it doesn't exist
    if (!fs.existsSync(outputFolderPath)) {
        fs.mkdirSync(outputFolderPath, { recursive: true });
        console.log(`Created output folder: ${outputFolderPath}`);
    }

    // Get all image files
    let imageFiles = getImageFiles(imagesFolderPath);
    const totalImages = imageFiles.length;

    // Filter out images that already have output JSON (skip already processed)
    const skippedImages = [];
    imageFiles = imageFiles.filter(imagePath => {
        const imageId = path.basename(imagePath, path.extname(imagePath));
        const outputPath = path.join(outputFolderPath, `${imageId}.json`);
        if (fs.existsSync(outputPath)) {
            skippedImages.push(imageId);
            return false;
        }
        return true;
    });

    // Limit to count if specified
    if (count !== null && count > 0) {
        imageFiles = imageFiles.slice(0, count);
    }

    if (imageFiles.length === 0 && skippedImages.length > 0) {
        console.log(`\nAll ${skippedImages.length} images already processed. Nothing to do.`);
        console.log(`Delete output files or use a different output folder to reprocess.`);
        process.exit(0);
    }

    if (imageFiles.length === 0) {
        console.error(`Error: No image files found in ${imagesFolderPath}`);
        process.exit(1);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`BENCHMARKING: Gemini Tiered Extraction`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Images folder: ${imagesFolderPath}`);
    console.log(`Output folder: ${outputFolderPath}`);
    console.log(`Total images found: ${totalImages}`);
    if (skippedImages.length > 0) {
        console.log(`Already processed (skipped): ${skippedImages.length}`);
    }
    console.log(`Images to process: ${imageFiles.length}${count ? ` (limited to ${count})` : ''}`);
    console.log(`${'='.repeat(60)}\n`);

    const results = {
        total: imageFiles.length,
        success: 0,
        failed: 0,
        times: [],
        errors: []
    };

    const overallStart = Date.now();

    for (let i = 0; i < imageFiles.length; i++) {
        const imagePath = imageFiles[i];
        console.log(`[${i + 1}/${imageFiles.length}]`);

        const result = await processImage(imagePath, outputFolderPath);

        if (result.success) {
            results.success++;
            results.times.push(result.elapsed);
        } else {
            results.failed++;
            results.errors.push({ imageId: result.imageId, error: result.error });
        }

        // Delay between images to avoid rate limiting (except for last image)
        if (i < imageFiles.length - 1) {
            await sleep(DELAY_BETWEEN_IMAGES_MS);
        }
    }

    const totalTime = Date.now() - overallStart;

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`BENCHMARK COMPLETE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total images: ${results.total}`);
    console.log(`Successful: ${results.success}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Success rate: ${((results.success / results.total) * 100).toFixed(1)}%`);
    console.log(`\nTiming:`);
    console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
    if (results.times.length > 0) {
        const avgTime = results.times.reduce((a, b) => a + b, 0) / results.times.length;
        const minTime = Math.min(...results.times);
        const maxTime = Math.max(...results.times);
        console.log(`  Average per image: ${avgTime.toFixed(0)}ms`);
        console.log(`  Min: ${minTime}ms, Max: ${maxTime}ms`);
    }

    if (results.errors.length > 0) {
        console.log(`\nErrors:`);
        results.errors.forEach(err => {
            console.log(`  - ${err.imageId}: ${err.error}`);
        });
    }

    console.log(`\nOutput saved to: ${outputFolderPath}`);
    console.log(`${'='.repeat(60)}\n`);

    // Save summary
    const summaryPath = path.join(outputFolderPath, '_benchmark_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        images_folder: imagesFolderPath,
        output_folder: outputFolderPath,
        total_images: results.total,
        successful: results.success,
        failed: results.failed,
        success_rate: (results.success / results.total) * 100,
        total_time_ms: totalTime,
        average_time_ms: results.times.length > 0
            ? results.times.reduce((a, b) => a + b, 0) / results.times.length
            : 0,
        errors: results.errors
    }, null, 2));

    return results;
}

// Main execution
async function main() {
    const args = parseArgs();

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    await runBenchmark(args.imagesFolder, args.outputFolder, args.count);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
