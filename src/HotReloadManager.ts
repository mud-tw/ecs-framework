// src/HotReloadManager.ts
import type { Scene } from './ECS/Scene';
import type { EntitySystem } from './ECS/Systems/EntitySystem';
import { Component } from './ECS/Component'; // Added import for Component

/**
 * Represents a module that exports a class constructor, typically an EntitySystem.
 * This is used by the HotReloadManager to instantiate new system versions.
 */
export interface HotReloadableModule<T> {
    new (...args: any[]): T;
    /**
     * Optional unique identifier for the module, useful if the module path (import.meta.url)
     * isn't available or reliable in all HMR scenarios.
     */
    MODULE_ID?: string;
}

/**
 * Stores the state of a system during Hot Module Replacement (HMR).
 * This allows for state preservation and restoration across module reloads.
 */
interface HmrSystemState {
    /**
     * The state captured from the system's onBeforeReload() method.
     */
    state?: any;
    /**
     * Optional: Stores the original configuration or arguments used to create the system.
     * This might be needed if systems require complex setup for re-instantiation.
     * For now, it's assumed that systems have a default constructor or that the Scene
     * handles complex setup during its addEntityProcessor method.
     */
    originalConfig?: any;
}

/**
 * Stores the state of component instances during HMR.
 */
interface HmrComponentState {
    // Map of Entity ID to the state returned by component's onBeforeReload
    instanceStates: Map<number, any>;
    // Reference to the old Component class, to identify and remove its instances
    oldComponentClass: HotReloadableModule<Component>;
}

/**
 * Manages the Hot Module Replacement (HMR) process for EntitySystems and Components.
 * It handles saving and restoring system state across module reloads,
 * allowing for a smoother development experience.
 */
export class HotReloadManager {
    private static _instance: HotReloadManager;
    private activeScene: Scene | null = null;
    private isEnabled: boolean = false;

    /**
     * Maps a module URL (or a unique module ID) to its active EntitySystem instance.
     * This is crucial for identifying which system to operate on during HMR events.
     */
    private activeSystemInstances = new Map<string, EntitySystem>();

    private constructor() {}

    /**
     * Gets the singleton instance of the HotReloadManager.
     */
    public static get instance(): HotReloadManager {
        if (!HotReloadManager._instance) {
            HotReloadManager._instance = new HotReloadManager();
        }
        return HotReloadManager._instance;
    }

    /**
     * Initializes the HotReloadManager.
     * @param scene The active game scene.
     * @param enabled Whether HMR is enabled. Defaults to true.
     */
    public initialize(scene: Scene, enabled: boolean = true): void {
        this.activeScene = scene;
        this.isEnabled = enabled;
        if (this.isEnabled) {
            console.log('[HMR] HotReloadManager initialized and enabled.');
        } else {
            console.log('[HMR] HotReloadManager initialized but is DISABLED.');
        }
    }

    /**
     * Checks if HMR is currently enabled.
     */
    public get hmrEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Enables Hot Module Replacement functionality.
     */
    public enable(): void {
        this.isEnabled = true;
        console.log('[HMR] Hot Reloading ENABLED.');
    }

    /**
     * Disables Hot Module Replacement functionality.
     */
    public disable(): void {
        this.isEnabled = false;
        console.log('[HMR] Hot Reloading DISABLED.');
    }

    /**
     * Registers an active system instance with the HotReloadManager.
     * This should be called when a system is added to the scene if HMR is enabled.
     * @param systemInstance The EntitySystem instance to register.
     * @param moduleUrl The URL of the module where the system is defined (e.g., import.meta.url).
     */
    public registerSystemInstance(systemInstance: EntitySystem, moduleUrl: string): void {
        if (!this.isEnabled) return;
        if (!moduleUrl) {
            console.warn(`[HMR] Attempted to register system ${systemInstance.constructor.name} without a moduleUrl. Registration skipped.`);
            return;
        }
        if (this.activeSystemInstances.has(moduleUrl)) {
            console.warn(`[HMR] Overwriting existing system instance for module: ${moduleUrl} (${systemInstance.constructor.name}). Ensure previous instance was disposed.`);
        }
        console.log(`[HMR] Registering system instance ${systemInstance.constructor.name} from ${moduleUrl}`);
        this.activeSystemInstances.set(moduleUrl, systemInstance);
    }

    /**
     * Unregisters a system instance.
     * This is typically called when a system is removed or its module is disposed.
     * @param moduleUrl The URL of the module to unregister.
     */
    public unregisterSystemInstance(moduleUrl: string): void {
        if (!this.isEnabled) return;
        if (this.activeSystemInstances.has(moduleUrl)) {
            const systemName = this.activeSystemInstances.get(moduleUrl)?.constructor.name || 'UnknownSystem';
            console.log(`[HMR] Unregistering system instance ${systemName} from ${moduleUrl}`);
            this.activeSystemInstances.delete(moduleUrl);
        } else if (moduleUrl) { // Only warn if moduleUrl was provided but not found
            console.warn(`[HMR] Attempted to unregister system from ${moduleUrl}, but no instance was found.`);
        }
    }

    /**
     * Handles the disposal of a system module during HMR.
     * This method retrieves the system's state via `onBeforeReload`, stores it in `hmrData`,
     * removes the system from the scene, and unregisters it.
     *
     * This should be called from the module's `import.meta.hot.dispose` handler.
     *
     * @param moduleUrl The URL of the system module being disposed.
     * @param hmrData The HMR data object provided by the bundler (e.g., Vite's `import.meta.hot.data`).
     */
    public handleSystemDispose(moduleUrl: string, hmrData: any): void {
        if (!this.isEnabled || !this.activeScene) {
            console.warn('[HMR] System dispose ignored: HMR disabled or no active scene.');
            return;
        }

        const systemInstance = this.activeSystemInstances.get(moduleUrl);
        if (!systemInstance) {
            console.warn(`[HMR] System dispose for ${moduleUrl} called, but no registered active instance found. It might have been already removed or never registered.`);
            return;
        }

        console.log(`[HMR] Disposing system: ${systemInstance.constructor.name} from ${moduleUrl}`);

        let systemState: HmrSystemState = {};
        if (typeof systemInstance.onBeforeReload === 'function') {
            try {
                systemState.state = systemInstance.onBeforeReload();
            } catch (e) {
                console.error(`[HMR] Error in ${systemInstance.constructor.name}.onBeforeReload():`, e);
            }
        }

        hmrData.ecsSystemState = systemState;
        hmrData.ecsSystemModuleUrl = moduleUrl; // Store for identification in the accept phase if needed

        // Remove the old system instance from the scene
        this.activeScene.entityProcessors.remove(systemInstance);
        this.unregisterSystemInstance(moduleUrl); // Unregister after successful removal and state saving

        console.log(`[HMR] System ${systemInstance.constructor.name} (from ${moduleUrl}) removed from scene and unregistered.`);
    }

    /**
     * Handles the acceptance of a new system module version during HMR.
     * This method creates an instance of the new system class, restores its state
     * using `onAfterReload` if state was previously saved, and adds the new system
     * to the scene (which should also register it with the HMR manager).
     *
     * This should be called from the module's `import.meta.hot.accept` handler.
     *
     * @param NewSystemClass The constructor of the new system class.
     * @param moduleUrl The URL of the system module being accepted.
     * @param hmrData The HMR data object, potentially containing the saved state.
     */
    public handleSystemAccept<T extends EntitySystem>(
        NewSystemClass: HotReloadableModule<T>,
        moduleUrl: string,
        hmrData: any
    ): void {
        if (!this.isEnabled || !this.activeScene) {
            console.warn('[HMR] System accept ignored: HMR disabled or no active scene.');
            return;
        }

        console.log(`[HMR] Accepting new system module: ${NewSystemClass.name} for ${moduleUrl}`);

        let newSystemInstance: T;
        try {
            // Assume system constructors are simple or Scene.addEntityProcessor handles complex setup.
            newSystemInstance = new NewSystemClass();
        } catch (e) {
            console.error(`[HMR] Error instantiating new system ${NewSystemClass.name} from module ${moduleUrl}:`, e);
            return;
        }

        const hmrSystemState = (hmrData.ecsSystemModuleUrl === moduleUrl) ? hmrData.ecsSystemState as HmrSystemState | undefined : undefined;


        if (hmrSystemState && hmrSystemState.state !== undefined) {
            if (typeof newSystemInstance.onAfterReload === 'function') {
                try {
                    console.log(`[HMR] Restoring state for ${NewSystemClass.name} from ${moduleUrl}:`, hmrSystemState.state);
                    newSystemInstance.onAfterReload(hmrSystemState.state);
                } catch (e) {
                    console.error(`[HMR] Error in ${NewSystemClass.name}.onAfterReload() from ${moduleUrl}:`, e);
                }
            } else {
                 console.log(`[HMR] System ${NewSystemClass.name} from ${moduleUrl} has saved state but no onAfterReload method.`);
            }
        } else {
            console.log(`[HMR] No previous state found for ${NewSystemClass.name} from ${moduleUrl}, or onAfterReload not implemented. Initializing as new.`);
        }

        // Add the new system instance to the scene.
        // The Scene's addEntityProcessor method should handle setting the scene reference
        // and registering the system with the HotReloadManager using the moduleUrl.
        this.activeScene.addEntityProcessor(newSystemInstance as EntitySystem, moduleUrl, true /* isHmrAdd */);
        console.log(`[HMR] New system ${NewSystemClass.name} (from ${moduleUrl}) added to scene and reloaded.`);

        // Clean up the HMR data associated with this system
        if (hmrData && hmrData.ecsSystemModuleUrl === moduleUrl) {
            delete hmrData.ecsSystemState;
            delete hmrData.ecsSystemModuleUrl;
        }
    }

    /**
     * Finds the module URL for a given system instance.
     * This is used to identify the module associated with a system instance,
     * for example, when unregistering a manually removed system.
     * @param systemInstance The system instance to find the module URL for.
     * @returns The module URL if found, otherwise undefined.
     */
    public findModuleUrlForSystemInstance(systemInstance: EntitySystem): string | undefined {
        if (!this.isEnabled) return undefined;
        for (const [url, instance] of this.activeSystemInstances.entries()) {
            if (instance === systemInstance) {
                return url;
            }
        }
        return undefined;
    }

    // ----------------------------------------------------------------------------------
    // Component HMR Handling
    // ----------------------------------------------------------------------------------

    /**
     * Handles the disposal of a component module during HMR.
     * Saves the state of all instances of the OldComponentClass.
     * @param moduleUrl The URL of the component module being disposed.
     * @param OldComponentClass The constructor of the old component class.
     * @param hmrData The HMR data object from the bundler.
     */
    public handleComponentDispose(moduleUrl: string, OldComponentClass: HotReloadableModule<Component>, hmrData: any): void {
        if (!this.isEnabled || !this.activeScene) {
            console.warn('[HMR] Component dispose ignored: HMR disabled or no active scene.');
            return;
        }

        console.log(`[HMR] Preparing to dispose component module: ${OldComponentClass.name} from ${moduleUrl}`);

        const componentHmrState: HmrComponentState = {
            instanceStates: new Map<number, any>(),
            oldComponentClass: OldComponentClass
        };

        if (!this.activeScene.entities || !this.activeScene.entities.buffer) {
            console.warn('[HMR] No entities found in scene to process for component disposal for module:', moduleUrl);
            hmrData.ecsComponentState = componentHmrState; // Save empty state
            hmrData.ecsComponentModuleUrl = moduleUrl;
            return;
        }

        for (const entity of this.activeScene.entities.buffer) {
            // Cast to `any` for getComponent if it expects a concrete type and OldComponentClass is general.
            // Ensure getComponent can handle a general class constructor.
            const componentInstance = entity.getComponent(OldComponentClass as new (...args: any[]) => Component);

            if (componentInstance) {
                let stateToSave: any = {};
                if (typeof componentInstance.onBeforeReload === 'function') {
                    try {
                        stateToSave = componentInstance.onBeforeReload();
                    } catch (e) {
                        console.error(`[HMR] Error in ${componentInstance.constructor.name}.onBeforeReload() for entity ${entity.id}:`, e);
                    }
                }
                componentHmrState.instanceStates.set(entity.id, stateToSave);
            }
        }

        hmrData.ecsComponentState = componentHmrState;
        hmrData.ecsComponentModuleUrl = moduleUrl;
        console.log(`[HMR] State for ${componentHmrState.instanceStates.size} instances of ${OldComponentClass.name} (from ${moduleUrl}) saved for HMR.`);
    }

    /**
     * Handles the acceptance of a new component module version during HMR.
     * Replaces old component instances with new ones, migrating state.
     * @param NewComponentClass The constructor of the new component class.
     * @param moduleUrl The URL of the component module being accepted.
     * @param hmrData The HMR data object, potentially containing saved state.
     */
    public handleComponentAccept<T extends Component>(NewComponentClass: HotReloadableModule<T>, moduleUrl: string, hmrData: any): void {
        if (!this.isEnabled || !this.activeScene) {
            console.warn('[HMR] Component accept ignored: HMR disabled or no active scene.');
            return;
        }

        console.log(`[HMR] Accepting new component module: ${NewComponentClass.name} from ${moduleUrl}`);

        // Check if the hmrData contains state for *this specific moduleUrl*
        if (!hmrData || hmrData.ecsComponentModuleUrl !== moduleUrl || !hmrData.ecsComponentState) {
            console.warn(`[HMR] No valid HMR state found for component module ${moduleUrl} (${NewComponentClass.name}). Component instances may not be correctly restored or may require systems to re-process entities.`);
            // Notify systems that entities might have changed structure, even if we can't restore state.
            if (this.activeScene.entityProcessors && typeof this.activeScene.entityProcessors.notifyAllSystemsOfEntityChanges === 'function') {
                this.activeScene.entityProcessors.notifyAllSystemsOfEntityChanges();
            }
            return;
        }

        const componentHmrInfo = hmrData.ecsComponentState as HmrComponentState;
        const OldComponentClassRef = componentHmrInfo.oldComponentClass;
        const instanceStates = componentHmrInfo.instanceStates;

        if (!instanceStates || !OldComponentClassRef) {
            console.error(`[HMR] HMR component state is incomplete for ${NewComponentClass.name} (from ${moduleUrl}). Cannot proceed with component update.`);
            return;
        }

        let updatedCount = 0;

        if (this.activeScene.entities && this.activeScene.entities.buffer) { // Ensure entities are accessible
            instanceStates.forEach((oldState, entityId) => {
                const entity = this.activeScene!.findEntityById(entityId); // activeScene is checked
                if (entity) {
                    // Remove the old component instance
                    entity.removeComponentByType(OldComponentClassRef as new (...args: any[]) => Component);

                    let newComponentInstance: T;
                    try {
                        newComponentInstance = new NewComponentClass(); // Assumes default constructor
                    } catch (e) {
                        console.error(`[HMR] Error instantiating new component ${NewComponentClass.name} for entity ${entityId} (module ${moduleUrl}):`, e);
                        return; // Skip this entity
                    }

                    // State Migration
                    try {
                        if (typeof (NewComponentClass as any).migrateState === 'function') {
                            (NewComponentClass as any).migrateState(oldState, newComponentInstance as Component);
                        } else if (typeof Component.migrateState === 'function') { // Fallback to base Component static migrateState
                            Component.migrateState(oldState, newComponentInstance as Component);
                        }
                        // If neither, state is applied directly in onAfterReload or by property copy in onAfterReload default
                    } catch (e) {
                        console.error(`[HMR] Error during state migration for ${NewComponentClass.name} on entity ${entityId} (module ${moduleUrl}):`, e);
                    }

                    // onAfterReload Hook
                    if (typeof newComponentInstance.onAfterReload === 'function') {
                        try {
                            newComponentInstance.onAfterReload(oldState); // Pass oldState, as onAfterReload typically expects the direct output of onBeforeReload
                        } catch (e) {
                            console.error(`[HMR] Error in ${NewComponentClass.name}.onAfterReload() for entity ${entityId} (module ${moduleUrl}):`, e);
                        }
                    }

                    entity.addComponent(newComponentInstance as Component);
                    updatedCount++;
                } else {
                    console.warn(`[HMR] Entity with ID ${entityId} not found during component reload for ${NewComponentClass.name} (module ${moduleUrl}).`);
                }
            });
        }


        console.log(`[HMR] Component ${NewComponentClass.name} (from ${moduleUrl}) reloaded. ${updatedCount} of ${instanceStates.size} instances updated/processed.`);

        delete hmrData.ecsComponentState;
        delete hmrData.ecsComponentModuleUrl;

        // Notify systems that entities have changed
        if (this.activeScene.entityProcessors && typeof this.activeScene.entityProcessors.notifyAllSystemsOfEntityChanges === 'function') {
            this.activeScene.entityProcessors.notifyAllSystemsOfEntityChanges();
        } else {
            console.warn('[HMR] Scene.entityProcessors.notifyAllSystemsOfEntityChanges() not found. Systems may not be fully aware of HMR component changes.');
        }
    }
}
