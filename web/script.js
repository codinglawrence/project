// B站UP主视频核心观点提取工具 - 前端脚本

// DOM元素
const uidInput = document.getElementById('uid');
const maxVideosInput = document.getElementById('max-videos');
const modelTypeSelect = document.getElementById('model-type');
const extractBtn = document.getElementById('extract-btn');
const statusSection = document.getElementById('status-section');
const statusText = document.getElementById('status-text');
const progress = document.getElementById('progress');
const resultsSection = document.getElementById('results-section');
const resultsGrid = document.getElementById('results-grid');
const resultsTitle = document.getElementById('results-title');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const historyList = document.getElementById('history-list');
const configModal = document.getElementById('config-modal');
const closeModal = document.querySelector('.close');
const saveConfigBtn = document.getElementById('save-config-btn');
// 智能问答相关DOM元素
const aiChatSection = document.getElementById('ai-chat-section');
const chatMessages = document.getElementById('chat-messages');
const questionInput = document.getElementById('question-input');
const askBtn = document.getElementById('ask-btn');

// 存储当前结果，用于智能问答
let currentResults = [];
let currentUid = '';

// 常量
const API_BASE_URL = 'http://localhost:5000/api';
const STORAGE_KEY = 'bilibili-up-views';

// 初始化
function init() {
    // 加载历史记录
    loadHistory();

    // 添加事件监听器
    extractBtn.addEventListener('click', handleExtract);
    saveBtn.addEventListener('click', handleSave);
    clearBtn.addEventListener('click', handleClear);
    closeModal.addEventListener('click', closeConfigModal);
    saveConfigBtn.addEventListener('click', saveConfig);

    // 智能问答事件监听器
    askBtn.addEventListener('click', handleAskQuestion);
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleAskQuestion();
        }
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === configModal) {
            closeConfigModal();
        }
    });

    // 添加配置按钮
    addConfigButton();
}

// 显示聊天消息
function showChatMessage(content, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user' : 'assistant'}`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);

    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 处理提问
async function handleAskQuestion() {
    const question = questionInput.value.trim();
    if (!question) {
        showMessage('请输入您的问题！', 'warning');
        return;
    }

    if (currentResults.length === 0) {
        showMessage('请先提取视频核心观点！', 'error');
        return;
    }

    // 显示用户问题
    showChatMessage(question, true);

    // 清空输入框
    questionInput.value = '';

    try {
        // 发送请求到后端
        const response = await fetch(`${API_BASE_URL}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question,
                results: currentResults,
                uid: currentUid
            })
        });

        const data = await response.json();

        if (data.success) {
            // 显示回答
            showChatMessage(data.answer, false);
        } else {
            showChatMessage(`回答失败：${data.message}`, false);
            showMessage(`回答失败：${data.message}`, 'error');
        }

    } catch (error) {
        showChatMessage(`回答失败：${error.message}`, false);
        showMessage(`请求失败：${error.message}`, 'error');
    }
}

// 添加配置按钮
function addConfigButton() {
    const header = document.querySelector('.header');
    const configBtn = document.createElement('button');
    configBtn.innerHTML = '<i class="fa fa-cog"></i> 配置';
    configBtn.className = 'btn btn-secondary';
    configBtn.style.position = 'absolute';
    configBtn.style.top = '20px';
    configBtn.style.right = '20px';
    configBtn.addEventListener('click', openConfigModal);
    header.style.position = 'relative';
    header.appendChild(configBtn);
}

// 打开配置模态框
function openConfigModal() {
    // 加载现有配置
    const config = loadConfig();
    document.getElementById('deepseek-api-key').value = config.deepseekApiKey || '';
    document.getElementById('siliconflow-api-key').value = config.siliconflowApiKey || '';

    configModal.style.display = 'block';
}

// 关闭配置模态框
function closeConfigModal() {
    configModal.style.display = 'none';
}

// 保存配置
function saveConfig() {
    const config = {
        deepseekApiKey: document.getElementById('deepseek-api-key').value,
        siliconflowApiKey: document.getElementById('siliconflow-api-key').value
    };

    localStorage.setItem(`${STORAGE_KEY}-config`, JSON.stringify(config));
    showMessage('配置保存成功！', 'success');
    closeConfigModal();
}

// 加载配置
function loadConfig() {
    const config = localStorage.getItem(`${STORAGE_KEY}-config`);
    return config ? JSON.parse(config) : {};
}

// 处理提取请求
async function handleExtract() {
    const uid = uidInput.value.trim();
    const maxVideos = parseInt(maxVideosInput.value);
    const modelType = modelTypeSelect.value;

    if (!uid) {
        showMessage('请输入UP主UID！', 'error');
        return;
    }

    // 显示状态区域
    statusSection.style.display = 'block';
    resultsSection.style.display = 'none';
    statusText.textContent = '正在获取视频列表...';
    progress.style.width = '0%';

    try {
        // 获取配置的API密钥
        const config = loadConfig();

        // 发送请求到后端
        const response = await fetch(`${API_BASE_URL}/extract`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uid: uid,
                max_videos: maxVideos,
                model_type: modelType,
                api_keys: {
                    deepseek: config.deepseekApiKey,
                    siliconflow: config.siliconflowApiKey
                }
            })
        });

        const data = await response.json();

        if (data.success) {
            // 更新进度
            progress.style.width = '100%';
            statusText.textContent = `提取完成，共处理 ${data.total} 个视频`;

            // 显示结果（包含整体总结）
            showResults(data.results, uid, data.overall_summary);

            // 保存到历史记录
            saveToHistory({
                uid: uid,
                timestamp: new Date().toISOString(),
                total: data.total,
                results: data.results,
                overall_summary: data.overall_summary
            });

            // 隐藏状态区域
            setTimeout(() => {
                statusSection.style.display = 'none';
            }, 1500);

        } else {
            showMessage(data.message, 'error');
            statusSection.style.display = 'none';
        }

    } catch (error) {
        showMessage(`请求失败：${error.message}`, 'error');
        statusSection.style.display = 'none';
    }
}

// 显示结果
function showResults(results, uid, overallSummary) {
    // 保存当前结果和UID，用于智能问答
    currentResults = results;
    currentUid = uid;

    resultsTitle.textContent = `UP主 ${uid} 视频核心观点（共 ${results.length} 个）`;

    // 清空现有结果
    resultsGrid.innerHTML = '';

    // 显示整体总结
    const overallSummarySection = document.getElementById('overall-summary');
    const summaryContent = document.getElementById('summary-content');

    if (overallSummary && overallSummary !== '没有可总结的结果' && overallSummary !== '生成整体总结失败') {
        // 格式化整体总结（将换行符转换为<p>标签）
        const formattedSummary = overallSummary.split('\n').map(paragraph => {
            paragraph = paragraph.trim();
            return paragraph ? `<p>${paragraph}</p>` : '';
        }).join('');

        summaryContent.innerHTML = formattedSummary;
        overallSummarySection.style.display = 'block';
    } else {
        overallSummarySection.style.display = 'none';
    }

    // 显示智能问答区域
    aiChatSection.style.display = 'block';

    // 添加结果卡片
    results.forEach((result, index) => {
        const card = createResultCard(result, index + 1);
        resultsGrid.appendChild(card);
    });

    // 显示结果区域
    resultsSection.style.display = 'block';

    // 滚动到结果区域
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// 创建结果卡片
function createResultCard(result, index) {
    const card = document.createElement('div');
    card.className = 'result-card';

    // 获取核心观点纯文本（用于摘要）
    const coreViewsText = result.核心观点.replace(/^核心观点\d+：/gm, '').trim();

    // 格式化完整核心观点（带有序号）
    const formattedViews = formatCoreViews(result.核心观点);

    card.innerHTML = `
        <div class="result-content-toutiao">
            <!-- 标题 -->
            <h3 class="result-title">${result.视频标题}</h3>
            
            <!-- 元信息（横向排布） -->
            <div class="result-meta-info">
                <span class="meta-item"><i class="fa fa-calendar"></i> ${result.发布时间}</span>
                <span class="meta-item"><i class="fa fa-play"></i> 视频</span>
                <span class="meta-item"><i class="fa fa-eye"></i> B站</span>
            </div>
            
            <!-- 核心观点摘要 -->
            <div class="core-views-summary">
                ${coreViewsText}
            </div>
            
            <!-- 展开/折叠区域 -->
            <div class="core-views-expandable">
                <button class="expand-btn" onclick="toggleCoreViews(this)">
                    <span>展开查看全部</span>
                    <i class="fa fa-chevron-down"></i>
                </button>
                
                <!-- 完整核心观点 -->
                <div class="core-views-full">
                    <ul>
                        ${formattedViews}
                    </ul>
                </div>
            </div>
        </div>
    `;

    return card;
}

// 格式化核心观点
function formatCoreViews(text) {
    // 按换行符分割核心观点
    const views = text.split('\n').filter(view => view.trim());

    if (views.length === 0) {
        return '<li>无核心观点</li>';
    }

    // 只返回列表项，不包含ul标签
    let liElements = '';
    views.forEach(view => {
        const cleanedView = view.replace(/^核心观点\d+：/, '').trim();
        liElements += `<li>${cleanedView}</li>`;
    });

    return liElements;
}

// 切换核心观点展开/折叠状态
function toggleCoreViews(btn) {
    const content = btn.nextElementSibling;
    const icon = btn.querySelector('i');
    const text = btn.querySelector('span');

    if (content.classList.contains('show')) {
        // 收起
        content.classList.remove('show');
        btn.classList.remove('expanded');
        text.textContent = '展开查看全部';
    } else {
        // 展开
        content.classList.add('show');
        btn.classList.add('expanded');
        text.textContent = '收起';
    }
}

// 处理保存
function handleSave() {
    const results = document.querySelectorAll('.result-card');
    if (results.length === 0) {
        showMessage('没有可保存的结果！', 'warning');
        return;
    }

    // 获取结果数据
    const data = Array.from(results).map(card => {
        const title = card.querySelector('h3').textContent;
        const meta = card.querySelector('.result-meta');
        const date = meta.querySelector('span:first-child').textContent.replace('📅 ', '');
        const link = meta.querySelector('a').href;
        const coreViews = card.querySelector('.core-views').innerHTML;

        return {
            视频标题: title,
            视频链接: link,
            发布时间: date,
            核心观点: coreViews
        };
    });

    // 保存到浏览器本地存储，不触发下载
    localStorage.setItem(`${STORAGE_KEY}-results`, JSON.stringify(data));

    showMessage('结果已保存到浏览器本地存储！', 'success');
}

// 处理清空
function handleClear() {
    if (confirm('确定要清除所有结果吗？')) {
        resultsGrid.innerHTML = '';
        resultsSection.style.display = 'none';
        showMessage('结果已清除！', 'success');
    }
}

// 保存到历史记录
function saveToHistory(data) {
    const history = getHistory();
    history.unshift(data);

    // 只保留最近10条记录
    if (history.length > 10) {
        history.pop();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    loadHistory();
}

// 获取历史记录
function getHistory() {
    const history = localStorage.getItem(STORAGE_KEY);
    return history ? JSON.parse(history) : [];
}

// 加载历史记录
function loadHistory() {
    const history = getHistory();
    historyList.innerHTML = '';

    if (history.length === 0) {
        historyList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">暂无历史记录</p>';
        return;
    }

    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const date = new Date(item.timestamp).toLocaleString();

        historyItem.innerHTML = `
            <div class="history-info">
                <i class="fa fa-history"></i>
                <div>
                    <strong>UP主 ${item.uid}</strong>
                    <div class="history-date">${date} · ${item.total} 个视频</div>
                </div>
            </div>
            <div class="history-actions">
                <button onclick="viewHistory(${index})"><i class="fa fa-eye"></i> 查看</button>
                <button onclick="deleteHistory(${index})"><i class="fa fa-trash"></i> 删除</button>
            </div>
        `;

        historyList.appendChild(historyItem);
    });
}

// 查看历史记录
function viewHistory(index) {
    const history = getHistory();
    const item = history[index];
    showResults(item.results, item.uid, item.overall_summary || '');
}

// 删除历史记录
function deleteHistory(index) {
    const history = getHistory();
    history.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    loadHistory();
    showMessage('历史记录已删除！', 'success');
}

// 显示消息
function showMessage(text, type = 'success') {
    // 创建消息元素
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.innerHTML = `<i class="fa fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'warning'}"></i> ${text}`;

    // 添加到页面
    const container = document.querySelector('.container');
    container.insertBefore(message, container.firstChild);

    // 3秒后自动移除
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transform = 'translateY(-20px)';
        message.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            message.remove();
        }, 300);
    }, 3000);
}

// 启动应用
init();