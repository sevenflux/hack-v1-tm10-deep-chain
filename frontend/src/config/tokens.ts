// 支持的区块链网络
export const SUPPORTED_CHAINS = [
  {
    id: 1,
    name: '以太坊主网',
    key: 'ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      price: 1800 // 价格可以从API获取，这里为了简化硬编码
    }
  },
  {
    id: 56,
    name: 'BNB智能链',
    key: 'bsc',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
      price: 220
    }
  },
  {
    id: 137,
    name: 'Polygon',
    key: 'polygon',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'POL',
      decimals: 18,
      price: 0.7
    }
  },
  {
    id: 42161,
    name: 'Arbitrum One',
    key: 'arbitrum',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      price: 1800
    }
  },
  {
    id: 5000,
    name: 'Mantle',
    key: 'mantle',
    rpcUrl: 'https://rpc.mantle.xyz',
    blockExplorer: 'https://explorer.mantle.xyz',
    nativeCurrency: {
      name: 'Mantle',
      symbol: 'MNT',
      decimals: 18,
      price: 0.5
    }
  }
]

// 代币类型定义
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: number;
  chainKey: string;
  price: number;
}

// 支持的代币
export const SUPPORTED_TOKENS: { [key: string]: TokenInfo[] } = {
  ethereum: [
    {
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
      chainId: 1,
      chainKey: 'ethereum',
      price: 1800
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      chainId: 1,
      chainKey: 'ethereum',
      price: 1
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      chainId: 1,
      chainKey: 'ethereum',
      price: 1
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
      chainId: 1,
      chainKey: 'ethereum',
      price: 1
    }
  ],
  bsc: [
    {
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      decimals: 18,
      chainId: 56,
      chainKey: 'bsc',
      price: 220
    },
    {
      symbol: 'USDT',
      name: 'Binance-Peg BSC-USD',
      address: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      chainKey: 'bsc',
      chainId: 56,
      price: 1
    },
    {
      symbol: 'BUSD',
      name: 'Binance USD',
      address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      decimals: 18,
      chainKey: 'bsc',
      chainId: 56,
      price: 1
    },
    {
      symbol: 'CAKE',
      name: 'PancakeSwap Token',
      address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
      decimals: 18,
      chainKey: 'bsc',
      chainId: 56,
      price: 2
    }
  ],
  polygon: [
    {
      symbol: 'WPOL',
      name: 'Wrapped Polygon',
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // 这是WMATIC地址，如果POL有新的包装代币地址，请更新
      decimals: 18,
      chainId: 137,
      chainKey: 'polygon',
      price: 0.7
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
      chainKey: 'polygon',
      chainId: 137,
      price: 1
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      decimals: 6,
      chainKey: 'polygon',
      chainId: 137,
      price: 1
    },
    {
      symbol: 'USDC.e',
      name: 'USD Coin(PoS)',
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      decimals: 6,
      chainKey: 'polygon',
      chainId: 137,
      price: 1
    },
    {
      symbol: 'POL',
      name: 'POL Token',
      address: '0x0000000000000000000000000000000000001010',
      decimals: 18,
      chainKey: 'polygon',
      chainId: 137,
      price: 0.7
    }
  ],
  arbitrum: [
    {
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
      chainId: 42161,
      chainKey: 'arbitrum',
      price: 1800
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      decimals: 6,
      chainKey: 'arbitrum',
      chainId: 42161,
      price: 1
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      decimals: 6,
      chainKey: 'arbitrum',
      chainId: 42161,
      price: 1
    },
    {
      symbol: 'ARB',
      name: 'Arbitrum',
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      decimals: 18,
      chainKey: 'arbitrum',
      chainId: 42161,
      price: 1.2
    }
  ],
  mantle: [
    {
      symbol: 'WMNT',
      name: 'Wrapped Mantle',
      address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
      decimals: 18,
      chainId: 5000,
      chainKey: 'mantle',
      price: 0.5
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE',
      decimals: 6,
      chainKey: 'mantle',
      chainId: 5000,
      price: 1
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
      decimals: 6,
      chainKey: 'mantle',
      chainId: 5000,
      price: 1
    },
    {
      symbol: 'MNT',
      name: 'Mantle',
      address: '0x3c3a81e81dc49A522A592e7622A7E711c06bf354',
      decimals: 18,
      chainKey: 'mantle',
      chainId: 5000,
      price: 0.5
    }
  ]
}

// ERC20代币ABI
export const TOKEN_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
    stateMutability: "view"
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
    stateMutability: "view"
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
    stateMutability: "view"
  },
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
    stateMutability: "view"
  }
] as const; 