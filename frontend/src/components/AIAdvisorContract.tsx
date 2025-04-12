import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { Address } from 'viem'
import { 
  AI_CONTRACT_ADDRESS, 
  AI_CONTRACT_ABI, 
  BlockchainRequest, 
  aiApi, 
  AdvisorResponse,
  getEtherscanLink
} from '../api'
import '../styles/AIAdvisorContract.css'

// 从环境变量获取合约地址
const CONTRACT_ADDRESS = AI_CONTRACT_ADDRESS;

export function AIAdvisorContract() {
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const { writeContractAsync } = useWriteContract()
  const [history, setHistory] = useState<{
    requestHash: string;
    cid: string;
    timestamp: number;
    details?: {
      recommendation?: string;
      allocation?: { asset: string; percentage: number }[];
    }
  }[]>([])
  
  // 查询用户历史请求
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
    }
  }, [userRequests])
  
  // 加载IPFS详情
  const loadIpfsDetails = async (requests: BlockchainRequest[]) => {
    if (requests.length === 0) return
    
    setIsLoading(true)
    
    const updatedHistory = [...requests]
    
    // 并行加载所有IPFS数据
    await Promise.all(
      requests.map(async (req, index) => {
        try {
          const ipfsData = await aiApi.getIpfsData(req.cid)
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
  
  const refreshHistory = () => {
    refetch()
  }
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN')
  }
  
  const verifyTransaction = async (requestHash: string) => {
    try {
      setIsLoading(true)
      
      // 使用API验证交易
      const verification = await aiApi.verifyTransaction(requestHash)
      
      if (verification.success && verification.data) {
        alert(`交易已验证: 在区块 ${verification.data.blockNumber} 成功确认`)
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
  
  // 处理新请求
  const handleNewRequest = async (requestData: AdvisorResponse) => {
    if (!isConnected || !address) {
      alert('请先连接您的钱包');
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (requestData.success && requestData.data && requestData.data.txHash) {
        // 打开Etherscan链接查看交易
        window.open(getEtherscanLink(requestData.data.txHash), '_blank');
        
        // 刷新请求历史
        setTimeout(() => {
          refreshHistory();
        }, 5000); // 5秒后刷新，给交易一些确认时间
      } else {
        throw new Error(requestData.error || '请求失败');
      }
    } catch (error) {
      console.error('处理新请求时出错:', error);
      alert(`处理请求时出错: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
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
              <a 
                href={getEtherscanLink(item.requestHash)} 
                target="_blank"
                rel="noopener noreferrer"
                className="history-link"
              >
                查看交易
              </a>
              <button 
                onClick={() => verifyTransaction(item.requestHash)}
                className="history-link verify-button"
                disabled={isLoading}
              >
                区块链验证
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