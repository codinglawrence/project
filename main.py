#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B站UP主视频核心观点自动提炼工具

功能：
1. 获取指定UP主的所有公开视频列表
2. 自动获取视频字幕
3. 使用大模型API提炼视频核心观点
4. 将结果返回给前端
"""

import os
import time
import json
from bilibili_api import user, video, sync

# 导入配置
from config import *

# 尝试导入OpenAI库
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("警告：OpenAI库未安装，请先安装：pip install openai")


def ensure_directory(path):
    """确保目录存在，不存在则创建"""
    if not os.path.exists(path):
        os.makedirs(path)


class BilibiliUpCrawler:
    """B站UP主视频爬虫类"""
    
    def __init__(self, up_mid, max_videos=MAX_VIDEOS):
        self.up_mid = up_mid
        self.max_videos = max_videos
        self.videos = []
        self.results = []
        
        # 初始化大模型客户端
        self.model_client = self._init_model_client()
        
        # 音频下载已禁用，不再初始化Whisper模型
        self.whisper_model = None
    
    def _init_model_client(self):
        """初始化大模型客户端"""
        if not OPENAI_AVAILABLE:
            print("警告：OpenAI库未安装，请先安装：pip install openai")
            return None
        
        # 简化模型初始化，只保留核心模型
        model_configs = {
            "openai": {"api_key": OPENAI_API_KEY, "base_url": None},
            "deepseek": {"api_key": DEEPSEEK_API_KEY, "base_url": "https://api.deepseek.com/v1"},
            "siliconflow": {"api_key": SILICONFLOW_API_KEY, "base_url": "https://api.siliconflow.cn/v1"}
        }
        
        if MODEL_TYPE in model_configs:
            config = model_configs[MODEL_TYPE]
            if config["base_url"]:
                return OpenAI(api_key=config["api_key"], base_url=config["base_url"])
            else:
                return OpenAI(api_key=config["api_key"])
        else:
            print(f"警告：不支持的模型类型：{MODEL_TYPE}")
            return None
    
    def get_up_videos(self):
        """获取UP主的视频列表"""
        print(f"开始获取UP主（mid: {self.up_mid}）的视频列表...")
        
        pn = 1
        total_videos = 0
        
        while total_videos < self.max_videos:
            try:
                # 初始化用户对象
                u = user.User(uid=self.up_mid)
                
                # 尝试不同的API调用方式
                vlist = None
                try:
                    # 方法1：使用最新的参数名
                    vlist = sync(u.get_videos(pn=pn, ps=PAGE_SIZE))
                except TypeError:
                    try:
                        # 方法2：不传递页码参数，获取所有视频
                        vlist = sync(u.get_videos(ps=PAGE_SIZE))
                    except TypeError:
                        try:
                            # 方法3：不传递页码参数，只传递page_size
                            vlist = sync(u.get_videos(page_size=PAGE_SIZE))
                        except TypeError:
                            # 方法4：不传递任何参数，获取所有视频
                            vlist = sync(u.get_videos())
                
                # 处理不同的返回格式
                videos_list = []
                if isinstance(vlist, dict):
                    # 新的API返回格式：{"list": {"vlist": [...]}}
                    if vlist.get("list") and isinstance(vlist["list"], dict):
                        videos_list = vlist["list"].get("vlist", [])
                    else:
                        # 另一种可能的返回格式：{"data": [...]}
                        videos_list = vlist.get("data", [])
                else:
                    # 旧的API返回格式：直接返回列表
                    videos_list = vlist
                
                if not videos_list:
                    print("已获取所有视频，退出")
                    break
                
                # 提取关键信息
                for video in videos_list:
                    if total_videos >= self.max_videos:
                        break
                    
                    # 提取发布时间，兼容不同字段名
                    pubdate = video.get("pubdate", video.get("created", 0)) if isinstance(video, dict) else video.pubdate if hasattr(video, 'pubdate') else 0
                    
                    # 确保video是字典类型
                    if isinstance(video, dict):
                        bvid_val = video.get("bvid", "")
                        title_val = video.get("title", "")
                        desc_val = video.get("desc", "")
                    else:
                        bvid_val = video.bvid if hasattr(video, 'bvid') else ""
                        title_val = video.title if hasattr(video, 'title') else ""
                        desc_val = video.desc if hasattr(video, 'desc') else ""
                    
                    video_info = {
                        "bvid": bvid_val,  # 视频唯一标识
                        "title": title_val,  # 视频标题
                        "url": f"https://www.bilibili.com/video/{bvid_val}",  # 视频链接
                        "desc": desc_val,  # 视频简介，兼容可能的缺失字段
                        "pubdate": pubdate  # 发布时间
                    }
                    self.videos.append(video_info)
                    total_videos += 1
                    print(f"已获取视频 {total_videos}/{self.max_videos}: {title_val[:30]}...")
                
                if total_videos >= self.max_videos:
                    break
                    
                pn += 1
                time.sleep(DELAY)  # 加延时，避免触发B站反爬
                
            except Exception as e:
                print(f"获取第{pn}页视频失败：{e}")
                # 尝试直接获取所有视频，不使用分页
                try:
                    print("尝试直接获取所有视频...")
                    u = user.User(uid=self.up_mid)
                    vlist = sync(u.get_videos())
                    
                    # 处理返回格式
                    videos_list = []
                    if isinstance(vlist, dict):
                        videos_list = vlist.get("list", {}).get("vlist", [])
                    else:
                        videos_list = vlist
                    
                    if videos_list:
                        for video in videos_list[:self.max_videos - total_videos]:
                            # 提取发布时间，兼容不同字段名
                            if isinstance(video, dict):
                                pubdate = video.get("pubdate", video.get("created", 0))
                                bvid_val = video.get("bvid", "")
                                title_val = video.get("title", "")
                                desc_val = video.get("desc", "")
                            else:
                                pubdate = video.pubdate if hasattr(video, 'pubdate') else 0
                                bvid_val = video.bvid if hasattr(video, 'bvid') else ""
                                title_val = video.title if hasattr(video, 'title') else ""
                                desc_val = video.desc if hasattr(video, 'desc') else ""
                            
                            video_info = {
                                "bvid": bvid_val,
                                "title": title_val,
                                "url": f"https://www.bilibili.com/video/{bvid_val}",
                                "desc": desc_val,
                                "pubdate": pubdate
                            }
                            self.videos.append(video_info)
                            total_videos += 1
                            print(f"已获取视频 {total_videos}/{self.max_videos}: {title_val[:30]}...")
                    break
                except Exception as e2:
                    print(f"直接获取视频失败：{e2}")
                    break
        
        print(f"共获取到 {len(self.videos)} 个视频")
        return self.videos
    
    def get_video_subtitle(self, bvid):
        """获取视频字幕"""
        try:
            # 初始化视频对象
            v = video.Video(bvid=bvid)
            # 获取视频信息
            video_info = sync(v.get_info())
            cid = video_info["cid"]
            
            # 获取字幕信息
            subtitle_info = sync(v.get_subtitle(cid=cid))
            
            if not subtitle_info or "subtitles" not in subtitle_info:
                print(f"视频 {bvid} 没有可用字幕")
                return None
            
            # 获取字幕URL
            subtitles = subtitle_info["subtitles"]
            if not subtitles:
                print(f"视频 {bvid} 没有可用字幕")
                return None
            
            # 取第一个字幕（通常是中文字幕）
            subtitle_url = subtitles[0]["subtitle_url"]
            
            # 下载字幕
            import requests
            response = requests.get(subtitle_url)
            if response.status_code != 200:
                print(f"下载字幕失败：{response.status_code}")
                return None
            
            # 解析字幕
            subtitle_data = response.json()
            if "body" not in subtitle_data:
                print(f"字幕格式错误")
                return None
            
            # 提取字幕文本
            subtitle_text = ""
            for item in subtitle_data["body"]:
                subtitle_text += item["content"] + " "
            
            print(f"成功获取视频 {bvid} 的字幕")
            return subtitle_text.strip()
            
        except Exception as e:
            # 处理所有异常，包括需要登录才能获取字幕的情况
            print(f"获取视频 {bvid} 字幕失败：{e}")
            return None
    

    
    def clean_text(self, text):
        """文本清洗：去空格、去换行、去重复符号等"""
        if not text:
            return ""
        
        # 去除多余的空格和换行
        text = text.replace("\n", " ").replace("\r", " ").replace("  ", " ")
        
        # 只去除真正的广告类内容，保留正常的中文词汇
        ad_words = [
            "关注我", "一键三连", "点赞投币收藏", "记得三连", "感谢观看",
            "欢迎订阅", "喜欢的话", "下期再见", "更多精彩", "敬请期待"
        ]
        
        for word in ad_words:
            text = text.replace(word, "")
        
        return text.strip()
    
    def extract_core_view(self, text, title=""):
        """使用大模型API提取视频核心观点"""
        if not self.model_client:
            print("大模型客户端不可用，跳过核心观点提取")
            return "核心观点提取失败：模型客户端不可用"
        
        if not text:
            return "核心观点提取失败：无可用文本"
        
        try:
            prompt = f"""
            请你作为一个专业的内容分析师，提炼以下B站视频的核心观点，要求：
            1. 基于视频标题和文本内容，总结150-200字；
            2. 分2-3点列出核心观点，语言简洁明了；
            3. 直接切入主题，只保留核心内容；
            4. 使用中文表达，格式为：核心观点1：xxx\n核心观点2：xxx。

            视频标题：{title}
            视频文本：{text[:1500]}  # 只取前1500字，提高处理速度
            """
            
            # 根据模型类型选择正确的模型名称
            model_name = OPENAI_MODEL
            if MODEL_TYPE == "deepseek":
                model_name = DEEPSEEK_MODEL
            elif MODEL_TYPE == "siliconflow":
                model_name = SILICONFLOW_MODEL
            
            # 调用模型API（所有模型使用统一的OpenAI兼容接口）
            response = self.model_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS
            )
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            error_msg = str(e)
            print(f"核心观点提取失败：{error_msg}")
            
            # 提供更详细的错误说明
            if "Authentication Fails" in error_msg or "invalid" in error_msg.lower() or "401" in error_msg:
                if MODEL_TYPE == "siliconflow":
                    return f"核心观点提取失败：API密钥无效，请检查config.py中的SILICONFLOW_API_KEY设置是否正确"
                elif MODEL_TYPE == "deepseek":
                    return f"核心观点提取失败：API密钥无效，请检查config.py中的DEEPSEEK_API_KEY设置是否正确"
                else:
                    return f"核心观点提取失败：API密钥无效，请检查config.py中的{MODEL_TYPE.upper()}_API_KEY设置是否正确"
            elif "Insufficient Balance" in error_msg:
                return f"核心观点提取失败：API余额不足，请充值或更换API密钥"
            elif "rate limit" in error_msg.lower() or "Too Many Requests" in error_msg:
                return f"核心观点提取失败：API请求频率过高，请稍后重试或增加延迟设置"
            else:
                return f"核心观点提取失败：{error_msg[:100]}"
    
    def process_video(self, video_info):
        """处理单个视频：获取文本 → 清洗 → 提取核心观点"""
        bvid = video_info["bvid"]
        title = video_info["title"]
        
        print(f"\n开始处理视频：{title}")
        print(f"视频链接：{video_info['url']}")
        
        # 1. 尝试获取字幕
        text = self.get_video_subtitle(bvid)
        
        # 2. 如果没有字幕，使用标题和简介作为文本来源
        if not text:
            print("使用标题和简介作为文本来源...")
            text = f"{title} {video_info['desc']}"
        
        # 3. 文本清洗
        cleaned_text = self.clean_text(text)
        
        if not cleaned_text:
            print(f"视频 {bvid} 无可用文本，跳过")
            return None
        
        # 4. 提取核心观点
        core_view = self.extract_core_view(cleaned_text, title)
        
        # 5. 保存结果
        result = {
            "视频标题": title,
            "视频链接": video_info["url"],
            "发布时间": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(video_info["pubdate"])),
            "核心观点": core_view
        }
        
        self.results.append(result)
        print(f"视频 {bvid} 处理完成")
        return result
    
    def generate_overall_summary(self):
        """生成所有视频核心观点的整体总结"""
        if not self.results:
            return "没有可总结的结果"
        
        try:
            # 收集所有核心观点
            all_core_views = ""
            for i, result in enumerate(self.results):
                all_core_views += f"\n\n视频{i+1}标题：{result['视频标题']}\n"
                all_core_views += f"核心观点：{result['核心观点']}\n"
            
            prompt = f"""
            请你作为一个专业的内容分析师，基于以下多个B站视频的核心观点，生成一个整体总结，要求：
            1. 对所有视频的核心观点进行综合分析和归纳
            2. 总结这些视频的共同主题、主要观点和价值
            3. 分析这些视频内容的整体趋势和特点
            4. 语言简洁明了，结构清晰，使用中文表达
            5. 总结长度控制在300-400字左右
            
            所有视频核心观点：
            {all_core_views}
            """
            
            # 根据模型类型选择正确的模型名称
            model_name = OPENAI_MODEL
            if MODEL_TYPE == "deepseek":
                model_name = DEEPSEEK_MODEL
            elif MODEL_TYPE == "siliconflow":
                model_name = SILICONFLOW_MODEL
            
            # 调用模型API
            response = self.model_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS
            )
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"生成整体总结失败：{e}")
            return "生成整体总结失败"
    
    def answer_question(self, question):
        """基于提取的核心观点回答用户问题"""
        if not self.results:
            return "没有可用于回答问题的核心观点"
        
        try:
            # 收集所有核心观点和整体总结作为上下文
            context = "以下是从B站视频中提取的核心观点，你需要基于这些内容回答用户的问题：\n\n"
            for i, result in enumerate(self.results):
                context += f"视频{i+1}标题：{result['视频标题']}\n"
                context += f"核心观点：{result['核心观点']}\n\n"
            
            prompt = f"""
            请你作为一个专业的内容分析师，基于以下提供的B站视频核心观点，回答用户的问题。
            要求：
            1. 回答必须基于提供的核心观点，不得添加外部信息
            2. 回答要准确、清晰、简洁
            3. 使用中文回答
            4. 如果问题与提供的核心观点无关，请直接说明
            
            上下文信息：
            {context}
            
            用户问题：{question}
            """
            
            # 根据模型类型选择正确的模型名称
            model_name = OPENAI_MODEL
            if MODEL_TYPE == "deepseek":
                model_name = DEEPSEEK_MODEL
            elif MODEL_TYPE == "siliconflow":
                model_name = SILICONFLOW_MODEL
            
            # 调用模型API
            response = self.model_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS
            )
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"回答问题失败：{e}")
            return f"回答问题失败：{str(e)[:50]}"
    
    def process_all_videos(self):
        """处理所有视频"""
        if not self.videos:
            print("没有可处理的视频，请先调用get_up_videos()")
            return
        
        print(f"\n开始处理 {len(self.videos)} 个视频...")
        
        for i, video_info in enumerate(self.videos):
            print(f"\n--- 处理第 {i+1}/{len(self.videos)} 个视频 ---")
            self.process_video(video_info)
            time.sleep(DELAY)  # 加延时，避免触发API限制
        
        print(f"\n所有视频处理完成，共处理 {len(self.results)} 个视频")
    
    def save_results(self):
        """保存结果"""
        if not self.results:
            print("没有可保存的结果")
            return
        
        print(f"\n开始保存结果...")
        
        # 生成带时间戳的文件名，避免文件被锁定时保存失败
        timestamp = time.strftime("%Y%m%d_%H%M%S", time.localtime())
        save_filename = f"{RESULTS_FILENAME}_{timestamp}"
        
        if SAVE_FORMAT == "excel":
            # 保存为Excel
            df = pd.DataFrame(self.results)
            save_file = os.path.join(SAVE_PATH, f"{save_filename}.xlsx")
            df.to_excel(save_file, index=False, engine="openpyxl")
            print(f"结果已保存为Excel：{save_file}")
        
        elif SAVE_FORMAT == "json":
            # 保存为JSON
            save_file = os.path.join(SAVE_PATH, f"{save_filename}.json")
            with open(save_file, "w", encoding="utf-8") as f:
                json.dump(self.results, f, ensure_ascii=False, indent=2)
            print(f"结果已保存为JSON：{save_file}")
        
        elif SAVE_FORMAT == "markdown":
            # 保存为Markdown
            save_file = os.path.join(SAVE_PATH, f"{save_filename}.md")
            with open(save_file, "w", encoding="utf-8") as f:
                f.write(f"# B站UP主视频核心观点汇总\n\n")
                f.write(f"**UP主mid**: {self.up_mid}\n")
                f.write(f"**处理视频数**: {len(self.results)}\n")
                f.write(f"**生成时间**: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}\n\n")
                f.write("## 视频核心观点列表\n\n")
                
                for i, result in enumerate(self.results):
                    f.write(f"### {i+1}. {result['视频标题']}\n")
                    f.write(f"**视频链接**: [{result['视频链接']}]({result['视频链接']})\n")
                    f.write(f"**发布时间**: {result['发布时间']}\n")
                    f.write(f"**核心观点**:\n{result['核心观点']}\n\n")
            print(f"结果已保存为Markdown：{save_file}")
        
        else:
            print(f"不支持的保存格式：{SAVE_FORMAT}")
    
    def run(self):
        """运行完整流程"""
        try:
            # 1. 获取视频列表
            self.get_up_videos()
            
            if not self.videos:
                print("没有获取到视频，程序结束")
                return
            
            # 2. 处理所有视频
            self.process_all_videos()
            
            # 3. 保存结果
            self.save_results()
            
            print("\n程序执行完成！")
            
        except KeyboardInterrupt:
            print("\n程序被用户中断")
            # 保存已处理的结果
            if self.results:
                self.save_results()
        except Exception as e:
            print(f"\n程序执行出错：{e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    # 初始化爬虫
    crawler = BilibiliUpCrawler(UP_MID, MAX_VIDEOS)
    # 运行完整流程
    crawler.run()
