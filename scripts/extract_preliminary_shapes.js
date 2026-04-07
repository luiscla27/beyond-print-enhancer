const sharp = require('sharp');
const fs = require('fs');

async function extractShapes() {
  const input = 'demo/ignored/sheet_archer.png';
  const outDir = 'demo/ignored/extracted';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Bow Icon
  await sharp(input)
    .extract({ left: 70, top: 75, width: 300, height: 300 })
    .resize(512)
    .toFile(`${outDir}/bow_raw.png`);

  // Bird Icon
  await sharp(input)
    .extract({ left: 60, top: 420, width: 200, height: 300 })
    .resize(512)
    .toFile(`${outDir}/bird_raw.png`);

  // Quiver Icon
  await sharp(input)
    .extract({ left: 410, top: 320, width: 100, height: 600 })
    .resize(512)
    .toFile(`${outDir}/quiver_raw.png`);

  // Arrow Cluster
  await sharp(input)
    .extract({ left: 60, top: 800, width: 200, height: 300 })
    .resize(512)
    .toFile(`${outDir}/arrows_raw.png`);
    
  console.log('Shapes extracted.');
}

extractShapes().catch(console.error);
