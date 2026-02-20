class DomManager {
    constructor() {
        this.selectors = {
            CORE: {
                SHEET_DESKTOP: '.ct-character-sheet-desktop',
                SIDEBAR: '.ct-sidebar',
                NAVIGATION: 'nav', // Often the main navigation
                QUICK_INFO: '.ct-quick-info',
                SITE_BAR: '.site-bar',
                HEADER_MAIN: 'header.main',
                MEGA_MENU_TARGET: '#mega-menu-target',
                FOOTER: 'footer',
                SITE_ALERT: '.ddb-site-alert',
                WATERMARK: '.watermark',
                NOTIFICATIONS: '.notifications-wrapper',
                SIDEBAR_PORTAL: '.ct-sidebar__portal',
                SPELL_MANAGER: '.ct-spell-manager',
                SHEET_INNER: '.ct-character-sheet__inner',
                MM_NAVBAR: '.mm-navbar',
                CONTENT_GROUP: 'div.ct-content-group',
                BUTTON: '.ct-button',
                THEME_BUTTON: '.ct-theme-button',
                TAB_BUTTON: 'button[class*="tabButton"]',
                PRIMARY_BOX_WRAPPER: '[class*="styles_primaryBox"]',
                HEADING_STYLES: '[class^="styles_heading__"]',
                SECTION_HEADING_STYLES: '[class^="styles_sectionHeading__"]',
                HEADING_SUFFIX: '[class$="-heading"]',
                HEADING_SUFFIX_ALT: '[class$="__heading"]',
                GROUP_HEADER_CONTENT: '.ct-content-group__header-content',
                DICE_CONTAINER: '.integrated-dice__container',
                DEFENSES: '.ct-sidebar__section--defenses',
                DEFENSES_ALT: '[class*="sidebar__section--defenses"]',
                DEFENSES_HEADER: '.ct-sidebar__section-header',
                DEFENSES_HEADER_ALT: '[class*="sidebar__section-header"]',
                COMBAT_TABLET: '.ct-status-summary-bar',
                COMBAT_TABLET_ALT: '[class*="status-summary-bar"]',
                TIDBITS_NAME: '.ct-character-tidbits__name',
                TIDBITS_NAME_ALT: '[class*="tidbits__name"]',
                SUBSECTION_HEADER: '.ct-subsection__header',
                SECTION_HEADER: '.ct-section__header',
                CHARACTER_TOOLS: '#character-tools-target',
                SUBSECTIONS: '.ct-subsections', // Added
                ABILITY: '.ct-quick-info__ability',
                ABILITY_NAME: '.ct-quick-info__ability-name'
            },
            SPELLS: {
                CONTAINER: '.ct-spells',
                ROW: '.ct-spells-spell',
                LABEL: '.ct-spells-spell__label',
                FILTER: '.ct-spells-filter',
                ACTION: '.ct-spells-spell__action',
                LEVEL_HEADER: '.ct-content-group__header', // Generic but often used in spells
                SPELL_NAME: '.ct-spell-name', // Hypothetical, need to verify if distinct from label
                DETAIL_BUTTON: '.be-spell-details-button',
                FILTER_CLASS: '.ct-spells-filter' // For removal
            },
            ACTIONS: {
                CONTAINER: '[class*="styles_actionsList__"]',
                LIST: '[class*="styles_actionsList__"]',
                ATTACK_ROW: '[class*="styles_attackTable__"]' // Based on main.js analysis
            },
            EQUIPMENT: {
                CONTAINER: '.ct-equipment', // Need to verify if this exists or is generic
                FILTER: '.ct-equipment__filter',
                INVENTORY_FILTER: '.ct-inventory__filter'
            },
            TRAITS: {
                CONTAINER: '[class*="__traits"]',
                MANAGEMENT_LINK: '.ct-features__management-link' // Often shared or similar
            },
            EXTRAS: {
                CONTAINER: '.ct-extras', // Based on analysis
                FILTER: '.ct-extras__filter',
                INTERACTIONS: '.ct-extras-filter__interactions'
            },
            COMPACT: {
                TABLE_HEADER: '[class^="styles_tableHeader__"]',
                GENERIC_HEADER: '[class$="__header"]',
                GENERIC_HEADING: '[class$="__heading"]',
                GENERIC_ROW: '[class$="-row"]',
                ROW_HEADER: '[class$="__row-header"]',
                PRIMARY: '[class$="--primary"]',
                ROW_PRIMARY: '[class$="-row__primary"]',
                GENERIC_CONTENT: '[class$="-content"]',
                ICON_ATTACK: '[class$="__attack-save-icon"]',
                ICON_RANGE: '[class$="__range-icon"]',
                ICON_CAST_TIME: '[class$="__casting-time-icon"]',
                ICON_DAMAGE: '[class$="__damage-effect-icon"]',
                ICON_FILE: '.ddbc-file-icon',
                PREVIEW: '[class$="--preview"]',
                PREVIEW_ALT: '[class$="__preview"]',
                LABEL: '[class$="__label"]',
                NOTES: '[class$="__notes"]',
                ACTIVATION: '[class$="__activation"]',
                RANGE: '[class$="__range"]',
                HIT_DC: '[class$="__hit-dc"]',
                EFFECT: '[class$="__effect"]',
                BUTTON_CONTAINER: 'button[class$="__container"]',
                SLOTS: '[class$="__slots"]',
                HEADER_CONTENT: '[class$="__header-content"]',
                ACTION: '[class$="__action"]',
                DISTANCE: '[class$="__distance"]',
                META: '[class$="__meta"]',
                ROW_HEADER_DIV: 'div[class$="-row-header"] > div',
                GENERIC_CONTENT_DIV_DIV: 'div[class$="-content"] > div > div',
                ROW_HEADER_NAME: 'div[class$="-row-header"] div[class$="--name"]',
                CONTENT_NAME: 'div[class$="-content"] div[class$="__name"]',
                CONTENT_SLOT_NAME: 'div[class$="-content"] div[class$="-slot__name"]',
                CONTENT_ITEM_NAME: 'div[class$="-content"] div[class$="-item__name"]'
            },
            UI: {
                SPINNER: '.be-spinner',
                ERROR_ACTIONS: '.be-error-actions',
                RETRY_BTN: '.be-retry-button',
                DELETE_BTN: '.be-delete-button',
                EXTRACTABLE: '.be-extractable',
                DICE_ROLLER: '.dice-rolling-panel',
                COLLAPSED_ACTIONS: '[class$="__actions--collapsed"]',
                THEME_LINK: '.ddbc-theme-link',
                TIDBITS_HEADING: '.ddbc-character-tidbits__heading',
                FEATURES_LINK: '.ct-features__management-link',
                SUBSECTION_FOOTER: '.ct-subsection__footer',
                HEADER_DESKTOP: '.ct-character-sheet-desktop .ct-character-header-desktop',
                QUICK_INFO_INSPIRATION: '.ct-quick-info__inspiration',
                QUICK_INFO_HEALTH_HEADER: '.ct-quick-info__health h1 + div',
                QUICK_INFO_HEALTH: '.ct-quick-info__health',
                PORTRAIT: '.ddbc-character-avatar__portrait',
                PRINT_CONTAINER: '.print-section-container',
                COMPACT_MODE: '.be-compact-mode',
                SIDEBAR_INNER: '.ct-sidebar__inner',
                CHARACTER_SHEET: '.ct-character-sheet',
                PRIMARY_BOX: '.ct-primary-box',
                TOOLS_TARGET: '#character-tools-target',
                SUBSECTION: '.ct-subsection',
                SECTION: '.ct-section',
                MENU: 'menu',
                HEADER_WRAPPER: '.header-wrapper',
                SEARCH_INPUT: 'input[type="search"]',
                FILTER_GENERIC: '[class*="filter"]'
            },
            SKILLS: {
                BOX: '.ct-skills__box',
                CONTAINER: '.ct-skills'
            },
            COMBAT: {
                STATUSES: '.ct-combat__statuses',
                AC_VALUE: '.ddbc-armor-class-box__value'
            },
            SENSES: {
                CALLOUT_VALUE: '.ct-senses__callout-value'
            },
            // Extractables
            EXTRACTABLE: {
                GROUP: '[class*="-group"]',
                SNIPPET_CLASS: '[class*="-snippet--class"]',
                ACTIONS_LIST: '[class*="styles_actionsList__"]',
                ATTACK_TABLE: '[class*="styles_attackTable__"]',
                TRAITS: '[class*="__traits"]',
                HEADER_GENERIC: 'h1, h2, h3, h4, h5, [class*="head"], [data-testid*="header"], [data-testid*="heading"]',
                CONTENT_GROUP_HEADER: '.ct-content-group__header',
                ID_PREFIX: 'be-ext-'
            },
            // SVGs
            SVG: {
                BOX_BACKGROUND: '.ddbc-box-background',
                ARMOR_CLASS: '.ddbc-armor-class-box-svg',
                INITIATIVE: '.ddbc-initiative-box-svg',
                ARMOR_CLASS_BOX: '.ddbc-armor-class-box',
                INITIATIVE_BOX: '.ddbc-initiative-box',
                REP_BOX: 'svg.ddbc-rep-box-background__svg',
                PROFICIENCY: '.ct-proficiency-groups-box svg',
                SENSES: '.ct-senses-box svg',
                SKILLS: '.ct-skills-box svg',
                SAVING_THROWS: '.ct-saving-throws-box svg',
                GENERIC_SECTION: 'section > div > svg',
                DEFS: 'svg definitions', // internal marker
                ALL: 'svg'
            },
            // CSS Generation extras
            CSS: {
                DIALOG_SIBLING: 'dialog + div',
                SHEET_BEFORE: '.ct-character-sheet:before'
            }
        };
    }

    static getInstance() {
        if (!DomManager.instance) {
            DomManager.instance = new DomManager();
        }
        return DomManager.instance;
    }

    /**
     * Helper to wrap an element or return empty wrapper.
     * @param {string} selector 
     * @returns {ElementWrapper}
     */
    _wrap(selector) {
        const el = document.querySelector(selector);
        return new ElementWrapper(el);
    }

    /**
     * Helper to wrap all elements matching selector.
     * @param {string} selector 
     * @returns {ElementWrapper[]}
     */
    _wrapAll(selector) {
        const els = document.querySelectorAll(selector);
        return Array.from(els).map(el => new ElementWrapper(el));
    }

    /**
     * Gets the main character sheet container.
     * @returns {ElementWrapper}
     */
    getCharacterSheet() {
        return this._wrap(this.selectors.CORE.SHEET_DESKTOP);
    }

    /**
     * Gets the inner sheet container.
     * @returns {ElementWrapper}
     */
    getSheetInner() {
        return this._wrap(this.selectors.CORE.SHEET_INNER);
    }

    /**
     * Gets the sidebar container.
     * @returns {ElementWrapper}
     */
    getSidebar() {
        return this._wrap(this.selectors.CORE.SIDEBAR);
    }

    /**
     * Gets the main navigation element.
     * @returns {ElementWrapper}
     */
    getNavigation() {
        // More specific check might be needed for D&D Beyond's structure
        // Often it's within the sheet desktop or a specific class
        // For now, simple 'nav' as per analysis or refined selector
        // The analysis showed `document.querySelector('.ct-character-sheet-desktop nav')` usage.
        const el = document.querySelector('.ct-character-sheet-desktop nav') || document.querySelector(this.selectors.CORE.NAVIGATION);
        return new ElementWrapper(el);
    }

    /**
     * Gets the quick info panel.
     * @returns {ElementWrapper}
     */
    getQuickInfo() {
        return this._wrap(this.selectors.CORE.QUICK_INFO);
    }

    /**
     * Hides core UI elements that are not needed for printing.
     */
    hideCoreInterface() {
        const selectors = [
            this.selectors.CORE.SITE_BAR,
            this.selectors.CORE.HEADER_MAIN,
            this.selectors.CORE.MEGA_MENU_TARGET,
            this.selectors.CORE.FOOTER,
            this.selectors.CORE.SITE_ALERT,
            this.selectors.CORE.WATERMARK,
            this.selectors.CORE.NOTIFICATIONS,
            this.selectors.CORE.NAVIGATION // Might be too broad if navigation is needed for extraction, but tweakStyles hides it.
        ];
        
        selectors.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.style.display = 'none';
        });
        
        // Handle sidebars
        const sidebars = document.querySelectorAll('[class*="sidebar"]');
        sidebars.forEach(el => {
            // User Request: Exclude the portal which contains modals
            if (el.classList.contains('ct-sidebar__portal') || el.closest('.ct-sidebar__portal')) return;
            el.style.display = 'none';
        });
        
        // Handle navigation variations
        const navs = document.querySelectorAll('[class*="navigation"]');
        navs.forEach(el => el.style.display = 'none');

        const megaMenus = document.querySelectorAll('[class*="mega-menu"]');
        megaMenus.forEach(el => el.style.display = 'none');
    }

    /**
     * Gets the main spells container.
     * @returns {ElementWrapper}
     */
    getSpellsContainer() {
        return this._wrap(this.selectors.SPELLS.CONTAINER);
    }

    /**
     * Gets all spell rows.
     * @returns {ElementWrapper[]}
     */
    getSpellRows(context = document) {
        if (context instanceof ElementWrapper) context = context.element;
        // If context is provided, query within it, otherwise global
        const els = context.querySelectorAll ? context.querySelectorAll(this.selectors.SPELLS.ROW) : document.querySelectorAll(this.selectors.SPELLS.ROW);
        return Array.from(els).map(el => new ElementWrapper(el));
    }

    /**
     * Gets the actions container.
     * @returns {ElementWrapper}
     */
    getActionsContainer() {
        return this._wrap(this.selectors.ACTIONS.CONTAINER);
    }

    /**
     * Gets the equipment container.
     * @returns {ElementWrapper}
     */
    getEquipmentContainer() {
        return this._wrap(this.selectors.EQUIPMENT.CONTAINER);
    }

    /**
     * Gets the extras container.
     * @returns {ElementWrapper}
     */
    getExtrasContainer() {
        return this._wrap(this.selectors.EXTRAS.CONTAINER);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DomManager;
} else {
    window.DomManager = DomManager;
}
