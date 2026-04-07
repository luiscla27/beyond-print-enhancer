const sharp = require('sharp');
const path = require('path');

async function getMetadata() {
  const inputFile = process.argv[2] || 'demo/ignored/sheet_archer.png';
  const metadata = await sharp(inputFile).metadata();
  console.log(JSON.stringify(metadata, null, 2));
}

getMetadata().catch(err => {
  console.error(err);
  process.exit(1);
});
