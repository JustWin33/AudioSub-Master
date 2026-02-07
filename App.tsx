import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, Play, Pause, Download, Copy, RefreshCw, FileText, Captions, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SubtitleSegment, ProcessingState, TabView } from './types';
import { transcribeAudio } from './services/gemini';
import { blobToBase64, generateSRT, formatTime } from './utils/helpers';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit for inline base64 safety

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'idle' });
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>(TabView.TRANSCRIPT);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL when file changes
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        alert("文件过大。请上传小于 15MB 的音频文件。");
        return;
      }
      setFile(selectedFile);
      setAudioUrl(URL.createObjectURL(selectedFile));
      setSegments([]);
      setProcessingState({ status: 'idle' });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type.startsWith('audio/') || selectedFile.type.startsWith('video/')) {
         if (selectedFile.size > MAX_FILE_SIZE) {
          alert("文件过大。请上传小于 15MB 的音频文件。");
          return;
        }
        setFile(selectedFile);
        setAudioUrl(URL.createObjectURL(selectedFile));
        setSegments([]);
        setProcessingState({ status: 'idle' });
      } else {
        alert("请拖放有效的音频或视频文件。");
      }
    }
  };

  const processAudio = async () => {
    if (!file) return;

    setProcessingState({ status: 'uploading', message: '正在准备音频...' });

    try {
      const base64 = await blobToBase64(file);
      const mimeType = file.type || 'audio/mp3'; // Default fallback

      setProcessingState({ status: 'analyzing', message: 'Gemini 正在聆听并翻译...' });

      // Note: In a real prod app, the API key should be proxied or user-provided if strict client-side.
      // Based on prompt instructions, we assume process.env.API_KEY is available.
      const apiKey = process.env.API_KEY || '';
      
      const result = await transcribeAudio(base64, mimeType, apiKey);
      setSegments(result);
      setProcessingState({ status: 'completed' });
    } catch (error: any) {
      setProcessingState({ 
        status: 'error', 
        message: error.message || "发生了意外错误。" 
      });
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleCopySRT = () => {
    const text = generateSRT(segments);
    navigator.clipboard.writeText(text);
    alert("SRT 已复制到剪贴板！");
  };

  const handleDownloadSRT = () => {
    const text = generateSRT(segments);
    const blob = new Blob([text], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.split('.')[0] || 'subtitle'}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSeek = (ms: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = ms / 1000;
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
              <Captions size={18} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              AudioSub Master
            </h1>
          </div>
          <div className="text-sm text-gray-500 hidden sm:block">
            基于 Gemini 3 Flash 构建
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Intro / Empty State */}
        {!file && (
          <div className="text-center py-12 space-y-4">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              将音频转化为<span className="text-indigo-600">完美字幕</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              上传您的音频或视频文件。我们的 AI 智能体将即时转录、翻译并生成专业的 SRT 字幕。
            </p>
          </div>
        )}

        {/* Upload Area */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`
            relative group border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out
            ${file 
              ? 'border-indigo-200 bg-indigo-50/30' 
              : 'border-gray-300 hover:border-indigo-500 hover:bg-gray-50 bg-white'
            }
          `}
        >
          <div className="p-8 sm:p-12 text-center">
            {!file ? (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  将音频文件拖放到此处
                </h3>
                <p className="text-sm text-gray-500">
                  支持 MP3, WAV, M4A, MP4 (最大 15MB)
                </p>
                <div className="mt-6">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                  >
                    选择文件
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <FileAudio size={32} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 break-all px-4">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                
                {/* Audio Player Controls */}
                <div className="flex items-center space-x-4 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 mt-2">
                  <button onClick={togglePlayback} className="p-2 rounded-full hover:bg-gray-100 text-indigo-600 transition-colors">
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                  </button>
                  <div className="text-xs font-mono text-gray-500">
                    预览音频
                  </div>
                </div>

                <div className="flex space-x-3 mt-4">
                  <button 
                    onClick={() => { setFile(null); setSegments([]); setProcessingState({ status: 'idle' }); }}
                    className="text-sm text-gray-500 hover:text-red-500 px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    移除
                  </button>
                  {processingState.status === 'idle' && (
                    <button 
                      onClick={processAudio}
                      className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    >
                      开始分析
                    </button>
                  )}
                </div>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="audio/*,video/*" 
              onChange={handleFileChange} 
            />
          </div>

          {/* Progress Overlay */}
          {(processingState.status === 'uploading' || processingState.status === 'analyzing') && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-20">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p className="text-lg font-medium text-indigo-900 animate-pulse">
                {processingState.message}
              </p>
              <p className="text-sm text-gray-500 mt-2">这可能需要一点时间...</p>
            </div>
          )}

           {/* Error Overlay */}
           {processingState.status === 'error' && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-20 px-4 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={28} />
              </div>
              <p className="text-lg font-medium text-red-800">处理失败</p>
              <p className="text-sm text-red-600 mt-1 max-w-md">{processingState.message}</p>
              <button 
                onClick={() => setProcessingState({ status: 'idle' })}
                className="mt-6 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
              >
                重试
              </button>
            </div>
          )}
        </div>

        {/* Hidden Audio Element for Logic */}
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onEnded={() => setIsPlaying(false)} 
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            className="hidden"
          />
        )}

        {/* Results Section */}
        {segments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in-up">
            <div className="border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50">
              <div className="flex space-x-1 bg-gray-200/50 p-1 rounded-lg self-start sm:self-center">
                <button
                  onClick={() => setActiveTab(TabView.TRANSCRIPT)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === TabView.TRANSCRIPT 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                  }`}
                >
                  <FileText size={16} />
                  <span>转录文本</span>
                </button>
                <button
                  onClick={() => setActiveTab(TabView.SRT)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === TabView.SRT 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                  }`}
                >
                  <Captions size={16} />
                  <span>SRT 输出</span>
                </button>
              </div>
              
              <div className="flex space-x-2 mt-4 sm:mt-0">
                <button 
                  onClick={handleCopySRT}
                  className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors shadow-sm"
                >
                  <Copy size={16} />
                  <span>复制 SRT</span>
                </button>
                <button 
                  onClick={handleDownloadSRT}
                  className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  <Download size={16} />
                  <span>下载 .srt</span>
                </button>
              </div>
            </div>

            <div className="p-0">
              {activeTab === TabView.TRANSCRIPT ? (
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {segments.map((segment) => (
                    <div 
                      key={segment.id} 
                      className="p-6 hover:bg-indigo-50/30 transition-colors group flex gap-4"
                    >
                      <div className="flex-shrink-0 mt-1">
                         <button 
                           onClick={() => handleSeek(segment.startMs)}
                           className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                           title="播放此片段"
                         >
                           <Play size={14} fill="currentColor" />
                         </button>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <h4 className="text-sm font-mono text-indigo-500 font-medium">
                            {formatTime(segment.startMs)} - {formatTime(segment.endMs)}
                          </h4>
                        </div>
                        
                        <div className="space-y-2">
                           <div>
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500 mb-1">
                                原文
                              </span>
                              <p className="text-gray-900 text-lg leading-relaxed font-medium">
                                {segment.original}
                              </p>
                           </div>
                           <div>
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 mb-1">
                                译文
                              </span>
                              <p className="text-gray-600 text-lg leading-relaxed">
                                {segment.translation}
                              </p>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-900 p-6 overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                  <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap leading-relaxed">
                    {generateSRT(segments)}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 p-4 border-t border-gray-200 text-center">
               <p className="text-xs text-gray-500">
                 由 Gemini 3 生成。专业使用前请核对准确性。
               </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
