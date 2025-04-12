import { useState, useEffect } from 'react'
import { useAccount, useReadContracts, useBalance, useBlockNumber } from 'wagmi'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { SUPPORTED_TOKENS, TOKEN_ABI, TokenInfo, SUPPORTED_CHAINS } from '../config/tokens'
import '../styles/TokenBalances.css'

// 饼图颜色
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B', '#6B66FF', '#FFD166'];

// 在组件顶部添加类型定义
interface TokenBalance {
  token: TokenInfo;
  balance: number;
  value: number;
}

export function TokenBalances() {
  const { address, chainId: _chainId } = useAccount()
  const [balances, setBalances] = useState<{[key: string]: TokenBalance}>({})
  const [totalValue, setTotalValue] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)

  // 获取当前区块号，用于监听链上变化
  const { data: blockNumber } = useBlockNumber({ watch: true })

  // 过滤掉测试网络，只保留主网
  const mainnetChains = SUPPORTED_CHAINS.filter(chain => !chain.isTestnet)

  // 获取所有支持链上的所有代币，排除测试网
  const allTokens = Object.entries(SUPPORTED_TOKENS)
    .filter(([key]) => !SUPPORTED_CHAINS.find(chain => chain.key === key && chain.isTestnet)) 
    .flatMap(([_, tokens]) => tokens)
  
  // 准备合约读取请求 (仅ERC20代币)
  const erc20Tokens = allTokens.filter(token => token.address !== 'native')
  const contracts = erc20Tokens.map(token => ({
    address: token.address as `0x${string}`,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: token.chainId
  }))

  // 获取ERC20代币余额
  const { data: erc20Data, isError: isErc20Error, isPending: isErc20Pending, refetch: refetchErc20 } = useReadContracts({
    contracts,
    query: {
      enabled: Boolean(address),
      refetchInterval: 30000, // 每30秒自动刷新一次
    }
  })

  // 获取原生代币余额
  const nativeTokens = mainnetChains.map(chain => ({
    chainId: chain.id,
    symbol: chain.nativeCurrency?.symbol || 'ETH',
    name: chain.nativeCurrency?.name || 'Ethereum',
    decimals: chain.nativeCurrency?.decimals || 18,
    price: chain.nativeCurrency?.price || 1, // 使用配置中的价格
    chainKey: chain.key
  }))

  // 为每个链创建useBalance hook
  const nativeBalances = nativeTokens.map(token => {
    const { data, isError, isLoading, refetch } = useBalance({
      address,
      chainId: token.chainId,
      query: {
        enabled: Boolean(address),
        refetchInterval: 30000, // 每30秒自动刷新一次
      }
    })
    return { data, isError, isLoading, refetch, token }
  })

  // 手动刷新所有余额
  const refreshAllBalances = () => {
    if (!address) return;
    
    setIsLoading(true);
    
    // 刷新ERC20代币余额
    refetchErc20();
    
    // 刷新所有原生代币余额
    nativeBalances.forEach(({ refetch }) => refetch());
    
    setLastRefreshTime(new Date());
  };

  // 当区块号变化时，自动刷新余额
  useEffect(() => {
    if (blockNumber && address) {
      refreshAllBalances();
    }
  }, [blockNumber, address]);

  useEffect(() => {
    if (address) {
      setIsLoading(true)
      
      // 初始化新的余额对象
      const newBalances: {[key: string]: TokenBalance} = {}
      let newTotalValue = 0
      
      // 处理ERC20代币余额
      if (erc20Data) {
        erc20Data.forEach((result, index) => {
          const token = erc20Tokens[index]
          if (result.status === 'success' && result.result) {
            const rawBalance = result.result
            const formattedBalance = Number(rawBalance.toString()) / Math.pow(10, token.decimals)
            
            // 这里可以添加代币价格获取逻辑，目前简化为使用配置的价格
            const value = formattedBalance * (token.price || 1)
            
            if (formattedBalance > 0) {
              newBalances[token.symbol + '-' + token.chainKey] = {
                token,
                balance: formattedBalance,
                value
              }
              newTotalValue += value
            }
          }
        })
      }
      
      // 处理原生代币余额
      nativeBalances.forEach(({ data, isError, token }) => {
        if (data && !isError) {
          const formattedBalance = Number(data.formatted)
          const value = formattedBalance * token.price
          
          if (formattedBalance > 0) {
            newBalances[token.symbol + '-' + token.chainKey] = {
              token: {
                symbol: token.symbol,
                name: token.name,
                address: 'native',
                decimals: token.decimals,
                chainKey: token.chainKey,
                chainId: token.chainId,
                price: token.price
              },
              balance: formattedBalance,
              value
            }
            newTotalValue += value
          }
        }
      })
      
      setBalances(newBalances)
      setTotalValue(newTotalValue)
      setIsLoading(false)
    }
  }, [address, erc20Data, nativeBalances])

  // 准备饼图数据
  const pieData = Object.values(balances).map(item => ({
    name: `${item.token.symbol} (${item.token.chainKey})`,
    value: item.value,
    balance: item.balance,
    symbol: item.token.symbol,
    chainKey: item.token.chainKey
  }))

  // 按链分组的余额数据
  const balancesByChain = Object.values(balances).reduce((acc, item) => {
    const chainKey = item.token.chainKey
    if (!acc[chainKey]) {
      acc[chainKey] = {
        tokens: [],
        totalValue: 0
      }
    }
    acc[chainKey].tokens.push(item)
    acc[chainKey].totalValue += item.value
    return acc
  }, {} as {[key: string]: {tokens: TokenBalance[], totalValue: number}})

  if (!address) {
    return <div className="token-balances">请先连接钱包</div>
  }

  return (
    <div className="token-balances">
      <div className="dashboard-header">
        <h2>资产仪表盘</h2>
        <div className="dashboard-actions">
          <button 
            className="refresh-button" 
            onClick={refreshAllBalances}
            disabled={isLoading || isErc20Pending || nativeBalances.some(b => b.isLoading)}
          >
            刷新余额
          </button>
          {lastRefreshTime && (
            <div className="last-refresh">
              上次更新: {lastRefreshTime.toLocaleTimeString()}
            </div>
          )}
          <div className="total-value-card">
            <div className="total-value-label">总资产估值</div>
            <div className="total-value-amount">${totalValue.toFixed(2)}</div>
          </div>
        </div>
      </div>
      
      {isLoading || isErc20Pending || nativeBalances.some(b => b.isLoading) ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在加载资产数据...</p>
        </div>
      ) : isErc20Error || nativeBalances.some(b => b.isError) ? (
        <div className="error-container">
          <p>获取余额时出错，请检查钱包连接并重试</p>
        </div>
      ) : pieData.length === 0 ? (
        <div className="empty-state">
          <p>未找到任何代币余额</p>
          <p>请确保您的钱包中有受支持的代币</p>
        </div>
      ) : (
        <>
          <div className="dashboard-grid">
            <div className="chart-card">
              <h3>资产分布</h3>
              <div className="pie-chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name) => [
                        `$${value.toFixed(2)} (${(value/totalValue*100).toFixed(2)}%)`, 
                        name
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="summary-card">
              <h3>链分布</h3>
              <div className="chain-distribution">
                {Object.entries(balancesByChain).map(([chainKey, data]) => (
                  <div key={chainKey} className="chain-item">
                    <div className="chain-name">{chainKey}</div>
                    <div className="chain-value">${data.totalValue.toFixed(2)}</div>
                    <div className="chain-percentage">
                      {(data.totalValue / totalValue * 100).toFixed(1)}%
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress" 
                        style={{ 
                          width: `${(data.totalValue / totalValue * 100)}%`,
                          backgroundColor: chainKey === 'ethereum' ? '#627EEA' :
                                          chainKey === 'bsc' ? '#F3BA2F' :
                                          chainKey === 'polygon' ? '#8247E5' :
                                          chainKey === 'arbitrum' ? '#28A0F0' :
                                          chainKey === 'mantle' ? '#FF5F5F' : '#3498db'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="tokens-table-card">
            <h3>代币详情</h3>
            <div className="table-container">
              <table className="tokens-table">
                <thead>
                  <tr>
                    <th>代币</th>
                    <th>网络</th>
                    <th>余额</th>
                    <th>估值 ($)</th>
                    <th>占比</th>
                  </tr>
                </thead>
                <tbody>
                  {pieData.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <div className="token-cell">
                          <div className="token-color" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span>{item.symbol}</span>
                        </div>
                      </td>
                      <td>{item.chainKey}</td>
                      <td>{item.balance.toFixed(6)}</td>
                      <td>${item.value.toFixed(2)}</td>
                      <td>{(item.value / totalValue * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
} 