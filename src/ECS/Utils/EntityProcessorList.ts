import { EntitySystem } from '../Systems/EntitySystem';
import type { Scene } from '../Scene'; // Import Scene type

/**
 * 实体处理器列表管理器
 * 管理场景中的所有实体系统
 */
export class EntityProcessorList {
    private _processors: EntitySystem[] = [];
    private _isDirty = false;
    private scene: Scene; // Added scene reference

    /**
     * 构造函数
     * @param scene 场景实例的引用
     */
    constructor(scene: Scene) { // Modified constructor
        this.scene = scene;
    }

    /**
     * 设置为脏状态，需要重新排序
     */
    public setDirty(): void {
        this._isDirty = true;
    }

    /**
     * 添加实体处理器
     * @param processor 要添加的处理器
     */
    public add(processor: EntitySystem): void {
        this._processors.push(processor);
        this.setDirty();
    }

    /**
     * 移除实体处理器
     * @param processor 要移除的处理器
     */
    public remove(processor: EntitySystem): void {
        const index = this._processors.indexOf(processor);
        if (index !== -1) {
            this._processors.splice(index, 1);
        }
    }

    /**
     * 获取指定类型的处理器
     * @param type 处理器类型
     */
    public getProcessor<T extends EntitySystem>(type: new (...args: any[]) => T): T | null {
        for (const processor of this._processors) {
            if (processor instanceof type) {
                return processor as T;
            }
        }
        return null;
    }

    /**
     * 开始处理
     */
    public begin(): void {
        this.sortProcessors();
        for (const processor of this._processors) {
            processor.initialize();
        }
    }

    /**
     * 结束处理
     */
    public end(): void {
        // 清理处理器
    }

    /**
     * 更新所有处理器
     */
    public update(): void {
        this.sortProcessors();
        for (const processor of this._processors) {
            processor.update();
        }
    }

    /**
     * 后期更新所有处理器
     */
    public lateUpdate(): void {
        for (const processor of this._processors) {
            processor.lateUpdate();
        }
    }

    /**
     * 排序处理器
     */
    private sortProcessors(): void {
        if (this._isDirty) {
            this._processors.sort((a, b) => a.updateOrder - b.updateOrder);
            this._isDirty = false;
        }
    }

    /** 获取处理器列表 */
    public get processors() {
        return this._processors;
    }

    /** 获取处理器数量 */
    public get count() {
        return this._processors.length;
    }

    /**
     * Notifies all enabled systems that entity component compositions might have changed.
     * This is typically called after HMR of components to ensure systems re-evaluate entities.
     */
    public notifyAllSystemsOfEntityChanges(): void {
        if (!this.scene) {
            console.warn('[HMR][EntityProcessorList] Cannot notify systems: Scene reference not available.');
            return;
        }
        if (!this.scene.entities || !this.scene.entities.buffer) {
            // entities.buffer is an internal detail of EntityList, prefer entities.all or a getter for the array
            // For now, assuming entities.buffer is the way to get all entities as an array based on prior context.
            // A better approach might be: const allEntities = this.scene.entities.all(); if such a method exists.
            console.warn('[HMR][EntityProcessorList] Cannot notify systems: Scene entities buffer not available or empty.');
            return;
        }

        const allEntities = this.scene.entities.buffer; // Assuming this is the live list of entities
        if (allEntities.length === 0) {
            // console.log('[HMR][EntityProcessorList] No entities in scene to notify systems about.');
            // No need to proceed if there are no entities.
            return;
        }

        console.log(`[HMR] Notifying ${this.processors.length} systems of potential entity changes across ${allEntities.length} entities.`);
        let systemsNotified = 0;
        let totalOnChangedCalls = 0;

        for (const processor of this.processors) {
            if (processor.enabled) { // Only notify enabled systems
                for (const entity of allEntities) {
                    try {
                        // processor.onChanged(entity) is called to make the system
                        // re-evaluate if it's interested in this entity after component changes.
                        processor.onChanged(entity);
                        totalOnChangedCalls++;
                    } catch (e) {
                        console.error(`[HMR] Error in ${processor.constructor.name}.onChanged() for entity ${entity.id} during HMR notification:`, e);
                    }
                }
                systemsNotified++;
            }
        }
        console.log(`[HMR] System notification complete. ${systemsNotified} enabled systems processed. Total onChanged calls: ${totalOnChangedCalls}.`);
    }
}
