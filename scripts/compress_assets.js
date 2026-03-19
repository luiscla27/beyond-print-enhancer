const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.resolve(__dirname, '../assets');
const SHAPES_DIR = path.resolve(ASSETS_DIR, 'shapes');
const MAX_DIMENSION = 512;
const QUALITY = 80;

// Input metadata from main.js (extracted for recalculation)
const INPUT_METADATA = {
    'assets/border_ability.gif': { slice: 66, width: '28px', outset: '16px', className: 'ability_border' },
    'assets/border_barbarian.gif': { slice: 212, width: '142px', outset: '55px', className: 'barbarian_border' },
    'assets/border_barbarian_hand.gif': { slice: 1050, width: '100px', outset: '30px', className: 'barbarian_hand_border' },
    'assets/border_box.gif': { slice: 45, width: '20px', outset: '7px 10px', className: 'box_border' },
    'assets/border_default.gif': { slice: 22, width: '24px', outset: '7px 10px', className: 'default-border' },
    'assets/border_goth1.gif': { slice: 1014, width: '111px', outset: '54px 44px', className: 'goth_border' },
    'assets/border_goth1_hand.gif': { slice: 1050, width: '100px', outset: '30px', className: 'goth_hand_border' },
    'assets/border_spikes.gif': { slice: 177, width: '118px', outset: '55px', className: 'spikes_border' },
    'assets/dwarf.gif': { slice: 308, width: '205px', outset: '55px', className: 'dwarf_border' },
    'assets/dwarf_hollow.gif': { slice: 215, width: '143px', outset: '38px', className: 'dwarf_hollow_border' },
    'assets/dwarf_hollow_hand.gif': { slice: 1050, width: '100px', outset: '30px', className: 'dwarf_hollow_hand_border' },
    'assets/ornament.gif': { slice: 133, width: '88px', outset: '32px', className: 'ornament_border' },
    'assets/ornament2.gif': { slice: 217, width: '144px', outset: '48px', className: 'ornament2_border' },
    'assets/ornament_bold.gif': { slice: 333, width: '222px', outset: '100px', className: 'ornament_bold_border' },
    'assets/ornament_bold2.gif': { slice: 212, width: '141px', outset: '50px', className: 'ornament_bold2_border' },
    'assets/ornament_simple.gif': { slice: 166, width: '111px', outset: '45px', className: 'ornament_simple_border' },
    'assets/spike_bold.gif': { slice: 166, width: '111px', outset: '55px', className: 'spiky_bold_border' },
    'assets/spike_hollow.gif': { slice: 166, width: '111px', outset: '45px', className: 'spike_hollow_border' },
    'assets/spike_hollow2.gif': { slice: 1050, width: '100px', outset: '45px', className: 'spiky_border' },
    'assets/sticks.gif': { slice: 220, width: '146px', outset: '65px', className: 'sticks_border' },
    'assets/vine_hand.gif': { slice: 1050, width: '100px', outset: '30px', className: 'vine_hand_border' },
    'assets/vine_hollow.gif': { slice: 429, width: '130px', outset: '45px', className: 'vine_border' },
    'assets/vine_plants.gif': { slice: 200, width: '133px', outset: '55px', className: 'plants_border' },
    'assets/shapes/border_spikes_hand.gif': { isBackground: true },
    'assets/shapes/corner_barbarian.gif': { isBackground: true },
    'assets/shapes/corner_border_barbarian_hand.gif': { isBackground: true },
    'assets/shapes/corner_border_goth1.gif': { isBackground: true },
    'assets/shapes/corner_border_plants_hand.gif': { isBackground: true },
    'assets/shapes/corner_dwarf.gif': { isBackground: true },
    'assets/shapes/corner_dwarf_hollow.gif': { isBackground: true },
    'assets/shapes/corner_ornament.gif': { isBackground: true },
    'assets/shapes/corner_ornament2.gif': { isBackground: true },
    'assets/shapes/corner_ornament_bold.gif': { isBackground: true },
    'assets/shapes/corner_ornament_bold2.gif': { isBackground: true },
    'assets/shapes/corner_ornament_bold3.gif': { isBackground: true },
    'assets/shapes/corner_ornament_simple.gif': { isBackground: true },
    'assets/shapes/corner_ornament_simple2.gif': { isBackground: true },
    'assets/shapes/corner_spikes.gif': { isBackground: true },
    'assets/shapes/corner_spike_hollow.gif': { isBackground: true },
    'assets/shapes/corner_spike_hollow2.gif': { isBackground: true },
    'assets/shapes/corner_sticks.gif': { isBackground: true },
    'assets/shapes/corner_sticks1.gif': { isBackground: true },
    'assets/shapes/corner_vine_hollow.gif': { isBackground: true }
};

const NEW_METADATA = {};

async function processFile(filePath, relativePath) {
    const ext = path.extname(filePath);
    if (ext.toLowerCase() !== '.gif') return;

    const outputRelativePath = relativePath.replace(/\.gif$/i, '.webp');
    const outputPath = path.resolve(ASSETS_DIR, '..', outputRelativePath);
    
    console.log(`Processing: ${relativePath} -> ${outputRelativePath}`);

    const image = sharp(filePath);
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

    // Resize and convert
    await image
        .resize(targetWidth, targetHeight)
        .webp({ quality: QUALITY })
        .toFile(outputPath);

    // Recalculate slice if present
    if (INPUT_METADATA[relativePath]) {
        const entry = { ...INPUT_METADATA[relativePath] };
        if (entry.slice) {
            // border-image-slice can be a number or space-separated numbers
            if (typeof entry.slice === 'number') {
                entry.slice = Math.round(entry.slice * scaleRatio);
            } else if (typeof entry.slice === 'string') {
                entry.slice = entry.slice.split(/\s+/).map(s => {
                    const val = parseInt(s);
                    return isNaN(val) ? s : Math.round(val * scaleRatio);
                }).join(' ');
            }
        }
        NEW_METADATA[outputRelativePath] = entry;
    }
}

async function walkDir(dir, relPrefix = 'assets') {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relPath = relPrefix + '/' + file;
        if (fs.statSync(fullPath).isDirectory()) {
            await walkDir(fullPath, relPath);
        } else {
            await processFile(fullPath, relPath);
        }
    }
}

async function main() {
    try {
        await walkDir(ASSETS_DIR);
        
        // Output new metadata for main.js
        console.log('\n--- NEW ASSET_METADATA ---\n');
        console.log(JSON.stringify(NEW_METADATA, null, 4));
        
        console.log('\n--- NEW ASSET_LIST ---\n');
        console.log(JSON.stringify(Object.keys(NEW_METADATA), null, 4));
        
        console.log('\nCompression complete!');
    } catch (err) {
        console.error('Error processing assets:', err);
    }
}

main();
