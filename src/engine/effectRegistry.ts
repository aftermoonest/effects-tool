import type { EffectPlugin } from './types';

class EffectRegistry {
    private plugins: Map<string, EffectPlugin> = new Map();

    public register(plugin: EffectPlugin) {
        if (this.plugins.has(plugin.id)) {
            console.warn(`[EffectRegistry] Overwriting existing effect plugin for id: ${plugin.id}`);
        }
        this.plugins.set(plugin.id, plugin);
        console.log(`[EffectRegistry] Registered effect plugin: ${plugin.id} (${plugin.name})`);
    }

    public get(id: string): EffectPlugin | undefined {
        return this.plugins.get(id);
    }

    public getAll(): EffectPlugin[] {
        return Array.from(this.plugins.values());
    }
}

// Export a singleton instance
export const effectRegistry = new EffectRegistry();
