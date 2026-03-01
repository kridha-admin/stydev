/**
 * Benchmark Comparison Script - Compare model output against ground truth
 *
 * Usage: node compare_results.mjs -g ./images_json -o ./output_json
 *
 * Options:
 *   -g, --ground-truth   Ground truth folder (default: ./images_json)
 *   -o, --output         Output folder to compare (default: ./output_json)
 *   -h, --help           Show help
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_GROUND_TRUTH_FOLDER = './images_json';
const DEFAULT_OUTPUT_FOLDER = './output_json';

/**
 * Parse command line arguments
 * @returns {Object} - Parsed arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {
        groundTruthFolder: DEFAULT_GROUND_TRUTH_FOLDER,
        outputFolder: DEFAULT_OUTPUT_FOLDER,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];

        switch (arg) {
            case '-g':
            case '--ground-truth':
                parsed.groundTruthFolder = nextArg;
                i++;
                break;
            case '-o':
            case '--output':
                parsed.outputFolder = nextArg;
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
Benchmark Comparison Script - Compare model output against ground truth

Usage: node compare_results.mjs [options]

Options:
  -g, --ground-truth <folder>   Ground truth folder (default: ./images_json)
  -o, --output <folder>         Output folder to compare (default: ./output_json)
  -h, --help                    Show this help message

Examples:
  node compare_results.mjs                              # Use defaults
  node compare_results.mjs -o ./my_output               # Custom output folder
  node compare_results.mjs -g ./gt -o ./output          # Custom both folders
`);
}

// All attributes to compare (19 total)
const ATTRIBUTES_TO_COMPARE = [
    'garment_type',
    'color_primary',
    'color_value',
    'pattern_type',
    'hemline_position',
    'is_adult_clothing',
    'fabric_apparent_weight',
    'fabric_sheen',
    'fit_category',
    'fabric_drape',
    'waist_definition',
    'waist_position',
    'rise',
    'leg_shape',
    'leg_opening_width',
    'silhouette_type',
    'sleeve_type',
    'sleeve_length',
    'neckline_type',
    'neckline_depth'
];

// Attributes where case-insensitive comparison is appropriate (free text)
const CASE_INSENSITIVE_ATTRIBUTES = ['color_primary'];

/**
 * Generate HTML report from benchmark results
 */
function generateHtmlReport(results, outputPath) {
    const { summary, per_attribute, per_image } = results;

    // Collect all mismatches for the table
    const allMismatches = [];
    for (const [attr, data] of Object.entries(per_attribute)) {
        for (const m of data.mismatches) {
            allMismatches.push({ ...m, attribute: attr });
        }
    }

    // Sort attributes by accuracy (worst first)
    const sortedAttrs = Object.entries(per_attribute)
        .filter(([_, data]) => data.total > 0)
        .sort((a, b) => (a[1].accuracy || 0) - (b[1].accuracy || 0));

    const getAccuracyColor = (acc) => {
        if (acc >= 90) return '#22c55e'; // green
        if (acc >= 70) return '#eab308'; // yellow
        return '#ef4444'; // red
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Benchmark Results - ${new Date(results.timestamp).toLocaleDateString()}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { margin-bottom: 10px; color: #1a1a1a; }
        h2 { margin: 30px 0 15px; color: #333; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
        .timestamp { color: #666; margin-bottom: 20px; }

        /* Summary Cards */
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .card-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .card-value { font-size: 32px; font-weight: 700; margin-top: 5px; }
        .card-value.green { color: #22c55e; }
        .card-value.yellow { color: #eab308; }
        .card-value.red { color: #ef4444; }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        th {
            background: #f8f9fa;
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            color: #555;
            border-bottom: 2px solid #e5e5e5;
        }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        tr:hover { background: #fafafa; }
        tr:last-child td { border-bottom: none; }

        /* Accuracy Bar */
        .accuracy-bar {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .bar-bg {
            flex: 1;
            height: 20px;
            background: #e5e5e5;
            border-radius: 4px;
            overflow: hidden;
            min-width: 100px;
        }
        .bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s;
        }
        .bar-text {
            min-width: 50px;
            text-align: right;
            font-weight: 600;
        }

        /* Mismatch table */
        .mismatch-table td:nth-child(2) { font-family: monospace; }
        .mismatch-table .expected { color: #22c55e; font-weight: 500; }
        .mismatch-table .got { color: #ef4444; font-weight: 500; }
        .mismatch-table .thumb-cell { padding: 8px; }
        .mismatch-table .thumb {
            width: 80px;
            height: 100px;
            object-fit: contain;
            background: #f5f5f5;
            border-radius: 4px;
            border: 1px solid #ddd;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .mismatch-table .thumb:hover { transform: scale(2); z-index: 10; position: relative; background: white; }

        /* Filters */
        .filter-row {
            margin-bottom: 15px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .filter-row select, .filter-row input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        .filter-row input { flex: 1; max-width: 300px; }

        .tag {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        .tag-correct { background: #dcfce7; color: #166534; }
        .tag-incorrect { background: #fee2e2; color: #991b1b; }
        .tag-skipped { background: #f3f4f6; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Benchmark Results</h1>
        <div class="timestamp">Generated: ${new Date(results.timestamp).toLocaleString()}</div>

        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="card">
                <div class="card-label">Overall Accuracy</div>
                <div class="card-value ${summary.overall_accuracy >= 90 ? 'green' : summary.overall_accuracy >= 70 ? 'yellow' : 'red'}">${summary.overall_accuracy.toFixed(1)}%</div>
            </div>
            <div class="card">
                <div class="card-label">Images Compared</div>
                <div class="card-value">${summary.images_compared}</div>
            </div>
            <div class="card">
                <div class="card-label">Total Comparisons</div>
                <div class="card-value">${summary.total_comparisons}</div>
            </div>
            <div class="card">
                <div class="card-label">Matches / Mismatches</div>
                <div class="card-value">${summary.total_matches} / ${summary.total_comparisons - summary.total_matches}</div>
            </div>
        </div>

        <!-- Per-Attribute Accuracy -->
        <h2>Per-Attribute Accuracy</h2>
        <table>
            <thead>
                <tr>
                    <th style="width: 200px;">Attribute</th>
                    <th>Accuracy</th>
                    <th style="width: 80px;">Correct</th>
                    <th style="width: 80px;">Total</th>
                    <th style="width: 80px;">Skipped</th>
                </tr>
            </thead>
            <tbody>
                ${sortedAttrs.map(([attr, data]) => `
                <tr>
                    <td><strong>${attr}</strong></td>
                    <td>
                        <div class="accuracy-bar">
                            <div class="bar-bg">
                                <div class="bar-fill" style="width: ${data.accuracy || 0}%; background: ${getAccuracyColor(data.accuracy || 0)};"></div>
                            </div>
                            <span class="bar-text" style="color: ${getAccuracyColor(data.accuracy || 0)};">${data.accuracy?.toFixed(1) || 'N/A'}%</span>
                        </div>
                    </td>
                    <td>${data.correct}</td>
                    <td>${data.total}</td>
                    <td>${data.skipped}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <!-- Mismatches -->
        <h2>All Mismatches (${allMismatches.length})</h2>
        ${allMismatches.length > 0 ? `
        <div class="filter-row">
            <select id="attrFilter" onchange="filterTable()">
                <option value="">All Attributes</option>
                ${[...new Set(allMismatches.map(m => m.attribute))].sort().map(attr =>
                    `<option value="${attr}">${attr}</option>`
                ).join('')}
            </select>
            <input type="text" id="imageFilter" placeholder="Filter by image ID..." oninput="filterTable()">
        </div>
        <table class="mismatch-table" id="mismatchTable">
            <thead>
                <tr>
                    <th style="width: 90px;">Preview</th>
                    <th>Image ID</th>
                    <th>Attribute</th>
                    <th>Expected</th>
                    <th>Got</th>
                    <th>Reason</th>
                </tr>
            </thead>
            <tbody>
                ${allMismatches.map(m => `
                <tr data-attr="${m.attribute}" data-image="${m.image_id}">
                    <td class="thumb-cell"><img class="thumb" src="../../images/${m.image_id}.jpg" onerror="this.onerror=null; this.src='../../images/${m.image_id}.png'; this.onerror=function(){this.src='../../images/${m.image_id}.webp';}" alt="${m.image_id}"></td>
                    <td>${m.image_id}</td>
                    <td>${m.attribute}</td>
                    <td class="expected">${m.ground_truth}</td>
                    <td class="got">${m.output ?? '(missing)'}</td>
                    <td>${m.reason}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '<p>No mismatches found!</p>'}

        <!-- Per-Image Results -->
        <h2>Per-Image Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Image</th>
                    <th style="width: 100px;">Correct</th>
                    <th style="width: 100px;">Incorrect</th>
                    <th style="width: 100px;">Skipped</th>
                    <th>Accuracy</th>
                </tr>
            </thead>
            <tbody>
                ${per_image.sort((a, b) => {
                    const accA = a.correct / (a.correct + a.incorrect) || 0;
                    const accB = b.correct / (b.correct + b.incorrect) || 0;
                    return accA - accB;
                }).map(img => {
                    const total = img.correct + img.incorrect;
                    const acc = total > 0 ? (img.correct / total * 100) : 100;
                    return `
                    <tr>
                        <td><strong>${img.image_id}</strong></td>
                        <td><span class="tag tag-correct">${img.correct}</span></td>
                        <td><span class="tag tag-incorrect">${img.incorrect}</span></td>
                        <td><span class="tag tag-skipped">${img.skipped}</span></td>
                        <td>
                            <div class="accuracy-bar">
                                <div class="bar-bg">
                                    <div class="bar-fill" style="width: ${acc}%; background: ${getAccuracyColor(acc)};"></div>
                                </div>
                                <span class="bar-text" style="color: ${getAccuracyColor(acc)};">${acc.toFixed(1)}%</span>
                            </div>
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>

    <script>
        function filterTable() {
            const attrFilter = document.getElementById('attrFilter').value.toLowerCase();
            const imageFilter = document.getElementById('imageFilter').value.toLowerCase();
            const rows = document.querySelectorAll('#mismatchTable tbody tr');

            rows.forEach(row => {
                const attr = row.dataset.attr.toLowerCase();
                const image = row.dataset.image.toLowerCase();
                const matchAttr = !attrFilter || attr === attrFilter;
                const matchImage = !imageFilter || image.includes(imageFilter);
                row.style.display = matchAttr && matchImage ? '' : 'none';
            });
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(outputPath, html);
    console.log(`HTML report saved to: ${outputPath}`);
}

/**
 * Generate CSV report from benchmark results
 */
function generateCsvReport(results, outputPath) {
    const { summary, per_attribute } = results;
    const lines = [];

    // Section 1: Per-Attribute Accuracy
    lines.push('## ACCURACY BY ATTRIBUTE');
    lines.push('attribute,accuracy,correct,total,skipped');

    // Sort by accuracy (worst first)
    const sortedAttrs = Object.entries(per_attribute)
        .sort((a, b) => (a[1].accuracy || 0) - (b[1].accuracy || 0));

    for (const [attr, data] of sortedAttrs) {
        const acc = data.accuracy !== null ? data.accuracy.toFixed(1) : 'N/A';
        lines.push(`${attr},${acc},${data.correct},${data.total},${data.skipped}`);
    }

    lines.push(`OVERALL,${summary.overall_accuracy.toFixed(1)},${summary.total_matches},${summary.total_comparisons},`);
    lines.push('');

    // Section 2: All Mismatches
    lines.push('## MISMATCHES');
    lines.push('image_id,attribute,expected,got,reason');

    for (const [attr, data] of sortedAttrs) {
        for (const m of data.mismatches) {
            // Escape commas in values
            const expected = String(m.ground_truth).replace(/,/g, ';');
            const got = String(m.output ?? '(null)').replace(/,/g, ';');
            lines.push(`${m.image_id},${attr},${expected},${got},${m.reason}`);
        }
    }

    fs.writeFileSync(outputPath, lines.join('\n'));
    console.log(`CSV report saved to: ${outputPath}`);
}

/**
 * Get all JSON files from a folder (excluding files starting with _)
 * @param {string} folderPath - Path to folder
 * @returns {Map<string, Object>} - Map of image_id to parsed JSON
 */
function loadJsonFiles(folderPath) {
    const files = fs.readdirSync(folderPath);
    const jsonMap = new Map();

    for (const file of files) {
        if (!file.endsWith('.json') || file.startsWith('_')) continue;

        const filePath = path.join(folderPath, file);
        try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const imageId = content.image_id || path.basename(file, '.json');
            jsonMap.set(imageId, content);
        } catch (error) {
            console.warn(`Warning: Could not parse ${file}: ${error.message}`);
        }
    }

    return jsonMap;
}

/**
 * Compare two attribute values
 * @param {any} groundTruth - Ground truth value
 * @param {any} output - Model output value
 * @param {string} attributeName - Name of the attribute
 * @returns {{ match: boolean, reason: string }}
 */
function compareValues(groundTruth, output, attributeName) {
    // Both null = match
    if (groundTruth === null && output === null) {
        return { match: true, reason: 'both_null' };
    }

    // Ground truth null but output has value = still consider it (model extracted something extra)
    if (groundTruth === null && output !== null) {
        return { match: true, reason: 'gt_null_output_has_value' };
    }

    // Ground truth has value but output is null/undefined = mismatch
    if (groundTruth !== null && (output === null || output === undefined)) {
        return { match: false, reason: 'missing_in_output' };
    }

    // Case-insensitive comparison for free text attributes
    if (CASE_INSENSITIVE_ATTRIBUTES.includes(attributeName)) {
        const gtLower = String(groundTruth).toLowerCase().trim();
        const outLower = String(output).toLowerCase().trim();
        return {
            match: gtLower === outLower,
            reason: gtLower === outLower ? 'exact_match_case_insensitive' : 'value_mismatch'
        };
    }

    // Boolean comparison
    if (typeof groundTruth === 'boolean') {
        const outputBool = output === true || output === 'true';
        return {
            match: groundTruth === outputBool,
            reason: groundTruth === outputBool ? 'exact_match' : 'value_mismatch'
        };
    }

    // Exact string match for enum values
    const gtStr = String(groundTruth).trim();
    const outStr = String(output).trim();
    return {
        match: gtStr === outStr,
        reason: gtStr === outStr ? 'exact_match' : 'value_mismatch'
    };
}

/**
 * Run benchmark comparison
 * @param {string} groundTruthFolder - Path to ground truth folder
 * @param {string} outputFolder - Path to output folder
 */
function runComparison(groundTruthFolder, outputFolder) {
    // Resolve paths
    const gtFolderPath = path.resolve(__dirname, groundTruthFolder);
    const outFolderPath = path.resolve(__dirname, outputFolder);

    // Validate folders exist
    if (!fs.existsSync(gtFolderPath)) {
        console.error(`Error: Ground truth folder not found: ${gtFolderPath}`);
        process.exit(1);
    }
    if (!fs.existsSync(outFolderPath)) {
        console.error(`Error: Output folder not found: ${outFolderPath}`);
        process.exit(1);
    }

    // Load JSON files
    const groundTruthMap = loadJsonFiles(gtFolderPath);
    const outputMap = loadJsonFiles(outFolderPath);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`BENCHMARK COMPARISON: Ground Truth vs Model Output`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Ground truth folder: ${gtFolderPath}`);
    console.log(`Output folder: ${outFolderPath}`);
    console.log(`Ground truth files: ${groundTruthMap.size}`);
    console.log(`Output files to compare: ${outputMap.size}`);
    console.log(`${'='.repeat(70)}\n`);

    // Initialize results tracking
    const attributeResults = {};
    for (const attr of ATTRIBUTES_TO_COMPARE) {
        attributeResults[attr] = {
            correct: 0,
            incorrect: 0,
            skipped: 0, // ground truth is null
            total: 0,
            mismatches: []
        };
    }

    const imageResults = [];
    let totalMatches = 0;
    let totalComparisons = 0;

    // Compare each image that exists in output folder (not ground truth)
    // This way, if only a subset of images were processed, we only compare those
    for (const [imageId, outData] of outputMap) {
        const gtData = groundTruthMap.get(imageId);

        if (!gtData) {
            console.warn(`Warning: No ground truth found for ${imageId}`);
            continue;
        }

        // Get attributes from ground truth and output
        const gtAttrs = gtData.ground_truth || gtData;
        const outAttrs = outData.extracted_attributes || outData;

        if (!outAttrs) {
            console.warn(`Warning: No extracted_attributes in output for ${imageId}`);
            continue;
        }

        const imageResult = {
            image_id: imageId,
            correct: 0,
            incorrect: 0,
            skipped: 0,
            details: {}
        };

        // Compare each attribute
        for (const attr of ATTRIBUTES_TO_COMPARE) {
            const gtValue = gtAttrs[attr];
            const outValue = outAttrs[attr];

            // Skip if ground truth is null (attribute doesn't apply to this garment)
            if (gtValue === null) {
                attributeResults[attr].skipped++;
                imageResult.skipped++;
                imageResult.details[attr] = { status: 'skipped', reason: 'gt_null' };
                continue;
            }

            attributeResults[attr].total++;
            totalComparisons++;

            const comparison = compareValues(gtValue, outValue, attr);

            if (comparison.match) {
                attributeResults[attr].correct++;
                imageResult.correct++;
                totalMatches++;
                imageResult.details[attr] = {
                    status: 'correct',
                    ground_truth: gtValue,
                    output: outValue
                };
            } else {
                attributeResults[attr].incorrect++;
                imageResult.incorrect++;
                attributeResults[attr].mismatches.push({
                    image_id: imageId,
                    ground_truth: gtValue,
                    output: outValue,
                    reason: comparison.reason
                });
                imageResult.details[attr] = {
                    status: 'incorrect',
                    ground_truth: gtValue,
                    output: outValue,
                    reason: comparison.reason
                };
            }
        }

        imageResults.push(imageResult);
    }

    // Print per-attribute accuracy table
    console.log(`\n${'='.repeat(70)}`);
    console.log(`PER-ATTRIBUTE ACCURACY`);
    console.log(`${'='.repeat(70)}`);
    console.log(`${'Attribute'.padEnd(25)} | ${'Correct'.padStart(7)} | ${'Total'.padStart(7)} | ${'Accuracy'.padStart(8)} | Skipped`);
    console.log(`${'-'.repeat(25)}-+-${'-'.repeat(7)}-+-${'-'.repeat(7)}-+-${'-'.repeat(8)}-+-${'-'.repeat(7)}`);

    const sortedAttributes = [...ATTRIBUTES_TO_COMPARE].sort((a, b) => {
        const accA = attributeResults[a].total > 0
            ? attributeResults[a].correct / attributeResults[a].total
            : 1;
        const accB = attributeResults[b].total > 0
            ? attributeResults[b].correct / attributeResults[b].total
            : 1;
        return accA - accB; // Sort by accuracy ascending (worst first)
    });

    for (const attr of sortedAttributes) {
        const r = attributeResults[attr];
        const accuracy = r.total > 0 ? ((r.correct / r.total) * 100).toFixed(1) + '%' : 'N/A';
        console.log(
            `${attr.padEnd(25)} | ${String(r.correct).padStart(7)} | ${String(r.total).padStart(7)} | ${accuracy.padStart(8)} | ${String(r.skipped).padStart(7)}`
        );
    }

    // Overall accuracy
    const overallAccuracy = totalComparisons > 0
        ? ((totalMatches / totalComparisons) * 100).toFixed(1)
        : 0;

    console.log(`${'-'.repeat(25)}-+-${'-'.repeat(7)}-+-${'-'.repeat(7)}-+-${'-'.repeat(8)}-+-${'-'.repeat(7)}`);
    console.log(`${'OVERALL'.padEnd(25)} | ${String(totalMatches).padStart(7)} | ${String(totalComparisons).padStart(7)} | ${(overallAccuracy + '%').padStart(8)} |`);

    // Print detailed mismatches
    console.log(`\n${'='.repeat(70)}`);
    console.log(`DETAILED MISMATCHES (by attribute)`);
    console.log(`${'='.repeat(70)}`);

    for (const attr of ATTRIBUTES_TO_COMPARE) {
        const mismatches = attributeResults[attr].mismatches;
        if (mismatches.length === 0) continue;

        console.log(`\n${attr} (${mismatches.length} mismatches):`);
        for (const m of mismatches.slice(0, 10)) { // Show max 10 per attribute
            console.log(`  ${m.image_id}: "${m.ground_truth}" → "${m.output}" (${m.reason})`);
        }
        if (mismatches.length > 10) {
            console.log(`  ... and ${mismatches.length - 10} more`);
        }
    }

    // Save detailed results
    const resultsPath = path.join(outFolderPath, '_benchmark_results.json');
    const fullResults = {
        timestamp: new Date().toISOString(),
        ground_truth_folder: gtFolderPath,
        output_folder: outFolderPath,
        summary: {
            total_output_images: outputMap.size,
            total_ground_truth_images: groundTruthMap.size,
            images_compared: imageResults.length,
            total_comparisons: totalComparisons,
            total_matches: totalMatches,
            overall_accuracy: parseFloat(overallAccuracy)
        },
        per_attribute: Object.fromEntries(
            ATTRIBUTES_TO_COMPARE.map(attr => [
                attr,
                {
                    correct: attributeResults[attr].correct,
                    incorrect: attributeResults[attr].incorrect,
                    skipped: attributeResults[attr].skipped,
                    total: attributeResults[attr].total,
                    accuracy: attributeResults[attr].total > 0
                        ? parseFloat(((attributeResults[attr].correct / attributeResults[attr].total) * 100).toFixed(1))
                        : null,
                    mismatches: attributeResults[attr].mismatches
                }
            ])
        ),
        per_image: imageResults
    };

    fs.writeFileSync(resultsPath, JSON.stringify(fullResults, null, 2));

    // Generate HTML report
    const htmlPath = path.join(outFolderPath, '_benchmark_results.html');
    generateHtmlReport(fullResults, htmlPath);

    // Generate CSV report
    const csvPath = path.join(outFolderPath, '_benchmark_results.csv');
    generateCsvReport(fullResults, csvPath);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`SUMMARY`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Total images compared: ${imageResults.length}`);
    console.log(`Total attribute comparisons: ${totalComparisons}`);
    console.log(`Total matches: ${totalMatches}`);
    console.log(`Overall accuracy: ${overallAccuracy}%`);
    console.log(`\nResults saved to:`);
    console.log(`  JSON: ${resultsPath}`);
    console.log(`  HTML: ${htmlPath}`);
    console.log(`  CSV:  ${csvPath}`);
    console.log(`${'='.repeat(70)}\n`);

    return fullResults;
}

// Main execution
function main() {
    const args = parseArgs();

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    runComparison(args.groundTruthFolder, args.outputFolder);
}

main();
