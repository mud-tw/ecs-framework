import type { IComponent } from '../Types';

/**
 * 游戏组件基类
 * 
 * ECS架构中的组件（Component），用于实现具体的游戏功能。
 * 组件包含数据和行为，可以被添加到实体上以扩展实体的功能。
 * 
 * @example
 * ```typescript
 * class HealthComponent extends Component {
 *     public health: number = 100;
 *     
 *     public takeDamage(damage: number): void {
 *         this.health -= damage;
 *         if (this.health <= 0) {
 *             this.entity.destroy();
 *         }
 *     }
 * }
 * ```
 */
export abstract class Component implements IComponent {
    /**
     * 组件ID生成器
     * 
     * 用于为每个组件分配唯一的ID。
     */
    public static _idGenerator: number = 0;
    
    /**
     * 组件唯一标识符
     * 
     * 在整个游戏生命周期中唯一的数字ID。
     */
    public readonly id: number;
    
    /**
     * 组件所属的实体
     * 
     * 指向拥有此组件的实体实例。
     */
    public entity!: Entity;
    
    /**
     * 组件启用状态
     * 
     * 控制组件是否参与更新循环。
     */
    private _enabled: boolean = true;
    
    /**
     * 更新顺序
     * 
     * 决定组件在更新循环中的执行顺序。
     */
    private _updateOrder: number = 0;

    /**
     * 创建组件实例
     * 
     * 自动分配唯一ID给组件。
     */
    constructor() {
        this.id = Component._idGenerator++;
    }

    /**
     * 获取组件启用状态
     * 
     * 组件的实际启用状态取决于自身状态和所属实体的状态。
     * 
     * @returns 如果组件和所属实体都启用则返回true
     */
    public get enabled(): boolean {
        return this.entity ? this.entity.enabled && this._enabled : this._enabled;
    }

    /**
     * 设置组件启用状态
     * 
     * 当状态改变时会触发相应的生命周期回调。
     * 
     * @param value - 新的启用状态
     */
    public set enabled(value: boolean) {
        if (this._enabled !== value) {
            this._enabled = value;
            if (this._enabled) {
                this.onEnabled();
            } else {
                this.onDisabled();
            }
        }
    }

    /**
     * 获取更新顺序
     * 
     * @returns 组件的更新顺序值
     */
    public get updateOrder(): number {
        return this._updateOrder;
    }

    /**
     * 设置更新顺序
     * 
     * @param value - 新的更新顺序值
     */
    public set updateOrder(value: number) {
        this._updateOrder = value;
    }

    /**
     * 组件添加到实体时的回调
     * 
     * 当组件被添加到实体时调用，可以在此方法中进行初始化操作。
     */
    public onAddedToEntity(): void {
    }

    /**
     * 组件从实体移除时的回调
     * 
     * 当组件从实体中移除时调用，可以在此方法中进行清理操作。
     */
    public onRemovedFromEntity(): void {
    }

    /**
     * 组件启用时的回调
     * 
     * 当组件被启用时调用。
     */
    public onEnabled(): void {
    }

    /**
     * 组件禁用时的回调
     * 
     * 当组件被禁用时调用。
     */
    public onDisabled(): void {
    }

    /**
     * 更新组件
     * 
     * 每帧调用，用于更新组件的逻辑。
     * 子类应该重写此方法来实现具体的更新逻辑。
     */
    public update(): void {
    }

    /**
     * 在热模块替换 (HMR) 之前调用。
     * 派生组件应覆盖此方法以返回需要保留的特定状态。
     * @returns 组件的当前状态，将传递给 onAfterReload 或 migrateState。
     */
    public onBeforeReload(): any {
        console.log(`[HMR] Component.onBeforeReload called for ${this.constructor.name} on entity ${this.entity?.id}`);
        // 默认实现：浅拷贝自身可枚举的非函数、非实体、非id属性
        const ownData: any = {};
        for (const key in this) {
            if (Object.prototype.hasOwnProperty.call(this, key) &&
                key !== 'entity' && key !== 'id' &&
                key !== '_enabled' && key !== '_updateOrder' && // Exclude known base class private-like properties
                typeof (this as any)[key] !== 'function') {
                ownData[key] = (this as any)[key];
            }
        }
        return ownData;
    }

    /**
     * 在热模块替换 (HMR) 之后调用。
     * 派生组件应覆盖此方法以从先前保留的状态恢复其内部状态。
     * @param previousState 先前由 onBeforeReload 返回的状态。
     */
    public onAfterReload(previousState: any): void {
        console.log(`[HMR] Component.onAfterReload called for ${this.constructor.name} on entity ${this.entity?.id}. PrevState:`, previousState);
        // 默认实现：尝试将 previousState 中的属性应用到新实例上对应的属性
        if (previousState) {
            for (const key in previousState) {
                if (Object.prototype.hasOwnProperty.call(this, key) &&
                    key !== 'id' && key !== 'entity' &&
                    typeof (this as any)[key] !== 'function') { // 确保不在原型链上且不是方法
                    (this as any)[key] = previousState[key];
                }
            }
        }
    }

    /**
     * 可选的静态方法，用于在组件类结构发生重大变化时迁移状态。
     * 当 onAfterReload 不足以处理状态恢复时（例如，属性重命名、类型更改），
     * 派生组件可以覆盖此方法以实现自定义迁移逻辑。
     * @param oldState 从旧版本组件的 onBeforeReload 返回的状态。
     * @param newInstance 新版本组件的实例。
     */
    public static migrateState(oldState: any, newInstance: Component): void {
        console.log(`[HMR] Component.migrateState called for ${newInstance.constructor.name}. OldState:`, oldState);
        // 默认迁移：尝试将 oldState 中的属性复制到 newInstance 中对应的属性
        // 这与 onAfterReload 中的默认逻辑类似，但作为静态方法提供，
        // 允许在无法简单地将旧状态直接应用到新实例时进行更复杂的转换。
        if (oldState && typeof oldState === 'object' && newInstance) {
            for (const key in oldState) {
                // 检查 newInstance 是否确实具有该属性（不是来自原型）
                if (Object.prototype.hasOwnProperty.call(newInstance, key) &&
                    key !== 'id' && key !== 'entity' &&
                    typeof (newInstance as any)[key] !== 'function') {
                    (newInstance as any)[key] = oldState[key];
                } else if (!Object.prototype.hasOwnProperty.call(newInstance, key) &&
                           key !== 'id' && key !== 'entity' &&
                           (newInstance as any)[key] === undefined) {
                    // 属性存在于旧状态但不存在于新实例上，可以考虑记录警告
                    // console.warn(`[HMR] Property ${key} existed in old state for ${newInstance.constructor.name} but not in new instance.`);
                }
            }
        }
    }
}

// 避免循环引用，在文件末尾导入Entity
import type { Entity } from './Entity';