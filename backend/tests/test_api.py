import pytest
from fastapi.testclient import TestClient
from ..main import app
from ..app.utils.hash_utils import generate_hash

client = TestClient(app)


def test_advice_endpoint():
    """
    测试投资建议API接口
    """
    # 准备测试数据
    test_data = {
        "userAddress": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "input": {
            "riskLevel": "high",
            "amount": 10000,
            "horizon": 3,
            "assets": ["crypto", "stocks"]
        },
        "requestHash": generate_hash({
            "riskLevel": "high",
            "amount": 10000,
            "horizon": 3,
            "assets": ["crypto", "stocks"]
        })
    }
    
    # 发送请求
    response = client.post("/api/advice", json=test_data)
    
    # 验证响应
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "data" in response.json()
    assert "recommendation" in response.json()["data"]
    assert "cid" in response.json()["data"]
    assert "txHash" in response.json()["data"]
    assert "signature" in response.json()["data"]


def test_invalid_request():
    """
    测试无效请求
    """
    # 准备测试数据 - 缺少必要字段
    test_data = {
        "userAddress": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "input": {
            "riskLevel": "high",
            "amount": 10000
            # 缺少 horizon 字段
        },
        "requestHash": "0x1234567890"
    }
    
    # 发送请求
    response = client.post("/api/advice", json=test_data)
    
    # 验证响应
    assert response.status_code == 422  # 验证错误 