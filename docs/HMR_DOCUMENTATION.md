# Hot Module Replacement (HMR) in this ECS Framework

## 1. Introduction to HMR in this ECS Framework

Hot Module Replacement (HMR) is a powerful development feature that significantly accelerates the iteration cycle. Instead of requiring a full page reload for every code change, HMR allows updated modules (like your game's Systems and Components) to be swapped into a running application live, often while preserving the current application state.

For this ECS framework, HMR offers several key benefits:
*   **Faster Iteration:** See the effects of code changes in your Systems and Components almost instantly.
*   **State Preservation:** Maintain the current state of your game entities, components, and systems across reloads, avoiding the need to replay game scenarios to reach a certain state.
*   **Improved Developer Experience:** Focus more on building and less on waiting for reloads.

This framework supports HMR for:
*   **Entity Systems (`EntitySystem` derived classes):** Update system logic on the fly.
*   **Components (`Component` derived classes):** Update component logic and even their data structures, with mechanisms for data migration.

The HMR functionality integrates with common JavaScript/TypeScript development bundlers (e.g., Vite, Webpack). It relies on a central `HotReloadManager` within the framework and specific lifecycle hooks (`onBeforeReload`, `onAfterReload`, and static `migrateState` for Components) that you implement in your hot-reloadable classes.

## 2. Setup and Configuration

### Environment Requirements

Effective Hot Module Replacement in this framework depends on using a modern JavaScript/TypeScript development server and bundler that provides HMR capabilities. Examples include:
*   **Vite:** Recommended for its fast HMR and native ES Module approach.
*   **Webpack:** Requires configuration with `webpack-dev-server` and `HotModuleReplacementPlugin`.

The framework's HMR code (e.g., in example Systems and Components) uses `import.meta.hot` (Vite-style) for HMR API interactions. If you are using Webpack, you might need to adapt this to `module.hot` or ensure your Webpack setup provides `import.meta.hot` compatibility (some loaders/plugins can do this).

For more detailed information on bundler-specific HMR setup and how the framework expects the bundler to initiate HMR updates, please refer to **`docs/HMR_SETUP_NOTES.md`**.

### Initializing `HotReloadManager`

The `HotReloadManager` is a singleton that orchestrates HMR for ECS Systems and Components. It needs to be initialized once your main `Scene` instance is created and available.

Typically, you would do this in your main application setup file (e.g., `main.ts` or `game.ts`):

```typescript
// Example in your main application setup file (e.g., main.ts or game.ts)
import { Core } from './Core'; // Adjust path as per your project structure
import { YourInitialScene } from './YourInitialScene'; // Adjust path
import { HotReloadManager } from './HotReloadManager'; // Adjust path

// Initialize core engine and scene
const core = Core.create(); // Or your specific core creation method
const gameScene = new YourInitialScene(); // Or however your main scene is instantiated
Core.scene = gameScene; // Assuming Core manages the active scene

// Initialize HotReloadManager
// This should typically be done after the main scene is created and active.
// It's crucial to enable this only in development mode where HMR is expected.
if (import.meta.env.DEV) { // Vite-specific way to check for development mode
// For Webpack, you might use: if (process.env.NODE_ENV === 'development') {
    HotReloadManager.instance.initialize(gameScene, true); // Second argument: true to enable HMR
}
```
The second argument to `HotReloadManager.instance.initialize(scene, isEnabled)` allows you to control whether HMR is active. It defaults to `true` if omitted in the `initialize` method's signature (refer to `HotReloadManager.ts` for exact default).

### Enabling/Disabling HMR at Runtime

For debugging or specific scenarios, you can toggle the framework's HMR handling at runtime using methods on the `HotReloadManager` instance:

```typescript
import { HotReloadManager } from './HotReloadManager'; // Adjust path

// To disable HMR handling by the framework:
// HotReloadManager.instance.disable();
// This will make the HotReloadManager ignore HMR events from the bundler.

// To re-enable HMR handling by the framework:
// HotReloadManager.instance.enable();
```

Note that these controls only affect how the `HotReloadManager` processes HMR events. The bundler might still attempt to serve HMR updates to the client; disabling in `HotReloadManager` simply means the ECS-specific state preservation and restoration logic will not run.

## 3. Making Systems Hot-Reloadable

This section details how to make your `EntitySystem` derived classes capable of hot reloading. This allows you to change system logic (e.g., in the `process` method) and have it applied live, often while preserving the system's internal state.

### Implementing HMR Lifecycle Hooks

To enable stateful hot reloading for systems, you can implement two optional methods provided by the `EntitySystem` base class:

*   **`onBeforeReload(): any`**
    *   **Purpose:** This method is called on the current system instance just before its module is replaced by an updated version. Its job is to gather and return any state that should be preserved and passed to the new system instance.
    *   **What to return:** A serializable object (e.g., a plain JavaScript object) containing the data you want to keep. Avoid returning complex class instances unless they are simple data containers or you handle their reconstruction carefully.
    *   **Example:**
        ```typescript
        // In MyCustomSystem.ts
        private tickCounter: number = 0;
        private internalThreshold: number = 10;
        private someConfig: { rate: number, active: boolean };

        constructor(initialThreshold: number = 10, config?: { rate: number, active: boolean }) {
            super();
            this.internalThreshold = initialThreshold;
            this.someConfig = config || { rate: 5, active: true };
            console.log(`[MyCustomSystem] Constructed. Threshold: ${this.internalThreshold}`);
        }

        public onBeforeReload(): any {
            console.log(`[HMR] MyCustomSystem: onBeforeReload - Saving state. Counter: ${this.tickCounter}, Threshold: ${this.internalThreshold}`);
            return {
                tickCounter: this.tickCounter,
                internalThreshold: this.internalThreshold,
                someConfig: { ...this.someConfig } // Return a copy of nested objects
            };
        }
        ```
    *   If you don't override `onBeforeReload`, the default implementation in `EntitySystem` logs the call and returns `null`, meaning no state will be explicitly passed to the new instance beyond what the `HotReloadManager` might handle by default (which is none for systems).

*   **`onAfterReload(previousState: any): void`**
    *   **Purpose:** This method is called on the *new* system instance *after* its module has been reloaded and the new instance has been created. It receives the state object that was returned by `onBeforeReload` from the old instance.
    *   **How to use `previousState`:** Use this data to restore the internal state of the new system instance, allowing it to continue where the old one left off.
    *   **Example (continuing `MyCustomSystem`):**
        ```typescript
        // In MyCustomSystem.ts
        public onAfterReload(previousState: any): void {
            console.log('[HMR] MyCustomSystem: onAfterReload - Restoring state from:', previousState);
            if (previousState) {
                this.tickCounter = previousState.tickCounter !== undefined ? previousState.tickCounter : 0;
                this.internalThreshold = previousState.internalThreshold !== undefined ? previousState.internalThreshold : 10; // Provide a default
                this.someConfig = previousState.someConfig ? { ...previousState.someConfig } : this.someConfig; // Restore config
            }
            console.log(`[HMR] MyCustomSystem: State restored. Counter: ${this.tickCounter}, Threshold: ${this.internalThreshold}`);
        }
        ```
    *   The default `EntitySystem.onAfterReload` implementation only logs the call and the received state.

### HMR Boilerplate Code (Module Integration)

For each system file you want to make hot-reloadable, you need to include specific boilerplate code. This code integrates with your bundler's HMR API (e.g., Vite's `import.meta.hot`) and communicates with the framework's `HotReloadManager`.

Here's a complete example for `MyCustomSystem.ts` using Vite-style HMR:

```typescript
// src/ECS/Systems/MyCustomSystem.ts
import { EntitySystem } from './EntitySystem'; // Adjust path as needed
import type { Entity } from '../Entity';       // Adjust path
import { HotReloadManager, HotReloadableModule } from '../../HotReloadManager'; // Adjust path

export class MyCustomSystem extends EntitySystem {
    private tickCounter: number = 0;
    private internalThreshold: number = 10;
    private message: string;

    constructor(message: string = "System Default Message") {
        super(); // Assumes EntitySystem base constructor needs no args for HMR re-instantiation by default
        this.message = message;
        console.log(`[MyCustomSystem] Constructed with message: "${this.message}". Initial Tick: ${this.tickCounter}`);
    }

    public process(entities: Entity[]): void {
        this.tickCounter++;
        if (this.tickCounter % 120 === 0) { // Log periodically
            console.log(`[MyCustomSystem] Processing "${this.message}", tick: ${this.tickCounter}, threshold: ${this.internalThreshold}. Entities: ${entities.length}`);
        }
    }

    public onBeforeReload(): any {
        const state = {
            tickCounter: this.tickCounter,
            internalThreshold: this.internalThreshold,
            message: this.message
        };
        console.log(`[HMR] MyCustomSystem: onBeforeReload - Saving state:`, state);
        return state;
    }

    public onAfterReload(previousState: any): void {
        console.log('[HMR] MyCustomSystem: onAfterReload - Received previous state:', previousState);
        if (previousState) {
            this.tickCounter = previousState.tickCounter !== undefined ? previousState.tickCounter : 0;
            this.internalThreshold = previousState.internalThreshold !== undefined ? previousState.internalThreshold : 10;
            this.message = previousState.message !== undefined ? previousState.message : "System Message After Reload (No State)";
        }
        console.log(`[HMR] MyCustomSystem: State restored. Tick: ${this.tickCounter}, Threshold: ${this.internalThreshold}, Message: "${this.message}"`);
    }
}

// HMR Integration Boilerplate (Vite-specific example)
if (import.meta.hot) {
    // Ensure HMR data store exists on the `hot.data` object for our framework
    // This is a common pattern but check your HotReloadManager's expectations for hmrData structure
    if (!import.meta.hot.data.ecsSystemState) { // Key used by HotReloadManager
        import.meta.hot.data.ecsSystemState = {};
    }
    if (!import.meta.hot.data.ecsSystemModuleUrl) { // Key used by HotReloadManager
        import.meta.hot.data.ecsSystemModuleUrl = '';
   }

    import.meta.hot.dispose((data: any) => {
        console.log('[MyCustomSystem.ts HMR] dispose CALLED for module:', import.meta.url);
        // Pass the module's URL (unique identifier) and the HMR data object
        HotReloadManager.instance.handleSystemDispose(import.meta.url, data);
    });

    import.meta.hot.accept((newModule?: { MyCustomSystem?: HotReloadableModule<MyCustomSystem> }) => {
        console.log('[MyCustomSystem.ts HMR] accept CALLED for module:', import.meta.url);
        if (newModule && newModule.MyCustomSystem) {
            HotReloadManager.instance.handleSystemAccept(
                newModule.MyCustomSystem,
                import.meta.url,
                import.meta.hot.data // Pass the data object that `dispose` might have populated
            );
            console.log('[MyCustomSystem.ts HMR] Module reloaded and accepted.');
        } else {
            console.error('[MyCustomSystem.ts HMR] Accept failed: New module or MyCustomSystem class not found.');
            // Optionally, if the update is critical and cannot be handled by this module,
            // you can try to invalidate it, which might bubble the update or cause a full reload.
            // import.meta.hot.invalidate();
        }
    });
    console.log('[MyCustomSystem.ts HMR] HMR hooks registered.');
} else {
    // Optional: log if HMR API is not available for this module during development
    // console.log('[MyCustomSystem.ts HMR] HMR API (import.meta.hot) not available.');
}
```

**Explanation of the Boilerplate:**
*   **`if (import.meta.hot)`:** This guard ensures the HMR code only runs in environments where HMR is available and enabled by the bundler. It's tree-shaken in production builds.
*   **Initializing `import.meta.hot.data` properties:** The `ecsSystemState` and `ecsSystemModuleUrl` properties are initialized on `import.meta.hot.data` if they don't exist. This `data` object is persisted by the bundler across HMR updates for a given module. `HotReloadManager` uses these properties to store and retrieve state.
*   **`import.meta.hot.dispose((data: any) => { ... })`:**
    *   This function is called by the bundler just before the current module is unloaded.
    *   It calls `HotReloadManager.instance.handleSystemDispose(import.meta.url, data)`.
        *   `import.meta.url`: Provides a unique identifier for the current module file.
        *   `data`: The bundler-provided object where persistent HMR state can be stored. `handleSystemDispose` will use this to store the system's state (obtained from `onBeforeReload`).
*   **`import.meta.hot.accept((newModule?: { MyCustomSystem?: ... }) => { ... })`:**
    *   This function is called by the bundler after the new module code has been loaded.
    *   `newModule`: An object representing the newly loaded module, containing its exports. We expect it to export `MyCustomSystem`.
    *   It calls `HotReloadManager.instance.handleSystemAccept(newModule.MyCustomSystem, import.meta.url, import.meta.hot.data)`.
        *   `newModule.MyCustomSystem`: The constructor of the new system class.
        *   `import.meta.url`: The module identifier.
        *   `import.meta.hot.data`: The same persistent `data` object that `dispose` had access to, now potentially containing the saved state.
    *   Includes basic error logging if the new module or class isn't found.

### Registering Systems with `moduleUrl`

For the `HotReloadManager` to correctly track and manage system instances during HMR, it's crucial that when you initially add a system to your scene, you provide its `moduleUrl`.

**Example:**
```typescript
// When adding your system in your scene setup
import { MyCustomSystem } from './ECS/Systems/MyCustomSystem'; // Path to your system
// ... other imports like Scene, HotReloadManager ...

// Assuming 'scene' is your Scene instance
const mySystem = new MyCustomSystem("Live Message!");
scene.addEntityProcessor(mySystem, import.meta.url); // Pass import.meta.url
```
The `addEntityProcessor` method in `Scene.ts` has been updated to accept this `moduleUrl` and will use it to register the system instance with `HotReloadManager` if HMR is enabled.

## 4. Making Components Hot-Reloadable

Hot reloading components allows you to update their logic (methods) and, more significantly, their data structures (fields) while attempting to preserve existing data across these changes. This is more complex than system HMR due to:
1.  Multiple instances of a component type can exist across many entities.
2.  Structural changes (adding/removing/renaming fields) require data migration.

### Implementing HMR Lifecycle Hooks (Instance Hooks)

The `Component` base class provides two optional instance methods for HMR:

*   **`onBeforeReload(): any`**
    *   **Purpose:** Called on *each existing instance* of the component just before its module (class definition) is replaced. It should return a serializable object representing that specific instance's state.
    *   **Default Behavior:** The base `Component.onBeforeReload` attempts a shallow copy of the component's own, non-function properties (excluding `id`, `entity`, and some base private-like fields).
    *   **Override:** You should override this method in your derived components for more precise control over what state is saved, especially if your component contains complex objects, nested structures, or private fields that wouldn't be caught by a simple property iteration.
    *   **Example:**
        ```typescript
        // In MyDataComponent.ts
        public value: number = 0;
        public settings: { detail: string, level: number } = { detail: "low", level: 1 };
        private _internalCache: any = null; // Example of a non-serializable or complex private field

        public onBeforeReload(): any {
            console.log(`[HMR] MyDataComponent (Entity ${this.entity?.id}): onBeforeReload - Saving state.`);
            return {
                value: this.value,
                settings: { ...this.settings }, // Ensure a copy for plain objects
                // Do not return _internalCache directly if it's not serializable or needs special handling
            };
        }
        ```

*   **`onAfterReload(previousState: any): void`**
    *   **Purpose:** Called on a *new* component instance *after* it has been created (using the new class definition from the reloaded module) and *after* the static `migrateState` method (see below) has been attempted. It receives the `previousState` object that was returned by `onBeforeReload` from the corresponding old instance.
    *   **Use:** This hook is for any final state adjustments, re-establishing computed values, or re-initializing non-serializable parts of the component based on the restored/migrated state. The primary data restoration/migration should ideally happen in `migrateState`.
    *   **Default Behavior:** The base `Component.onAfterReload` attempts to assign properties from `previousState` to the new instance if the keys match and are not functions or core fields like `id`/`entity`.
    *   **Example:**
        ```typescript
        // In MyDataComponent.ts
        public onAfterReload(previousState: any): void {
            console.log(`[HMR] MyDataComponent (Entity ${this.entity?.id}): onAfterReload - Received previous state:`, previousState);
            // Assuming migrateState has already populated this.value and this.settings.
            // Re-initialize _internalCache or other transient state if needed.
            this._internalCache = this.settings.level > 5 ? { complexData: "..." } : null;
            console.log(`[HMR] MyDataComponent (Entity ${this.entity?.id}): State after reload: value=${this.value}, settings.level=${this.settings.level}`);
        }
        ```

### Handling Structural Changes with `static migrateState()`

This static method is **crucial** for managing changes to a component's data fields (e.g., adding, removing, renaming fields, or changing their types). When a component's structure changes, simply copying old properties to the new instance might not be enough or might lead to errors.

*   **Signature:** `static migrateState(oldState: any, newInstance: Component): void`
    *   `oldState`: The plain data object returned by `onBeforeReload` from an old component instance.
    *   `newInstance`: The newly created instance of the component (from the new, reloaded class definition). This instance has been constructed but `onAfterReload` has not yet been called on it.
*   **Purpose:** To transfer and transform data from the `oldState` (reflecting the old component structure) to the fields of the `newInstance` (reflecting the new component structure). The `HotReloadManager` calls this static method on the *new* component class for each instance being updated.
*   **Default Behavior:** The base `Component.migrateState` attempts a basic property-by-property copy from `oldState` to `newInstance` for properties that exist on `newInstance` and are not core fields like `id`/`entity`.
*   **Override Requirement:** You **must** override this static method in your component class if you make structural changes and want to preserve or map data correctly.

**Examples of `migrateState`:**

*   **Adding a new field:**
    ```typescript
    // MyComponentV2 adds 'public newField: string = "defaultValue";'
    // MyComponentV1 did not have 'newField'.
    export class MyComponentV2 extends Component {
        public existingField: number = 0;
        public newField: string = "defaultValue"; // Has a default

        // ... constructor, onBeforeReload, onAfterReload ...

        public static migrateState(oldState: any, newInstance: MyComponentV2): void {
            console.log(`[HMR] MyComponentV2.migrateState. Old:`, oldState, `New Instance (pre-migrate):`, newInstance);
            // Base migration can copy 'existingField' if names match
            Component.migrateState(oldState, newInstance);

            // newInstance.newField will already have its default "defaultValue"
            // from its class definition or constructor.
            // If oldState somehow had a 'newField' (e.g. from a previous HMR of V2), it would be copied by base.
            // No specific action needed for newField if default is okay.
            if (oldState.newField === undefined) {
                 console.log(`[HMR] MyComponentV2: 'newField' was not in old state, initialized to default: '${newInstance.newField}'.`);
            }
        }
    }
    ```

*   **Renaming a field (e.g., `dataValue` to `value`):**
    ```typescript
    // MyComponentV2 renames 'dataValue' to 'value'.
    export class MyComponentV2 extends Component {
        public value: number = 0; // Was 'dataValue' in V1

        // ... constructor, onBeforeReload (saves this.value), onAfterReload ...

        public static migrateState(oldState: any, newInstance: MyComponentV2): void {
            console.log(`[HMR] MyComponentV2.migrateState (Rename). Old:`, oldState, `New Instance:`, newInstance);
            if (oldState.dataValue !== undefined) {
                newInstance.value = oldState.dataValue; // Map old name to new name
                console.log(`[HMR] MyComponentV2: Migrated 'oldState.dataValue' (${oldState.dataValue}) to 'newInstance.value'.`);
            } else if (oldState.value !== undefined) {
                // If HMR ran on V2 before, or no rename needed.
                newInstance.value = oldState.value;
            }
            // Handle other fields if necessary
        }
    }
    ```

*   **Removing a field:**
    ```typescript
    // MyComponentV2 removes 'obsoleteField'. V1 had it.
    export class MyComponentV2 extends Component {
        public importantField: string = "";

        // ... constructor, onBeforeReload (saves this.importantField), onAfterReload ...

        public static migrateState(oldState: any, newInstance: MyComponentV2): void {
            console.log(`[HMR] MyComponentV2.migrateState (Remove). Old:`, oldState, `New Instance:`, newInstance);
            if (oldState.importantField !== undefined) {
                newInstance.importantField = oldState.importantField;
            }
            if (oldState.obsoleteField !== undefined) {
                console.log(`[HMR] MyComponentV2: 'obsoleteField' from old state is ignored (value: ${oldState.obsoleteField}).`);
            }
        }
    }
    ```

### HMR Boilerplate Code (Module Integration)

Each hot-reloadable component file requires HMR boilerplate, similar to systems, to interface with the bundler and `HotReloadManager`.

**Example for `MyDataComponent.ts` (Vite-style):**
```typescript
// src/ECS/Components/MyDataComponent.ts
import { Component } from '../Component'; // Adjust path as needed
import { HotReloadManager, HotReloadableModule } from '../../../HotReloadManager'; // Adjust path

export class MyDataComponent extends Component {
    public value: number = 42;
    public name: string = "Initial Name";
    // For migration demo, let's assume a future version might change 'name' to 'label'.
    // public label: string = "Initial Label";

    constructor(value: number = 42, name: string = "Initial Name") {
        super();
        this.value = value;
        this.name = name;
        // console.log(`[MyDataComponent] Constructed on entity ${this.entity?.id}: value=${this.value}, name=${this.name}`);
    }

    public onBeforeReload(): any {
        const state = { value: this.value, name: this.name }; // Only save current fields
        console.log(`[HMR] MyDataComponent (Entity ${this.entity?.id}): onBeforeReload. Saving:`, state);
        return state;
    }

    public onAfterReload(previousState: any): void {
        console.log(`[HMR] MyDataComponent (Entity ${this.entity?.id}): onAfterReload. Restored from:`, previousState);
        // `migrateState` should have handled the core data transfer.
        // This hook is for any additional re-initialization logic if needed.
        // console.log(`[HMR] MyDataComponent (Entity ${this.entity?.id}): Current state: value=${this.value}, name=${this.name}`);
    }

    public static migrateState(oldState: any, newInstance: MyDataComponent): void {
        const newInst = newInstance as any; // To handle potentially new/old fields
        const old = oldState as any;

        console.log(`[HMR] MyDataComponent.migrateState for entity ${newInst.entity?.id}. Old:`, old);

        // Example: Migrating if 'name' was renamed to 'label' in a hypothetical future version
        // For this example, let's assume 'name' still exists, but 'label' could be new.
        if (old.name !== undefined && newInst.name !== undefined) {
            newInst.name = old.name;
        }
        // If 'label' was added to MyDataComponent and old state doesn't have it:
        // if (newInst.label !== undefined && old.label === undefined) {
        //     console.log(`[HMR] MyDataComponent: 'label' is new, defaulting to "${newInst.label}".`);
        // } else if (newInst.label !== undefined && old.label !== undefined) {
        //     newInst.label = old.label;
        // }

        // Handle 'value'
        if (old.value !== undefined && newInst.value !== undefined) {
            newInst.value = old.value;
        }
        console.log(`[HMR] MyDataComponent.migrateState: Resulting newInstance: value=${newInst.value}, name=${newInst.name}`);
    }
}

// HMR Integration Boilerplate (Vite-specific example)
if (import.meta.hot) {
    // Ensure HMR data store exists on the `hot.data` object
    if (!import.meta.hot.data.ecsComponentState) {
        import.meta.hot.data.ecsComponentState = {};
    }
    if (!import.meta.hot.data.ecsComponentModuleUrl) {
        import.meta.hot.data.ecsComponentModuleUrl = '';
    }

    import.meta.hot.dispose((data: any) => {
        console.log('[MyDataComponent.ts HMR] dispose CALLED for module:', import.meta.url);
        // Pass the Component CLASS itself for type identification by HotReloadManager
        HotReloadManager.instance.handleComponentDispose(import.meta.url, MyDataComponent, data);
    });

    import.meta.hot.accept((newModule?: { MyDataComponent?: HotReloadableModule<MyDataComponent> }) => {
        console.log('[MyDataComponent.ts HMR] accept CALLED for module:', import.meta.url);
        if (newModule && newModule.MyDataComponent) {
            HotReloadManager.instance.handleComponentAccept(
                newModule.MyDataComponent,
                import.meta.url,
                import.meta.hot.data
            );
            console.log('[MyDataComponent.ts HMR] Module reloaded and accepted.');
        } else {
            console.error('[MyDataComponent.ts HMR] Accept failed: New module or MyDataComponent class not found.');
            // import.meta.hot.invalidate(); // Optional: force full reload if this module is critical
        }
    });
    console.log('[MyDataComponent.ts HMR] HMR hooks registered.');
} else {
    // console.log('[MyDataComponent.ts HMR] HMR API (import.meta.hot) not available.');
}
```

**Key aspects of the component HMR boilerplate:**
*   Similar to systems, it uses `import.meta.hot.dispose` and `import.meta.hot.accept`.
*   Crucially, `HotReloadManager.instance.handleComponentDispose` is passed the **Component Class** itself (e.g., `MyDataComponent`) as an argument. This allows `HotReloadManager` to identify instances of this specific component type across all entities using `entity.getComponent(TheOldComponentClass)`.
*   `HotReloadManager.instance.handleComponentAccept` is passed the new component class constructor (e.g., `newModule.MyDataComponent`).

### Notification to Systems

After component instances are updated or replaced during HMR, the `HotReloadManager.handleComponentAccept` method automatically calls `this.activeScene.entityProcessors.notifyAllSystemsOfEntityChanges()`. This is important because changes to an entity's components (either data or structure) might alter which systems are interested in that entity. This notification prompts all systems to re-evaluate their matched entities.

This comprehensive approach allows for powerful, stateful hot reloading of components, accommodating both simple data updates and more complex structural modifications.

## 5. Advanced Topics, Limitations & Troubleshooting

### How It Works Under The Hood (Briefly)

The HMR process, orchestrated by your bundler and the framework's `HotReloadManager`, generally follows these steps:

1.  **File Change Detection:** The development bundler (e.g., Vite) detects a change in a System or Component source file.
2.  **Module Disposal (`dispose` handler):**
    *   The bundler's HMR runtime executes the `import.meta.hot.dispose(...)` handler in the *old* version of the module about to be replaced.
    *   This handler calls the appropriate method on `HotReloadManager.instance`:
        *   `handleSystemDispose(moduleUrl, hmrData)` for systems.
        *   `handleComponentDispose(moduleUrl, OldComponentClass, hmrData)` for components.
    *   Inside `HotReloadManager`:
        *   It calls the `onBeforeReload()` method on the active system instance or on all active instances of the component type being reloaded. This method returns the state to be preserved.
        *   The collected state is stored in the `hmrData` object (which is persisted by the bundler for that module).
        *   For systems, the old system instance is removed from the scene's processor list and unregistered from the `HotReloadManager`.
        *   For components, their states are collected, but the actual removal of component instances from entities happens in the `accept` phase.
3.  **Module Update:** The bundler loads the new, updated module code.
4.  **Module Acceptance (`accept` handler):**
    *   The bundler's HMR runtime executes the `import.meta.hot.accept(...)` handler in the *new* version of the module.
    *   This handler calls the appropriate method on `HotReloadManager.instance`:
        *   `handleSystemAccept(NewSystemClass, moduleUrl, hmrData)` for systems.
        *   `handleComponentAccept(NewComponentClass, moduleUrl, hmrData)` for components.
    *   Inside `HotReloadManager`:
        *   **For Systems:**
            *   A new instance of `NewSystemClass` is created.
            *   The `onAfterReload(savedState)` method is called on the new instance, passing the state retrieved from `hmrData`.
            *   The new system instance is added to the scene (and registered with `HotReloadManager`).
        *   **For Components:**
            *   For each entity that had an old instance (identified from `hmrData`):
                *   The old component instance is removed from the entity.
                *   A new instance of `NewComponentClass` is created.
                *   The static `NewComponentClass.migrateState(savedState, newInstance)` method is called to transfer and transform data from the old state to the new instance.
                *   The `onAfterReload(savedState)` method is called on the new component instance for any final adjustments.
                *   The new component instance is added to the entity.
        *   **For Component HMR:** After all relevant component instances are updated, `Scene.entityProcessors.notifyAllSystemsOfEntityChanges()` is called. This prompts all systems to re-check entities against their matchers, as component changes might affect which entities they process.

### Best Practices for HMR-Friendly Code

*   **Keep Constructors Simple:** Especially for Systems, as `HotReloadManager` typically calls the constructor with no arguments when creating a new instance during HMR. If constructor arguments are essential for re-instantiation, you would need to save them in `onBeforeReload` and use them in `onAfterReload` or have `HotReloadManager` handle this (which it currently doesn't by default for systems). Components are also newed up with default constructors by `HotReloadManager`.
*   **Serializable State:** Ensure the state object returned by `onBeforeReload` is serializable (composed of plain JavaScript objects, arrays, and primitive types). Avoid returning complex class instances directly unless they are primarily simple data containers or you explicitly handle their reconstruction in `onAfterReload` or `migrateState`.
*   **Idempotent Hooks (Good Practice):** While not strictly required by the current HMR flow (hooks are generally called once per cycle), designing `onAfterReload` and `migrateState` to be safe if they were hypothetically called multiple times on the same instance with the same state can make them more robust.
*   **Clear and Robust `migrateState`:** For component structural changes, this is your most important tool. Write clear, well-commented `migrateState` static methods. Explicitly handle mapping of renamed fields, provide sensible defaults for newly added fields, and decide what to do with data from removed fields.
*   **Consistent `moduleUrl` Usage:** Always use `import.meta.url` (or the equivalent for your bundler, like Webpack's `__webpack_module__.id` if `import.meta.url` isn't behaving as expected for module identity) when registering systems with the scene (e.g., `scene.addEntityProcessor(system, import.meta.url)`). This URL is the key `HotReloadManager` uses to track system instances.
*   **Small, Focused Modules:** HMR generally works best and is more predictable with smaller, more focused modules (for both systems and components). Large, monolithic modules can make HMR less effective or harder to reason about.
*   **Minimize Global State in Modules:** Avoid or carefully manage global state that is internal to a module being reloaded. If a module relies on its own internal "singleton" or global variables, these might be reset or duplicated during HMR unless their state is explicitly passed through the HMR state-saving mechanisms.

### Troubleshooting Common HMR Issues

*   **HMR Not Triggering at All:**
    *   **Bundler Config:** Double-check your bundler's configuration (Vite, Webpack) to ensure HMR is enabled and correctly set up for your project type and file extensions.
    *   **File Watching:** Verify that the files you are modifying are indeed being watched by the bundler. Sometimes, files outside the main `src` directory or exotic paths might be missed.
    *   **HMR Boilerplate:** Ensure the `if (import.meta.hot) { ... }` boilerplate code is present *at the top level* of the system or component module file you expect to hot reload.
    *   **Console Errors:** Look for any HMR-related errors or warnings in both your browser's developer console and your bundler's terminal output.

*   **State Not Being Preserved/Restored:**
    *   **`onBeforeReload`:** Verify that `onBeforeReload` in your system or component is actually being called (use `console.log`) and that it's returning the correct state object.
    *   **`onAfterReload` / `migrateState`:** Check that `onAfterReload` (for systems and components) and/or `static migrateState` (for components) are being called and are correctly using the `previousState` or `oldState` to update the new instance. Log the received state.
    *   **HMR Data Keys:** Ensure the keys used by `HotReloadManager` to store state in the HMR `data` object (e.g., `ecsSystemState`, `ecsComponentState`, `ecsSystemModuleUrl`, `ecsComponentModuleUrl`) are correct and not being unintentionally cleared or overwritten. (The module-specific `import.meta.hot.data` should generally isolate this).
    *   **Logging:** Add extensive logging inside `HotReloadManager`'s handler methods and your class's HMR hooks to trace the flow of state.

*   **Errors During State Migration or Restoration:**
    *   **Debug `migrateState` / `onAfterReload`:** These are common places for errors if the structure of the state object changes or if you try to access properties that don't exist. Log `oldState` and the `newInstance` (before modification) to understand the data you're working with.
    *   **Handle Missing/New Fields:** In `migrateState`, explicitly check for the existence of fields in `oldState` before accessing them, especially if fields have been renamed or removed. Provide sensible defaults for newly added fields in your component if they aren't present in `oldState`.

*   **"Cannot find module" or Class Undefined in `accept` Handlers:**
    *   **Export/Import Names:** Double-check that the class name you're expecting in the `accept` handler (e.g., `newModule.MySystem`) matches the actual export from the module. `export class MySystem` vs `export default class MySystem` will change how you access it.
    *   **Bundler Issues/Circular Dependencies:** Complex circular dependencies between modules can sometimes confuse HMR. Try to simplify dependencies if this occurs.
    *   **Module Identifier Consistency:** Ensure the `moduleUrl` (e.g., `import.meta.url`) used in `dispose` is identical to the one used in `accept` so that `HotReloadManager` can correlate the operations.

*   **Systems Not Reacting to Component HMR:**
    *   **`notifyAllSystemsOfEntityChanges` Call:** Verify that `HotReloadManager.handleComponentAccept` successfully calls `this.activeScene.entityProcessors.notifyAllSystemsOfEntityChanges()`.
    *   **`EntityProcessorList` Implementation:** Check that `EntityProcessorList.notifyAllSystemsOfEntityChanges()` correctly iterates through all enabled systems and all entities, calling `processor.onChanged(entity)` on each pair.
    *   **System `onChanged` Logic:** Ensure the `onChanged(entity)` method in your systems correctly updates their internal entity lists or caches based on the (potentially modified) components of the entity.

*   **Duplicate Systems or Components After HMR:**
    *   **Unregistration:** This usually indicates that old instances were not correctly removed or unregistered during the `dispose` phase before new ones were added in the `accept` phase.
        *   For systems, ensure `HotReloadManager.handleSystemDispose` correctly removes the system from the scene and unregisters it using the `moduleUrl`.
        *   For components, ensure `HotReloadManager.handleComponentAccept` correctly calls `entity.removeComponentByType(OldComponentClassRef)`.
    *   **Module URL Consistency:** Ensure the `moduleUrl` used for registration (e.g., in `Scene.addEntityProcessor`) is the same one used in the `dispose` and `accept` HMR handlers for that module.

### Known Limitations

*   **Class Hierarchy Changes:** Modifying the inheritance chain of a System or Component (e.g., changing its base class) is generally not supported by HMR and will likely lead to errors or unpredictable behavior, often requiring a full page reload.
*   **System Constructor Argument Changes:** The default HMR process for systems in `HotReloadManager` instantiates new system versions using a parameterless constructor (`new NewSystemClass()`). If a system's constructor signature changes or requires specific arguments that were provided during initial setup, these arguments are not automatically re-applied. You would need to:
    1.  Save the original constructor arguments in `onBeforeReload`.
    2.  Use these saved arguments in `onAfterReload` to re-configure the system, or modify `HotReloadManager` to support re-instantiation with saved arguments (more complex).
*   **Component Constructor for HMR:** Similarly, `HotReloadManager.handleComponentAccept` creates new component instances with a parameterless constructor (`new NewComponentClass()`). The state is then applied via `migrateState` and `onAfterReload`. If a component's constructor is vital for its setup beyond default field initialization, that logic might need to be callable separately or incorporated into `onAfterReload`/`migrateState`.
*   **Global State/Singletons Within Reloaded Modules:** If a System or Component module maintains its own internal global state (e.g., a module-scoped variable that acts like a singleton for that module type) or directly manages global resources not tied to the ECS instance lifecycle, HMR can lead to duplicated state or resource leaks. Such global state needs to be explicitly managed during the `dispose` and `accept` HMR phases if it needs to be reset or preserved correctly.
*   **Deeply Nested/Complex Object State:** The default state saving in the base `Component.onBeforeReload` (shallow copy of own properties) and `Component.migrateState` (property-by-property copy) might not correctly handle deeply nested objects or complex class instances within a component's state. For such cases, you must implement custom logic in `onBeforeReload` to serialize or deep-clone these parts of the state, and corresponding custom logic in `migrateState` and/or `onAfterReload` to correctly re-hydrate or re-instantiate them. Using plain data structures for component state generally makes HMR more straightforward.
*   **Performance with Many Component Instances:** For component HMR, the `HotReloadManager.handleComponentDispose` method iterates over all entities in the scene to find instances of the component type being reloaded. `handleComponentAccept` then iterates over the saved states to update/recreate these instances. In scenes with a very large number of entities, this process could introduce a noticeable pause during development HMR. This is typically a one-time cost during the HMR update and does not affect runtime game performance.
*   **Core Framework Reloading:** Hot reloading the HMR infrastructure itself (e.g., `HotReloadManager.ts`) or core ECS base classes (`Entity.ts`, `Scene.ts`, `Component.ts`, `EntitySystem.ts`) is not supported by this HMR mechanism. Changes to these files will almost certainly require a full page reload to take effect correctly. The HMR setup described is designed for user-defined systems and components derived from the framework's base classes.
```
