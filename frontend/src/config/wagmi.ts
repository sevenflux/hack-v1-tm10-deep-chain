import { http, createConfig } from 'wagmi'
import { mainnet, bsc, polygon, arbitrum, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { SUPPORTED_CHAINS } from './tokens'

// 定义 Mantle 链
const mantle = {
  id: 5000,
  name: 'Mantle',
  nativeCurrency: {
    decimals: 18,
    name: 'Mantle',
    symbol: 'MNT',
  },
  rpcUrls: {
    default: { http: ['https://rpc.mantle.xyz'] },
    public: { http: ['https://rpc.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantle Explorer', url: 'https://explorer.mantle.xyz' },
  }
}

// 替换为你的 WalletConnect 项目 ID
// 项目 ID 用于 WalletConnect 协议，可以从 https://cloud.walletconnect.com/ 获取
// 如果只使用 MetaMask 等注入式钱包，可以不填写此项
// 但如果要支持 WalletConnect 协议（用于移动钱包连接），则必须提供有效的项目 ID
const projectId = 'a591cf3c592769652bd36a7e6e31e137'

// 创建 transports 对象
const transports: Record<number, any> = {}
SUPPORTED_CHAINS.forEach(chain => {
  if (chain.id === mainnet.id) transports[mainnet.id] = http(chain.rpcUrl)
  if (chain.id === sepolia.id) transports[sepolia.id] = http(chain.rpcUrl)
  if (chain.id === bsc.id) transports[bsc.id] = http(chain.rpcUrl)
  if (chain.id === polygon.id) transports[polygon.id] = http(chain.rpcUrl)
  if (chain.id === arbitrum.id) transports[arbitrum.id] = http(chain.rpcUrl)
  if (chain.id === mantle.id) transports[mantle.id] = http(chain.rpcUrl)
})

export const config = createConfig({
  chains: [sepolia, mainnet, bsc, polygon, arbitrum, mantle], // 将Sepolia放在第一位，作为默认网络
  connectors: [
    injected(),
    metaMask(),
    walletConnect({ projectId }),
  ],
  transports,
}) 