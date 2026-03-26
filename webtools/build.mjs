import * as esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const isWatch = process.argv.includes('--watch');

// Output to Python package directory so it's included in the wheel
const outDir = '../src/xray/webtools_dist';

// JavaScript build options
const jsOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'XRayToolbar',
  outfile: `${outDir}/xray-toolbar.js`,
  target: ['es2020'],
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  logLevel: 'info',
};

// CSS build options
const cssOptions = {
  entryPoints: ['styles/index.css'],
  bundle: true,
  outfile: `${outDir}/xray-toolbar.css`,
  minify: !isWatch,
  logLevel: 'info',
};

async function build() {
  // Ensure output directory exists
  mkdirSync(outDir, { recursive: true });

  // Create __init__.py so Python can import this as a package
  writeFileSync(
    `${outDir}/__init__.py`,
    '"""Webtools dist - JS/CSS bundle for xray browser tools."""\n'
  );

  if (isWatch) {
    // Watch mode
    const jsContext = await esbuild.context(jsOptions);
    const cssContext = await esbuild.context(cssOptions);

    await Promise.all([
      jsContext.watch(),
      cssContext.watch(),
    ]);

    console.log('Watching for changes...');
  } else {
    // Production build
    await Promise.all([
      esbuild.build(jsOptions),
      esbuild.build(cssOptions),
    ]);

    console.log('Build complete!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
