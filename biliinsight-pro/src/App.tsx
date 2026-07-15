/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { 
  PlayCircle, 
  UserCircle, 
  Film, 
  Brain, 
  Wand2, 
  Save, 
  Trash2, 
  History, 
  Settings, 
  Send, 
  Loader2, 
  ExternalLink,
  LayoutDashboard,
  MessageSquareText,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// --- Types ---

interface VideoResult {
  bvid: string;
  title: string;
  created: string;
  core_views: string[];
  summary: string;
  url: string;
}

interface ExtractionSession {
  id: string;
  uid: string;
  timestamp: string;
  totalVideos: number;
  results: VideoResult[];
  overall_summary: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// --- Constants ---

const STORAGE_KEY = "bili-insight-history";
const API_BASE_URL = "http://localhost:5000";

// --- Components ---

export default function App() {
  const [uid, setUid] = useState("");
  const [maxVideos, setMaxVideos] = useState("5");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  
  const [currentSession, setCurrentSession] = useState<ExtractionSession | null>(null);
  const [history, setHistory] = useState<ExtractionSession[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const saveToHistory = (session: ExtractionSession) => {
    const newHistory = [session, ...history.filter(h => h.id !== session.id)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("历史记录已清除");
  };

  const handleExtract = async () => {
    if (!uid) {
      toast.error("请输入UP主UID");
      return;
    }

    setLoading(true);
    setProgress(10);
    setStatus("正在连接服务器...");
    setChatMessages([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: uid,
          max_videos: parseInt(maxVideos),
          model_type: 'deepseek'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || '提取失败');
      }

      const session: ExtractionSession = {
        id: Date.now().toString(),
        uid,
        timestamp: new Date().toISOString(),
        totalVideos: data.total,
        results: data.results.map((r: any) => {
          // 解析核心观点（后端返回的是字符串，需要分割）
          const coreViewsText = r['核心观点'] || '';
          const coreViews = coreViewsText
            .split(/核心观点\d+：/)
            .filter((s: string) => s.trim())
            .map((s: string) => s.trim().replace(/\n+/g, ' '));
          
          return {
            bvid: r['视频链接']?.split('/').pop() || '',
            title: r['视频标题'] || '',
            created: r['发布时间'] || '',
            core_views: coreViews,
            summary: r['核心观点'] || '',
            url: r['视频链接'] || ''
          };
        }),
        overall_summary: data.overall_summary || ''
      };

      setCurrentSession(session);
      saveToHistory(session);
      setProgress(100);
      setStatus("提取完成！");
      toast.success(`成功分析 ${data.total} 个视频`);

      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 1000);

    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "提取失败，请检查后端服务是否运行");
      setLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || !currentSession) return;

    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: question }
    ];
    setChatMessages(newMessages);
    setQuestion("");
    setIsChatLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const context = `以下是UP主 ${currentSession.uid} 的视频分析结果：
      ${currentSession.results.map(r => `标题: ${r.title}\n观点: ${r.core_views.join(", ")}`).join("\n\n")}
      
      整体总结: ${currentSession.overall_summary}`;

      try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context: context,
            question: question
          }),
        });

        if (!response.ok) {
          throw new Error('聊天请求失败');
        }

        const data = await response.json();
        
        setChatMessages([
          ...newMessages,
          { role: "assistant", content: data.answer || "抱歉，我无法回答这个问题。" }
        ]);
      } catch (error) {
        setChatMessages([
          ...newMessages,
          { role: "assistant", content: "抱歉，AI 服务暂时不可用，请稍后重试。" }
        ]);
      }
    } catch (error) {
      console.error(error);
      toast.error("AI 响应失败");
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-blue-100">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-200">
              <Sparkles className="h-6 w-6 text-pink-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">BiliInsight <span className="text-pink-500">Pro</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Professional Creator Analysis</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="h-5 w-5 text-slate-500" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input & History */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-xl shadow-slate-200/40 overflow-hidden bg-white">
              <div className="h-1.5 bg-slate-900" />
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Wand2 className="h-5 w-5 text-pink-500" />
                  开始分析
                </CardTitle>
                <CardDescription className="text-slate-500">输入UP主UID，一键获取视频核心观点</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="uid" className="text-xs font-bold uppercase tracking-wider text-slate-500">UP主 UID</Label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input 
                      id="uid" 
                      placeholder="例如: 1411721850" 
                      className="pl-10 h-11 border-slate-200 bg-slate-50/50 focus:bg-white transition-all focus:ring-slate-900"
                      value={uid}
                      onChange={(e) => setUid(e.target.value)}
                    />
                  </div>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs text-pink-600 font-semibold hover:text-pink-700"
                    onClick={() => setUid("1411721850")}
                  >
                    使用示例 UID
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-videos" className="text-xs font-bold uppercase tracking-wider text-slate-500">最大视频数</Label>
                    <Select value={maxVideos} onValueChange={setMaxVideos}>
                      <SelectTrigger id="max-videos" className="h-11 border-slate-200 bg-slate-50/50">
                        <SelectValue placeholder="选择数量" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 个视频</SelectItem>
                        <SelectItem value="5">5 个视频</SelectItem>
                        <SelectItem value="10">10 个视频</SelectItem>
                        <SelectItem value="20">20 个视频</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">分析模型</Label>
                    <Badge variant="secondary" className="h-11 w-full justify-center text-xs font-bold bg-slate-100 text-slate-700 border-slate-200">
                      DeepSeek Chat
                    </Badge>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button 
                  className="w-full h-12 text-base font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                  onClick={handleExtract}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5 text-pink-400" />
                      开始提取
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* Progress Display */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card className="border-slate-100 bg-white shadow-sm">
                    <CardContent className="pt-6">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                        <span className="text-slate-500">{status}</span>
                        <span className="text-slate-900">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-slate-900"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* History */}
            <Card className="border-none shadow-lg shadow-slate-200/40 bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                    <History className="h-4 w-4 text-slate-400" />
                    历史记录
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500" onClick={clearHistory}>
                    清空
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-2">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-1.5 px-2">
                    {history.length === 0 ? (
                      <div className="text-center py-12 text-slate-300 text-xs font-medium">
                        暂无历史记录
                      </div>
                    ) : (
                      history.map((item) => (
                        <button
                          key={item.id}
                          className={`w-full text-left p-3 rounded-xl transition-all border ${currentSession?.id === item.id ? 'bg-slate-50 border-slate-200 ring-1 ring-slate-200' : 'hover:bg-slate-50/80 border-transparent'}`}
                          onClick={() => setCurrentSession(item)}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-xs text-slate-700">UID: {item.uid}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{format(new Date(item.timestamp), "MM-dd HH:mm")}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            <Film className="h-3 w-3" />
                            {item.totalVideos} Videos
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Results & Chat */}
          <div className="lg:col-span-8 space-y-6">
            {!currentSession && !loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center">
                  <LayoutDashboard className="h-10 w-10 text-slate-300" />
                </div>
                <div className="max-w-md space-y-2">
                  <h2 className="text-xl font-bold text-slate-800">准备好开始了吗？</h2>
                  <p className="text-slate-500">在左侧输入 UP 主 UID 并点击开始提取，我们将为您深度分析视频内容。</p>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="insights" className="w-full">
                <div className="flex items-center justify-between mb-6">
                  <TabsList className="bg-slate-200/50 p-1 rounded-xl">
                    <TabsTrigger value="insights" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-500 font-bold text-xs uppercase tracking-widest px-4">
                      <LayoutDashboard className="h-3.5 w-3.5 mr-2" />
                      核心观点
                    </TabsTrigger>
                    <TabsTrigger value="chat" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-500 font-bold text-xs uppercase tracking-widest px-4">
                      <MessageSquareText className="h-3.5 w-3.5 mr-2" />
                      智能问答
                    </TabsTrigger>
                  </TabsList>
                  
                  {currentSession && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="rounded-xl h-9 border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm">
                        <Save className="h-3.5 w-3.5 mr-2 text-slate-400" />
                        保存结果
                      </Button>
                    </div>
                  )}
                </div>

                <TabsContent value="insights" className="space-y-8 mt-0">
                  {loading && !currentSession ? (
                    <div className="space-y-6">
                      <Skeleton className="h-[200px] w-full rounded-3xl" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Skeleton className="h-[300px] rounded-2xl" />
                        <Skeleton className="h-[300px] rounded-2xl" />
                      </div>
                    </div>
                  ) : currentSession && (
                    <>
                      {/* Overall Summary */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Card className="border-none shadow-xl shadow-slate-200/40 bg-white overflow-hidden rounded-3xl">
                          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                              <Brain className="h-5 w-5 text-pink-500" />
                              整体洞察总结
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-6">
                            <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium">
                              <ReactMarkdown>{currentSession.overall_summary}</ReactMarkdown>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      {/* Video Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {currentSession.results.map((video, idx) => (
                          <motion.div
                            key={video.bvid}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <Card className="h-full border-none shadow-lg shadow-slate-200/30 bg-white hover:shadow-xl transition-all duration-300 overflow-hidden group rounded-2xl">
                              <CardHeader className="pb-3">
                                <div className="flex justify-between items-start gap-4">
                                  <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-100 font-mono text-[9px] font-bold tracking-tighter">
                                    {video.bvid}
                                  </Badge>
                                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{video.created}</span>
                                </div>
                                <CardTitle className="text-sm font-bold mt-2 leading-snug group-hover:text-pink-500 transition-colors line-clamp-2">
                                  {video.title}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-5">
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3 text-pink-400" />
                                    核心观点
                                  </h4>
                                  <ul className="space-y-2.5">
                                    {video.core_views.map((point, pIdx) => (
                                      <li key={pIdx} className="text-xs text-slate-600 flex gap-3 leading-relaxed">
                                        <span className="flex-shrink-0 h-5 w-5 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                                          {pIdx + 1}
                                        </span>
                                        {point}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <Separator className="bg-slate-50" />
                                <div className="space-y-2">
                                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">内容摘要</h4>
                                  <p className="text-xs text-slate-500 leading-relaxed italic bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                    "{video.summary}"
                                  </p>
                                </div>
                              </CardContent>
                              <CardFooter className="pt-0">
                                <Button variant="ghost" size="sm" className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-pink-500 hover:bg-pink-50 transition-colors" onClick={() => window.open(video.url, '_blank')}>
                                    查看原视频
                                    <ExternalLink className="ml-2 h-3 w-3" />
                                </Button>
                              </CardFooter>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="chat" className="mt-0">
                  <Card className="border-none shadow-xl shadow-slate-200/40 h-[650px] flex flex-col overflow-hidden rounded-3xl bg-white">
                    <CardHeader className="border-b bg-slate-50/30">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
                          <Brain className="h-6 w-6 text-pink-400" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">AI 智能分析助手</CardTitle>
                          <CardDescription className="text-xs font-medium">深度解析 UP 主创作逻辑与内容价值</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0 bg-slate-50/20">
                      <ScrollArea className="h-full p-6">
                        <div className="space-y-8">
                          {chatMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
                              <div className="p-5 bg-white shadow-sm rounded-3xl border border-slate-100">
                                <MessageSquareText className="h-10 w-10 text-slate-200" />
                              </div>
                              <div className="max-w-xs space-y-2">
                                <h3 className="text-sm font-bold text-slate-700">开始对话</h3>
                                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                  您可以针对该 UP 主的视频内容进行深度提问，AI 将基于分析结果为您解答。
                                </p>
                              </div>
                            </div>
                          )}
                          {chatMessages.map((msg, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                                msg.role === 'user' 
                                  ? 'bg-slate-900 text-white rounded-tr-none' 
                                  : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                              }`}>
                                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                          {isChatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-3 shadow-sm">
                                <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Thinking...</span>
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                      </ScrollArea>
                    </CardContent>
                    <CardFooter className="p-5 border-t bg-white">
                      <div className="flex w-full items-center gap-3">
                        <Input 
                          placeholder="输入您的问题..." 
                          className="flex-1 h-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all focus:ring-slate-900"
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                          disabled={isChatLoading || !currentSession}
                        />
                        <Button 
                          size="icon" 
                          className="h-12 w-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200 transition-all active:scale-90"
                          onClick={handleAsk}
                          disabled={isChatLoading || !currentSession || !question.trim()}
                        >
                          <Send className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <PlayCircle className="h-5 w-5 text-indigo-600" />
            <span className="font-bold text-slate-800">BiliInsight Pro</span>
          </div>
          <p className="text-sm text-slate-500">© 2024 BiliInsight Pro. Powered by Google Gemini AI.</p>
        </div>
      </footer>
    </div>
  );
}
