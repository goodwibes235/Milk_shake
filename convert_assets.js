const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function processStrawberry() {
  const srcDir = 'strawberry';
  if (!fs.existsSync(srcDir)) return;
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png')).sort();
  console.log(`Processing strawberry: ${files.length} frames found`);
  
  const targetDir = 'assets/strawberry';
  const targetSmDir = 'assets/strawberry-sm';
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(targetSmDir, { recursive: true });

  const count = Math.min(90, files.length);
  for (let i = 0; i < count; i++) {
    const srcFile = path.join(srcDir, files[i]);
    const num = String(i + 1).padStart(4, '0');
    const outWebp = path.join(targetDir, `frame_${num}.webp`);
    const outSmWebp = path.join(targetSmDir, `frame_${num}.webp`);

    // 1080x1080 contain
    await sharp(srcFile)
      .resize(1080, 1080, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 85 })
      .toFile(outWebp);

    // 540x540 mobile
    await sharp(srcFile)
      .resize(540, 540, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 78, alphaQuality: 80 })
      .toFile(outSmWebp);

    if ((i + 1) % 15 === 0 || i === count - 1) {
      console.log(`Strawberry frames converted: ${i + 1}/${count}`);
    }
  }
}

async function processSplash() {
  const srcDir = 'Milk splash';
  if (!fs.existsSync(srcDir)) return;
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png')).sort();
  console.log(`Processing splash: ${files.length} frames found`);
  
  const targetDir = 'assets/splash';
  const targetSmDir = 'assets/splash-sm';
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(targetSmDir, { recursive: true });

  // Burst -> peak (around frame 45) -> settle (around frame 90)
  const count = Math.min(90, files.length);
  for (let i = 0; i < count; i++) {
    const srcFile = path.join(srcDir, files[i]);
    const num = String(i + 1).padStart(4, '0');
    const outWebp = path.join(targetDir, `frame_${num}.webp`);
    const outSmWebp = path.join(targetSmDir, `frame_${num}.webp`);

    // 1920x1080 contain
    await sharp(srcFile)
      .resize(1920, 1080, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80, alphaQuality: 85 })
      .toFile(outWebp);

    // 960x540 mobile
    await sharp(srcFile)
      .resize(960, 540, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 75, alphaQuality: 80 })
      .toFile(outSmWebp);

    if ((i + 1) % 15 === 0 || i === count - 1) {
      console.log(`Splash frames converted: ${i + 1}/${count}`);
    }
  }
}

async function main() {
  await processStrawberry();
  await processSplash();
  console.log('All WebP conversions completed successfully!');
}

main().catch(console.error);
