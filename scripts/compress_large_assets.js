const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.resolve(__dirname, '../assets');
const MAX_DIMENSION = 512;
const QUALITY = 80;

const TARGET_FILES = [
    'assets/border_archer_ability.webp',
    'assets/border_archer_footer.webp',
    'assets/border_archer_sidebar.webp',
    'assets/shapes/shield_stats.webp'
];

const INPUT_METADATA = {
    "assets/border_archer_ability.webp": {
        "slice": "466 563 243 556",
        "width": "208px 251px 133px 251px",
        "outset": "10px",
        "className": "archer_ability_border"
    }
};

const NEW_METADATA = {};

async function processFile(relativePath) {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    if (!fs.existsSync(fullPath)) {
        console.log(`Skipping missing file: ${relativePath}`);
        return;
    }
    
    console.log(`Processing: ${relativePath}`);
    
    // We process it to a temp file then overwrite
    const tempPath = fullPath + '.temp.webp';

    const imageBuffer = fs.readFileSync(fullPath);
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;
    let scaleRatio = 1.0;

    if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
        if (originalWidth >= originalHeight) {
            targetWidth = MAX_DIMENSION;
            targetHeight = Math.round((originalHeight * MAX_DIMENSION) / originalWidth);
            scaleRatio = MAX_DIMENSION / originalWidth;
        } else {
            targetHeight = MAX_DIMENSION;
            targetWidth = Math.round((originalWidth * MAX_DIMENSION) / originalHeight);
            scaleRatio = MAX_DIMENSION / originalHeight;
        }
    }

    // Resize and convert/re-compress
    await image
        .resize(targetWidth, targetHeight)
        .webp({ quality: QUALITY })
        .toFile(tempPath);
        
    // Replace original with temp
    fs.unlinkSync(fullPath);
    fs.renameSync(tempPath, fullPath);

    // Recalculate slice if present
    if (INPUT_METADATA[relativePath]) {
        const entry = { ...INPUT_METADATA[relativePath] };
        if (entry.slice) {
            if (typeof entry.slice === 'number') {
                entry.slice = Math.round(entry.slice * scaleRatio);
            } else if (typeof entry.slice === 'string') {
                entry.slice = entry.slice.split(/\s+/).map(s => {
                    const val = parseInt(s);
                    return isNaN(val) ? s : Math.round(val * scaleRatio);
                }).join(' ');
            }
        }
        NEW_METADATA[relativePath] = entry;
    }
}

async function main() {
    try {
        for (const file of TARGET_FILES) {
            await processFile(file);
        }
        
        console.log('\n--- NEW METADATA FOR main.js ---');
        console.log(JSON.stringify(NEW_METADATA, null, 4));
        console.log('--- END NEW METADATA ---');
    } catch (err) {
        console.error('Error processing assets:', err);
    }
}

main();