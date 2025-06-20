// src/ECS/Systems/ExampleSystem.ts
import { EntitySystem } from './EntitySystem'; // Adjust path if needed
import type { Entity } from '../Entity'; // Adjust path
import { HotReloadManager } from '../../HotReloadManager'; // Adjust path
import { Matcher }from '../Utils/Matcher'; // Ensure Matcher is imported

export class ExampleSystem extends EntitySystem {
    private updateCount: number = 0;
    private message: string;
    public GREETING_MESSAGE_STATIC: string = "Hello from ExampleSystem static property!";

    constructor(message: string = "Default Message") {
        super(Matcher.empty().all()); // Assuming EntitySystem constructor takes a Matcher
        this.message = message;
        console.log(`[ExampleSystem] Constructed with message: "${this.message}", initial count: ${this.updateCount}`);
    }

    public initialize(): void {
        super.initialize(); // Call base initialize if it does anything
        console.log(`[ExampleSystem] Initialized via initialize(). Message: "${this.message}"`);
    }

    public process(entities: Entity[]): void {
        this.updateCount++;
        if (this.updateCount % 60 === 0) { // Log every ~second if 60fps
            console.log(`[ExampleSystem] Processing. Message: "${this.message}". Update count: ${this.updateCount}. Entities: ${entities.length}`);
        }
    }

    public override onBeforeReload(): any {
        const baseState = super.onBeforeReload ? super.onBeforeReload() : {};
        console.log(`[ExampleSystem HMR] onBeforeReload called. Current count: ${this.updateCount}, Message: "${this.message}"`);
        return {
            ...baseState,
            updateCount: this.updateCount,
            message: this.message
        };
    }

    public override onAfterReload(previousState: any): void {
        if(super.onAfterReload) super.onAfterReload(previousState?.baseState || previousState);

        console.log('[ExampleSystem HMR] onAfterReload called.');
        if (previousState) {
            this.updateCount = previousState.updateCount !== undefined ? previousState.updateCount : 0;
            this.message = previousState.message !== undefined ? previousState.message : "Reloaded Default Message";
            console.log(`[ExampleSystem HMR] State restored. New count: ${this.updateCount}, New Message: "${this.message}"`);
        } else {
            console.log('[ExampleSystem HMR] No previous state found or provided.');
            this.message = "Reloaded Without State";
        }
    }
}

// HMR Boilerplate - Vite specific
if (typeof import.meta.hot !== 'undefined') {
    // Ensure data is initialized if this is the first load and HMR is active
    // import.meta.hot.data is persistent across HMR updates for this module.
    if (!import.meta.hot.data.ecsSystemState && !import.meta.hot.data.ecsSystemModuleUrl) {
         // Initialize fields that HotReloadManager expects to write to.
         // This helps avoid issues if dispose is called before accept on the very first HMR cycle.
        import.meta.hot.data.ecsSystemState = {};
        import.meta.hot.data.ecsSystemModuleUrl = '';
        console.log('[ExampleSystem.ts HMR] Initialized import.meta.hot.data properties for ECS HMR.');
    }


    import.meta.hot.dispose((data: any) => {
        console.log(`[ExampleSystem.ts HMR] dispose CALLED for module: ${import.meta.url}`);
        HotReloadManager.instance.handleSystemDispose(import.meta.url, data);
    });

    import.meta.hot.accept((newModule: any) => {
        console.log(`[ExampleSystem.ts HMR] accept CALLED for module: ${import.meta.url}`);
        if (newModule && newModule.ExampleSystem) {
            HotReloadManager.instance.handleSystemAccept(
                newModule.ExampleSystem,
                import.meta.url,
                import.meta.hot.data
            );
            console.log('[ExampleSystem.ts HMR] Module reloaded and new ExampleSystem class accepted.');
        } else {
            console.error('[ExampleSystem.ts HMR] Accept failed: new module or ExampleSystem class not found on newModule:', newModule);
        }
    });
    console.log(`[ExampleSystem.ts HMR] HMR hooks registered for ${import.meta.url}.`);
} else {
    // console.log('[ExampleSystem.ts HMR] HMR API (import.meta.hot) not available for this module.');
}
