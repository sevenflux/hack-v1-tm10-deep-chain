import logging
import time
import json
import aiohttp
from typing import Dict, Any, List
from ..schemas.advice import InputData
from ..core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# 从配置获取DeepSeek API信息
DEEPSEEK_API_KEY = settings.DEEPSEEK_API_KEY
DEEPSEEK_API_URL = settings.DEEPSEEK_API_URL
DEEPSEEK_MODEL = settings.DEEPSEEK_MODEL


async def generate_investment_advice(input_data: InputData) -> Dict[str, Any]:
    """
    使用DeepSeek API生成投资建议
    
    Args:
        input_data: 用户输入数据
        
    Returns:
        Dict: 包含资产配置的投资建议
    """
    try:
        if not DEEPSEEK_API_KEY:
            logger.error("DeepSeek API密钥未配置")
            raise ValueError("DeepSeek API密钥未配置")
        
        # 构建提示词
        system_prompt = """
        你是一个专业的投资顾问AI，根据用户提供的风险偏好、投资金额和当前加密货币资产分布提供投资建议。
        你需要给出具体的加密货币资产配置比例，包括主流加密货币和稳定币。
        请按照以下JSON格式输出：
        {
            "allocation": [
                {"asset": "资产名称", "percentage": 百分比},
                ...
            ],
            "allocationText": "总结性的资产配置描述文本"
        }
        注意：所有资产配置比例总和必须为100%
        """
        
        # 格式化当前加密货币资产分布
        crypto_assets_text = ""
        for asset in input_data.cryptoAssets:
            crypto_assets_text += f"- {asset.symbol}: {asset.percentage}%\n"
        
        # 构建用户消息
        user_message = f"""
        请根据以下投资者信息提供加密货币资产配置建议：
        风险偏好：{input_data.riskLevel}（low=保守, medium=中等, high=激进）
        投资金额：{input_data.amount}
        
        当前加密货币资产分布：
        {crypto_assets_text}
        """
        
        # 添加用户的具体需求描述（如果有）
        if hasattr(input_data, 'userMessage') and input_data.userMessage:
            user_message += f"""
        投资者额外需求：
        {input_data.userMessage}
        """
            
        user_message += """
        我希望获得一个具体的加密货币投资组合方案，包括不同资产的配置比例。
        请根据我当前的资产分布、风险偏好和个人需求，提供更加合理的配置建议。
        """
        
        # 构建DeepSeek API请求
        payload = {
            "model": DEEPSEEK_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.3,  # 较低的温度以获得更确定的结果
            "max_tokens": 1000
        }
        
        # 请求头
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
        }
        
        # 发送请求到DeepSeek API
        async with aiohttp.ClientSession() as session:
            async with session.post(DEEPSEEK_API_URL, json=payload, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"DeepSeek API请求失败: {error_text}")
                    raise Exception(f"DeepSeek API请求失败: {response.status}")
                
                # 解析API响应
                response_data = await response.json()
                
                # 提取AI生成的内容
                ai_response = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                logger.info(f"DeepSeek API返回: {ai_response[:100]}...")
                
                # 从响应中提取JSON
                try:
                    # 提取JSON部分，如果有多个JSON块，则选取第一个
                    json_start = ai_response.find('{')
                    json_end = ai_response.rfind('}') + 1
                    
                    if json_start >= 0 and json_end > json_start:
                        json_str = ai_response[json_start:json_end]
                        ai_data = json.loads(json_str)
                    else:
                        # 如果没有找到JSON格式，尝试解析整个文本
                        ai_data = json.loads(ai_response)
                    
                    # 确保正确的结构
                    if "allocation" not in ai_data or "allocationText" not in ai_data:
                        raise ValueError("API返回的数据格式不正确")
                    
                    # 处理分配数据，确保百分比总和为100%
                    allocation = ai_data["allocation"]
                    total = sum(item["percentage"] for item in allocation)
                    
                    # 如果百分比总和不为100%，进行调整
                    if total != 100:
                        logger.warning(f"资产配置百分比总和为{total}%，调整为100%")
                        scale_factor = 100 / total
                        for item in allocation:
                            item["percentage"] = round(item["percentage"] * scale_factor)
                        
                        # 确保调整后总和为100%
                        current_sum = sum(item["percentage"] for item in allocation)
                        if current_sum != 100:
                            # 加到第一个资产上
                            allocation[0]["percentage"] += (100 - current_sum)
                    
                    return {
                        "modelVersion": f"deepseek-api-{DEEPSEEK_MODEL}",
                        "timestamp": int(time.time()),
                        "allocation": allocation,
                        "allocationText": ai_data["allocationText"]
                    }
                    
                except (json.JSONDecodeError, ValueError) as e:
                    logger.error(f"解析DeepSeek API响应失败: {str(e)}")
                    raise ValueError(f"无法从DeepSeek API响应中提取有效的JSON: {str(e)}")
                    
    except Exception as e:
        logger.error(f"生成投资建议时出错: {str(e)}")
        # 提供后备建议，并记录错误
        return {
            "modelVersion": "fallback",
            "timestamp": int(time.time()),
            "error": str(e),
            "allocation": [
                {"asset": "USDC", "percentage": 50},
                {"asset": "BTC", "percentage": 20},
                {"asset": "ETH", "percentage": 15},
                {"asset": "债券", "percentage": 15}
            ],
            "allocationText": "50% USDC, 20% BTC, 15% ETH, 15% 债券"
        } 