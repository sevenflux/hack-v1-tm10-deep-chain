import { useState } from 'react'
import { TradeItem } from '../api/types'
import { useAccount } from 'wagmi'
import '../styles/TokenSwapWidget.css'

interface TokenSwapWidgetProps {
  trade: TradeItem
  onComplete?: (success: boolean) => void
  onClose?: () => void
}

export function TokenSwapWidget({ trade, onComplete, onClose }: TokenSwapWidgetProps) {
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 处理交易
  const handleSwap = async () => {
    if (!trade || !isConnected || !address) {
      setError('请先连接钱包')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      // 模拟交易过程
      setTimeout(() => {
        setIsLoading(false)
        onComplete?.(true)
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
    // 判断需要去哪个平台交易
    let url = '';
    
    // 如果是同链交易，跳转到对应链的DEX
    if (trade.fromChain === trade.toChain) {
      if (trade.fromChain === 'ethereum') {
        url = `https://app.uniswap.org/#/swap?inputCurrency=${trade.fromAsset}&outputCurrency=${trade.toAsset}`;
      } else if (trade.fromChain === 'polygon') {
        url = `https://quickswap.exchange/#/swap?inputCurrency=${trade.fromAsset}&outputCurrency=${trade.toAsset}`;
      } else if (trade.fromChain === 'bsc') {
        url = `https://pancakeswap.finance/swap?inputCurrency=${trade.fromAsset}&outputCurrency=${trade.toAsset}`;
      } else {
        url = `https://app.1inch.io/#/${trade.fromChain}/simple/swap/${trade.fromAsset}/${trade.toAsset}`;
      }
    } 
    // 如果是跨链交易，跳转到跨链平台
    else {
      url = `https://app.across.to/?from=${trade.fromChain}&to=${trade.toChain}`;
    }
    
    window.open(url, '_blank');
    
    // 通知完成
    setTimeout(() => {
      onComplete?.(true);
    }, 1000);
  };

  // 如果链不同，显示跨链交换信息
  const isCrossChain = trade.fromChain !== trade.toChain;
  
  if (!trade) {
    return <div className="swap-container">没有可用的交易数据</div>
  }

  return (
    <div className="swap-widget-container">
      <div className="swap-widget-header">
        <h3>执行交易</h3>
        {onClose && (
          <button className="close-swap-widget" onClick={onClose}>×</button>
        )}
      </div>

      <div className="swap-widget-content">
        {isCrossChain && (
          <div className="cross-chain-warning">
            <p>⚠️ 跨链交易需要使用桥接服务</p>
            <p>从 {trade.fromChain} 到 {trade.toChain}</p>
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
                {trade.amount} {trade.fromAsset}
                <span className="chain-tag" data-chain={trade.fromChain}>{trade.fromChain}</span>
              </span>
              <span className="arrow">→</span>
              <span className="to-asset">
                {trade.toAsset}
                <span className="chain-tag" data-chain={trade.toChain}>{trade.toChain}</span>
              </span>
            </div>
            
            {trade.reason && (
              <div className="swap-reason">
                原因: {trade.reason}
              </div>
            )}
          </div>
          
          <div className="trade-options">
            <h4>交易方式选择</h4>
            
            <div className="trade-option-card">
              <h5>{isCrossChain ? '跨链' : '同链'}交易</h5>
              <p>
                {isCrossChain 
                  ? `从${trade.fromChain}到${trade.toChain}的跨链交易需要使用专业的桥接服务。` 
                  : `在${trade.fromChain}链上进行${trade.fromAsset}到${trade.toAsset}的交换。`}
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
                    href={`https://app.across.to/?from=${trade.fromChain}&to=${trade.toChain}`} 
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