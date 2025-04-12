// 重新导出类型
export * from './types';

// 重新导出合约配置
export * from './contractConfig';

// 导出API客户端
import { ApiClient } from './apiClient';

// 创建API客户端单例
export const aiApi = new ApiClient();

// 默认导出API客户端实例
export default aiApi; 