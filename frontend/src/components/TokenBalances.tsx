import { useState, useEffect, useCallback } from 'react'
import { useAccount, useReadContracts, useBalance, useBlockNumber } from 'wagmi'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { 
  SUPPORTED_TOKENS, 
  TOKEN_ABI, 
  TokenInfo, 
  SUPPORTED_CHAINS, 
  getTokenPrice, 
  getNativeCurrencyPrice,
  updateAllTokenPrices
} from '../config/tokens'
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
  const [pricesUpdated, setPricesUpdated] = useState(false)

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

  // 刷新价格数据并重新计算资产价值
  const refreshPrices = async () => {
    setIsLoading(true);
    await updateAllTokenPrices();
    setPricesUpdated(true);
    
    // 触发余额重新计算
    refreshBalances();
  };

  // 手动刷新所有余额
  const refreshAllBalances = async () => {
    if (!address) return;
    
    setIsLoading(true);
    
    // 刷新价格数据
    await updateAllTokenPrices();
    setPricesUpdated(true);
    
    // 刷新ERC20代币余额
    refetchErc20();
    
    // 刷新所有原生代币余额
    nativeBalances.forEach(({ refetch }) => refetch());
    
    setLastRefreshTime(new Date());
  };

  // 计算余额和总价值（不获取新数据）
  const refreshBalances = () => {
    if (!address) return;
    
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
          
          // 获取最新价格
          const price = getTokenPrice(token.chainKey, token.symbol);
          const value = formattedBalance * price;
          
          if (formattedBalance > 0) {
            newBalances[token.symbol + '-' + token.chainKey] = {
              token: {
                ...token,
                price  // 使用最新价格
              },
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
        // 获取最新价格
        const price = getNativeCurrencyPrice(token.chainKey);
        const value = formattedBalance * price;
        
        if (formattedBalance > 0) {
          newBalances[token.symbol + '-' + token.chainKey] = {
            token: {
              symbol: token.symbol,
              name: token.name,
              address: 'native',
              decimals: token.decimals,
              chainKey: token.chainKey,
              chainId: token.chainId,
              price  // 使用最新价格
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
    
    if (pricesUpdated) {
      setPricesUpdated(false);
    }
  };

  // 当区块号变化时，自动刷新余额
  useEffect(() => {
    if (blockNumber && address) {
      refreshAllBalances();
    }
  }, [blockNumber, address]);

  // 确保一进入组件就立即更新价格
  useEffect(() => {
    // 组件首次加载时立即更新价格
    updateAllTokenPrices().then(() => {
      if (address) {
        refreshBalances();
      }
    });
  }, []);

  // 当数据变化时计算余额
  useEffect(() => {
    if (address) {
      setIsLoading(true);
      refreshBalances();
    }
  }, [address, erc20Data, nativeBalances]);

  // 设置自动更新时间显示
  useEffect(() => {
    // 初始设置最后更新时间
    setLastRefreshTime(new Date());
    
    // 每30秒更新一次时间
    const timeUpdateInterval = setInterval(() => {
      setLastRefreshTime(new Date());
    }, 30000);
    
    return () => clearInterval(timeUpdateInterval);
  }, []);

  // 准备饼图数据
  const pieData = Object.values(balances).map(item => ({
    name: `${item.token.symbol} (${item.token.chainKey})`,
    value: item.value,
    balance: item.balance,
    symbol: item.token.symbol,
    chainKey: item.token.chainKey,
    price: item.token.price
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

  // 当价格数据为0时显示加载中
  const isPriceLoading = useCallback(() => {
    // 检查是否有代币价格为0
    const hasZeroPrice = pieData.some(item => item.price === 0);
    return hasZeroPrice;
  }, [pieData]);

  if (!address) {
    return <div className="token-balances">请先连接钱包</div>
  }

  return (
    <div className="token-balances">
      <div className="dashboard-header">
        <h2><span className="dashboard-icon">📊</span> 资产仪表盘</h2>
        <div className="dashboard-actions">
          <div className="total-value-card">
            <div className="total-value-label">总资产估值</div>
            <div className="total-value-amount">
              {isPriceLoading() ? '加载中...' : `$${totalValue.toFixed(2)}`}
            </div>
          </div>
          {lastRefreshTime && (
            <div className="update-info">
              <span className="refresh-indicator"></span>
              每30秒自动更新 | 上次更新: {lastRefreshTime.toLocaleTimeString()}
            </div>
          )}
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
                      formatter={(value: number, name: string) => [
                        `$${value.toFixed(2)}`,
                        `${name}`
                      ]}
                      contentStyle={{ 
                        backgroundColor: '#1a1a1a', 
                        borderColor: '#333', 
                        borderRadius: '4px',
                        padding: '8px'
                      }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}
                      labelFormatter={(name, props) => {
                        if (props && props.length > 0 && props[0].payload) {
                          const { balance, symbol, chainKey, price } = props[0].payload;
                          return (
                            <div>
                              <div>{symbol} ({chainKey})</div>
                              <div style={{ fontSize: '0.9em', color: '#ccc' }}>
                                余额: {balance.toFixed(4)} {symbol}
                              </div>
                              <div style={{ fontSize: '0.9em', color: '#ccc' }}>
                                价格: ${price.toFixed(2)}
                              </div>
                            </div>
                          );
                        }
                        return name;
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="asset-list-card">
              <h3>资产详情</h3>
              <div className="asset-list">
                {Object.entries(balancesByChain).map(([chainKey, { tokens, totalValue }]) => (
                  <div key={chainKey} className="chain-assets">
                    <div className="chain-header">
                      <h4>{SUPPORTED_CHAINS.find(c => c.key === chainKey)?.name || chainKey}</h4>
                      <span className="chain-total">${totalValue.toFixed(2)}</span>
                    </div>
                    <ul className="token-list">
                      {tokens.map(item => (
                        <li key={item.token.symbol} className="token-item">
                          <div className="token-info">
                            <span className="token-symbol">{item.token.symbol}</span>
                            <span className="token-balance">{item.balance.toFixed(4)}</span>
                          </div>
                          <div className="token-value">
                            <span className="token-price">${item.token.price.toFixed(2)}</span>
                            <span className="token-total-value">${item.value.toFixed(2)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
} 