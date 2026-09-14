/**
 * Asset catalog: border/shape asset lists, metadata and the
 * parseAssets categorizer.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 2. Pure data + one pure
 * function; loaded before js/main.js in the production script list
 * (js/background.js) and in the shared test harness boot.
 */

"use strict";

  /**
   * Full list of available assets for the shape picker.
   */
  const ASSET_LIST = [
    "assets/border_ability.webp",
    "assets/border_archer_ability.webp",
    "assets/border_archer_footer.webp",
    "assets/border_archer_header.webp",
    "assets/border_archer_sidebar.webp",
    "assets/border_barbarian.webp",
    "assets/border_barbarian_hand.webp",
    "assets/border_box.webp",
    "assets/border_default.webp",
    "assets/border_goth1.webp",
    "assets/border_goth1_hand.webp",
    "assets/border_spikes.webp",
    "assets/dwarf.webp",
    "assets/dwarf_hollow.webp",
    "assets/dwarf_hollow_hand.webp",
    "assets/ornament.webp",
    "assets/ornament2.webp",
    "assets/ornament_bold.webp",
    "assets/ornament_bold2.webp",
    "assets/ornament_simple.webp",
    "assets/shapes/archer_accent_a.webp",
    "assets/shapes/archer_accent_b.webp",
    "assets/shapes/dwarf.webp",
    "assets/shapes/dwarf_hollow_hand.webp",
    "assets/shapes/shield_stats.webp",
    "assets/shapes/archer_divider.webp",
    "assets/shapes/archer_main.webp",
    "assets/shapes/border_spikes_hand.webp",
    "assets/shapes/corner_barbarian.webp",
    "assets/shapes/corner_border_barbarian_hand.webp",
    "assets/shapes/corner_border_goth1.webp",
    "assets/shapes/corner_border_plants_hand.webp",
    "assets/shapes/corner_dwarf.webp",
    "assets/shapes/corner_dwarf_hollow.webp",
    "assets/shapes/corner_ornament.webp",
    "assets/shapes/corner_ornament2.webp",
    "assets/shapes/corner_ornament_bold.webp",
    "assets/shapes/corner_ornament_bold2.webp",
    "assets/shapes/corner_ornament_bold3.webp",
    "assets/shapes/corner_ornament_simple.webp",
    "assets/shapes/corner_ornament_simple2.webp",
    "assets/shapes/corner_spikes.webp",
    "assets/shapes/corner_spike_hollow.webp",
    "assets/shapes/corner_spike_hollow2.webp",
    "assets/shapes/corner_sticks.webp",
    "assets/shapes/corner_sticks1.webp",
    "assets/shapes/corner_vine_hollow.webp",
    "assets/spike_bold.webp",
    "assets/spike_hollow.webp",
    "assets/spike_hollow2.webp",
    "assets/sticks.webp",
    "assets/vine_hand.webp",
    "assets/vine_hollow.webp",
    "assets/vine_plants.webp",
  ];

  /**
   * Metadata for assets including slice, width, and outset for border-image.
   * Values are calculated based on image dimensions and file sizes.
   * If 'isBackground' is true, it will be applied as background-image instead of border-image.
   */
  const ASSET_METADATA = {
    "assets/border_ability.webp": {
      slice: 66,
      width: "28px",
      outset: "16px",
      className: "ability_border",
    },
    "assets/border_barbarian.webp": {
      slice: 153,
      width: "142px",
      outset: "55px",
      className: "barbarian_border",
    },
    "assets/border_archer_header.webp": {
      slice: "481 470 202 475",
      width: "172px 208px 81px 194px",
      outset: "10px",
      className: "archer_header_border",
    },
    "assets/border_archer_ability.webp": {
      slice: "167 174 79 178",
      width: "201px 245px 116px 242px",
      outset: "10px",
      className: "archer_ability_border",
    },
    "assets/border_archer_footer.webp": {
      slice: "61 60 61 83",
      width: "35px 32px 36px 44px",
      outset: "10px",
      className: "archer_border_archer_footer",
    },
    "assets/border_archer_sidebar.webp": {
      slice: "61 60 61 83",
      width: "35px 32px 36px 44px",
      outset: "10px",
      className: "archer_border_archer_sidebar",
    },
    "assets/border_barbarian_hand.webp": {
      slice: 261,
      width: "100px",
      outset: "30px",
      className: "barbarian_hand_border",
    },
    "assets/border_box.webp": {
      slice: 45,
      width: "20px",
      outset: "7px 10px",
      className: "box_border",
    },
    "assets/border_default.webp": {
      slice: 22,
      width: "24px",
      outset: "7px 10px",
      className: "default-border",
    },
    "assets/border_goth1.webp": {
      slice: 250,
      width: "111px",
      outset: "54px 44px",
      className: "goth_border",
    },
    "assets/border_goth1_hand.webp": {
      slice: 261,
      width: "100px",
      outset: "30px",
      className: "goth_hand_border",
    },
    "assets/border_spikes.webp": {
      slice: 177,
      width: "118px",
      outset: "55px",
      className: "spikes_border",
    },
    "assets/dwarf.webp": {
      slice: 206,
      width: "205px",
      outset: "55px",
      className: "dwarf_border",
    },
    "assets/dwarf_hollow.webp": {
      slice: 206,
      width: "143px",
      outset: "38px",
      className: "dwarf_hollow_border",
    },
    "assets/dwarf_hollow_hand.webp": {
      slice: 259,
      width: "100px",
      outset: "30px",
      className: "dwarf_hollow_hand_border",
    },
    "assets/ornament.webp": {
      slice: 105,
      width: "88px",
      outset: "32px",
      className: "ornament_border",
    },
    "assets/ornament2.webp": {
      slice: 105,
      width: "144px",
      outset: "48px",
      className: "ornament2_border",
    },
    "assets/ornament_bold.webp": {
      slice: 205,
      width: "222px",
      outset: "100px",
      className: "ornament_bold_border",
    },
    "assets/ornament_bold2.webp": {
      slice: 205,
      width: "141px",
      outset: "50px",
      className: "ornament_bold2_border",
    },
    "assets/ornament_simple.webp": {
      slice: 83,
      width: "111px",
      outset: "45px",
      className: "ornament_simple_border",
    },
    "assets/shapes/archer_accent_a.webp": {
      isBackground: true,
    },
    "assets/shapes/archer_accent_b.webp": {
      isBackground: true,
    },
    "assets/shapes/dwarf.webp": {
      isBackground: true,
    },
    "assets/shapes/dwarf_hollow_hand.webp": {
      isBackground: true,
    },
    "assets/shapes/shield_stats.webp": {
      isBackground: true,
    },
    "assets/shapes/archer_divider.webp": {
      isBackground: true,
    },
    "assets/shapes/archer_main.webp": {
      isBackground: true,
    },
    "assets/shapes/border_spikes_hand.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_barbarian.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_border_barbarian_hand.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_border_goth1.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_border_plants_hand.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_dwarf.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_dwarf_hollow.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_ornament.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_ornament2.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_ornament_bold.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_ornament_bold2.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_ornament_bold3.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_ornament_simple.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_ornament_simple2.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_spikes.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_spike_hollow.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_spike_hollow2.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_sticks.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_sticks1.webp": {
      isBackground: true,
    },
    "assets/shapes/corner_vine_hollow.webp": {
      isBackground: true,
    },
    "assets/spike_bold.webp": {
      slice: 83,
      width: "111px",
      outset: "55px",
      className: "spiky_bold_border",
    },
    "assets/spike_hollow.webp": {
      slice: 205,
      width: "111px",
      outset: "45px",
      className: "spike_hollow_border",
    },
    "assets/spike_hollow2.webp": {
      slice: 205,
      width: "100px",
      outset: "45px",
      className: "spiky_border",
    },
    "assets/sticks.webp": {
      slice: 245,
      width: "146px",
      outset: "65px",
      className: "sticks_border",
    },
    "assets/vine_hand.webp": {
      slice: 261,
      width: "100px",
      outset: "30px",
      className: "vine_hand_border",
    },
    "assets/vine_hollow.webp": {
      slice: 205,
      width: "130px",
      outset: "45px",
      className: "vine_border",
    },
    "assets/vine_plants.webp": {
      slice: 200,
      width: "133px",
      outset: "55px",
      className: "plants_border",
    },
  };

  /**
   * Parses and categorizes assets for the shape picker.
   * @param {string[]} fileList
   * @returns {{borders: Array, shapes: Array}}
   */
  function parseAssets(fileList) {
    const categories = {
      borders: [],
      shapes: [],
    };

    const tagList = [
      "bold",
      "hand drawn",
      "hollow",
      "ornament",
      "dwarf",
      "goth",
      "border",
      "barbarian",
      "vine",
      "plants",
      "spikes",
      "sticks",
    ];

    fileList.forEach((filePath) => {
      if (!filePath.endsWith(".webp")) return;

      const isShape = filePath.includes("assets/shapes/");
      const fileName = filePath.split("/").pop().toLowerCase();

      // Extract tags
      const tags = tagList.filter((tag) =>
        fileName.includes(tag.replace(" ", "_")),
      );

      // Specialized logic for "hand drawn" which might be "hand" in filename
      if (fileName.includes("hand") && !tags.includes("hand drawn")) {
        tags.push("hand drawn");
      }

      const asset = {
        path: filePath,
        label: fileName
          .replace(".webp", "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        tags: tags,
      };

      if (isShape) {
        categories.shapes.push(asset);
      } else {
        categories.borders.push(asset);
      }
    });

    return categories;
  }

  /**
   * Ordered section-frame style catalog — the SINGLE source of truth for the
   * "Section Styles" picker (track border_shape_picker_ux_20260909, B-1).
   * Migrated verbatim from the hard-coded array that lived in
   * js/modals.js:177-198 (that function is deleted with this track) so the
   * picker and the asset catalog can never drift. The 20-entry order/labels are the
   * frozen regression fixture (unit: derived list === this list).
   */
  const SECTION_BORDER_STYLES = [
    { className: "default-border", label: "Default" },
    { className: "no-border", label: "None" },
    { className: "ability_border", label: "Ability" },
    { className: "spikes_border", label: "Spikes" },
    { className: "barbarian_border", label: "Barbarian" },
    { className: "goth_border", label: "Goth" },
    { className: "plants_border", label: "Plants" },
    { className: "box_border", label: "Box" },
    { className: "dwarf_border", label: "Dwarf" },
    { className: "dwarf_hollow_border", label: "Dwarf Hollow" },
    { className: "sticks_border", label: "Sticks" },
    { className: "ornament_border", label: "Ornament 1" },
    { className: "ornament2_border", label: "Ornament 2" },
    { className: "ornament_bold_border", label: "Ornament Bold" },
    { className: "ornament_bold2_border", label: "Ornament Bold 2" },
    { className: "ornament_simple_border", label: "Ornament Simple" },
    { className: "spike_hollow_border", label: "Spike Hollow" },
    { className: "spiky_border", label: "Spiky" },
    { className: "spiky_bold_border", label: "Spiky Bold" },
    { className: "vine_border", label: "Vine" },
  ];

  /**
   * All available border style classes, derived from metadata.
   * (Relocated from js/main.js, encapsulation track Phase 7.)
   */
  const ALL_BORDER_STYLES = [
    "no-border",
    ...Object.values(ASSET_METADATA)
      .map((meta) => meta.className)
      .filter((name) => name),
  ];

  /**
   * Curated display names + family grouping (track border_shape_picker_ux_
   * 20260909, B-4 / AC-4). Keyed by asset path; EVERY path in ASSET_LIST must
   * be present (a unit test enforces coverage). Display names are human
   * editorial ("Ornament Bold Double", not "Ornament Bold2"), and the family
   * group drives the grouped grid headers. SECTION_BORDER_STYLES entries are
   * already curated labels and are grouped as "Section Styles" for the same
   * rendering path.
   */
  const ASSET_GROUP_ORDER = [
    "Archer",
    "Barbarian",
    "Dwarf",
    "Goth",
    "Ornament",
    "Spike",
    "Sticks",
    "Vine & Plant",
    "Base",
    "Emblems & Accents",
    "Other",
  ];

  const ASSET_CURATION = {
    "assets/border_ability.webp": { name: "Ability", group: "Base" },
    "assets/border_archer_ability.webp": { name: "Archer Ability", group: "Archer" },
    "assets/border_archer_footer.webp": { name: "Archer Footer", group: "Archer" },
    "assets/border_archer_header.webp": { name: "Archer Header", group: "Archer" },
    "assets/border_archer_sidebar.webp": { name: "Archer Sidebar", group: "Archer" },
    "assets/border_barbarian.webp": { name: "Barbarian", group: "Barbarian" },
    "assets/border_barbarian_hand.webp": { name: "Barbarian, Hand-Drawn", group: "Barbarian" },
    "assets/border_box.webp": { name: "Box", group: "Base" },
    "assets/border_default.webp": { name: "Default", group: "Base" },
    "assets/border_goth1.webp": { name: "Goth", group: "Goth" },
    "assets/border_goth1_hand.webp": { name: "Goth, Hand-Drawn", group: "Goth" },
    "assets/border_spikes.webp": { name: "Spikes", group: "Spike" },
    "assets/dwarf.webp": { name: "Dwarf", group: "Dwarf" },
    "assets/dwarf_hollow.webp": { name: "Dwarf Hollow", group: "Dwarf" },
    "assets/dwarf_hollow_hand.webp": { name: "Dwarf Hollow, Hand-Drawn", group: "Dwarf" },
    "assets/ornament.webp": { name: "Ornament", group: "Ornament" },
    "assets/ornament2.webp": { name: "Ornament Double", group: "Ornament" },
    "assets/ornament_bold.webp": { name: "Ornament Bold", group: "Ornament" },
    "assets/ornament_bold2.webp": { name: "Ornament Bold Double", group: "Ornament" },
    "assets/ornament_simple.webp": { name: "Ornament Simple", group: "Ornament" },
    "assets/shapes/archer_accent_a.webp": { name: "Archer Accent A", group: "Archer" },
    "assets/shapes/archer_accent_b.webp": { name: "Archer Accent B", group: "Archer" },
    "assets/shapes/dwarf.webp": { name: "Dwarf Emblem", group: "Dwarf" },
    "assets/shapes/dwarf_hollow_hand.webp": { name: "Dwarf Hollow, Hand-Drawn", group: "Dwarf" },
    "assets/shapes/shield_stats.webp": { name: "Shield Stats", group: "Emblems & Accents" },
    "assets/shapes/archer_divider.webp": { name: "Archer Divider", group: "Archer" },
    "assets/shapes/archer_main.webp": { name: "Archer Emblem", group: "Archer" },
    "assets/shapes/border_spikes_hand.webp": { name: "Spikes, Hand-Drawn", group: "Spike" },
    "assets/shapes/corner_barbarian.webp": { name: "Barbarian Corner", group: "Barbarian" },
    "assets/shapes/corner_border_barbarian_hand.webp": { name: "Barbarian Corner, Hand-Drawn", group: "Barbarian" },
    "assets/shapes/corner_border_goth1.webp": { name: "Goth Corner", group: "Goth" },
    "assets/shapes/corner_border_plants_hand.webp": { name: "Plants Corner, Hand-Drawn", group: "Vine & Plant" },
    "assets/shapes/corner_dwarf.webp": { name: "Dwarf Corner", group: "Dwarf" },
    "assets/shapes/corner_dwarf_hollow.webp": { name: "Dwarf Hollow Corner", group: "Dwarf" },
    "assets/shapes/corner_ornament.webp": { name: "Ornament Corner", group: "Ornament" },
    "assets/shapes/corner_ornament2.webp": { name: "Ornament Double Corner", group: "Ornament" },
    "assets/shapes/corner_ornament_bold.webp": { name: "Ornament Bold Corner", group: "Ornament" },
    "assets/shapes/corner_ornament_bold2.webp": { name: "Ornament Bold Double Corner", group: "Ornament" },
    "assets/shapes/corner_ornament_bold3.webp": { name: "Ornament Bold Corner 3", group: "Ornament" },
    "assets/shapes/corner_ornament_simple.webp": { name: "Ornament Simple Corner", group: "Ornament" },
    "assets/shapes/corner_ornament_simple2.webp": { name: "Ornament Simple Corner 2", group: "Ornament" },
    "assets/shapes/corner_spikes.webp": { name: "Spikes Corner", group: "Spike" },
    "assets/shapes/corner_spike_hollow.webp": { name: "Spike Hollow Corner", group: "Spike" },
    "assets/shapes/corner_spike_hollow2.webp": { name: "Spike Hollow Corner 2", group: "Spike" },
    "assets/shapes/corner_sticks.webp": { name: "Sticks Corner", group: "Sticks" },
    "assets/shapes/corner_sticks1.webp": { name: "Sticks Corner 2", group: "Sticks" },
    "assets/shapes/corner_vine_hollow.webp": { name: "Vine Hollow Corner", group: "Vine & Plant" },
    "assets/spike_bold.webp": { name: "Spike Bold", group: "Spike" },
    "assets/spike_hollow.webp": { name: "Spike Hollow", group: "Spike" },
    "assets/spike_hollow2.webp": { name: "Spike Hollow Double", group: "Spike" },
    "assets/sticks.webp": { name: "Sticks", group: "Sticks" },
    "assets/vine_hand.webp": { name: "Vine, Hand-Drawn", group: "Vine & Plant" },
    "assets/vine_hollow.webp": { name: "Vine Hollow", group: "Vine & Plant" },
    "assets/vine_plants.webp": { name: "Vine & Plants", group: "Vine & Plant" },
  };

  /**
   * Resolve the curated display info for an asset path (B-4 / AC-4).
   * @returns {{name: string, group: string}}
   */
  function curatedAssetInfo(path) {
    const c = ASSET_CURATION[path];
    if (c) return { name: c.name, group: c.group };
    // Coverage is unit-enforced for ASSET_LIST; any unknown path degrades to
    // a plain, non-filename-derived label rather than the old surgery.
    return { name: "Custom Shape", group: "Custom" };
  }

const AssetCatalog = { ASSET_LIST, ASSET_METADATA, parseAssets, ALL_BORDER_STYLES, SECTION_BORDER_STYLES, ASSET_CURATION, ASSET_GROUP_ORDER, curatedAssetInfo };
if (typeof module !== "undefined" && module.exports) {
  module.exports = AssetCatalog;
}
if (typeof window !== "undefined") {
  window.AssetCatalog = AssetCatalog;
}
