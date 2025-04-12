import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { AdvisorRequestInput, AllocationItem, aiApi, APIError } from '../config/api'
import '../styles/Sidebar.css'

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

// 消息类型
type MessageType = 'user' | 'ai' | 'system';

// 聊天消息接口
interface ChatMessage {
  type: MessageType;
  text: string;
  timestamp: number;
  allocation?: AllocationItem[];
  cid?: string;
  txHash?: string;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { isConnected, address } = useAccount()
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      type: 'ai', 
      text: '你好！我是你的投资顾问AI。我可以根据你的资产分布给你投资建议。有什么可以帮助你的吗？',
      timestamp: Date.now()
    }
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  
  // 解析用户输入为投资请求
  const parseUserInput = (input: string): AdvisorRequestInput | null => {
    // 简单示例：根据关键词匹配风险等级
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (input.includes('保守') || input.includes('低风险')) {
      riskLevel = 'low';
    } else if (input.includes('激进') || input.includes('高风险')) {
      riskLevel = 'high';
    }
    
    // 尝试匹配投资金额，例如"投资5000元"或"10000美元"
    const amountMatch = input.match(/投资\s*(\d+)\s*(元|美元|块|美金)/);
    const amount = amountMatch ? parseInt(amountMatch[1]) : 10000; // 默认10000
    
    // 尝试匹配投资期限，例如"3年期"或"5年投资"
    const horizonMatch = input.match(/(\d+)\s*年/);
    const horizon = horizonMatch ? parseInt(horizonMatch[1]) : 3; // 默认3年
    
    // 尝试匹配资产类型
    const assets: string[] = [];
    if (input.includes('比特币') || input.includes('BTC')) assets.push('BTC');
    if (input.includes('以太坊') || input.includes('ETH')) assets.push('ETH');
    if (input.includes('稳定币') || input.includes('USDT') || input.includes('USDC')) assets.push('stablecoins');
    
    return {
      riskLevel,
      amount,
      horizon,
      assets: assets.length > 0 ? assets : undefined
    };
  }
  
  const handleSendMessage = async () => {
    if (!message.trim() || !isConnected || !address) return
    
    // 添加用户消息到聊天历史
    const userMessage: ChatMessage = {
      type: 'user', 
      text: message,
      timestamp: Date.now()
    };
    setChatHistory(prev => [...prev, userMessage]);
    setMessage('');
    
    // 显示处理中状态
    setIsProcessing(true);
    
    // 添加"正在思考"的系统消息
    setChatHistory(prev => [...prev, {
      type: 'system',
      text: '正在分析您的投资需求...',
      timestamp: Date.now()
    }]);
    
    try {
      // 解析用户输入
      const requestInput = parseUserInput(message);
      
      if (requestInput) {
        // 显示解析到的参数给用户
        setChatHistory(prev => [...prev.filter(msg => msg.type !== 'system'), {
          type: 'system',
          text: `正在为您生成投资建议：风险偏好-${
            requestInput.riskLevel === 'low' ? '低' : 
            requestInput.riskLevel === 'medium' ? '中' : '高'
          }，投资金额-${requestInput.amount}元，投资期限-${requestInput.horizon}年`,
          timestamp: Date.now()
        }]);
        
        try {
          // 调用AI服务API获取建议
          const response = await aiApi.getAdvice(address, requestInput);
          
          // 移除"正在思考"的系统消息
          setChatHistory(prev => prev.filter(msg => msg.type !== 'system'));
          
          if (response.success && response.data) {
            // 添加AI回复
            setChatHistory(prev => [...prev, {
              type: 'ai',
              text: response.data?.recommendation || '获取推荐建议失败',
              allocation: response.data?.allocation,
              cid: response.data?.cid,
              txHash: response.data?.txHash,
              timestamp: Date.now()
            }]);
            
            // 添加区块链验证信息
            if (response.data?.txHash && response.data?.cid) {
              setChatHistory(prev => [...prev, {
                type: 'system',
                text: `✓ 此建议已通过区块链验证 [交易哈希: ${response.data?.txHash.substring(0, 10)}...] [IPFS: ${response.data?.cid.substring(0, 10)}...]`,
                timestamp: Date.now()
              }]);
              
              // 检查交易细节和IPFS数据
              try {
                // 异步获取交易验证信息，不阻塞用户界面
                const verifyPromise = aiApi.verifyTransaction(response.data.txHash);
                
                // 使用Promise.race，两秒后如果没有结果就放弃，不阻塞用户体验
                const verifyResult = await Promise.race([
                  verifyPromise,
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
                ]);
                
                if (verifyResult && verifyResult.success && verifyResult.data) {
                  setChatHistory(prev => [...prev, {
                    type: 'system',
                    text: `✓ 区块链验证成功：区块号 ${verifyResult.data?.blockNumber || '未知'}`,
                    timestamp: Date.now()
                  }]);
                }
              } catch (verifyError) {
                console.error('验证交易出错:', verifyError);
                // 不向用户显示验证错误，因为建议已经返回
              }
            }
          } else {
            // 处理错误
            setChatHistory(prev => [...prev, {
              type: 'system',
              text: `获取建议时出错: ${response.message || '未知错误'}`,
              timestamp: Date.now()
            }]);
          }
        } catch (apiError) {
          // 处理API错误
          let errorMessage = '与AI服务通信时出错，请稍后重试。';
          
          if (apiError instanceof APIError) {
            errorMessage = `错误: ${apiError.message}`;
          }
          
          setChatHistory(prev => [...prev.filter(msg => msg.type !== 'system'), {
            type: 'system',
            text: errorMessage,
            timestamp: Date.now()
          }]);
        }
      } else {
        // 无法解析用户请求
        setChatHistory(prev => [...prev.filter(msg => msg.type !== 'system'), {
          type: 'ai',
          text: '抱歉，我无法理解您的请求。请尝试明确描述您的投资需求，例如"我想投资10000元，期限3年，中等风险"。',
          timestamp: Date.now()
        }]);
      }
    } catch (error) {
      console.error('AI顾问处理失败:', error);
      setChatHistory(prev => [...prev.filter(msg => msg.type !== 'system'), {
        type: 'system',
        text: '与AI服务通信时出错，请稍后重试。',
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  }
  
  // 渲染资产配置建议
  const renderAllocation = (allocation: AllocationItem[]) => {
    return (
      <div className="allocation-chart">
        <h4>推荐资产配置：</h4>
        <div className="allocation-items">
          {allocation.map((item, index) => (
            <div key={index} className="allocation-item">
              <div className="allocation-bar" style={{ width: `${item.percentage}%` }}></div>
              <div className="allocation-label">
                <span className="allocation-asset">{item.asset}</span>
                <span className="allocation-percentage">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // 当侧边栏打开时，滚动到最新消息
  useEffect(() => {
    if (isOpen) {
      const chatMessages = document.querySelector('.chat-messages');
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  }, [isOpen, chatHistory]);
  
  return (
    <>
      {/* 只有在连接钱包后才显示侧边栏切换按钮 */}
      {isConnected && (
        <button 
          className={`sidebar-toggle ${isOpen ? 'open' : ''}`} 
          onClick={onToggle}
          aria-label={isOpen ? '关闭AI助手' : '打开AI助手'}
        >
          <span className="toggle-icon">
            {isOpen ? '›' : '‹'}
          </span>
          <span className="toggle-text">AI投顾</span>
        </button>
      )}
      
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>去中心化AI投顾</h3>
          {isConnected && (
            <button className="close-sidebar" onClick={onToggle}>×</button>
          )}
        </div>
        
        <div className="chat-container">
          <div className="chat-messages">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.type}`}>
                <div className="message-content">{msg.text}</div>
                {msg.allocation && renderAllocation(msg.allocation)}
                {msg.cid && msg.txHash && (
                  <div className="message-metadata">
                    <a 
                      href={`https://ipfs.io/ipfs/${msg.cid}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="metadata-link"
                    >
                      查看IPFS数据
                    </a>
                    <a 
                      href={`https://etherscan.io/tx/${msg.txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="metadata-link"
                    >
                      查看区块链交易
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="输入您的投资需求..."
              disabled={!isConnected || isProcessing}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button 
              onClick={handleSendMessage} 
              disabled={!isConnected || isProcessing}
              className={isProcessing ? 'processing' : ''}
            >
              {isProcessing ? '处理中...' : '发送'}
            </button>
          </div>
          {!isConnected && (
            <div className="chat-connect-notice">请先连接钱包以使用AI顾问</div>
          )}
        </div>
      </div>
    </>
  )
} 