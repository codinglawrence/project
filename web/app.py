#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B站UP主视频核心观点提取工具 - 后端服务

功能：
1. 接收前端请求，获取UP主视频列表
2. 调用大模型API提取核心观点
3. 返回处理结果给前端
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import BilibiliUpCrawler
from config import *

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:5000", "http://127.0.0.1:3000", "http://127.0.0.1:5000"]}})  # 跨域白名单

@app.route('/')
def index():
    """首页"""
    return app.send_static_file('index.html')

@app.route('/api/extract', methods=['POST'])
def extract_core_views():
    """提取UP主视频核心观点"""
    try:
        # 获取请求参数
        data = request.json
        uid = data.get('uid')
        max_videos = data.get('max_videos', MAX_VIDEOS)
        model_type = data.get('model_type', MODEL_TYPE)
        api_keys = data.get('api_keys', {})

        if not uid:
            return jsonify({
                'success': False,
                'message': '缺少必填参数：uid'
            }), 400

        if not isinstance(uid, str) or not uid.strip().isdigit():
            return jsonify({
                'success': False,
                'message': 'UID 必须是纯数字'
            }), 400

        if not isinstance(max_videos, int) or max_videos < 1 or max_videos > 200:
            return jsonify({
                'success': False,
                'message': 'max_videos 必须在 1-200 之间'
            }), 400

        # 初始化爬虫，model_type 和 api_keys 通过构造器传入（不再修改全局变量）
        crawler = BilibiliUpCrawler(uid, max_videos, model_type=model_type, api_keys=api_keys)
        
        # 获取视频列表
        print(f"正在获取UP主 {uid} 的视频列表...")
        crawler.get_up_videos()
        
        print(f"获取到 {len(crawler.videos)} 个视频")
        
        if not crawler.videos:
            return jsonify({
                'success': False,
                'message': '没有获取到视频'
            }), 404
        
        # 处理所有视频
        print(f"开始处理 {len(crawler.videos)} 个视频...")
        crawler.process_all_videos()
        
        print(f"处理完成，共生成 {len(crawler.results)} 个结果")
        
        # 生成整体总结
        print("生成整体总结...")
        overall_summary = crawler.generate_overall_summary()
                
        # 返回结果
        return jsonify({
            'success': True,
            'results': crawler.results,
            'total': len(crawler.results),
            'overall_summary': overall_summary
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'处理失败：{str(e)}'
        }), 500

@app.route('/api/ask', methods=['POST'])
def ask_question():
    """基于提取的核心观点回答用户问题"""
    try:
        # 获取请求参数
        data = request.json
        question = data.get('question')
        results = data.get('results')
        uid = data.get('uid')
        
        if not question or not results:
            return jsonify({
                'success': False,
                'message': '缺少必填参数：question或results'
            }), 400
        
        # 初始化爬虫并直接使用提供的results
        crawler = BilibiliUpCrawler(uid, 0)
        crawler.results = results
        
        # 调用回答问题的方法
        answer = crawler.answer_question(question)
        
        return jsonify({
            'success': True,
            'answer': answer
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'回答问题失败：{str(e)}'
        }), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """智能问答接口"""
    try:
        data = request.json
        context = data.get('context', '')
        question = data.get('question', '')
        
        if not question:
            return jsonify({
                'success': False,
                'message': '缺少问题参数'
            }), 400
        
        # 初始化模型客户端
        from main import BilibiliUpCrawler
        crawler = BilibiliUpCrawler(0, 0)
        
        # 构建提示词
        prompt = f"""基于以下UP主视频分析内容，回答用户的问题：

{context}

用户问题：{question}

请基于上述分析内容，给出一个详细、准确的回答。"""
        
        # 调用模型生成回答
        answer = crawler._call_model(prompt)
        
        return jsonify({
            'success': True,
            'answer': answer
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'聊天请求失败：{str(e)}'
        }), 500

@app.route('/api/test', methods=['GET'])
def test():
    """测试接口"""
    return jsonify({
        'success': True,
        'message': '后端服务运行正常'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
