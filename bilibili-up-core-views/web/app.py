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

app = Flask(__name__)
CORS(app)  # 允许跨域请求

@app.route('/api/extract', methods=['POST'])
def extract_core_views():
    """提取UP主视频核心观点"""
    try:
        # 声明全局变量
        global MODEL_TYPE, DEEPSEEK_API_KEY, SILICONFLOW_API_KEY
        
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
        
        # 更新配置
        original_model_type = MODEL_TYPE
        original_deepseek_key = DEEPSEEK_API_KEY
        original_siliconflow_key = SILICONFLOW_API_KEY
        
        MODEL_TYPE = model_type
        
        # 更新API密钥（如果提供了）
        if api_keys.get('deepseek'):
            DEEPSEEK_API_KEY = api_keys.get('deepseek')
        if api_keys.get('siliconflow'):
            SILICONFLOW_API_KEY = api_keys.get('siliconflow')
        
        # 初始化爬虫
        crawler = BilibiliUpCrawler(uid, max_videos)
        
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
        
        # 恢复原始配置
        MODEL_TYPE = original_model_type
        DEEPSEEK_API_KEY = original_deepseek_key
        SILICONFLOW_API_KEY = original_siliconflow_key
        
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

@app.route('/api/test', methods=['GET'])
def test():
    """测试接口"""
    return jsonify({
        'success': True,
        'message': '后端服务运行正常'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)