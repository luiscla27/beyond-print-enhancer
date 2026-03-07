const assert = require('assert');

// We will implement these in js/main.js or a separate utils file
// For now, let's define the expected behavior in the test
function calculateSnappedAngle(angle, step = 15) {
    return Math.round(angle / step) * step;
}

function getAngleFromPoint(cx, cy, px, py) {
    const dy = py - cy;
    const dx = px - cx;
    let theta = Math.atan2(dy, dx); // range (-PI, PI]
    theta *= 180 / Math.PI; // range (-180, 180]
    if (theta < 0) theta = 360 + theta; // range [0, 360)
    return theta;
}

describe('Rotation Snapping Logic', function() {
    it('should snap to 15 degree increments', function() {
        assert.strictEqual(calculateSnappedAngle(7), 0);
        assert.strictEqual(calculateSnappedAngle(8), 15);
        assert.strictEqual(calculateSnappedAngle(14), 15);
        assert.strictEqual(calculateSnappedAngle(16), 15);
        assert.strictEqual(calculateSnappedAngle(22), 15);
        assert.strictEqual(calculateSnappedAngle(23), 30);
        assert.strictEqual(calculateSnappedAngle(359), 360); // 360 is effectively 0
    });

    it('should calculate angle from center and pointer correctly', function() {
        // Center at (100, 100)
        // Point at (200, 100) -> 0 degrees (East)
        assert.strictEqual(getAngleFromPoint(100, 100, 200, 100), 0);
        
        // Point at (100, 200) -> 90 degrees (South - Y is down in browser)
        assert.strictEqual(getAngleFromPoint(100, 100, 100, 200), 90);
        
        // Point at (0, 100) -> 180 degrees (West)
        assert.strictEqual(getAngleFromPoint(100, 100, 0, 100), 180);
        
        // Point at (100, 0) -> 270 degrees (North)
        assert.strictEqual(getAngleFromPoint(100, 100, 100, 0), 270);
    });

    it('should combine to snap a pointer position', function() {
        const cx = 100, cy = 100;
        const px = 150, py = 120; // Some random point
        const angle = getAngleFromPoint(cx, cy, px, py);
        const snapped = calculateSnappedAngle(angle);
        assert.strictEqual(snapped % 15, 0);
    });
});
