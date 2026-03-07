const assert = require('assert');

// We will implement this in js/main.js or a separate utils file
// For now, let's define the expected behavior in the test
function parseAssets(fileList) {
    const categories = {
        borders: [],
        shapes: []
    };

    const tagList = ["bold", "hand drawn", "hollow", "ornament", "dwarf", "goth", "border", "barbarian", "vine", "plants", "spikes", "sticks"];

    fileList.forEach(filePath => {
        if (!filePath.endsWith('.gif')) return;

        const isShape = filePath.includes('assets/shapes/');
        const fileName = filePath.split('/').pop().toLowerCase();
        
        // Extract tags
        const tags = tagList.filter(tag => fileName.includes(tag.replace(' ', '_')));
        
        // Specialized logic for "hand drawn" which might be "hand" in filename
        if (fileName.includes('hand') && !tags.includes('hand drawn')) {
            tags.push('hand drawn');
        }

        const asset = {
            path: filePath,
            label: fileName.replace('.gif', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            tags: tags
        };

        if (isShape) {
            categories.shapes.push(asset);
        } else {
            categories.borders.push(asset);
        }
    });

    return categories;
}

describe('Shape Parsing and Tagging', function() {
    const mockFileList = [
        'assets/border_default.gif',
        'assets/border_barbarian_hand.gif',
        'assets/vine_plants.gif',
        'assets/shapes/corner_dwarf_hollow.gif',
        'assets/shapes/ornament_bold.gif',
        'assets/not_an_asset.txt'
    ];

    it('should categorize assets into borders and shapes', function() {
        const result = parseAssets(mockFileList);
        assert.strictEqual(result.borders.length, 3);
        assert.strictEqual(result.shapes.length, 2);
    });

    it('should extract tags correctly from filenames', function() {
        const result = parseAssets(mockFileList);
        
        const barbarian = result.borders.find(a => a.path === 'assets/border_barbarian_hand.gif');
        assert.ok(barbarian.tags.includes('border'));
        assert.ok(barbarian.tags.includes('barbarian'));
        assert.ok(barbarian.tags.includes('hand drawn'));

        const dwarf = result.shapes.find(a => a.path === 'assets/shapes/corner_dwarf_hollow.gif');
        assert.ok(dwarf.tags.includes('dwarf'));
        assert.ok(dwarf.tags.includes('hollow'));
    });

    it('should format labels correctly', function() {
        const result = parseAssets(mockFileList);
        const dwarf = result.shapes.find(a => a.path === 'assets/shapes/corner_dwarf_hollow.gif');
        assert.strictEqual(dwarf.label, 'Corner Dwarf Hollow');
    });

    it('should ignore non-gif files', function() {
        const result = parseAssets(mockFileList);
        const allPaths = [...result.borders, ...result.shapes].map(a => a.path);
        assert.ok(!allPaths.includes('assets/not_an_asset.txt'));
    });

    it('should filter assets by tag', function() {
        const result = parseAssets(mockFileList);
        const boldShapes = result.shapes.filter(a => a.tags.includes('bold'));
        assert.strictEqual(boldShapes.length, 1);
        assert.strictEqual(boldShapes[0].path, 'assets/shapes/ornament_bold.gif');

        const plantsBorders = result.borders.filter(a => a.tags.includes('plants'));
        assert.strictEqual(plantsBorders.length, 1);
        assert.strictEqual(plantsBorders[0].path, 'assets/vine_plants.gif');
    });
});
