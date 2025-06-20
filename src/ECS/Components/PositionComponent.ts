// src/ECS/Components/PositionComponent.ts
import { Component } from '../Component';
import { HotReloadManager } from '../../HotReloadManager'; // Adjusted path

export class PositionComponent extends Component {
    public x: number;
    public y: number;
    public z: number = 0; // New field for migration demo

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        super();
        this.x = x;
        this.y = y;
        this.z = z; // Initialize new field
        // console.log(`[PositionComponent] Constructed: x=${this.x}, y=${this.y}, z=${this.z} for entity ${this.entity?.id}`);
    }

    public override onBeforeReload(): any {
        const state = { x: this.x, y: this.y, z: this.z, oldVersionMarker: "v1State" };
        console.log(`[HMR] PositionComponent.onBeforeReload on entity ${this.entity?.id}. Saving state:`, JSON.stringify(state));
        return state;
    }

    public override onAfterReload(previousState: any): void {
        // Note: migrateState would have already run and potentially modified this instance's properties
        // using values from previousState. This hook is for any additional logic after migration/basic restore.
        console.log(`[HMR] PositionComponent.onAfterReload on entity ${this.entity?.id}. Current state before this hook: x=${this.x}, y=${this.y}, z=${this.z}. Received (original) previousState:`, JSON.stringify(previousState));

        // If migrateState didn't handle everything or if there's logic specific to onAfterReload:
        if (previousState) {
            // Example: if a property was intentionally not handled by migrateState for some reason
            // or if some setup needs to happen based on the restored state.
            // For this component, migrateState is comprehensive for x,y,z.
        } else {
            console.log(`[HMR] PositionComponent on entity ${this.entity?.id}: No previous state provided to onAfterReload.`);
        }
        console.log(`[HMR] PositionComponent state after onAfterReload logic on entity ${this.entity?.id}: x=${this.x}, y=${this.y}, z=${this.z}`);
    }

    public static override migrateState(oldState: any, newInstance: PositionComponent): void {
        // Note: newInstance.entity might not be set yet when this static method is called by HotReloadManager.
        // Logging newInstance.entity?.id here might show undefined.
        console.log(`[HMR] PositionComponent.migrateState. OldState:`, JSON.stringify(oldState), "New instance initial state:", JSON.stringify({x: newInstance.x, y: newInstance.y, z: newInstance.z}));

        if (oldState && typeof oldState === 'object') {
            // Handle potential old field names (example)
            newInstance.x = oldState.posX !== undefined ? oldState.posX : (oldState.x !== undefined ? oldState.x : newInstance.x);
            newInstance.y = oldState.posY !== undefined ? oldState.posY : (oldState.y !== undefined ? oldState.y : newInstance.y);

            // Handle new 'z' field: if oldState has it, use it, otherwise it keeps its default from constructor
            newInstance.z = oldState.z !== undefined ? oldState.z : newInstance.z;

            if (oldState.z === undefined && newInstance.z !== undefined) { // newInstance.z would be its default value
                console.log(`[HMR] PositionComponent.migrateState: Field 'z' was not in old state, initialized to default ${newInstance.z}.`);
            }
            if (oldState.oldVersionMarker) {
                console.log(`[HMR] PositionComponent.migrateState: Migrated from state marked as: ${oldState.oldVersionMarker}`);
            }
        } else {
            console.log("[HMR] PositionComponent.migrateState: No old state provided or not an object.");
        }
        console.log(`[HMR] PositionComponent.migrateState: State after migration: x=${newInstance.x}, y=${newInstance.y}, z=${newInstance.z}`);
    }

    public toString(): string {
        return `Position(x: ${this.x}, y: ${this.y}, z: ${this.z})`;
    }
}

// HMR Boilerplate - Vite specific
if (typeof import.meta.hot !== 'undefined') {
    // Ensure data object and its expected HMR properties exist on first load for this module.
    // import.meta.hot.data is persistent across HMR updates for *this specific module*.
    if (!import.meta.hot.data.ecsComponentState && !import.meta.hot.data.ecsComponentModuleUrl) {
        import.meta.hot.data.ecsComponentState = {}; // Will be populated by handleComponentDispose
        import.meta.hot.data.ecsComponentModuleUrl = ''; // Will be set by handleComponentDispose
        console.log(`[PositionComponent.ts HMR] Initialized import.meta.hot.data properties for component HMR for ${import.meta.url}.`);
    }

    import.meta.hot.dispose((data: any) => {
        console.log(`[PositionComponent.ts HMR] dispose CALLED for module: ${import.meta.url}`);
        // Pass the current class constructor to HotReloadManager.
        // `data` is `import.meta.hot.data` for this module.
        HotReloadManager.instance.handleComponentDispose(import.meta.url, PositionComponent, data);
    });

    import.meta.hot.accept((newModule?: { PositionComponent?: typeof Component } ) => {
        // `newModule` is an object like: { PositionComponent: class PositionComponent_1 { ... } }
        console.log(`[PositionComponent.ts HMR] accept CALLED for module: ${import.meta.url}`);
        if (newModule && newModule.PositionComponent) {
            HotReloadManager.instance.handleComponentAccept(
                newModule.PositionComponent as any, // Cast to satisfy HotReloadableModule<PositionComponent>
                import.meta.url,
                import.meta.hot.data // Pass the persistent data store for this module
            );
            console.log('[PositionComponent.ts HMR] Module reloaded and new PositionComponent class accepted.');
        } else {
            console.error('[PositionComponent.ts HMR] Accept failed: new module or new PositionComponent class not found on newModule:', newModule);
            // If the accept handler fails or newModule is not as expected,
            // you might want to invalidate to force a full reload or let it bubble up.
            // For example: import.meta.hot.invalidate();
        }
    });
    console.log(`[PositionComponent.ts HMR] HMR hooks registered for ${import.meta.url}.`);
} else {
    // console.log('[PositionComponent.ts HMR] HMR API (import.meta.hot) not available for this module.');
}
