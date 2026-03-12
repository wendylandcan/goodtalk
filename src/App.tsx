import { useState, useEffect, useRef, ReactNode, ChangeEvent } from 'react';
import { Mic, MicOff, Send, Sparkles, Eye, Heart, HandHeart, MessageCircle, Loader2, RefreshCw, Image as ImageIcon, X } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface NVCResponse {
  observation: string;
  feeling: string;
  need: string;
  request: string;
  final_version: string;
  explanation: string;
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<NVCResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentTranscript += transcript;
          } else {
            currentTranscript += transcript;
          }
        }
        
        const finalTranscript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
          
        setInputText(finalTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          setError('麦克风权限被拒绝，请允许使用麦克风。');
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setError('当前浏览器不支持语音识别，请使用 Chrome、Edge 等支持 Web Speech API 的浏览器。');
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      setError(null);
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
        setError('无法启动麦克风，请确保您的浏览器支持并已授权。');
      }
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTransform = async () => {
    if (!inputText.trim() && !selectedImage) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const parts: any[] = [];
      
      if (selectedImage && imagePreview) {
        const base64Data = imagePreview.split(',')[1];
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: selectedImage.type
          }
        });
      }

      let promptText = `请将以下表达转化为高情商版本。参考“非暴力沟通 (NVC)”的四个要素：观察、感受、需要、请求。\n\n`;
      
      if (selectedImage) {
        promptText += `请先仔细阅读并理解上传的聊天截图中的语境。\n`;
      }
      
      if (inputText.trim()) {
        promptText += `用户的原始表达/想法是： "${inputText}"\n\n`;
      } else if (selectedImage) {
        promptText += `用户没有输入文字，请根据截图的最后一句对话或整体语境，替用户拟定一个高情商的回复。\n\n`;
      }
      
      promptText += `请分析语境和原始表达，并提供一个更有同理心、不带指责的沟通方式。`;

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              observation: {
                type: Type.STRING,
                description: '观察：客观描述发生的事情，不带评判。',
              },
              feeling: {
                type: Type.STRING,
                description: '感受：表达自己对于这件事情的真实情绪感受。',
              },
              need: {
                type: Type.STRING,
                description: '需要：说明是自己的哪种需要/价值观导致了这种感受。',
              },
              request: {
                type: Type.STRING,
                description: '请求：提出具体、正向、可操作的请求。',
              },
              final_version: {
                type: Type.STRING,
                description: '最终高情商版本：将上述四个要素自然地融合在一起，形成一段连贯、真诚的话。',
              },
              explanation: {
                type: Type.STRING,
                description: '解析：简短解释为什么这个新版本比原版更好，它解决了什么沟通障碍。',
              }
            },
            required: ['observation', 'feeling', 'need', 'request', 'final_version', 'explanation']
          }
        }
      });

      if (response.text) {
        const parsedResult = JSON.parse(response.text) as NVCResponse;
        setResult(parsedResult);
      }
    } catch (err) {
      console.error('Transformation error:', err);
      setError('转换过程中出现错误，请稍后再试。');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl space-y-10">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-warm-accent/10 rounded-full mb-2"
          >
            <Sparkles className="w-8 h-8 text-warm-accent" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl font-serif text-warm-text tracking-tight"
          >
            高情商表达转换器
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-warm-muted max-w-xl mx-auto"
          >
            基于非暴力沟通 (NVC) 框架，将情绪化的表达转化为有温度、有建设性的沟通。支持上传聊天截图，AI 将结合语境为您定制回复。
          </motion.p>
        </div>

        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-warm-card rounded-3xl shadow-sm border border-warm-border overflow-hidden"
        >
          <div className="p-6 sm:p-8 flex flex-col space-y-4">
            
            {/* Image Preview Area */}
            {imagePreview && (
              <div className="relative inline-block self-start">
                <img 
                  src={imagePreview} 
                  alt="Chat context preview" 
                  className="h-32 sm:h-48 object-contain rounded-xl border border-warm-border bg-warm-bg"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-warm-text text-white rounded-full p-1.5 shadow-md hover:bg-red-500 transition-colors"
                  title="移除图片"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="支持上传聊天截图帮助AI理解语境。可以点击麦克风语音输入或者文字输入... 例如：你每次都迟到，到底有没有把我放在眼里！"
              className="w-full h-24 sm:h-32 bg-transparent text-warm-text placeholder:text-warm-muted/60 resize-none focus:outline-none text-lg leading-relaxed"
              disabled={isProcessing}
            />
            
            <div className="flex justify-between items-center pt-4 border-t border-warm-border/50">
              <div className="flex items-center space-x-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImageChange} 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-full transition-all duration-300 bg-warm-bg text-warm-muted hover:bg-warm-border hover:text-warm-text"
                  title="上传聊天截图"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={toggleRecording}
                  className={`p-3 rounded-full transition-all duration-300 ${
                    isRecording 
                      ? 'bg-red-100 text-red-500 animate-pulse' 
                      : 'bg-warm-bg text-warm-muted hover:bg-warm-border hover:text-warm-text'
                  }`}
                  title={isRecording ? "停止录音" : "开始录音"}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              </div>
              
              <button
                onClick={handleTransform}
                disabled={(!inputText.trim() && !selectedImage) || isProcessing}
                className="flex items-center space-x-2 bg-warm-accent hover:bg-warm-accent-hover text-white px-6 py-3 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>转换中...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>温柔表达</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-red-50 text-red-600 rounded-xl text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              {/* Final Version Card */}
              <div className="bg-warm-accent/10 border border-warm-accent/20 rounded-3xl p-8 sm:p-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-warm-accent"></div>
                <h3 className="text-sm font-semibold text-warm-accent uppercase tracking-wider mb-4 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  高情商表达
                </h3>
                <p className="text-2xl sm:text-3xl font-serif text-warm-text leading-relaxed">
                  "{result.final_version}"
                </p>
              </div>

              {/* NVC Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <NVCComponent 
                  icon={<Eye className="w-5 h-5" />}
                  title="观察 (Observation)"
                  content={result.observation}
                  colorClass="text-nvc-obs bg-[#8AB0AB]/10 border-[#8AB0AB]/20"
                  iconColor="text-[#8AB0AB]"
                />
                <NVCComponent 
                  icon={<Heart className="w-5 h-5" />}
                  title="感受 (Feeling)"
                  content={result.feeling}
                  colorClass="text-nvc-feel bg-[#E6A57E]/10 border-[#E6A57E]/20"
                  iconColor="text-[#E6A57E]"
                />
                <NVCComponent 
                  icon={<HandHeart className="w-5 h-5" />}
                  title="需要 (Need)"
                  content={result.need}
                  colorClass="text-nvc-need bg-[#D9B44A]/10 border-[#D9B44A]/20"
                  iconColor="text-[#D9B44A]"
                />
                <NVCComponent 
                  icon={<MessageCircle className="w-5 h-5" />}
                  title="请求 (Request)"
                  content={result.request}
                  colorClass="text-nvc-req bg-[#7E998A]/10 border-[#7E998A]/20"
                  iconColor="text-[#7E998A]"
                />
              </div>

              {/* Explanation */}
              <div className="bg-warm-card rounded-2xl p-6 border border-warm-border">
                <h3 className="text-sm font-semibold text-warm-muted uppercase tracking-wider mb-3">
                  解析
                </h3>
                <p className="text-warm-text leading-relaxed">
                  {result.explanation}
                </p>
              </div>
              
              <div className="flex justify-center pt-4">
                <button 
                  onClick={() => {
                    setInputText('');
                    setResult(null);
                    removeImage();
                  }}
                  className="flex items-center space-x-2 text-warm-muted hover:text-warm-text transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>再试一次</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

function NVCComponent({ icon, title, content, colorClass, iconColor }: { icon: ReactNode, title: string, content: string, colorClass: string, iconColor: string }) {
  return (
    <div className={`rounded-2xl p-6 border ${colorClass}`}>
      <div className={`flex items-center space-x-2 mb-3 ${iconColor}`}>
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-warm-text text-sm leading-relaxed">{content}</p>
    </div>
  );
}
