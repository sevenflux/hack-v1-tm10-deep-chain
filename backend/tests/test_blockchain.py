import pytest
from unittest.mock import patch, MagicMock
from ..app.services.blockchain import create_signature, record_to_blockchain


@pytest.mark.asyncio
@patch('app.services.blockchain.w3')
async def test_record_to_blockchain(mock_w3):
    """
    测试区块链记录功能
    """
    # 模拟Web3对象和交易
    mock_contract = MagicMock()
    mock_w3.eth.contract.return_value = mock_contract
    mock_w3.is_connected.return_value = True
    
    # 模拟交易哈希和收据
    mock_tx_hash = MagicMock()
    mock_tx_hash.hex.return_value = "0x1234567890abcdef"
    mock_w3.eth.send_raw_transaction.return_value = mock_tx_hash
    
    mock_receipt = MagicMock()
    mock_receipt.status = 1  # 成功状态
    mock_w3.eth.wait_for_transaction_receipt.return_value = mock_receipt
    
    # 测试数据
    user_address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    request_hash = "0x1234567890abcdef"
    cid = "bafybeiabcdef"
    signature = "0xabcdef1234567890"
    
    # 调用函数
    result = await record_to_blockchain(user_address, request_hash, cid, signature)
    
    # 验证结果
    assert result == "0x1234567890abcdef"
    assert mock_contract.functions.recordRequest.called
    assert mock_w3.eth.send_raw_transaction.called
    assert mock_w3.eth.wait_for_transaction_receipt.called


@patch('app.services.blockchain.Account')
def test_create_signature(mock_account):
    """
    测试签名创建功能
    """
    # 模拟签名结果
    mock_signed_message = MagicMock()
    mock_signed_message.signature.hex.return_value = "0xabcdef1234567890"
    mock_account.sign_message.return_value = mock_signed_message
    
    # 测试数据
    cid = "bafybeiabcdef"
    
    # 调用函数
    result = create_signature(cid)
    
    # 验证结果
    assert result == "0xabcdef1234567890"
    assert mock_account.sign_message.called 