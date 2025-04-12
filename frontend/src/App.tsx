import { useAccount } from 'wagmi'
import { useState, useEffect } from 'react'
import './styles/App.css'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'
import { WalletOptions } from './components/WalletOptions'
import { TokenBalances } from './components/TokenBalances'
import { AIAdvisorContract } from './components/AIAdvisorContract'

function App() {
  const { isConnected } = useAccount()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'assets' | 'history'>('assets')
  
  // 当钱包断开连接时，自动关闭侧边栏
  useEffect(() => {
    if (!isConnected) {
      setSidebarOpen(false);
    }
  }, [isConnected]);

  // 侧边栏切换函数，只有在连接钱包后才能打开
  const handleToggleSidebar = () => {
    if (isConnected) {
      setSidebarOpen(!sidebarOpen);
    }
  };

  return (
    <div className={`app ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Navbar />
      
      <div className="main-container">
        <main className="content">
          {!isConnected ? (
            <div className="connect-section">
              <h2>欢迎使用AI投资助手</h2>
              <p>连接您的钱包以查看您在不同区块链上的资产分布和获取AI投资建议</p>
              <WalletOptions />
            </div>
          ) : (
            <div className="dashboard-section">
              <div className="dashboard-tabs">
                <button 
                  className={`tab-button ${activeTab === 'assets' ? 'active' : ''}`}
                  onClick={() => setActiveTab('assets')}
                >
                  资产概览
                </button>
                <button 
                  className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  投资建议历史
                </button>
              </div>
              
              <div className="tab-content">
                {activeTab === 'assets' ? (
                  <TokenBalances />
                ) : (
                  <AIAdvisorContract />
                )}
              </div>
            </div>
          )}
        </main>
        
        <Sidebar isOpen={sidebarOpen} onToggle={handleToggleSidebar} />
      </div>
      
      <footer className="footer">
        <p>DeepChain &copy; {new Date().getFullYear()} | 数据仅供参考，不构成投资建议</p>
      </footer>
    </div>
  )
}

export default App
