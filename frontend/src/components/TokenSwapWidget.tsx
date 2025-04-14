import { useState } from 'react'
import { TradeItem } from '../api/types'
import { useAccount } from 'wagmi'
import '../styles/TokenSwapWidget.css'

interface TokenSwapWidgetProps {
  trade?: TradeItem
  trades?: TradeItem[]
  userAddress?: string
  onComplete?: (success: boolean) => void
  onClose?: () => void
}

export function TokenSwapWidget({ trade, trades, userAddress, onComplete, onClose }: TokenSwapWidgetProps) {
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTradeIndex, setActiveTradeIndex] = useState(0)
  
  // 使用参数中提供的地址或从钱包连接中获取地址
  const effectiveAddress = userAddress || (isConnected ? address : undefined)
  
  // 获取当前处理的交易
  const currentTrade = trade || (trades && trades.length > activeTradeIndex ? trades[activeTradeIndex] : undefined)
  
  // 是否为批量交易模式
  const isBatchMode = !trade && trades && trades.length > 0
  
  // 处理交易
  const handleSwap = async () => {
    if (!currentTrade || !effectiveAddress) {
      setError('请先连接钱包')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      // 模拟交易过程
      setTimeout(() => {
        setIsLoading(false)
        
        // 如果是批量模式并且还有下一个交易
        if (isBatchMode && trades && activeTradeIndex < trades.length - 1) {
          setActiveTradeIndex(activeTradeIndex + 1)
        } else {
          onComplete?.(true)
        }
      }, 2000)
    } catch (err: any) {
      console.error('交易执行失败:', err)
      setError(err.message || '交易执行失败')
      setIsLoading(false)
      onComplete?.(false)
    }
  }

  // 跳转到外部交易平台
  const goToExternalExchange = () => {
    if (!currentTrade) return
    
    // 判断需要去哪个平台交易
    let url = '';
    
    // 如果是同链交易，跳转到对应链的DEX
    if (currentTrade.fromChain === currentTrade.toChain) {
      if (currentTrade.fromChain === 'ethereum') {
        url = `https://app.uniswap.org/#/swap?inputCurrency=${currentTrade.fromAsset}&outputCurrency=${currentTrade.toAsset}`;
      } else if (currentTrade.fromChain === 'polygon') {
        url = `https://quickswap.exchange/#/swap?inputCurrency=${currentTrade.fromAsset}&outputCurrency=${currentTrade.toAsset}`;
      } else if (currentTrade.fromChain === 'bsc') {
        url = `https://pancakeswap.finance/swap?inputCurrency=${currentTrade.fromAsset}&outputCurrency=${currentTrade.toAsset}`;
      } else {
        url = `https://app.1inch.io/#/${currentTrade.fromChain}/simple/swap/${currentTrade.fromAsset}/${currentTrade.toAsset}`;
      }
    } 
    // 如果是跨链交易，跳转到跨链平台
    else {
      url = `https://app.across.to/?from=${currentTrade.fromChain}&to=${currentTrade.toChain}`;
    }
    
    window.open(url, '_blank');
    
    // 如果是批量模式并且还有下一个交易
    if (isBatchMode && trades && activeTradeIndex < trades.length - 1) {
      setTimeout(() => {
        setActiveTradeIndex(activeTradeIndex + 1);
      }, 1000);
    } else {
      // 通知完成
      setTimeout(() => {
        onComplete?.(true);
      }, 1000);
    }
  };

  // 如果没有交易数据，显示提示信息
  if (!currentTrade) {
    return <div className="swap-container">没有可用的交易数据</div>
  }

  // 如果链不同，显示跨链交换信息
  const isCrossChain = currentTrade.fromChain !== currentTrade.toChain;

  return (
    <div className="swap-widget-container">
      <div className="swap-widget-header">
        <h3>
          执行交易 
          {isBatchMode && trades && (
            <span className="batch-indicator">
              ({activeTradeIndex + 1}/{trades.length})
            </span>
          )}
        </h3>
        {onClose && (
          <button className="close-swap-widget" onClick={onClose}>×</button>
        )}
      </div>

      <div className="swap-widget-content">
        {isBatchMode && trades && trades.length > 1 && (
          <div className="batch-navigation">
            <div className="batch-progress">
              {trades.map((_, index) => (
                <div 
                  key={index} 
                  className={`progress-dot ${index === activeTradeIndex ? 'active' : index < activeTradeIndex ? 'completed' : ''}`}
                  onClick={() => setActiveTradeIndex(index)}
                />
              ))}
            </div>
          </div>
        )}
        
        {isCrossChain && (
          <div className="cross-chain-warning">
            <p>⚠️ 跨链交易需要使用桥接服务</p>
            <p>从 {currentTrade.fromChain} 到 {currentTrade.toChain}</p>
          </div>
        )}
        
        {error && (
          <div className="swap-error">
            {error}
          </div>
        )}

        <div className="swap-details">
          <div className="swap-summary">
            <p>交易摘要：</p>
            <div className="swap-assets">
              <span className="from-asset">
                {currentTrade.amount} {currentTrade.fromAsset}
                <span className="chain-tag" data-chain={currentTrade.fromChain}>{currentTrade.fromChain}</span>
              </span>
              <span className="arrow">→</span>
              <span className="to-asset">
                {currentTrade.toAsset}
                <span className="chain-tag" data-chain={currentTrade.toChain}>{currentTrade.toChain}</span>
              </span>
            </div>
            
            {currentTrade.reason && (
              <div className="swap-reason">
                原因: {currentTrade.reason}
              </div>
            )}
          </div>
          
          <div className="trade-options">
            <h4>交易方式选择</h4>
            
            <div className="trade-option-card">
              <h5>{isCrossChain ? '跨链' : '同链'}交易</h5>
              <p>
                {isCrossChain 
                  ? `从${currentTrade.fromChain}到${currentTrade.toChain}的跨链交易需要使用专业的桥接服务。` 
                  : `在${currentTrade.fromChain}链上进行${currentTrade.fromAsset}到${currentTrade.toAsset}的交换。`}
              </p>
              <button 
                className="trade-option-button" 
                onClick={goToExternalExchange}
                disabled={isLoading}
              >
                {isLoading ? '处理中...' : `前往${isCrossChain ? 'Across跨链交易' : '交易平台'}`}
              </button>
            </div>
            
            {!isCrossChain && (
              <div className="trade-option-card">
                <h5>使用推荐交易路径</h5>
                <p>系统将自动选择最佳交易路径，获得更好的交易价格。</p>
                <button 
                  className="trade-option-button primary" 
                  onClick={handleSwap}
                  disabled={isLoading}
                >
                  {isLoading ? '处理中...' : '立即交易'}
                </button>
              </div>
            )}
          </div>
          
          {isCrossChain && (
            <div className="cross-chain-info">
              <p>推荐使用以下跨链服务：</p>
              <ul>
                <li>
                  <a 
                    href={`https://app.across.to/?from=${currentTrade.fromChain}&to=${currentTrade.toChain}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Across Protocol
                  </a>
                </li>
                <li>
                  <a 
                    href="https://app.hop.exchange/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Hop Exchange
                  </a>
                </li>
                <li>
                  <a 
                    href="https://app.multichain.org/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Multichain
                  </a>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 