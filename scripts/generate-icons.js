import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceIcon = process.argv[2];
const publicDir = path.join(process.cwd(), 'public');

async function generateIcons() {
    if (!fs.existsSync(sourceIcon)) {
        console.error('Source icon not found:', sourceIcon);
        process.exit(1);
    }

    console.log('Generating PWA icons from:', sourceIcon);

    try {
        // Generate pwa-192x192.png
        await sharp(sourceIcon)
            .resize(192, 192)
            .toFile(path.join(publicDir, 'pwa-192x192.png'));
        console.log('✓ Created pwa-192x192.png');

        // Generate pwa-512x512.png
        await sharp(sourceIcon)
            .resize(512, 512)
            .toFile(path.join(publicDir, 'pwa-512x512.png'));
        console.log('✓ Created pwa-512x512.png');

        // Generate apple-touch-icon.png (180x180)
        await sharp(sourceIcon)
            .resize(180, 180)
            .toFile(path.join(publicDir, 'apple-touch-icon.png'));
        console.log('✓ Created apple-touch-icon.png');

        // Generate favicon.ico (32x32)
        await sharp(sourceIcon)
            .resize(32, 32)
            .toFile(path.join(publicDir, 'favicon.ico'));
        console.log('✓ Created favicon.ico');

        console.log('All icons generated successfully!');
    } catch (err) {
        console.error('Error generating icons:', err);
    }
}

generateIcons();
