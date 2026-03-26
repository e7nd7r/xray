/**
 * XRay Controller unit tests
 */

import { jest } from '@jest/globals';
import { XRay } from './xray';
import { Panel, type PanelConfig } from './ui/panel';

// Mock Panel implementation for testing
class MockPanel extends Panel {
  public renderCalled = false;
  public destroyCalled = false;
  private iconName: string;

  constructor(id: string, title: string, icon: string = 'settings') {
    super({ id, title } as PanelConfig);
    this.iconName = icon;
  }

  protected getContentHTML(): string {
    return '<div>Mock content</div>';
  }

  protected attachContentEvents(): void {
    // No-op for tests
  }

  render(): void {
    this.renderCalled = true;
    // Don't call super.render() to avoid DOM operations in tests
  }

  destroy(): void {
    this.destroyCalled = true;
    // Don't call super.destroy() to avoid DOM operations in tests
  }

  getTitle(): string {
    return this.config.title;
  }

  getIcon(): string {
    return this.iconName;
  }
}

describe('XRay Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    // Clean up any DOM elements from previous tests
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('should create with default config', () => {
      const xray = new XRay();

      expect(xray).toBeDefined();
      expect(xray.getStore()).toBeDefined();
      expect(xray.getTabDock()).toBeDefined();
      expect(xray.isShown()).toBe(false);
    });

    it('should create with custom config', () => {
      const xray = new XRay({
        tabDock: { side: 'right', position: 200 },
        persistState: true,
      });

      expect(xray).toBeDefined();
    });

    it('should restore state when persistState is true', () => {
      // Save some state first
      const initialXray = new XRay();
      initialXray.getStore().update('toolbar', (s) => ({ ...s, currentTool: 'arrow' }));
      initialXray.getStore().save();

      // Create new XRay with persistState
      const xray = new XRay({ persistState: true });
      const toolbar = xray.getStore().get('toolbar');

      expect(toolbar.currentTool).toBe('arrow');
    });
  });

  describe('panel registration', () => {
    it('should register a panel', () => {
      const xray = new XRay();
      const panel = new MockPanel('test', 'Test Panel');

      xray.registerPanel('test', panel);

      expect(xray.hasPanel('test')).toBe(true);
      expect(xray.getPanel('test')).toBe(panel);
    });

    it('should return undefined for unregistered panel', () => {
      const xray = new XRay();

      expect(xray.getPanel('nonexistent')).toBeUndefined();
      expect(xray.hasPanel('nonexistent')).toBe(false);
    });

    it('should unregister a panel', () => {
      const xray = new XRay();
      const panel = new MockPanel('test', 'Test Panel');

      xray.registerPanel('test', panel);
      xray.unregisterPanel('test');

      expect(xray.hasPanel('test')).toBe(false);
      expect(panel.destroyCalled).toBe(true);
    });

    it('should get all panel IDs', () => {
      const xray = new XRay();
      xray.registerPanel('panel1', new MockPanel('panel1', 'Panel 1'));
      xray.registerPanel('panel2', new MockPanel('panel2', 'Panel 2'));

      const ids = xray.getPanelIds();

      expect(ids).toContain('panel1');
      expect(ids).toContain('panel2');
      expect(ids.length).toBe(2);
    });
  });

  describe('lifecycle', () => {
    it('should show the XRay system', () => {
      const xray = new XRay();
      const panel = new MockPanel('test', 'Test Panel');

      xray.registerPanel('test', panel);
      xray.show();

      expect(xray.isShown()).toBe(true);
      expect(panel.renderCalled).toBe(true);
      // TabDock should have rendered (creates DOM element)
      expect(document.querySelector('.xray-tab-dock')).not.toBeNull();
    });

    it('should not show again if already visible', () => {
      const xray = new XRay();
      const panel = new MockPanel('test', 'Test Panel');

      xray.registerPanel('test', panel);
      xray.show();

      // Reset the flag
      panel.renderCalled = false;

      xray.show(); // Call again

      // Panel render should not be called again
      expect(panel.renderCalled).toBe(false);
    });

    it('should hide the XRay system', () => {
      const xray = new XRay();
      const panel = new MockPanel('test', 'Test Panel');

      xray.registerPanel('test', panel);
      xray.show();
      xray.hide();

      expect(xray.isShown()).toBe(false);
      expect(panel.destroyCalled).toBe(true);
      // TabDock should be removed from DOM
      expect(document.querySelector('.xray-tab-dock')).toBeNull();
    });

    it('should not hide if already hidden', () => {
      const xray = new XRay();
      const panel = new MockPanel('test', 'Test Panel');

      xray.registerPanel('test', panel);
      xray.hide(); // Already hidden

      expect(panel.destroyCalled).toBe(false);
    });

    it('should destroy and save state when persistState is enabled', () => {
      const xray = new XRay({ persistState: true });
      const panel = new MockPanel('test', 'Test Panel');

      xray.registerPanel('test', panel);
      xray.show();

      // Update state
      xray.getStore().update('toolbar', (s) => ({ ...s, currentTool: 'arrow' }));

      xray.destroy();

      // Verify state was saved
      const saved = sessionStorage.getItem(`xray-state-${window.location.pathname}`);
      expect(saved).toBeDefined();

      const parsed = JSON.parse(saved!);
      expect(parsed.toolbar.currentTool).toBe('arrow');
    });

    it('should clear panels on destroy', () => {
      const xray = new XRay();
      xray.registerPanel('panel1', new MockPanel('panel1', 'Panel 1'));
      xray.registerPanel('panel2', new MockPanel('panel2', 'Panel 2'));

      xray.destroy();

      expect(xray.getPanelIds()).toEqual([]);
    });
  });

  describe('state access', () => {
    it('should provide access to StateStore', () => {
      const xray = new XRay();
      const store = xray.getStore();

      expect(store).toBeDefined();
      expect(store.get('toolbar')).toBeDefined();
    });

    it('should provide a single StateStore for the entire system', () => {
      const xray = new XRay();
      const store = xray.getStore();

      // Store should be available for controllers to use
      expect(store).toBeDefined();
      expect(store.get('toolbar')).toBeDefined();
      expect(store.get('palette')).toBeDefined();
    });
  });

  describe('panel title and icon', () => {
    it('should use panel getTitle method', () => {
      const xray = new XRay();
      const panel = new MockPanel('test', 'My Custom Title');

      xray.registerPanel('test', panel);
      xray.show();

      // Check that the tab with the title was created
      const tabElement = document.querySelector('[data-tab-id="test"]');
      expect(tabElement).not.toBeNull();
      expect(tabElement?.getAttribute('title')).toBe('My Custom Title');
    });

    it('should use custom label override', () => {
      const xray = new XRay();
      const panel = new MockPanel('test', 'Panel Title');

      xray.registerPanel('test', panel, { label: 'Override Label' });
      xray.show();

      const tabElement = document.querySelector('[data-tab-id="test"]');
      expect(tabElement?.getAttribute('title')).toBe('Override Label');
    });
  });
});
