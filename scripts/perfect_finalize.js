const sharp = require('sharp');
const fs = require('fs');

/**
 * Isolates black ink lines from a white background and recolors them.
 */
async function finalizeAsset(inputFile, outputFile) {
    console.log(`Finalizing ${inputFile} -> ${outputFile}`);
    
    const image = sharp(inputFile);
    const metadata = await image.metadata();
    const { width, height } = metadata;
    
    // Get raw pixel data
    const { data } = await image.raw().toBuffer({ resolveWithObject: true });
    
    const targetRed = 0xe4;
    const targetGreen = 0x07;
    const targetBlue = 0x12;
    
    // Create new buffer with alpha
    const outBuffer = Buffer.alloc(width * height * 4);
    
    for (let i = 0; i < width * height; i++) {
        const r = data[i * 3];
        const g = data[i * 3 + 1];
        const b = data[i * 3 + 2];
        
        // Intensity (0 = black, 255 = white)
        const intensity = (r + g + b) / 3;
        
        if (intensity > 220) {
            // White background becomes transparent
            outBuffer[i * 4] = 0;
            outBuffer[i * 4 + 1] = 0;
            outBuffer[i * 4 + 2] = 0;
            outBuffer[i * 4 + 3] = 0;
        } else {
            // Black ink becomes the target red
            outBuffer[i * 4] = targetRed;
            outBuffer[i * 4 + 1] = targetGreen;
            outBuffer[i * 4 + 2] = targetBlue;
            
            // Alpha: use inverse of intensity for anti-aliasing (smoother edges)
            // If intensity is 0 (black), alpha is 255 (opaque)
            // If intensity is 220, alpha is very low.
            outBuffer[i * 4 + 3] = Math.round(255 * (1 - intensity / 255));
        }
    }
    
    await sharp(outBuffer, { raw: { width, height, channels: 4 } })
        .webp({ quality: 90, lossless: true })
        .toFile(outputFile);
    
    console.log(`Saved to ${outputFile}`);
}

const input = process.argv[2];
const output = process.argv[3];
if (input && output) {
    finalizeAsset(input, output).catch(console.error);
}
