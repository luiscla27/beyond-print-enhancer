const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Manifest Integrity', function() {
    const manifestPath = path.join(__dirname, '../../manifest.json');
    const projectRoot = path.join(__dirname, '../../');
    let manifest;

    before(function() {
        if (!fs.existsSync(manifestPath)) {
            throw new Error('manifest.json not found');
        }
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    });

    function checkFileExists(filePath) {
        // Resolve path relative to project root
        const fullPath = path.join(projectRoot, filePath);
        assert.ok(fs.existsSync(fullPath), `File not found: ${filePath} (Full path: ${fullPath})`);
    }

    /**
     * Simplistic pattern matcher for resources (handles * and folders)
     */
    function checkPatternMatches(pattern) {
        const parts = pattern.split('/');
        let currentDir = projectRoot;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === '*') {
                // Just check if the directory exists and has files
                assert.ok(fs.existsSync(currentDir), `Directory not found: ${currentDir}`);
                const files = fs.readdirSync(currentDir);
                assert.ok(files.length > 0, `No files found in directory for pattern: ${pattern}`);
                return; // Matched something
            } else if (part.includes('*')) {
                // e.g. *.webp
                const ext = part.replace('*', '');
                assert.ok(fs.existsSync(currentDir), `Directory not found: ${currentDir}`);
                const files = fs.readdirSync(currentDir);
                const matches = files.filter(f => f.endsWith(ext));
                assert.ok(matches.length > 0, `No files matching ${part} found in ${currentDir}`);
                return;
            } else {
                currentDir = path.join(currentDir, part);
                if (i === parts.length - 1) {
                    // Final part, if not a glob, check file/dir exists
                    assert.ok(fs.existsSync(currentDir), `Path not found: ${currentDir} for pattern: ${pattern}`);
                }
            }
        }
    }

    it('should have all declared icons', function() {
        if (manifest.icons) {
            Object.values(manifest.icons).forEach(iconPath => {
                checkFileExists(iconPath);
            });
        }
    });

    it('should have all background service worker scripts', function() {
        if (manifest.background && manifest.background.service_worker) {
            checkFileExists(manifest.background.service_worker);
        }
    });

    it('should have all content scripts', function() {
        if (manifest.content_scripts) {
            manifest.content_scripts.forEach(script => {
                if (script.js) {
                    script.js.forEach(jsPath => {
                        checkFileExists(jsPath);
                    });
                }
                if (script.css) {
                    script.css.forEach(cssPath => {
                        checkFileExists(cssPath);
                    });
                }
            });
        }
    });

    it('should have all action icons', function() {
        if (manifest.action && manifest.action.default_icon) {
            if (typeof manifest.action.default_icon === 'string') {
                checkFileExists(manifest.action.default_icon);
            } else {
                Object.values(manifest.action.default_icon).forEach(iconPath => {
                    checkFileExists(iconPath);
                });
            }
        }
    });

    it('should have all web accessible resources (handling basic patterns)', function() {
        if (manifest.web_accessible_resources) {
            manifest.web_accessible_resources.forEach(resourceGroup => {
                resourceGroup.resources.forEach(resourcePattern => {
                    checkPatternMatches(resourcePattern);
                });
            });
        }
    });
});
