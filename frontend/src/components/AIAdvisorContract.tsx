import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { Address } from 'viem'
import { 
  AI_CONTRACT_ADDRESS, 
  AI_CONTRACT_ABI, 
  apiClient, 
  getEtherscanLink
} from '../api'
import { BlockchainRequest, TradeItem } from '../api/types'
import '../styles/AIAdvisorContract.css'

// 从环境变量获取合约地址
const CONTRACT_ADDRESS = AI_CONTRACT_ADDRESS;

export function AIAdvisorContract() {
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
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
  
  // 添加超时自动重试和失败恢复机制
  useEffect(() => {
    // 如果已加载数据，则不执行
    if (history.length > 0) return;
    
    // 网络问题或其他原因导致数据未加载，设置重试定时器
    const retryTimer = setTimeout(() => {
      if (history.length === 0 && address && isConnected) {
        console.log("数据加载超时，尝试使用API获取历史记录");
        fetchHistoryFromApi();
      }
    }, 5000); // 5秒后检查是否加载成功
    
    return () => clearTimeout(retryTimer);
  }, [history.length, address, isConnected]);
  
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
        
        // 如果当前历史记录为空，并且API返回为空，尝试再次刷新合约数据
        if (history.length === 0) {
          console.log("尝试再次从合约获取数据");
          setTimeout(() => refetch(), 2000);
        }
      }
    } catch (error) {
      console.error("从API获取历史记录失败:", error);
      
      // 如果失败并且当前历史为空，尝试使用本地存储的数据
      if (history.length === 0) {
        try {
          const cachedHistory = localStorage.getItem('advisorHistory');
          if (cachedHistory) {
            const parsedHistory = JSON.parse(cachedHistory);
            if (parsedHistory && parsedHistory.length > 0 && parsedHistory[0].address === address) {
              console.log("使用缓存的历史记录");
              setHistory(parsedHistory.data || []);
            }
          }
        } catch (cacheError) {
          console.error("读取缓存数据失败:", cacheError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }
  
  // 缓存历史记录以备网络问题时使用
  useEffect(() => {
    if (history.length > 0 && address) {
      try {
        localStorage.setItem('advisorHistory', JSON.stringify({
          address,
          data: history,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error("缓存历史记录失败:", error);
      }
    }
  }, [history, address]);
  
  // 加载IPFS详情
  const loadIpfsDetails = async (requests: BlockchainRequest[]) => {
    if (requests.length === 0) return
    
    setIsLoading(true)
    setLoadError(false)
    
    const updatedHistory = [...requests]
    let loadedCount = 0
    let errorCount = 0
    
    // 并行加载所有IPFS数据
    await Promise.all(
      requests.map(async (req, index) => {
        if (req.details) {
          // 已经有详情数据，不需要再次加载
          loadedCount++
          return
        }
        
        try {
          const ipfsData = await apiClient.getIpfsData(req.cid)
          if (ipfsData && ipfsData.output) {
            let recommendation = '';
            let allocation = undefined;
            let trades = undefined;
            
            // 根据输出类型处理数据
            if (ipfsData.output.action === 'recommend') {
              recommendation = ipfsData.output.allocationText || '';
              allocation = ipfsData.output.allocation || [];
            } else if (ipfsData.output.action === 'trade') {
              recommendation = ipfsData.output.tradeSummary || '';
              trades = ipfsData.output.trades;
              
              // 如果需要，还可以将交易转换为分配格式以便显示
              if (!allocation && trades && trades.length > 0) {
                allocation = trades.map(trade => ({
                  asset: `${trade.fromAsset} → ${trade.toAsset}`,
                  percentage: 100 / trades.length, // 平均分配百分比
                  chain: `${trade.fromChain} → ${trade.toChain}`
                }));
              }
            }
            
            updatedHistory[index] = {
              ...updatedHistory[index],
              details: {
                recommendation,
                allocation,
                trades
              }
            }
            loadedCount++
          } else {
            errorCount++
            console.warn(`IPFS数据CID为${req.cid}的响应为空`)
          }
        } catch (error) {
          errorCount++
          console.error(`无法加载CID为${req.cid}的IPFS数据:`, error)
        }
      })
    )
    
    // 更新状态并跟踪加载情况
    setHistory(updatedHistory)
    setLoadError(errorCount > 0)
    
    // 如果部分加载成功，也视为成功
    if (loadedCount > 0) {
      console.log(`IPFS数据加载: ${loadedCount}成功, ${errorCount}失败`)
    } else if (errorCount > 0) {
      // 全部加载失败，尝试重试
      if (retryCount < 3) {
        console.log(`所有IPFS数据加载失败，重试中... (${retryCount + 1}/3)`)
        setRetryCount(prev => prev + 1)
        
        // 延迟重试
        setTimeout(() => {
          loadIpfsDetails(requests)
        }, 3000)
        return
      } else {
        console.error('多次尝试后仍无法加载IPFS数据')
      }
    }
    
    setIsLoading(false)
  }
  
  // 刷新历史记录
  const refreshHistory = () => {
    refetch();
    // 同时也尝试通过API获取
    fetchHistoryFromApi();
  }
  
  /**
   * 处理新请求
   * @param requestHash 请求哈希
   * @param txHash 交易哈希
   */
  const handleNewRequest = async (requestHash: string, txHash: string) => {
    try {
      // 确保用户已连接
      if (!isConnected || !address) {
        alert('请先连接钱包');
        return;
      }
      
      setIsLoading(true);
      
      // 如果有交易哈希，可以打开区块链浏览器查看交易
      if (txHash) {
        const etherscanLink = getEtherscanLink(txHash);
        const result = confirm(
          `请求已提交到区块链，交易哈希: ${txHash}\n\n` +
          `点击确定在Etherscan上查看交易详情`
        );
        
        if (result) {
          window.open(etherscanLink, '_blank');
        }
      }
      
      // 刷新历史记录
      await refreshHistory();
    } catch (error) {
      console.error('处理新请求时出错:', error);
      alert('处理请求时发生错误');
    } finally {
      setIsLoading(false);
    }
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
  
  // 渲染单个交易详情
  const renderTradeItem = (trade: TradeItem) => {
    return (
      <div className="trade-item">
        <div className="trade-header">
          <div className="trade-assets">
            <span className="from-asset">
              {trade.fromAsset}
              {trade.fromChain && <span className="chain-tag" data-chain={trade.fromChain}>{trade.fromChain}</span>}
            </span>
            <span className="arrow">→</span>
            <span className="to-asset">
              {trade.toAsset}
              {trade.toChain && <span className="chain-tag" data-chain={trade.toChain}>{trade.toChain}</span>}
            </span>
          </div>
        </div>
        <div className="trade-detail">
          <div className="trade-amount">
            数量: <strong>{trade.amount}</strong> {trade.fromAsset}
            {trade.amountInUSD && <span className="amount-usd">(约 ${trade.amountInUSD.toFixed(2)})</span>}
          </div>
          {trade.reason && (
            <div className="trade-reason">
              原因: {trade.reason}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染请求历史
  const renderHistory = () => {
    // 显示网络错误但有备选方案
    if (isError && history.length === 0 && retryCount === 0) {
      return (
        <div className="error-message">
          <p>从区块链加载历史数据失败，正在尝试备选方案...</p>
          <button onClick={fetchHistoryFromApi} className="retry-button">
            立即重试
          </button>
        </div>
      );
    }
    
    // 完全无法加载数据
    if (isError && history.length === 0 && retryCount >= 3) {
      return (
        <div className="error-message">
          <p>无法加载历史数据，请检查网络连接</p>
          <button onClick={refreshHistory} className="retry-button">
            重试
          </button>
        </div>
      );
    }
    
    if (history.length === 0) {
      return (
        <div className="empty-history">
          <p>暂无投资建议历史</p>
          <p>使用右侧AI投顾获取您的第一条投资建议</p>
        </div>
      );
    }
    
    // 有些IPFS数据加载失败
    const showIpfsError = loadError && history.some(item => !item.details);
    
    return (
      <>
        {showIpfsError && (
          <div className="warning-message">
            <p>部分详细数据加载失败，但我们仍然显示可用的信息</p>
            <button onClick={() => loadIpfsDetails(history)} className="retry-button">
              重新加载详情
            </button>
          </div>
        )}
        
        <div className="history-list">
          {history.map((item, index) => (
            <div key={index} className="history-item">
              <div className="history-time">{formatDate(item.timestamp)}</div>
              
              {item.details ? (
                <div className="history-details">
                  <div className="history-recommendation">{item.details.recommendation}</div>
                  
                  {/* 判断是投资建议还是交易执行 */}
                  {item.details.trades && item.details.trades.length > 0 ? (
                    <div className="trades-list history-trades">
                      <h4>交易计划</h4>
                      {item.details.trades.map((trade, i) => (
                        <div key={i}>{renderTradeItem(trade)}</div>
                      ))}
                    </div>
                  ) : item.details.allocation && (
                    <div className="mini-allocation-chart">
                      {item.details.allocation.map((alloc, i) => (
                        <div key={i} className="mini-allocation-item">
                          <div className="mini-allocation-label">
                            {alloc.asset}
                            {alloc.chain && <span className="chain-tag" data-chain={alloc.chain}>{alloc.chain}</span>}
                          </div>
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
                <div className="history-loading">
                  {isLoading ? '加载IPFS数据中...' : 
                   <button onClick={() => loadIpfsDetails([item])} className="retry-button">
                     重新加载详情
                   </button>
                  }
                </div>
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
      </>
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