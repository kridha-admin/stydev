/**
 * Generate HTML accuracy report from multiple benchmark output folders
 *
 * Usage: node accuracy_report.mjs
 * Output: accuracy_report.html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// HARDCODE YOUR OUTPUT FOLDERS HERE
// ============================================================================
const OUTPUT_FOLDERS = [
    './output/gemini_lite_with_null',
    './output/gemini_tiered_with_null',
    './output/gemini_flash_with_null',
    // './output_json_v2',
    // './output_json_flash_only',
];

// ============================================================================

function loadBenchmarkResults(folderPath) {
    const resultsFile = path.join(folderPath, '_benchmark_results.json');
    if (!fs.existsSync(resultsFile)) {
        console.warn(`Warning: No _benchmark_results.json found in ${folderPath}`);
        return null;
    }
    return JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
}

function generateHtml(allResults) {
    const getAccuracyColor = (acc) => {
        if (acc >= 90) return '#22c55e';
        if (acc >= 70) return '#eab308';
        return '#ef4444';
    };

    // Get all unique attributes across all results
    const allAttributes = new Set();
    for (const { results } of allResults) {
        if (results?.per_attribute) {
            for (const attr of Object.keys(results.per_attribute)) {
                allAttributes.add(attr);
            }
        }
    }

    // Calculate average accuracy per attribute for sorting
    const attrAvgAccuracy = {};
    for (const attr of allAttributes) {
        let sum = 0, count = 0;
        for (const { results } of allResults) {
            const acc = results?.per_attribute?.[attr]?.accuracy;
            if (acc !== null && acc !== undefined) {
                sum += acc;
                count++;
            }
        }
        attrAvgAccuracy[attr] = count > 0 ? sum / count : 0;
    }

    // Sort attributes by average accuracy (worst first)
    const sortedAttributes = [...allAttributes].sort((a, b) => attrAvgAccuracy[a] - attrAvgAccuracy[b]);

    // Build header row
    const folderHeaders = allResults.map(({ folder, results }) => {
        const overall = results?.summary?.overall_accuracy?.toFixed(1) || 'N/A';
        return `<th>${folder}<br><span class="overall">(${overall}%)</span></th>`;
    }).join('');

    // Build data rows
    const rows = sortedAttributes.map(attr => {
        const cells = allResults.map(({ results }) => {
            const data = results?.per_attribute?.[attr];
            const acc = data?.accuracy;
            if (acc === null || acc === undefined || data?.total === 0) {
                return `<td class="na">N/A</td>`;
            }
            return `
                <td>
                    <div class="accuracy-bar">
                        <div class="bar-bg">
                            <div class="bar-fill" style="width: ${acc}%; background: ${getAccuracyColor(acc)};"></div>
                        </div>
                        <span class="bar-text" style="color: ${getAccuracyColor(acc)};">${acc.toFixed(1)}%</span>
                    </div>
                </td>
            `;
        }).join('');

        return `<tr><td><strong>${attr}</strong></td>${cells}</tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accuracy Report</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        h1 { margin-bottom: 20px; color: #1a1a1a; }
        .overall { font-weight: normal; color: #666; font-size: 11px; display: block; }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
            padding: 8px 12px;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        td.na { color: #999; text-align: center; }
        tr:last-child td { border-bottom: none; }
        tr:hover { background: #fafafa; }
        .accuracy-bar {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .bar-bg {
            flex: 1;
            height: 16px;
            background: #e5e5e5;
            border-radius: 4px;
            overflow: hidden;
            min-width: 80px;
        }
        .bar-fill {
            height: 100%;
            border-radius: 4px;
        }
        .bar-text {
            min-width: 45px;
            text-align: right;
            font-weight: 600;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Per-Attribute Accuracy Comparison</h1>
    <table>
        <thead>
            <tr>
                <th style="width: 180px;">Attribute</th>
                ${folderHeaders}
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
</body>
</html>`;
}

// Ground truth folder path
const GROUND_TRUTH_FOLDER = './images_json';

// Attributes to include in image-wise comparison
const ATTRIBUTES = [
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

/**
 * Load all JSON files from a folder
 */
function loadJsonFilesFromFolder(folderPath) {
    const files = fs.readdirSync(folderPath);
    const jsonMap = new Map();

    for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('_')) {
            const filePath = path.join(folderPath, file);
            const imageId = path.basename(file, '.json');
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                jsonMap.set(imageId, data);
            } catch (e) {
                console.warn(`Warning: Could not parse ${filePath}`);
            }
        }
    }
    return jsonMap;
}

/**
 * Generate image-wise comparison CSV
 * Shows GT and each model's prediction for every attribute per image
 */
function generateImageWiseCsv(outputFolders) {
    const gtPath = path.resolve(__dirname, GROUND_TRUTH_FOLDER);
    const groundTruth = loadJsonFilesFromFolder(gtPath);

    // Load all model outputs
    const modelOutputs = outputFolders.map(folder => {
        const fullPath = path.resolve(__dirname, folder);
        return {
            name: path.basename(folder).replace('gemini_', '').replace('_with_null', ''),
            data: loadJsonFilesFromFolder(fullPath)
        };
    });

    // Get all image IDs (sorted)
    const imageIds = [...groundTruth.keys()].sort((a, b) => {
        const numA = parseInt(a.replace('image_', ''));
        const numB = parseInt(b.replace('image_', ''));
        return numA - numB;
    });

    // Build header
    const modelNames = modelOutputs.map(m => m.name);
    let header = 'image_id';
    for (const attr of ATTRIBUTES) {
        header += `,${attr}_GT`;
        for (const modelName of modelNames) {
            header += `,${attr}_${modelName}`;
        }
    }

    const lines = [header];

    // Build data rows
    for (const imageId of imageIds) {
        const gtJson = groundTruth.get(imageId) || {};
        // Ground truth attributes are nested under 'ground_truth' key
        const gtData = gtJson.ground_truth || gtJson;
        let row = imageId;

        for (const attr of ATTRIBUTES) {
            // Ground truth value
            const gtVal = gtData[attr] ?? '';
            row += `,${String(gtVal).replace(/,/g, ';')}`;

            // Each model's value
            for (const model of modelOutputs) {
                const modelJson = model.data.get(imageId) || {};
                // Model attributes are nested under 'extracted_attributes' key
                const modelData = modelJson.extracted_attributes || modelJson;
                const modelVal = modelData[attr] ?? '';
                row += `,${String(modelVal).replace(/,/g, ';')}`;
            }
        }

        lines.push(row);
    }

    return lines.join('\n');
}

function generateCsv(allResults) {
    // Get all unique attributes
    const allAttributes = new Set();
    for (const { results } of allResults) {
        if (results?.per_attribute) {
            for (const attr of Object.keys(results.per_attribute)) {
                allAttributes.add(attr);
            }
        }
    }

    // Calculate average for sorting
    const attrAvgAccuracy = {};
    for (const attr of allAttributes) {
        let sum = 0, count = 0;
        for (const { results } of allResults) {
            const acc = results?.per_attribute?.[attr]?.accuracy;
            if (acc !== null && acc !== undefined) {
                sum += acc;
                count++;
            }
        }
        attrAvgAccuracy[attr] = count > 0 ? sum / count : 0;
    }

    const sortedAttributes = [...allAttributes].sort((a, b) => attrAvgAccuracy[a] - attrAvgAccuracy[b]);

    // Header row
    const folderNames = allResults.map(r => r.folder);
    const lines = [`attribute,${folderNames.join(',')}`];

    // Add overall accuracy row first
    const overallRow = ['OVERALL'];
    for (const { results } of allResults) {
        const acc = results?.summary?.overall_accuracy;
        overallRow.push(acc !== null && acc !== undefined ? acc.toFixed(1) : 'N/A');
    }
    lines.push(overallRow.join(','));

    // Data rows
    for (const attr of sortedAttributes) {
        const row = [attr];
        for (const { results } of allResults) {
            const acc = results?.per_attribute?.[attr]?.accuracy;
            row.push(acc !== null && acc !== undefined ? acc.toFixed(1) : 'N/A');
        }
        lines.push(row.join(','));
    }

    return lines.join('\n');
}

function main() {
    const allResults = OUTPUT_FOLDERS.map(folder => {
        const fullPath = path.resolve(__dirname, folder);
        console.log(`Loading results from: ${fullPath}`);
        return {
            folder: path.basename(folder),
            results: loadBenchmarkResults(fullPath)
        };
    });

    // Generate HTML
    const html = generateHtml(allResults);
    const htmlPath = path.join(__dirname, 'accuracy_report.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`HTML report: ${htmlPath}`);

    // Generate CSV
    const csv = generateCsv(allResults);
    const csvPath = path.join(__dirname, 'accuracy_report.csv');
    fs.writeFileSync(csvPath, csv);
    console.log(`CSV report:  ${csvPath}`);

    // Generate image-wise comparison CSV
    const imageWiseCsv = generateImageWiseCsv(OUTPUT_FOLDERS);
    const imageWiseCsvPath = path.join(__dirname, 'image_wise_comparison.csv');
    fs.writeFileSync(imageWiseCsvPath, imageWiseCsv);
    console.log(`Image-wise:  ${imageWiseCsvPath}`);
}

main();
