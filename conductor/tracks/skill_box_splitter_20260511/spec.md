# Specification: Skill Box Splitter

## 1. Overview
The goal of this track is to split the combined `ct-skills-box` section into 5 individual sections, one for each specified ability score: STR, INT, WIS, CHA, and DEX. This is achieved by introducing a new "Splitter" button in the section's actions area. The split state will be saved and automatically reapplied on load.

## 2. Functional Requirements
1. **Splitter Button Injection:**
   - Inject a new button into the `be-section-actions` container specifically for the `ct-skills-box` section.
   - The button should display an icon only.
2. **Splitting Logic:**
   - When the Splitter button is clicked (or automatically triggered), trigger the existing section CLONE functionality to create 5 new cloned sections.
   - The 5 new sections will be retitled to: `STR`, `INT`, `WIS`, `CHA`, `DEX`.
   - The original `ct-skills-box` section must be deleted after successful cloning.
   - The newly cloned sections must NOT contain the Splitter button.
3. **Item Filtering:**
   - For each of the 5 newly cloned sections, scan their `.ct-skills__item` rows.
   - Keep only the skill items whose `.ct-skills__item--stat` element's text content matches the ENUM title of that specific clone.
   - Remove all other non-matching `.ct-skills__item` elements from that clone.
4. **Persistence & Initialization:**
   - A true/false flag indicating whether the skills box has been split must be saved in the extension's generated JSON state.
   - Upon loading the state JSON, if this flag is `true`, the splitting process must be executed automatically.
   - Ensure that the cloned sections work seamlessly with existing save/load events (so their state, layout, and properties are maintained).

## 3. Non-Functional Requirements
- **UI Consistency:** The new icon button should match the styling of existing buttons in the `be-section-actions` area.