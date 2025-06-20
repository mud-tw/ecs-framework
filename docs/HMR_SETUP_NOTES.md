# Hot Module Replacement (HMR) Setup Notes

## File Watching and HMR Triggering

The Hot Module Replacement (HMR) functionality for Systems and Components in this ECS framework relies on an external development server and bundler (e.g., Vite, Webpack) to monitor file changes and initiate the HMR process.

**The framework itself does not implement file watching.** Instead, it provides hooks and handlers that are called by the bundler's HMR runtime when a module is updated.

### Key Assumptions:

1.  **Bundler-Driven HMR:** You are using a development server with HMR capabilities (like Vite, Webpack with `webpack-dev-server`, etc.) during development.
2.  **HMR API Availability:** The bundler makes an HMR API available to modules (e.g., `import.meta.hot` for Vite, `module.hot` for Webpack). The example Systems and Components in this framework use `import.meta.hot` (Vite-style).
3.  **Configuration:** Your bundler is configured to watch `.ts` files in your source directories (e.g., `src/ECS/Systems/`, `src/ECS/Components/`). Most modern bundlers do this by default for TypeScript projects.

### Framework's Role:

When the bundler detects a change to a System or Component file that has HMR code:
1.  The bundler's HMR runtime calls the `import.meta.hot.dispose(...)` handler (if present) in the old version of the module. Our framework's `dispose` handlers call the appropriate `HotReloadManager.instance.handleSystemDispose(...)` or `HotReloadManager.instance.handleComponentDispose(...)` methods.
2.  The bundler loads the new module code.
3.  The bundler's HMR runtime then calls the `import.meta.hot.accept(...)` handler (if present) in the new version of the module. Our framework's `accept` handlers call `HotReloadManager.instance.handleSystemAccept(...)` or `HotReloadManager.instance.handleComponentAccept(...)` with the new module class and the `import.meta.hot.data` object (which was populated by the `dispose` handler).

### What to Ensure in Your Project Setup:

*   **Enable HMR:** Ensure HMR is enabled in your bundler's configuration. Vite enables it by default in development mode. For Webpack, you typically need `HotModuleReplacementPlugin` and dev server settings.
*   **Correct HMR API Usage:** Ensure your custom Systems and Components use the HMR API provided by your chosen bundler to interface with the `HotReloadManager` as shown in the provided examples (`ExampleSystem.ts`, `PositionComponent.ts`).

If you are working in an environment without a bundler that provides HMR (e.g., a basic Node.js ESM runtime for server-side game logic), a custom file watching and module reloading mechanism would need to be implemented. This would involve using libraries like `chokidar` for file watching and custom logic to un-cache and re-import modules, then manually triggering the `HotReloadManager`'s handler methods. This is a more advanced setup and not covered by the framework's built-in HMR helpers, which expect a bundler's HMR environment.
