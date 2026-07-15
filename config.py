
# 大模型API配置
MODEL_TYPE = "deepseek"  # 可选�? "openai"�?deepseek" �?"siliconflow"

# OpenAI API配置
OPENAI_API_KEY = "your-openai-api-key"  # 替换为你的OpenAI API Key
OPENAI_MODEL = "gpt-3.5-turbo"  # OpenAI模型名称

# DeepSeek API配置
DEEPSEEK_API_KEY = "YOUR_DEEPSEEK_API_KEY"  # 替换为你的DeepSeek API Key
DEEPSEEK_MODEL = "deepseek-chat"  # DeepSeek聊天模型

# 硅基流动API配置
SILICONFLOW_API_KEY = "your-siliconflow-api-key"  # 替换为你的硅基流动API Key
SILICONFLOW_MODEL = "Qwen/Qwen2-72B-Instruct"  # 硅基流动模型名称

# 数据采集配置
PAGE_SIZE = 30  # 每页获取的视频数
MAX_VIDEOS = 100  # 最大处理的视频数量
DOWNLOAD_AUDIO = False  # 音频下载已禁�?

# 大模型调用配�?
TEMPERATURE = 0.3  # 温度参数，越低结果越稳定
MAX_TOKENS = 1024  # 最大生成token�?

# 其他配置
DELAY = 0.1  # 减少请求间隔，提高处理速度

# 项目运行配置
UP_MID = "1411721850"  # 默认UP主mid（示例UID）
SAVE_FORMAT = "excel"  # 保存格式: excel / markdown / json
SAVE_PATH = "results"  # 结果保存目录
RESULTS_FILENAME = "up_core_views"  # 结果文件名前缀