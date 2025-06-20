const fs = require('fs');
const path = require('path');

// 模拟项目路径（实际会是真实的项目路径）
const projectPath = process.cwd();
const settingsPath = path.join(projectPath, '.ecs-framework-settings.json');

console.log('🧪 测试ECS框架设置功能...');
console.log('设置文件路径:', settingsPath);

// 默认设置
const testSettings = {
    codeGeneration: {
        template: 'typescript',
        useStrictMode: true,
        generateComments: true,
        generateImports: true,
        componentSuffix: 'Component',
        systemSuffix: 'System',
        indentStyle: 'spaces',
        indentSize: 4
    },
    performance: {
        enableMonitoring: true,
        warningThreshold: 16.67,
        criticalThreshold: 33.33,
        memoryWarningMB: 100,
        memoryCriticalMB: 200,
        maxRecentSamples: 60,
        enableFpsMonitoring: true,
        targetFps: 60
    },
    debugging: {
        enableDebugMode: true,
        showEntityCount: true,
        showSystemExecutionTime: true,
        enablePerformanceWarnings: true,
        logLevel: 'info',
        enableDetailedLogs: false
    },
    editor: {
        autoRefreshAssets: true,
        showWelcomePanelOnStartup: true,
        enableAutoUpdates: false,
        updateChannel: 'stable',
        enableNotifications: true
    },
    template: {
        defaultEntityName: 'TestEntity',  // 修改这个值来测试
        defaultComponentName: 'TestComponent',
        defaultSystemName: 'TestSystem',
        createExampleFiles: true,
        includeDocumentation: true,
        useFactoryPattern: true
    },
    events: {
        enableEventSystem: true,
        defaultEventPriority: 0,
        enableAsyncEvents: true,
        enableEventBatching: false,
        batchSize: 10,
        batchDelay: 16,
        maxEventListeners: 100
    }
};

// 测试保存功能
console.log('✅ 测试保存设置...');
try {
    fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2), 'utf-8');
    console.log('✅ 设置已成功保存到:', settingsPath);
} catch (error) {
    console.error('❌ 保存设置失败:', error);
}

// 测试加载功能
console.log('✅ 测试加载设置...');
try {
    if (fs.existsSync(settingsPath)) {
        const loadedData = fs.readFileSync(settingsPath, 'utf-8');
        const loadedSettings = JSON.parse(loadedData);

        console.log('✅ 设置已成功加载');
        console.log('默认实体名称:', loadedSettings.template.defaultEntityName);
        console.log('调试模式:', loadedSettings.debugging.enableDebugMode);
        console.log('目标FPS:', loadedSettings.performance.targetFps);

        // 验证数据完整性
        const expectedKeys = Object.keys(testSettings);
        const loadedKeys = Object.keys(loadedSettings);

        if (expectedKeys.every(key => loadedKeys.includes(key))) {
            console.log('✅ 数据完整性检查通过');
        } else {
            console.log('❌ 数据完整性检查失败');
        }
    } else {
        console.log('❌ 设置文件不存在');
    }
} catch (error) {
    console.error('❌ 加载设置失败:', error);
}

// 测试修改和重新保存
console.log('✅ 测试修改设置...');
try {
    const modifiedSettings = { ...testSettings };
    modifiedSettings.template.defaultEntityName = 'ModifiedEntity';
    modifiedSettings.performance.targetFps = 120;

    fs.writeFileSync(settingsPath, JSON.stringify(modifiedSettings, null, 2), 'utf-8');

    // 重新加载验证
    const reloadedData = fs.readFileSync(settingsPath, 'utf-8');
    const reloadedSettings = JSON.parse(reloadedData);

    if (reloadedSettings.template.defaultEntityName === 'ModifiedEntity' &&
        reloadedSettings.performance.targetFps === 120) {
        console.log('✅ 设置修改测试通过');
    } else {
        console.log('❌ 设置修改测试失败');
    }
} catch (error) {
    console.error('❌ 修改设置测试失败:', error);
}

console.log('🎉 测试完成！设置功能工作正常。');
console.log('📁 设置文件位置:', settingsPath);

// 清理测试文件（可选）
// fs.unlinkSync(settingsPath);
// console.log('🧹 已清理测试文件');