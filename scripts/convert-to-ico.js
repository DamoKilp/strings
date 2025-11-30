const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

// Icon sizes for Windows (standard sizes)
const ICON_SIZES = [16, 32, 48, 64, 128, 256];

async function convertToIco(inputPath, outputPath) {
  try {
    console.log(`Converting ${inputPath} to ${outputPath}...`);
    
    // Read the input file
    const inputBuffer = fs.readFileSync(inputPath);
    
    // Generate multiple sizes for the ICO file
    const images = await Promise.all(
      ICON_SIZES.map(async (size) => {
        const image = sharp(inputBuffer);
        
        // Resize to square format (required for ICO)
        const resized = await image
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
          })
          .png()
          .toBuffer();
        
        return resized;
      })
    );
    
    // Convert to ICO format
    const icoBuffer = await toIco(images);
    
    // Write the ICO file
    fs.writeFileSync(outputPath, icoBuffer);
    
    console.log(`✓ Successfully created ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error converting ${inputPath}:`, error.message);
    return false;
  }
}

async function main() {
  const iconsTempDir = path.join(__dirname, '..', 'iconsTemp');
  
  // Check if directory exists
  if (!fs.existsSync(iconsTempDir)) {
    console.error(`Directory ${iconsTempDir} does not exist!`);
    process.exit(1);
  }
  
  // Read all files in the directory
  const files = fs.readdirSync(iconsTempDir);
  
  // Filter for image files (SVG, PNG, JPG, etc.)
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.svg', '.png', '.jpg', '.jpeg'].includes(ext);
  });
  
  if (imageFiles.length === 0) {
    console.log('No image files found in iconsTemp folder.');
    return;
  }
  
  console.log(`Found ${imageFiles.length} image file(s) to convert:\n`);
  
  // Convert each file
  for (const file of imageFiles) {
    const inputPath = path.join(iconsTempDir, file);
    const baseName = path.basename(file, path.extname(file));
    const outputPath = path.join(iconsTempDir, `${baseName}.ico`);
    
    await convertToIco(inputPath, outputPath);
  }
  
  console.log('\n✓ Conversion complete!');
}

main().catch(console.error);





