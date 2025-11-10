// Script to fix Vite build to use standard Vite instead of rolldown-vite
// This prevents React context and module resolution errors during production builds

import { existsSync, cpSync, rmSync, statSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = resolve(__dirname, '..');
const viteStandardPath = join(rootDir, 'node_modules', 'vite-standard');
const vitePath = join(rootDir, 'node_modules', 'vite');

console.log('🔧 Starting Vite replacement script...');
console.log(`   Root dir: ${rootDir}`);
console.log(`   Vite standard path: ${viteStandardPath}`);
console.log(`   Vite path: ${vitePath}`);

// Check if vite-standard exists
if (!existsSync(viteStandardPath)) {
  console.error('❌ vite-standard not found. Please run: npm install vite-standard@npm:vite@^5.4.21 --save-dev');
  process.exit(1);
}

// Check if vite exists and what it is
if (existsSync(vitePath)) {
  try {
    const stat = statSync(vitePath);
    if (stat.isDirectory()) {
      // Check if it's already vite-standard by checking package.json
      try {
        const vitePkgPath = join(vitePath, 'package.json');
        if (existsSync(vitePkgPath)) {
          const vitePkg = JSON.parse(readFileSync(vitePkgPath, 'utf-8'));
          console.log(`   Current vite package: ${vitePkg.name}@${vitePkg.version}`);
          // If it's not rolldown-vite, skip replacement
          if (vitePkg.name && !vitePkg.name.includes('rolldown')) {
            console.log('✅ Vite is already using standard Vite, skipping replacement');
            process.exit(0);
          }
          console.log('⚠️  Detected rolldown-vite, replacing with standard Vite...');
        }
      } catch (e) {
        console.warn('⚠️  Could not read vite package.json:', e.message);
        console.log('   Proceeding with replacement...');
      }
      
      // Remove existing vite
      console.log('🗑️  Removing existing vite directory...');
      rmSync(vitePath, { recursive: true, force: true });
      console.log('✅ Removed existing vite directory');
    } else if (stat.isSymbolicLink()) {
      console.log('🗑️  Removing existing vite symlink...');
      rmSync(vitePath);
      console.log('✅ Removed existing vite symlink');
    }
  } catch (error) {
    console.error('❌ Error removing existing vite:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
} else {
  console.log('ℹ️  No existing vite directory found, will create new one');
}

// Copy vite-standard to vite
try {
  console.log('📦 Copying vite-standard to node_modules/vite...');
  cpSync(viteStandardPath, vitePath, { recursive: true, force: true });
  console.log('✅ Copied vite-standard to node_modules/vite');
  console.log(`   Source: ${viteStandardPath}`);
  console.log(`   Target: ${vitePath}`);
  
  // Verify the copy
  const vitePkgPath = join(vitePath, 'package.json');
  if (existsSync(vitePkgPath)) {
    const vitePkg = JSON.parse(readFileSync(vitePkgPath, 'utf-8'));
    console.log(`✅ Verification: Vite is now ${vitePkg.name}@${vitePkg.version}`);
  }
} catch (error) {
  console.error('❌ Error copying vite-standard:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}

console.log('✅ Vite is now configured to use standard Vite for production builds');

