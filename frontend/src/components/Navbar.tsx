import { useState, useEffect, useRef } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { WalletOptions } from './WalletOptions'
import logo from '../assets/Logo.jpg'
import '../styles/Navbar.css'

export function Navbar() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // 模拟恐慌指数 (实际应用�?�?以从API获取)
  const fearIndex = 65
  const getFearLevel = (index: number) => {
    if (index < 25) return { text: '极度恐慌', color: '#e74c3c' }
    if (index < 40) return { text: '恐慌', color: '#e67e22' }
    if (index < 60) return { text: '�?�?', color: '#f1c40f' }
    if (index < 80) return { text: '�?�?', color: '#2ecc71' }
    return { text: '极度�?�?', color: '#27ae60' }
  }
  
  const fearLevel = getFearLevel(fearIndex)
  
  const handleDisconnect = () => {
    disconnect()
    setShowDropdown(false)
  }
  
  // 点击外部区域关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <img src={logo} alt="Epoch Logo" className="navbar-logo" />
        <h1 className="navbar-title">F𝕚Mind</h1>
      </div>
      
      <div className="navbar-center">
        <div className="fear-index">
          <span>市场情绪: </span>
          <span className="fear-level" style={{ color: fearLevel.color }}>
            {fearLevel.text} ({fearIndex})
          </span>
        </div>
      </div>
      
      <div className="navbar-right">
        {isConnected ? (
          <div className="wallet-address-container" ref={dropdownRef}>
            <div 
              className="wallet-address" 
              onClick={() => setShowDropdown(!showDropdown)}
            >
              {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
            </div>
            {showDropdown && (
              <div className="wallet-dropdown">
                <div className="dropdown-item full-address">
                  <span className="item-label">钱包地址:</span>
                  <span className="item-value">{address}</span>
                </div>
                <button className="dropdown-item logout-button" onClick={handleDisconnect}>
                  退出登�?
                </button>
              </div>
            )}
          </div>
        ) : (
          <WalletOptions buttonStyle="navbar" />
        )}
      </div>
    </nav>
  )
} 