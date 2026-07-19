const {series, parallel, watch, src, dest} = require('gulp');
const pump = require('pump');
const fs = require('fs');
const path = require('path');
const order = require('ordered-read-streams');

// gulp plugins and utils
const livereload = require('gulp-livereload');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const beeper = require('beeper');
const {spawn, spawnSync} = require('child_process');

// translations support
const { mergeLocales } = require('@tryghost/theme-translations/build');
const sharedThemeAssetsPath = path.dirname(require.resolve('@tryghost/shared-theme-assets/package.json'));

function serve(done) {
    livereload.listen();
    done();
}

function handleError(done) {
    return function (err) {
        if (err) {
            beeper();
        }
        return done(err);
    };
};

function hbs(done) {
    pump([
        src(['*.hbs', 'partials/**/*.hbs']),
        livereload()
    ], handleError(done));
}

function readCssWithImports(file, seen = new Set()) {
    const resolvedFile = path.resolve(file);
    if (seen.has(resolvedFile)) {
        return '';
    }

    seen.add(resolvedFile);

    const directory = path.dirname(resolvedFile);
    const css = fs.readFileSync(resolvedFile, 'utf8');

    return css.replace(/@import\s+(?:url\()?["']?([^"')]+)["']?\)?;/g, (match, importPath) => {
        if (/^(https?:)?\/\//.test(importPath)) {
            return match;
        }

        const importedFile = importPath.startsWith('@tryghost/shared-theme-assets/')
            ? path.join(sharedThemeAssetsPath, importPath.replace('@tryghost/shared-theme-assets/', ''))
            : path.resolve(directory, importPath);

        return `\n/* ${importPath} */\n${readCssWithImports(importedFile, seen)}\n`;
    });
}

function css(done) {
    try {
        fs.mkdirSync('assets/built', {recursive: true});
        fs.writeFileSync('assets/built/screen.css', readCssWithImports('assets/css/screen.css'));
        livereload.reload('assets/built/screen.css');
        done();
    } catch (err) {
        handleError(done)(err);
    }
}

function getJsFiles(version) {
    const jsFiles = [
        src(`${sharedThemeAssetsPath}/assets/js/${version}/lib/**/*.js`),
        src(`${sharedThemeAssetsPath}/assets/js/${version}/main.js`),
    ];

    if (fs.existsSync(`assets/js/lib`)) {
        jsFiles.push(src(`assets/js/lib/*.js`));
    }

    jsFiles.push(src(`assets/js/main.js`));

    return jsFiles;
}

function js(done) {
    pump([
        order(getJsFiles('v1')),
        concat('main.min.js'),
        uglify(),
        dest('assets/built/'),
        livereload()
    ], handleError(done));
}

function zipper(done) {
    const filename = require('./package.json').name + '.zip';
    const outputPath = path.join('dist', filename);

    fs.mkdirSync('dist', {recursive: true});
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }

    const files = getThemeFiles();

    const zipProcess = spawn('zip', ['-q', outputPath, ...files], {stdio: 'inherit'});
    zipProcess.on('error', done);
    zipProcess.on('close', (code) => {
        if (code) {
            done(new Error(`zip exited with code ${code}`));
            return;
        }

        done();
    });
}

function getThemeFiles() {
    const result = spawnSync('git', ['ls-files'], {encoding: 'utf8'});

    if (result.status !== 0) {
        throw new Error(result.stderr || 'Unable to list tracked theme files');
    }

    return result.stdout
        .split('\n')
        .filter(Boolean)
        .filter((file) => fs.existsSync(file))
        .filter(isThemeFile);
}

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

function locales(done) {
    mergeLocales({
        local: './locales-local',
        output: './locales'
    })(done);
}

const localesWatcher = () => watch('./locales-local/**/*.json', locales);
const hbsWatcher = () => watch(['*.hbs', 'partials/**/*.hbs'], hbs);
const cssWatcher = () => watch('assets/css/**/*.css', css);
const jsWatcher = () => watch('assets/js/**/*.js', js);
const watcher = parallel(hbsWatcher, cssWatcher, jsWatcher, localesWatcher);
const build = series(css, js, locales);

exports.build = build;
exports.zip = series(zipper);
exports.default = series(build, serve, watcher);
