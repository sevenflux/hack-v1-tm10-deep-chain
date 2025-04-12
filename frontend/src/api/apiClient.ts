import {
  AdvisorRequestInput,
  AdvisorResponse,
  VerifyResponse,
  IPFSStorageData,
  APIError,
  generateRequestHash
} from './types';

// API 基础URL - 根据环境配置
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// IPFS配置
export const IPFS_GATEWAY = 'https://ipfs.io/ipfs';

/**
 * AI服务API客户端实现
 */
export class ApiClient {
  /**
   * 获取AI投资建议
   * @param userAddress 用户地址
   * @param input 投资请求参数
   * @returns 投资建议响应
   */
  async getAdvice(userAddress: string, input: AdvisorRequestInput): Promise<AdvisorResponse> {
    try {
      const requestHash = generateRequestHash(input);
      
      const response = await fetch(`${API_BASE_URL}/api/advice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          userAddress,
          input,
          requestHash
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new APIError(
          errorData.detail || '未知错误',
          response.status,
          errorData.error
        );
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      console.error('获取AI建议失败:', error);
      return {
        success: false,
        error: 'API_ERROR',
        message: '调用AI顾问服务失败'
      };
    }
  }
  
  /**
   * 从IPFS获取完整数据
   * @param cid IPFS内容ID
   * @returns IPFS存储数据
   */
  async getIpfsData(cid: string): Promise<IPFSStorageData | null> {
    try {
      // 优先尝试使用后端API获取
      const response = await fetch(`${API_BASE_URL}/api/ipfs/${cid}`);
      
      if (response.ok) {
        const result = await response.json();
        return result.data;
      }
      
      // 如果后端获取失败，直接从IPFS网关获取
      console.log('通过后端获取IPFS数据失败，尝试直接从网关获取');
      const ipfsResponse = await fetch(`${IPFS_GATEWAY}/${cid}`);
      
      if (!ipfsResponse.ok) {
        throw new Error(`IPFS请求失败: ${ipfsResponse.status}`);
      }
      
      return await ipfsResponse.json();
    } catch (error) {
      console.error('IPFS数据获取失败:', error);
      return null;
    }
  }
  
  /**
   * 验证区块链交易
   * @param txHash 交易哈希
   * @returns 验证结果
   */
  async verifyTransaction(txHash: string): Promise<VerifyResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/verify/${txHash}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new APIError(
          errorData.detail || '交易验证失败',
          response.status
        );
      }
      
      return await response.json();
    } catch (error) {
      console.error('验证交易失败:', error);
      return {
        success: false,
        error: error instanceof APIError ? error.message : '验证交易时发生错误'
      };
    }
  }
} 