import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { Address } from 'viem'
import { 
  AI_CONTRACT_ADDRESS, 
  AI_CONTRACT_ABI, 
  apiClient, 
  getEtherscanLink
} from '../api'
import { BlockchainRequest } from '../api/types'
import '../styles/AIAdvisorContract.css'

// 从环境变量获取合约地址
const CONTRACT_ADDRESS = AI_CONTRACT_ADDRESS;

export function AIAdvisorContract() {
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<BlockchainRequest[]>([])
  const { data: userRequests, isError, refetch } = useReadContract({
    address: CONTRACT_ADDRESS as Address,
    abi: AI_CONTRACT_ABI,
    functionName: 'getUserRequests',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    }
  })
  
  useEffect(() => {
    if (userRequests && Array.isArray(userRequests)) {
      // 转换区块链数据格式
      const formattedRequests = userRequests[0].map((hash: any, index: number) => ({
        requestHash: hash,
        cid: userRequests[1][index],
        timestamp: Number(userRequests[2][index])
      }))
      
      // 更新状态
      setHistory(formattedRequests)
      
      // 获取IPFS详情数据
      loadIpfsDetails(formattedRequests)
    } else if (address && isConnected) {
      // 如果直接从合约获取数据失败，则尝试使用API获取
      fetchHistoryFromApi();
    }
  }, [userRequests, address, isConnected])
  
  // 使用API获取历史记录
  const fetchHistoryFromApi = async () => {
    if (!address) return;
    
    try {
      setIsLoading(true);
      console.log("尝试从API获取历史记录...");
      
      const historyData = await apiClient.getUserRequests(address);
      
      if (historyData && historyData.length > 0) {
        console.log("成功从API获取历史记录:", historyData);
        setHistory(historyData);
        
        // 获取IPFS详情数据
        loadIpfsDetails(historyData);
      } else {
        console.log("API返回的历史记录为空");
      }
    } catch (error) {
      console.error("从API获取历史记录失败:", error);
    } finally {
      setIsLoading(false);
    }
  }
  
  // 加载IPFS详情
  const loadIpfsDetails = async (requests: BlockchainRequest[]) => {
    if (requests.length === 0) return
    
    setIsLoading(true)
    
    const updatedHistory = [...requests]
    
    // 并行加载所有IPFS数据
    await Promise.all(
      requests.map(async (req, index) => {
        try {
          const ipfsData = await apiClient.getIpfsData(req.cid)
          if (ipfsData && ipfsData.output) {
            updatedHistory[index] = {
              ...updatedHistory[index],
              details: {
                recommendation: ipfsData.output.allocationText || 
                  ipfsData.output.allocation
                    .map(item => `${item.asset}: ${item.percentage}%`)
                    .join(', '),
                allocation: ipfsData.output.allocation
              }
            }
          }
        } catch (error) {
          console.error(`无法加载CID为${req.cid}的IPFS数据:`, error)
        }
      })
    )
    
    setHistory(updatedHistory)
    setIsLoading(false)
  }
  
  // 刷新历史记录
  const refreshHistory = () => {
    refetch();
    // 同时也尝试通过API获取
    fetchHistoryFromApi();
  }
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN')
  }
  
  const verifyTransaction = async (requestHash: string) => {
    try {
      setIsLoading(true)
      
      // 告知用户这不是直接的交易哈希
      alert(`正在验证请求ID: ${requestHash}\n\n请注意: 这是请求的唯一标识符，不是实际的交易哈希。系统将尝试查找与此请求关联的交易。`);
      
      // 使用API验证交易
      const verification = await apiClient.verifyTransaction(requestHash)
      
      if (verification.success && verification.data) {
        // 显示成功信息并提供真实的交易哈希链接
        const txHash = verification.data.hash;
        const blockNumber = verification.data.blockNumber;
        const etherscanLink = getEtherscanLink(txHash);
        
        const result = confirm(
          `交易已验证: 在区块 ${blockNumber} 成功确认\n\n` +
          `交易哈希: ${txHash}\n\n` +
          `点击确定查看Etherscan上的交易详情`
        );
        
        if (result) {
          window.open(etherscanLink, '_blank');
        }
      } else {
        alert(`验证失败: ${verification.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('验证交易时出错:', error)
      alert('验证交易时发生错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }
  
  // 渲染请求历史
  const renderHistory = () => {
    if (isError) {
      return <div className="error-message">无法加载历史数据，请检查网络连接</div>;
    }
    
    if (history.length === 0) {
      return (
        <div className="empty-history">
          <p>暂无投资建议历史</p>
          <p>使用右侧AI投顾获取您的第一条投资建议</p>
        </div>
      );
    }
    
    return (
      <div className="history-list">
        {history.map((item, index) => (
          <div key={index} className="history-item">
            <div className="history-time">{formatDate(item.timestamp)}</div>
            
            {item.details ? (
              <div className="history-details">
                <div className="history-recommendation">{item.details.recommendation}</div>
                
                {item.details.allocation && (
                  <div className="mini-allocation-chart">
                    {item.details.allocation.map((alloc, i) => (
                      <div key={i} className="mini-allocation-item">
                        <div className="mini-allocation-label">{alloc.asset}</div>
                        <div className="mini-allocation-bar-container">
                          <div 
                            className="mini-allocation-bar" 
                            style={{width: `${alloc.percentage}%`}}
                          ></div>
                          <span className="mini-allocation-percentage">{alloc.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="history-loading">加载IPFS数据中...</div>
            )}
            
            <div className="history-links">
              <a 
                href={`https://ipfs.io/ipfs/${item.cid}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="history-link"
              >
                查看IPFS数据
              </a>
              <button 
                onClick={() => {
                  // 复制请求哈希到剪贴板
                  navigator.clipboard.writeText(item.requestHash);
                  alert('请求ID已复制到剪贴板');
                }}
                className="history-link"
              >
                复制请求ID
              </button>
              <button 
                onClick={() => verifyTransaction(item.requestHash)}
                className="history-link verify-button"
                disabled={isLoading}
              >
                查找交易详情
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (!isConnected) {
    return <div className="advisor-contract-container">请先连接钱包以查看您的投资建议历史</div>
  }
  
  return (
    <div className="advisor-contract-container">
      <div className="history-header">
        <h3>AI投顾建议历史</h3>
        <div className="history-actions">
          <button 
            className="refresh-button"
            onClick={refreshHistory}
            disabled={isLoading}
          >
            {isLoading ? '加载中...' : '刷新'}
          </button>
        </div>
      </div>
      
      {renderHistory()}
    </div>
  )
} 