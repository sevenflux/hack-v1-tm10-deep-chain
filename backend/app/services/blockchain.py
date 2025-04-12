import os
import logging
import time
import json
from web3 import Web3
from web3.middleware import geth_poa_middleware
from eth_account import Account
from eth_account.messages import encode_defunct
from typing import Dict, Any, List, Optional, Tuple
from web3.exceptions import ContractLogicError, TransactionNotFound
from ..core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# 从配置获取环境变量
BLOCKCHAIN_RPC_URL = settings.BLOCKCHAIN_RPC_URL
CONTRACT_ADDRESS_RAW = settings.CONTRACT_ADDRESS
PRIVATE_KEY = settings.PRIVATE_KEY
SERVER_ADDRESS = settings.SERVER_ADDRESS
CHAIN_ID = settings.CHAIN_ID
NETWORK_NAME = settings.NETWORK_NAME

# 初始化Web3连接
w3 = Web3(Web3.HTTPProvider(BLOCKCHAIN_RPC_URL))
# 针对Sepolia网络添加POA中间件
w3.middleware_onion.inject(geth_poa_middleware, layer=0)

# 转换合约地址为校验和格式
CONTRACT_ADDRESS = w3.to_checksum_address(CONTRACT_ADDRESS_RAW)

logger.info(f"连接到 {NETWORK_NAME} 网络, 链ID: {CHAIN_ID}")
logger.info(f"合约地址(校验和格式): {CONTRACT_ADDRESS}")

# 检查网络连接
try:
    connected = w3.is_connected()
    if connected:
        network_id = w3.eth.chain_id
        logger.info(f"已连接到区块链网络, 链ID: {network_id}")
        if network_id != CHAIN_ID:
            logger.warning(f"警告: 配置的链ID ({CHAIN_ID}) 与连接的网络链ID ({network_id}) 不匹配")
    else:
        logger.error(f"无法连接到区块链网络: {BLOCKCHAIN_RPC_URL}")
except Exception as e:
    logger.error(f"连接区块链时出错: {str(e)}")

# 从JSON文件加载合约ABI
try:
    try:
        # 尝试从当前目录的contracts文件夹加载ABI
        with open("./contracts/abi.json", "r") as f:
            CONTRACT_ABI = json.load(f)
    except:
        # 尝试从项目根目录加载ABI
        with open("../contracts/abi.json", "r") as f:
            CONTRACT_ABI = json.load(f)
            
    logger.info("成功加载合约ABI")
except Exception as e:
    logger.warning(f"无法从文件加载ABI: {str(e)}, 使用内置ABI")
    # 使用硬编码的ABI
    CONTRACT_ABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "requestHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "cid",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"name": "RequestRecorded",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "advisorServer",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			}
		],
		"name": "getUserRequests",
		"outputs": [
			{
				"internalType": "bytes32[]",
				"name": "requestHashes",
				"type": "bytes32[]"
			},
			{
				"internalType": "string[]",
				"name": "cids",
				"type": "string[]"
			},
			{
				"internalType": "uint256[]",
				"name": "timestamps",
				"type": "uint256[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "requestHash",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "cid",
				"type": "string"
			},
			{
				"internalType": "bytes",
				"name": "signature",
				"type": "bytes"
			}
		],
		"name": "recordRequest",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_newAdvisor",
				"type": "address"
			}
		],
		"name": "setAdvisorServer",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]


def create_signature(message_to_sign: str, timestamp: Optional[int] = None) -> Tuple[str, int]:
    """
    为给定的消息创建签名 - 完全匹配智能合约验证逻辑
    
    Args:
        message_to_sign: 要签名的消息(通常是CID)
        timestamp: 可选的时间戳，如果未提供则使用当前时间
    
    Returns:
        Tuple[str, int]: 包含签名和时间戳的元组
    """
    try:
        if not PRIVATE_KEY:
            logger.error("私钥未配置")
            raise ValueError("私钥未配置")
        
        # 检查SERVER_ADDRESS是否已设置
        if not SERVER_ADDRESS:
            logger.error("服务器地址未配置")
            raise ValueError("服务器地址未配置")
        
        # 使用可选的时间戳或当前时间
        if timestamp is None:
            timestamp = int(time.time())
        
        # 确保使用与合约完全相同的消息哈希算法
        # bytes32 messageHash = keccak256(abi.encodePacked(cid));
        message_bytes = message_to_sign.encode('utf-8')
        message_hash = w3.keccak(message_bytes)
        
        # 从私钥获取地址
        private_key_obj = Account.from_key(PRIVATE_KEY)
        signer_address = private_key_obj.address
        
        # 验证签名者地址与SERVER_ADDRESS匹配
        if signer_address.lower() != SERVER_ADDRESS.lower():
            logger.error(f"签名者地址不匹配: 私钥对应地址 {signer_address}, 配置的服务器地址 {SERVER_ADDRESS}")
            raise ValueError("签名者地址与配置的服务器地址不匹配")
        
        # # 检查合约中的advisorServer
        # try:
        #     contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
        #     advisor_server = contract.functions.advisorServer().call()
            
        #     if advisor_server.lower() != SERVER_ADDRESS.lower():
        #         logger.warning(f"警告: 服务器地址 {SERVER_ADDRESS} 与合约中的advisorServer {advisor_server} 不匹配")
        #         logger.warning("请确保合约所有者已调用setAdvisorServer更新为正确的地址")
        # except Exception as e:
        #     logger.warning(f"无法验证合约中的advisorServer地址: {str(e)}")
        
        # 使用Web3.py的方法签名，这会自动加上Ethereum签名前缀
        signature = w3.eth.account.sign_message(
            encode_defunct(hexstr=message_hash.hex()),
            private_key=PRIVATE_KEY
        )
        
        logger.info(f"消息: {message_to_sign}, 哈希: {message_hash.hex()}, 签名者: {signer_address}")
        
        return signature.signature.hex(), timestamp
    except Exception as e:
        logger.error(f"创建签名时出错: {str(e)}")
        raise


async def record_to_blockchain(user_address: str, request_hash: str, cid: str, signature: str) -> str:
    """
    在区块链上记录请求
    
    Args:
        user_address: 用户的以太坊地址
        request_hash: 请求哈希
        cid: IPFS内容标识符
        signature: 签名
    
    Returns:
        str: 交易哈希
    """
    try:
        if not PRIVATE_KEY:
            logger.error("私钥未配置")
            raise ValueError("私钥未配置")
        
        if not w3.is_connected():
            logger.error("无法连接到区块链")
            raise ConnectionError("无法连接到区块链")
        
        # 确保用户地址也是校验和格式
        user_address = w3.to_checksum_address(user_address)
        
        # 尝试多次连接
        retry_count = 0
        max_retries = 3
        while retry_count < max_retries:
            try:
                # 获取合约实例
                contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
                
                # 格式化请求哈希
                request_hash_bytes = bytes.fromhex(request_hash[2:] if request_hash.startswith('0x') else request_hash)
                
                # 格式化签名
                signature_bytes = bytes.fromhex(signature[2:] if signature.startswith('0x') else signature)
                
                # 当前gas价格
                gas_price = w3.eth.gas_price
                # 可选: 增加gas价格以加快确认
                gas_price = int(gas_price * 1.1)  # 增加10%
                
                # 构建交易
                tx = contract.functions.recordRequest(
                    user_address,
                    request_hash_bytes,
                    cid,
                    signature_bytes
                ).build_transaction({
                    'from': SERVER_ADDRESS,
                    'gas': 2000000,
                    'gasPrice': gas_price,
                    'nonce': w3.eth.get_transaction_count(SERVER_ADDRESS)
                })
                
                # 签名交易
                signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
                
                # 发送交易
                tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
                
                # 等待交易被确认
                tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                
                if tx_receipt.status == 1:  # 1表示成功
                    logger.info(f"交易成功记录到区块链，交易哈希: {tx_hash.hex()}")
                    return tx_hash.hex()
                else:
                    logger.error(f"交易失败，交易哈希: {tx_hash.hex()}")
                    raise Exception("区块链交易失败")
                
            except ContractLogicError as e:
                logger.error(f"合约执行错误: {str(e)}")
                raise
            
            except Exception as e:
                retry_count += 1
                if retry_count >= max_retries:
                    logger.error(f"经过{max_retries}次尝试后仍然失败: {str(e)}")
                    raise
                logger.warning(f"重试({retry_count}/{max_retries}): {str(e)}")
                time.sleep(2)  # 等待2秒后重试
                
    except Exception as e:
        logger.error(f"记录到区块链时出错: {str(e)}")
        raise


async def get_user_requests(user_address: str) -> List[Dict[str, Any]]:
    """
    获取用户的所有请求
    
    Args:
        user_address: 用户的以太坊地址
    
    Returns:
        list: 用户请求的列表
    """
    try:
        # 确保用户地址是校验和格式
        user_address = w3.to_checksum_address(user_address)
        
        # 获取合约实例
        contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
        
        # 调用合约方法
        result = contract.functions.getUserRequests(user_address).call()
        
        # 整理结果
        requests = []
        for i in range(len(result[0])):
            requests.append({
                "requestHash": result[0][i].hex(),
                "cid": result[1][i],
                "timestamp": result[2][i]
            })
        
        return requests
    except Exception as e:
        logger.error(f"获取用户请求时出错: {str(e)}")
        raise


async def verify_transaction(tx_hash: str, timeout: int = 30) -> Dict[str, Any]:
    """
    验证交易并获取详细信息
    
    Args:
        tx_hash: 交易哈希
        timeout: 超时时间(秒)
    
    Returns:
        Dict: 交易详情
    """
    try:
        # 移除前缀(如果有)
        if tx_hash.startswith('0x'):
            tx_hash = tx_hash[2:]
        
        # 转换为bytes
        tx_hash_bytes = bytes.fromhex(tx_hash)
        
        # 等待直到交易被挖出或超时
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                tx_receipt = w3.eth.get_transaction_receipt(tx_hash_bytes)
                tx_details = w3.eth.get_transaction(tx_hash_bytes)
                
                if tx_receipt:
                    # 提取事件数据
                    contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
                    events = []
                    for log in tx_receipt.logs:
                        try:
                            log_address = w3.to_checksum_address(log['address'])
                            if log_address.lower() == CONTRACT_ADDRESS.lower():
                                parsed_log = contract.events.RequestRecorded().process_log(log)
                                
                                # 创建符合我们API期望的事件对象
                                event_data = {
                                    "event": parsed_log.get('event', ''),
                                    "address": parsed_log.get('address', ''),
                                    "blockNumber": parsed_log.get('blockNumber', 0),
                                    "returnValues": {}  # 初始化为空字典
                                }
                                
                                # 提取args中的数据到returnValues
                                if hasattr(parsed_log, 'args'):
                                    args = dict(parsed_log.args)
                                    # 确保值是可序列化的
                                    for key, value in args.items():
                                        if isinstance(value, bytes):
                                            args[key] = '0x' + value.hex()
                                    event_data['returnValues'] = args
                                    
                                events.append(event_data)
                        except Exception as e:
                            logger.warning(f"解析事件日志时出错: {str(e)}")
                            logger.warning(f"异常详情: {e.__class__.__name__}: {str(e)}")
                    
                    return {
                        "hash": tx_hash,
                        "blockNumber": tx_receipt.blockNumber,
                        "from": tx_details['from'],
                        "to": tx_details['to'],
                        "status": "成功" if tx_receipt.status == 1 else "失败",
                        "gasUsed": tx_receipt.gasUsed,
                        "events": events
                    }
            except TransactionNotFound:
                # 交易尚未被挖出
                time.sleep(2)  # 等待2秒后重试
        
        # 超时
        raise TimeoutError(f"等待交易确认超时: {tx_hash}")
    except Exception as e:
        logger.error(f"验证交易时出错: {str(e)}")
        logger.error(f"异常类型: {e.__class__.__name__}")
        logger.error(f"异常详情: {str(e)}")
        raise 