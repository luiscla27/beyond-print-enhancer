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
                SHEET_INNER: '.ct-character-sheet__inner'
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
     * Gets the main character sheet container.
     * @returns {ElementWrapper}
     */
    getCharacterSheet() {
        return this._wrap(this.selectors.CORE.SHEET_DESKTOP);
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
        sidebars.forEach(el => el.style.display = 'none');
        
        // Handle navigation variations
        const navs = document.querySelectorAll('[class*="navigation"]');
        navs.forEach(el => el.style.display = 'none');

        const megaMenus = document.querySelectorAll('[class*="mega-menu"]');
        megaMenus.forEach(el => el.style.display = 'none');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DomManager;
} else {
    window.DomManager = DomManager;
}
