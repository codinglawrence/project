# B站UP主视频核心观点自动提炼工具

一个基于Python的工具，可以自动抓取B站某UP主的所有视频，提取字幕或音频转文字，然后使用大模型API（如GPT-3.5）提炼每个视频的核心观点，最终将结果保存为Excel/Markdown/JSON格式。

## 功能特性

- ✅ 自动获取UP主的所有公开视频列表
- ✅ 优先使用B站官方字幕，无字幕时自动下载音频并转文字（Whisper）
- ✅ 支持OpenAI GPT-3.5/4 API和百度文心一言API
- ✅ 智能文本清洗，去除广告和无关内容
- ✅ 分点列出核心观点，清晰易读
- ✅ 支持多种结果保存格式（Excel/Markdown/JSON）
- ✅ 友好的命令行输出，便于跟踪进度
- ✅ 支持中断后保存已处理结果

## 技术栈

- **核心语言**：Python 3.8+
- **B站API**：bilibili-api-python
- **语音转文字**：OpenAI Whisper
- **大模型API**：OpenAI GPT-3.5/4 / 百度文心一言
- **数据处理**：Pandas
- **视频下载**：you-get

## 安装步骤

### 1. 克隆或下载项目

```bash
git clone https://github.com/yourusername/bilibili-up-core-views.git
cd bilibili-up-core-views
```

### 2. 安装依赖

使用pip安装所需依赖：

```bash
pip install -r requirements.txt
```

> 注意：Whisper库安装后会自动下载模型，首次运行可能需要一些时间。

### 3. 配置参数

复制`config.py`文件，根据你的需求修改配置：

```bash
# 直接编辑config.py文件
```

**主要配置项说明**：

| 配置项 | 说明 | 默认值 |
|-------|------|--------|
| `UP_MID` | UP主的mid（从UP主主页URL提取） | `123456` |
| `MODEL_TYPE` | 大模型类型，可选值：`openai`或`wenxin` | `openai` |
| `OPENAI_API_KEY` | OpenAI API Key | `your-openai-api-key` |
| `OPENAI_MODEL` | OpenAI模型名称 | `gpt-3.5-turbo` |
| `MAX_VIDEOS` | 最大处理视频数量 | `100` |
| `DOWNLOAD_AUDIO` | 无字幕时是否下载音频 | `True` |
| `SAVE_FORMAT` | 结果保存格式，可选值：`excel`/`markdown`/`json` | `excel` |

## 使用方法

### 1. 查找UP主的mid

从UP主主页URL中提取mid，例如：
- UP主主页URL：`https://space.bilibili.com/123456`
- mid就是：`123456`

### 2. 配置API Key

在`config.py`中填入你的大模型API Key：

- 如果你使用OpenAI，填入`OPENAI_API_KEY`
- 如果你使用百度文心一言，填入`WENXIN_API_KEY`和`WENXIN_SECRET_KEY`

### 3. 运行程序

```bash
python main.py
```

### 4. 查看结果

程序执行完成后，结果会保存到`results`目录下，文件名默认为`up_core_views`，格式根据`SAVE_FORMAT`配置决定。

## 结果示例

### Excel格式

| 视频标题 | 视频链接 | 发布时间 | 核心观点 |
|---------|---------|---------|---------|
| Python入门教程 | https://www.bilibili.com/video/BV1xx411c7mZ | 2023-10-01 12:00:00 | 核心观点1：Python是一种简单易学的编程语言... |

### Markdown格式

```markdown
# B站UP主视频核心观点汇总

**UP主mid**: 123456
**处理视频数**: 5
**生成时间**: 2023-10-01 13:00:00

## 视频核心观点列表

### 1. Python入门教程
**视频链接**: [https://www.bilibili.com/video/BV1xx411c7mZ](https://www.bilibili.com/video/BV1xx411c7mZ)
**发布时间**: 2023-10-01 12:00:00
**核心观点**:
核心观点1：Python是一种简单易学的编程语言，适合初学者入门。
核心观点2：Python具有丰富的第三方库，可以用于数据分析、web开发等多个领域。
```

## 注意事项

1. **B站反爬机制**：
   - 程序已添加请求延时（默认1秒），避免触发B站反爬
   - 不要频繁运行程序，建议每天运行一次即可

2. **大模型API成本**：
   - OpenAI GPT-3.5的调用成本很低（1000个token约0.0015美元）
   - 国内大模型也有免费额度，可根据实际情况选择

3. **版权问题**：
   - 本工具仅用于**个人学习使用**
   - 请勿将提取的内容用于商业用途
   - 遵守B站的用户协议和相关法律法规

4. **音频转文字**：
   - 音频转文字功能需要较大的磁盘空间（每个视频的音频约几十MB）
   - 可以在`config.py`中设置`DOWNLOAD_AUDIO = False`关闭该功能

## 常见问题

### Q: 程序运行时报错：`No module named 'bilibili_api'`
A: 请确保已安装所有依赖：`pip install -r requirements.txt`

### Q: 无法获取视频字幕
A: 部分视频需要登录才能获取字幕，程序会自动跳过并尝试使用其他方式

### Q: 大模型API调用失败
A: 请检查API Key是否正确，以及网络连接是否正常

### Q: 结果文件在哪里？
A: 结果保存在`results`目录下，文件名和格式可在`config.py`中配置

## 扩展功能

本工具可以根据需求扩展：

1. 支持多UP主批量处理
2. 添加视频分类功能
3. 生成词云分析
4. 添加Web界面
5. 支持更多大模型API

## 贡献

欢迎提交Issue和Pull Request，帮助改进本工具！

## 许可证

MIT License

## 联系方式

如有问题或建议，欢迎通过以下方式联系：
- GitHub Issues: [https://github.com/yourusername/bilibili-up-core-views/issues](https://github.com/yourusername/bilibili-up-core-views/issues)
- Email: your.email@example.com
