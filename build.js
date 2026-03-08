const esbuild = require('esbuild');
const fs = require('fs');

async function build() {
  // Bundle JS
  const jsResult = await esbuild.build({
    entryPoints: ['src/main.js'],
    bundle: true,
    format: 'iife',
    minify: process.argv.includes('--minify'),
    write: false,
  });

  // Bundle CSS
  const cssResult = await esbuild.build({
    entryPoints: ['src/style.css'],
    bundle: true,
    minify: process.argv.includes('--minify'),
    write: false,
  });

  const js = jsResult.outputFiles[0].text;
  const css = cssResult.outputFiles[0].text;

  // Read template and inline bundles
  let html = fs.readFileSync('src/template.html', 'utf8');
  html = html.replace('/* STYLE */', css);
  html = html.replace('/* SCRIPT */', js);

  fs.writeFileSync('vi.html', html);
  const size = (fs.statSync('vi.html').size / 1024).toFixed(1);
  console.log('Built vi.html (' + size + ' KB)');
}

const watchMode = process.argv.includes('--watch');

build().then(function() {
  if (watchMode) {
    let timeout = null;
    console.log('Watching src/ for changes...');
    fs.watch('src', { recursive: true }, function(event, filename) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(function() {
        timeout = null;
        console.log('Change detected: ' + (filename || 'unknown'));
        build().catch(function(err) {
          console.error('Build error:', err.message);
        });
      }, 100);
    });
  }
}).catch(function(err) {
  console.error(err);
  process.exit(1);
});
