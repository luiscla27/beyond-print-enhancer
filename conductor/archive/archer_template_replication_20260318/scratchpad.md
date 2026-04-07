# Archer Template Scratchpad

## Planned Assets

### Borders
| Original Section | Asset Name | Description | Status |
| --- | --- | --- | --- |
| Main Frame | `border_archer_main.webp` | Braided rope style with corner knots. | |
| Ability/Small Box | `border_archer_box.webp` | Simple hand-drawn rectangular frame. | |
| HP/Armor Section | `border_archer_crest.webp` | Crest/Shield shape with bow-like flourishes. | |
| Equipment/Bottom | `border_archer_interwoven.webp` | Complex interwoven Celtic-style rope. | |

### Shapes (Icons/Flourishes)
| Original Shape | Asset Name | Description | Status |
| --- | --- | --- | --- |
| Bow Icon | `archer_bow.webp` | Hand-drawn bow (top left). | |
| Quiver Icon | `archer_quiver.webp` | Vertical quiver with arrows. | |
| Bird (Falcon/Hawk) | `archer_bird.webp` | Flying predatory bird icon. | |
| Arrow Cluster | `archer_arrows.webp` | Three arrows bunched together. | |
| Central Shield | `archer_shield_main.webp` | Large central shield with crossed bows/arrows. | |
| Bracer Icon | `archer_bracer.webp` | Leather bracer/gauntlet illustration. | |
| Ring Icon | `archer_ring.webp` | Ornate ring icon. | |
| Alliance Hands | `archer_hands.webp` | Clasping hands with crossed arrows. | |
| Tower Icon | `archer_tower.webp` | Castle/Tower illustration. | |
| Broken Arrow | `archer_broken_arrow.webp` | Snapped arrow icon. | |
| Skill Curve | `archer_skill_curve.webp` | Bow-string like curve used for skill list. | |

## Coordinate Mapping (Estimated for 1140x600 canvas)

| Element | Top-Left (x, y) | Bottom-Right (x, y) | Notes |
| --- | --- | --- | --- |
| Main Frame | (0, 0) | (1140, 600) | Outer braided rope. |
| Strength Box | (25, 25) | (165, 175) | "Ability/Small Box" style. |
| Dexterity Box | (25, 180) | (165, 330) | "Ability/Small Box" style. |
| Stats Center (HP) | (370, 185) | (580, 680) | "HP/Armor Section" (Crest). |
| Equipment Table | (655, 445) | (990, 650) | "Interwoven Rope" style. |
| Skills List Curve | (170, 65) | (350, 930) | Bow-string like vertical line. |

## Initial Asset State (2026-03-18)

### assets/
- `border_ability.webp`
- `border_barbarian_hand.webp`
- `border_barbarian.webp`
- `border_box.webp`
- `border_default.webp`
- `border_goth1_hand.webp`
- `border_goth1.webp`
- `border_spikes.webp`
- `dwarf_hollow_hand.webp`
- `dwarf_hollow.webp`
- `dwarf.webp`
- `ornament_bold.webp`
- `ornament_bold2.webp`
- `ornament_simple.webp`
- `ornament.webp`
- `ornament2.webp`
- `spike_bold.webp`
- `spike_hollow.webp`
- `spike_hollow2.webp`
- `sticks.webp`
- `vine_hand.webp`
- `vine_hollow.webp`
- `vine_plants.webp`

### assets/shapes/
- `border_spikes_hand.webp`
- `corner_barbarian.webp`
- `corner_border_barbarian_hand.webp`
- `corner_border_goth1.webp`
- `corner_border_plants_hand.webp`
- `corner_dwarf_hollow.webp`
- `corner_dwarf.webp`
- `corner_ornament_bold.webp`
- `corner_ornament_bold2.webp`
- `corner_ornament_bold3.webp`
- `corner_ornament_simple.webp`
- `corner_ornament_simple2.webp`
- `corner_ornament.webp`
- `corner_ornament2.webp`
- `corner_spike_hollow.webp`
- `corner_spike_hollow2.webp`
- `corner_spikes.webp`
- `corner_sticks.webp`
- `corner_sticks1.webp`
- `corner_vine_hollow.webp`

## Shape Coordinate Mapping (Estimated)

| Element | Top-Left (x, y) | Bottom-Right (x, y) | Notes |
| --- | --- | --- | --- |
| Bow Icon | (30, 30) | (150, 150) | Top-left corner. |
| Bird Icon | (25, 170) | (100, 280) | Beside Strength box. |
| Quiver Icon | (170, 130) | (200, 360) | Beside Skills list. |
| Arrow Cluster | (25, 320) | (100, 440) | Above Hawk icon. |
| Central Shield | (380, 200) | (570, 650) | Large center graphic. |
| Bracer Icon | (25, 715) | (95, 840) | Below Wisdom modifier. |
| Ring Icon | (25, 855) | (95, 970) | Bottom left corner. |
| Alliance Hands | (675, 840) | (755, 980) | Below Allies section. |
| Tower Icon | (790, 870) | (850, 980) | Below Organizations section. |
| Broken Arrow | (900, 840) | (985, 980) | Below Enemies section. |


```json
{
  "templates": [
    {
      "id": "archer",
      "name": "Archer Template",
      "thumbnail": "assets/thumbnails/archer.webp",
      "data": {
        "version": "1.4.0",
        "sections": {
          "section-id": {
            "left": "10px",
            "top": "20px",
            "width": "200px",
            "height": "150px",
            "borderStyle": "border_archer_header"
          }
        },
        "shapes": [
          {
            "id": "shape-1",
            "assetPath": "assets/shapes/archer_main.webp",
            "left": "100px",
            "top": "50px",
            "width": "50px",
            "height": "50px",
            "rotation": 0
          }
        ]
      }
    }
  ]
}
```
