import type { EffectProvider } from './types';

class EffectRegistry {
    private providers: Map<string, EffectProvider> = new Map();

    public register(provider: EffectProvider) {
        if (this.providers.has(provider.id)) {
            console.warn(`[EffectRegistry] Overwriting existing effect provider for id: ${provider.id}`);
        }
        this.providers.set(provider.id, provider);
        console.log(`[EffectRegistry] Registered effect: ${provider.id} (${provider.name})`);
    }

    public get(id: string): EffectProvider | undefined {
        return this.providers.get(id);
    }

    public getAll(): EffectProvider[] {
        return Array.from(this.providers.values());
    }
}

// Export a singleton instance
export const effectRegistry = new EffectRegistry();
