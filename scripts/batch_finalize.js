const cp = require('child_process');
const tasks = [
    { in: 'nanobanana-output/editisolate_the_braided_rope_bor_3.png', out: 'assets/border_archer_header.webp' },
    { in: 'nanobanana-output/editisolate_the_handdrawn_corner_2.png', out: 'assets/border_archer_ability.webp' },
    { in: 'nanobanana-output/editisolate_the_central_crestshi.png', out: 'assets/border_archer_stats.webp' },
    { in: 'nanobanana-output/editextract_the_interwoven_rope_.png', out: 'assets/border_archer_footer.webp' },
    { in: 'nanobanana-output/editextract_the_vertical_bowstri_1.png', out: 'assets/border_archer_sidebar.webp' },
    { in: 'nanobanana-output/editextract_the_archer_bow_icon_.png', out: 'assets/shapes/archer_main.webp' },
    { in: 'nanobanana-output/editextract_the_decorative_secti.png', out: 'assets/shapes/archer_divider.webp' },
    { in: 'nanobanana-output/editextract_the_small_quiver_acc.png', out: 'assets/shapes/archer_accent_a.webp' },
    { in: 'nanobanana-output/editextract_the_small_arrow_clus.png', out: 'assets/shapes/archer_accent_b.webp' }
];

tasks.forEach(t => {
    try {
        console.log(`Processing: ${t.in} -> ${t.out}`);
        cp.execSync(`node scripts/perfect_finalize.js "${t.in}" "${t.out}"`);
    } catch (err) {
        console.error(`Failed: ${t.in}`, err.message);
    }
});
