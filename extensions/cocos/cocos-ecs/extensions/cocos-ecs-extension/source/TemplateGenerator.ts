import * as path from 'path';
import * as fs from 'fs';

/**
 * ECS启动模板生成器
 * 生成最基础的ECS框架启动模板，不包含业务逻辑
 */
export class TemplateGenerator {
    private projectPath: string;
    private ecsDir: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        this.ecsDir = path.join(projectPath, 'assets', 'scripts', 'ecs');
    }

    /**
     * 检查是否已经存在ECS模板
     */
    public checkTemplateExists(): boolean {
        return fs.existsSync(this.ecsDir);
    }

    /**
     * 获取已存在的文件列表
     */
    public getExistingFiles(): string[] {
        if (!this.checkTemplateExists()) return [];

        const files: string[] = [];
        this.scanDirectory(this.ecsDir, '', files);
        return files;
    }

    private scanDirectory(dirPath: string, relativePath: string, files: string[]): void {
        if (!fs.existsSync(dirPath)) return;

        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const relativeFilePath = relativePath ? `${relativePath}/${item}` : item;

            if (fs.statSync(fullPath).isDirectory()) {
                this.scanDirectory(fullPath, relativeFilePath, files);
            } else {
                files.push(relativeFilePath);
            }
        }
    }

    /**
     * 删除现有的ECS模板
     */
    public removeExistingTemplate(): void {
        if (fs.existsSync(this.ecsDir)) {
            fs.rmSync(this.ecsDir, { recursive: true, force: true });
            console.log('Removed existing ECS template');
        }
    }

    /**
     * 创建ECS启动模板
     */
    public createTemplate(): void {
        // 创建目录结构
        this.createDirectories();

        // 创建ECS启动管理器
        this.createECSManager();

        // 创建基础游戏场景
        this.createBaseGameScene();

        // 创建README文档
        this.createReadme();

        console.log('ECS启动模板创建成功');
    }

    /**
     * 创建目录结构
     */
    private createDirectories(): void {
        const dirs = [
            this.ecsDir,
            path.join(this.ecsDir, 'scenes'),
            path.join(this.ecsDir, 'components'),
            path.join(this.ecsDir, 'systems')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${path.relative(this.projectPath, dir)}`);
            }
        });
    }

    /**
     * 创建ECS管理器
     */
    private createECSManager(): void {
        this.writeFile(path.join(this.ecsDir, 'ECSManager.ts'), `import { Core } from '@esengine/ecs-framework';
import { Component, _decorator } from 'cc';
import { GameScene } from './scenes/GameScene';

const { ccclass, property } = _decorator;

/**
 * ECS管理器 - Cocos Creator组件
 * 将此组件添加到场景中的任意节点上即可启动ECS框架
 *
 * 使用说明：
 * 1. 在Cocos Creator场景中创建一个空节点
 * 2. 将此ECSManager组件添加到该节点
 * 3. 运行场景即可自动启动ECS框架
 */
@ccclass('ECSManager')
export class ECSManager extends Component {

    @property({
        tooltip: '是否启用调试模式（建议开发阶段开启）'
    })
    public debugMode: boolean = true;

    private isInitialized: boolean = false;

    /**
     * 组件启动时初始化ECS
     */
    start() {
        this.initializeECS();
    }

    /**
     * 初始化ECS框架
     */
    private initializeECS(): void {
        if (this.isInitialized) return;

        console.log('🎮 正在初始化ECS框架...');

        try {
            // 1. 创建Core实例，启用调试功能
            if (this.debugMode) {
                Core.create({
                    debugConfig: {
                        enabled: true,
                        websocketUrl: 'ws://localhost:8080/ecs-debug',
                        autoReconnect: true,
                        updateInterval: 100,
                        channels: {
                            entities: true,
                            systems: true,
                            performance: true,
                            components: true,
                            scenes: true
                        }
                    }
                });
                console.log('🔧 ECS调试模式已启用，可在Cocos Creator扩展面板中查看调试信息');
            } else {
                Core.create(false);
            }

            // 2. 创建游戏场景
            const gameScene = new GameScene();

            // 3. 设置为当前场景（会自动调用scene.begin()）
            Core.scene = gameScene;

            this.isInitialized = true;
            console.log('✅ ECS框架初始化成功！');
            console.log('📖 请查看 assets/scripts/ecs/README.md 了解如何添加组件和系统');

        } catch (error) {
            console.error('❌ ECS框架初始化失败:', error);
        }
    }

    /**
     * 每帧更新ECS框架
     */
    update(deltaTime: number) {
        if (this.isInitialized) {
            // 更新ECS核心系统
            Core.update(deltaTime);
        }
    }

    /**
     * 组件销毁时清理ECS
     */
    onDestroy() {
        if (this.isInitialized) {
            console.log('🧹 清理ECS框架...');
            // ECS框架会自动处理场景清理
            this.isInitialized = false;
        }
    }
}
`);
    }

    /**
     * 创建基础游戏场景
     */
    private createBaseGameScene(): void {
        this.writeFile(path.join(this.ecsDir, 'scenes', 'GameScene.ts'), `import { Scene } from '@esengine/ecs-framework';

/**
 * 游戏场景
 *
 * 这是您的主游戏场景。在这里可以：
 * - 添加游戏系统
 * - 创建初始实体
 * - 设置场景参数
 */
export class GameScene extends Scene {

    /**
     * 场景初始化
     * 在场景创建时调用，用于设置基础配置
     */
    public initialize(): void {
        super.initialize();

        // 设置场景名称
        this.name = "MainGameScene";

        console.log('🎯 游戏场景已创建');

        // TODO: 在这里添加您的游戏系统
        // 例如：this.addEntityProcessor(new MovementSystem());

        // TODO: 在这里创建初始实体
        // 例如：this.createEntity("Player");
    }

    /**
     * 场景开始运行
     * 在场景开始时调用，用于执行启动逻辑
     */
    public onStart(): void {
        super.onStart();

        console.log('🚀 游戏场景已启动');

        // TODO: 在这里添加场景启动逻辑
        // 例如：创建UI、播放音乐、初始化游戏状态等
    }

    /**
     * 场景卸载
     * 在场景结束时调用，用于清理资源
     */
    public unload(): void {
        console.log('🛑 游戏场景已结束');

        // TODO: 在这里添加清理逻辑
        // 例如：清理缓存、释放资源等

        super.unload();
    }
}
`);
    }

    /**
     * 创建README文档
     */
    private createReadme(): void {
        this.writeFile(path.join(this.ecsDir, 'README.md'), `# ECS框架启动模板

欢迎使用ECS框架！这是一个最基础的启动模板，帮助您快速开始ECS项目开发。

## 📁 项目结构

\`\`\`
ecs/
├── components/          # 组件目录（请在此添加您的组件）
├── systems/            # 系统目录（请在此添加您的系统）
├── scenes/             # 场景目录
│   └── GameScene.ts    # 主游戏场景
├── ECSManager.ts       # ECS管理器组件
└── README.md          # 本文档
\`\`\`

## 🚀 快速开始

### 1. 启动ECS框架

ECS框架已经配置完成！您只需要：

1. 在Cocos Creator中打开您的场景
2. 创建一个空节点（例如命名为"ECSManager"）
3. 将 \`ECSManager\` 组件添加到该节点
4. 运行场景，ECS框架将自动启动

### 2. 查看控制台输出

如果一切正常，您将在控制台看到：

\`\`\`
🎮 正在初始化ECS框架...
🔧 ECS调试模式已启用，可在Cocos Creator扩展面板中查看调试信息
🎯 游戏场景已创建
✅ ECS框架初始化成功！
🚀 游戏场景已启动
\`\`\`

### 3. 使用调试面板

ECS框架已启用调试功能，您可以：

1. 在Cocos Creator编辑器菜单中选择 "扩展" → "ECS Framework" → "调试面板"
2. 调试面板将显示实时的ECS运行状态：
   - 实体数量和状态
   - 系统执行信息
   - 性能监控数据
   - 组件统计信息

**注意**：调试功能会消耗一定性能，正式发布时建议关闭调试模式。

## 📚 下一步开发

### 创建您的第一个组件

在 \`components/\` 目录下创建组件：

\`\`\`typescript
// components/PositionComponent.ts
import { Component } from '@esengine/ecs-framework';
import { Vec3 } from 'cc';

export class PositionComponent extends Component {
    public position: Vec3 = new Vec3();

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        super();
        this.position.set(x, y, z);
    }
}
\`\`\`

### 创建您的第一个系统

在 \`systems/\` 目录下创建系统：

\`\`\`typescript
// systems/MovementSystem.ts
import { EntitySystem, Entity, Matcher } from '@esengine/ecs-framework';
import { PositionComponent } from '../components/PositionComponent';

export class MovementSystem extends EntitySystem {
    constructor() {
        super(Matcher.empty().all(PositionComponent));
    }

    protected process(entities: Entity[]): void {
        for (const entity of entities) {
            const position = entity.getComponent(PositionComponent);
            if (position) {
                // TODO: 在这里编写移动逻辑
                console.log(\`实体 \${entity.name} 位置: \${position.position}\`);
            }
        }
    }
}
\`\`\`

### 在场景中注册系统

在 \`scenes/GameScene.ts\` 的 \`initialize()\` 方法中添加：

\`\`\`typescript
import { MovementSystem } from '../systems/MovementSystem';

public initialize(): void {
    super.initialize();
    this.name = "MainGameScene";

    // 添加系统
    this.addEntityProcessor(new MovementSystem());

    // 创建测试实体
    const testEntity = this.createEntity("TestEntity");
    testEntity.addComponent(new PositionComponent(0, 0, 0));
}
\`\`\`

## 🔗 学习资源

- [ECS框架完整文档](https://github.com/esengine/ecs-framework)
- [ECS概念详解](https://github.com/esengine/ecs-framework/blob/master/docs/concepts-explained.md)
- [新手教程](https://github.com/esengine/ecs-framework/blob/master/docs/beginner-tutorials.md)
- [组件设计指南](https://github.com/esengine/ecs-framework/blob/master/docs/component-design-guide.md)
- [系统开发指南](https://github.com/esengine/ecs-framework/blob/master/docs/system-guide.md)

## 💡 开发提示

1. **组件只存储数据**：避免在组件中编写复杂逻辑
2. **系统处理逻辑**：所有业务逻辑应该在系统中实现
3. **使用Matcher过滤实体**：系统通过Matcher指定需要处理的实体类型
4. **性能优化**：大量实体时考虑使用位掩码查询和组件索引

## ❓ 常见问题

### Q: 如何创建实体？
A: 在场景中使用 \`this.createEntity("实体名称")\`

### Q: 如何给实体添加组件？
A: 使用 \`entity.addComponent(new YourComponent())\`

### Q: 如何获取实体的组件？
A: 使用 \`entity.getComponent(YourComponent)\`

### Q: 如何删除实体？
A: 使用 \`entity.destroy()\` 或 \`this.destroyEntity(entity)\`

---

🎮 **开始您的ECS开发之旅吧！**

如有问题，请查阅官方文档或提交Issue。
`);
    }

    /**
     * 写入文件
     */
    private writeFile(filePath: string, content: string): void {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Created file: ${path.relative(this.projectPath, filePath)}`);
    }
}
