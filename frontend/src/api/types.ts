import { ethers } from 'ethers';

// 单个加密货币资产
export interface CryptoAsset {
  symbol: string;     // 加密货币符号：BTC, ETH, USDC等
  percentage: number; // 持有百分比 (0-100)
}

// AI投顾请求参数接口
export interface AdvisorRequestInput {
  riskLevel: 'low' | 'medium' | 'high'; // 风险承受能力
  amount: number;                      // 投资金额
  cryptoAssets: CryptoAsset[];         // 当前持有的加密货币资产比例
}

// AI建议项
export interface AllocationItem {
  asset: string;     // 资产名称
  percentage: number; // 配置百分比
}

// API请求体
export interface AdviceRequestBody {
  userAddress: string;
  input: AdvisorRequestInput;
  requestHash: string;
}

// AI响应结果接口
export interface AdvisorResponse {
  success: boolean;
  data?: {
    recommendation: string;    // 简短建议文本
    allocation: AllocationItem[]; // 具体资产配置
    cid: string;               // IPFS内容ID
    txHash: string;            // 区块链交易哈希
    signature: string;         // 后端签名
    timestamp: number;         // 签名时间戳
  };
  error?: string;
  message?: string;
}

// 区块链事件
export interface BlockchainEvent {
  event: string;
  address: string;
  returnValues: Record<string, any>;
  blockNumber: number;
}

// 交易验证结果
export interface TransactionVerification {
  hash: string;
  blockNumber: number;
  from: string;
  to: string;
  status: string;
  gasUsed: number;
  events: BlockchainEvent[];
}

// 交易验证响应
export interface VerifyResponse {
  success: boolean;
  data?: TransactionVerification;
  error?: string;
}

// IPFS存储的完整数据格式
export interface IPFSStorageData {
  input: AdvisorRequestInput;
  output: {
    modelVersion: string;
    timestamp: number;
    allocation: AllocationItem[];
    allocationText: string;
  };
  timestamp: number;
}

// 区块链上的用户请求记录
export interface BlockchainRequest {
  requestHash: string;
  cid: string;
  timestamp: number;
  // 可选的IPFS数据缓存
  details?: {
    recommendation?: string;
    allocation?: AllocationItem[];
  };
}

// 错误处理
export class APIError extends Error {
  statusCode: number;
  errorCode?: string;
  
  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

// 工具函数：生成请求哈希
export function generateRequestHash(input: AdvisorRequestInput): string {
  // 对输入进行排序以确保哈希一致性
  const sortedInput = JSON.stringify(input, Object.keys(input).sort());
  return ethers.keccak256(ethers.toUtf8Bytes(sortedInput));
}

// 工具函数：验证签名
export function verifySignature(message: string, signature: string, timestamp: number, expectedAddress: string): boolean {
  try {
    // 创建包含时间戳的消息
    const messageWithTimestamp = `${message}:${timestamp}`;
    const recoveredAddress = ethers.verifyMessage(messageWithTimestamp, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
} 