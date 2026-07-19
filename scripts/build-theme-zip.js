const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const themeName = require('../package.json').name;
const outputPath = path.join('dist', `${themeName}.zip`);

function isThemeFile(file) {
    if (file.endsWith('.map')) {
        return false;
    }

    return (
        /^[^/]+\.hbs$/.test(file) ||
        /^partials\/.*\.hbs$/.test(file) ||
        /^assets\//.test(file) ||
        /^locales\/.*\.json$/.test(file) ||
        ['package.json', 'routes.yaml', 'LICENSE', 'README.md'].includes(file)
    );
}

const tracked = spawnSync('git', ['ls-files'], {encoding: 'utf8'});
if (tracked.status !== 0) {
    throw new Error(tracked.stderr || 'Unable to list tracked theme files');
}

const files = tracked.stdout
    .split('\n')
    .filter(Boolean)
    .filter((file) => fs.existsSync(file))
    .filter(isThemeFile);

fs.mkdirSync('dist', {recursive: true});
if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
}

const zipped = spawnSync('zip', ['-q', outputPath, '-@'], {
    input: files.join('\n'),
    stdio: ['pipe', 'inherit', 'inherit']
});

if (zipped.status !== 0) {
    throw new Error(`zip exited with code ${zipped.status}`);
}

console.log(`Created ${outputPath} with ${files.length} files.`);
