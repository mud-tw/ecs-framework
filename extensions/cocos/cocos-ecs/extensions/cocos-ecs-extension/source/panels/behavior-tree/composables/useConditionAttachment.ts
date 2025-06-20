import { ref, reactive, Ref } from 'vue';
import { TreeNode } from '../types';
import { NodeTemplate } from '../data/nodeTemplates';

/**
 * 拖拽状态
 */
interface DragState {
    isDraggingCondition: boolean;
    conditionTemplate: NodeTemplate | null;
    mousePosition: { x: number, y: number } | null;
    hoveredDecoratorId: string | null;
}

/**
 * 条件节点吸附功能
 */
export function useConditionAttachment(
    treeNodes: Ref<TreeNode[]>,
    getNodeByIdLocal: (id: string) => TreeNode | undefined
) {

    const dragState = reactive<DragState>({
        isDraggingCondition: false,
        conditionTemplate: null,
        mousePosition: null,
        hoveredDecoratorId: null
    });

    /**
     * 检查节点是否为条件装饰器
     */
    const isConditionalDecorator = (node: TreeNode): boolean => {
        return node.type === 'conditional-decorator';
    };

    /**
     * 开始拖拽条件节点
     */
    const startConditionDrag = (event: DragEvent, template: NodeTemplate) => {
        console.log('🎯 开始条件拖拽:', template.name, template.isDraggableCondition);

        if (!template.isDraggableCondition) {
            console.warn('节点不是可拖拽条件:', template.name);
            return;
        }

        dragState.isDraggingCondition = true;
        dragState.conditionTemplate = template;

        if (event.dataTransfer) {
            event.dataTransfer.setData('application/json', JSON.stringify({
                ...template,
                isConditionDrag: true
            }));
            event.dataTransfer.effectAllowed = 'copy';
        }

        console.log('✅ 条件拖拽状态已设置:', dragState);
    };

    /**
     * 处理拖拽悬停在装饰器上
     */
    const handleDecoratorDragOver = (event: DragEvent, decoratorNode: TreeNode) => {
        console.log('🔀 装饰器拖拽悬停:', decoratorNode.name, decoratorNode.type, 'isDragging:', dragState.isDraggingCondition);

        // 检查传输数据
        const transferData = event.dataTransfer?.getData('application/json');
        if (transferData) {
            try {
                const data = JSON.parse(transferData);
                console.log('📦 传输数据:', data.isConditionDrag, data.isDraggableCondition, data.name);
            } catch (e) {
                console.log('❌ 传输数据解析失败:', transferData);
            }
        }

        if (!dragState.isDraggingCondition || !isConditionalDecorator(decoratorNode)) {
            console.log('❌ 不符合条件:', {
                isDragging: dragState.isDraggingCondition,
                isDecorator: isConditionalDecorator(decoratorNode),
                nodeType: decoratorNode.type
            });
            return false;
        }

        event.preventDefault();
        event.stopPropagation();

        dragState.hoveredDecoratorId = decoratorNode.id;

        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }

        console.log('✅ 装饰器可接受拖拽:', decoratorNode.name);
        return true;
    };

    /**
     * 处理拖拽离开装饰器
     */
    const handleDecoratorDragLeave = (decoratorNode: TreeNode) => {
        if (dragState.hoveredDecoratorId === decoratorNode.id) {
            dragState.hoveredDecoratorId = null;
        }
    };

    /**
     * 条件到装饰器属性的映射
     */
    const mapConditionToDecoratorProperties = (conditionTemplate: NodeTemplate): Record<string, any> => {
        const baseConfig = {
            conditionType: getConditionTypeFromTemplate(conditionTemplate),
            shouldReevaluate: true
        };

        switch (conditionTemplate.type) {
            case 'condition-random':
                return {
                    ...baseConfig,
                    successProbability: conditionTemplate.properties?.successProbability?.value || 0.5
                };

            case 'condition-component':
                return {
                    ...baseConfig,
                    componentType: conditionTemplate.properties?.componentType?.value || 'Component'
                };

            case 'condition-tag':
                return {
                    ...baseConfig,
                    tagValue: conditionTemplate.properties?.tagValue?.value || 0
                };

            case 'condition-active':
                return {
                    ...baseConfig,
                    checkHierarchy: conditionTemplate.properties?.checkHierarchy?.value || true
                };

            case 'condition-numeric':
                return {
                    ...baseConfig,
                    propertyPath: conditionTemplate.properties?.propertyPath?.value || 'context.someValue',
                    compareOperator: conditionTemplate.properties?.compareOperator?.value || 'greater',
                    compareValue: conditionTemplate.properties?.compareValue?.value || 0
                };

            case 'condition-property':
                return {
                    ...baseConfig,
                    propertyPath: conditionTemplate.properties?.propertyPath?.value || 'context.someProperty'
                };

            case 'condition-custom':
                return {
                    ...baseConfig,
                    conditionCode: conditionTemplate.properties?.conditionCode?.value || '(context) => true'
                };

            // Blackboard相关条件支持
            case 'blackboard-variable-exists':
                return {
                    ...baseConfig,
                    variableName: conditionTemplate.properties?.variableName?.value || '',
                    invert: conditionTemplate.properties?.invert?.value || false
                };

            case 'blackboard-value-comparison':
                return {
                    ...baseConfig,
                    variableName: conditionTemplate.properties?.variableName?.value || '',
                    operator: conditionTemplate.properties?.operator?.value || 'equal',
                    compareValue: conditionTemplate.properties?.compareValue?.value || '',
                    compareVariable: conditionTemplate.properties?.compareVariable?.value || ''
                };

            case 'blackboard-variable-type-check':
                return {
                    ...baseConfig,
                    variableName: conditionTemplate.properties?.variableName?.value || '',
                    expectedType: conditionTemplate.properties?.expectedType?.value || 'string'
                };

            case 'blackboard-variable-range-check':
                return {
                    ...baseConfig,
                    variableName: conditionTemplate.properties?.variableName?.value || '',
                    minValue: conditionTemplate.properties?.minValue?.value || 0,
                    maxValue: conditionTemplate.properties?.maxValue?.value || 100
                };

            default:
                return baseConfig;
        }
    };

    /**
     * 获取条件类型字符串
     */
    const getConditionTypeFromTemplate = (template: NodeTemplate): string => {
        const typeMap: Record<string, string> = {
            'condition-random': 'random',
            'condition-component': 'hasComponent',
            'condition-tag': 'hasTag',
            'condition-active': 'isActive',
            'condition-numeric': 'numericCompare',
            'condition-property': 'propertyExists',
            'condition-custom': 'custom',
            // Blackboard相关条件
            'blackboard-variable-exists': 'blackboardExists',
            'blackboard-value-comparison': 'blackboardCompare',
            'blackboard-variable-type-check': 'blackboardTypeCheck',
            'blackboard-variable-range-check': 'blackboardRangeCheck'
        };

        return typeMap[template.type] || 'custom';
    };

    /**
     * 执行条件吸附到装饰器
     */
    const attachConditionToDecorator = (
        event: DragEvent,
        decoratorNode: TreeNode
    ): boolean => {
        event.preventDefault();
        event.stopPropagation();

        if (!dragState.isDraggingCondition || !dragState.conditionTemplate) {
            return false;
        }

        if (!isConditionalDecorator(decoratorNode)) {
            return false;
        }

        // 获取条件配置
        const conditionConfig = mapConditionToDecoratorProperties(dragState.conditionTemplate);

        // 更新装饰器属性
        if (!decoratorNode.properties) {
            decoratorNode.properties = {};
        }

        Object.assign(decoratorNode.properties, conditionConfig);

        // 标记装饰器已附加条件
        decoratorNode.attachedCondition = {
            type: dragState.conditionTemplate.type,
            name: dragState.conditionTemplate.name,
            icon: dragState.conditionTemplate.icon
        };

        // 初始化为收缩状态
        if (decoratorNode.conditionExpanded === undefined) {
            decoratorNode.conditionExpanded = false;
        }

        // 重置拖拽状态
        resetDragState();

        return true;
    };

    /**
     * 处理画布拖拽事件（阻止条件节点创建为独立节点）
     */
    const handleCanvasDrop = (event: DragEvent): boolean => {
        const templateData = event.dataTransfer?.getData('application/json');
        if (!templateData) return false;

        try {
            const data = JSON.parse(templateData);
            // 如果是条件拖拽，阻止创建独立节点
            if (data.isConditionDrag || data.isDraggableCondition) {
                event.preventDefault();
                resetDragState();
                return true;
            }
        } catch (error) {
            // 忽略解析错误
        }

        return false;
    };

    /**
     * 重置拖拽状态
     */
    const resetDragState = () => {
        dragState.isDraggingCondition = false;
        dragState.conditionTemplate = null;
        dragState.mousePosition = null;
        dragState.hoveredDecoratorId = null;
    };

    /**
     * 获取条件显示文本（简化版始终显示条件名称）
     */
    const getConditionDisplayText = (decoratorNode: TreeNode, expanded: boolean = false): string => {
        if (!decoratorNode.attachedCondition) {
            return '';
        }

        // 始终返回条件名称，不管是否展开
        return decoratorNode.attachedCondition.name;
    };

    /**
     * 获取条件的可见属性（用于展开时显示）
     */
    const getConditionProperties = (decoratorNode: TreeNode): Record<string, any> => {
        if (!decoratorNode.attachedCondition || !decoratorNode.properties) {
            return {};
        }

        const conditionType = decoratorNode.attachedCondition.type;
        const visibleProps: Record<string, any> = {};

        // 根据条件类型筛选相关属性
        switch (conditionType) {
            case 'condition-random':
                if ('successProbability' in decoratorNode.properties) {
                    visibleProps['成功概率'] = `${(decoratorNode.properties.successProbability * 100).toFixed(1)}%`;
                }
                break;

            case 'condition-component':
                if ('componentType' in decoratorNode.properties) {
                    visibleProps['组件类型'] = decoratorNode.properties.componentType;
                }
                break;

            case 'condition-tag':
                if ('tagValue' in decoratorNode.properties) {
                    visibleProps['标签值'] = decoratorNode.properties.tagValue;
                }
                break;

            case 'condition-active':
                if ('checkHierarchy' in decoratorNode.properties) {
                    visibleProps['检查层级'] = decoratorNode.properties.checkHierarchy ? '是' : '否';
                }
                break;

            case 'condition-numeric':
                if ('propertyPath' in decoratorNode.properties) {
                    visibleProps['属性路径'] = decoratorNode.properties.propertyPath;
                }
                if ('compareOperator' in decoratorNode.properties) {
                    visibleProps['比较操作'] = decoratorNode.properties.compareOperator;
                }
                if ('compareValue' in decoratorNode.properties) {
                    visibleProps['比较值'] = decoratorNode.properties.compareValue;
                }
                break;

            case 'condition-property':
                if ('propertyPath' in decoratorNode.properties) {
                    visibleProps['属性路径'] = decoratorNode.properties.propertyPath;
                }
                break;

            case 'blackboard-variable-exists':
                if ('variableName' in decoratorNode.properties) {
                    visibleProps['变量名'] = decoratorNode.properties.variableName;
                }
                if ('invert' in decoratorNode.properties) {
                    visibleProps['反转结果'] = decoratorNode.properties.invert ? '是' : '否';
                }
                break;

            case 'blackboard-value-comparison':
                if ('variableName' in decoratorNode.properties) {
                    visibleProps['变量名'] = decoratorNode.properties.variableName;
                }
                if ('operator' in decoratorNode.properties) {
                    visibleProps['操作符'] = decoratorNode.properties.operator;
                }
                if ('compareValue' in decoratorNode.properties) {
                    visibleProps['比较值'] = decoratorNode.properties.compareValue;
                }
                if ('compareVariable' in decoratorNode.properties) {
                    visibleProps['比较变量'] = decoratorNode.properties.compareVariable;
                }
                break;

            case 'blackboard-variable-type-check':
                if ('variableName' in decoratorNode.properties) {
                    visibleProps['变量名'] = decoratorNode.properties.variableName;
                }
                if ('expectedType' in decoratorNode.properties) {
                    visibleProps['期望类型'] = decoratorNode.properties.expectedType;
                }
                break;

            case 'blackboard-variable-range-check':
                if ('variableName' in decoratorNode.properties) {
                    visibleProps['变量名'] = decoratorNode.properties.variableName;
                }
                if ('minValue' in decoratorNode.properties) {
                    visibleProps['最小值'] = decoratorNode.properties.minValue;
                }
                if ('maxValue' in decoratorNode.properties) {
                    visibleProps['最大值'] = decoratorNode.properties.maxValue;
                }
                break;
        }

        return visibleProps;
    };

    /**
     * 切换条件展开状态
     */
    const toggleConditionExpanded = (decoratorNode: TreeNode) => {
        decoratorNode.conditionExpanded = !decoratorNode.conditionExpanded;
    };

    /**
     * 移除装饰器的条件
     */
    const removeConditionFromDecorator = (decoratorNode: TreeNode) => {
        if (decoratorNode.attachedCondition) {
            // 删除附加的条件信息
            delete decoratorNode.attachedCondition;

            // 重置展开状态
            decoratorNode.conditionExpanded = false;

            // 保留装饰器的基础属性，只删除条件相关的属性
            const preservedProperties: Record<string, any> = {};

            // 条件装饰器的基础属性
            const baseDecoratorProperties = [
                'executeWhenTrue',
                'executeWhenFalse',
                'checkInterval',
                'abortType'
            ];

            // 保留基础属性
            if (decoratorNode.properties) {
                baseDecoratorProperties.forEach(key => {
                    if (key in decoratorNode.properties!) {
                        preservedProperties[key] = decoratorNode.properties![key];
                    }
                });
            }

            // 重置为只包含基础属性的对象
            decoratorNode.properties = preservedProperties;
        }
    };

    /**
     * 检查装饰器是否可以接受条件吸附
     */
    const canAcceptCondition = (decoratorNode: TreeNode): boolean => {
        return isConditionalDecorator(decoratorNode);
    };

    return {
        dragState,
        startConditionDrag,
        handleDecoratorDragOver,
        handleDecoratorDragLeave,
        attachConditionToDecorator,
        handleCanvasDrop,
        resetDragState,
        getConditionDisplayText,
        removeConditionFromDecorator,
        canAcceptCondition,
        isConditionalDecorator,
        toggleConditionExpanded,
        getConditionProperties
    };
}