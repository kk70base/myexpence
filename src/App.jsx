import React, { useState, useEffect, useRef } from 'react';
import { Camera, FileText, Save, Download, Trash2, Plus, Calendar, DollarSign, Tag, Store, CheckCircle, AlertCircle, Settings, X, ExternalLink, Sparkles, File, Lock, Unlock, KeyRound } from 'lucide-react';

const ExpenseTrackerApp = () => {
    // ロック機能用State
    const [isLocked, setIsLocked] = useState(true);
    const [hasPasscode, setHasPasscode] = useState(false);
    const [inputPasscode, setInputPasscode] = useState('');
    const [passcodeError, setPasscodeError] = useState('');
    const [activeTab, setActiveTab] = useState('scan');
    const [expenses, setExpenses] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [currentImage, setCurrentImage] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    // 設定情報
    const [gasUrl, setGasUrl] = useState(''); // Google Apps Script Web App URL
    const [geminiApiKey, setGeminiApiKey] = useState(''); // Gemini API Key

    const [formData, setFormData] = useState({
          date: '',
          amount: '',
          vendor: '',
          category: '消耗品費',
          description: ''
    });
    const [showSuccess, setShowSuccess] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const fileInputRef = useRef(null);

    // 初回ロード時にデータを読み込む
    useEffect(() => {
          // パスコード設定の確認
                  const savedPasscode = localStorage.getItem('app_passcode');
          if (savedPasscode) {
                  setHasPasscode(true);
                  setIsLocked(true);
          } else {
                  setHasPasscode(false);
                  setIsLocked(true);
          }
          const savedExpenses = localStorage.getItem('expense_data');
          if (savedExpenses) {
                  setExpenses(JSON.parse(savedExpenses));
          }
          const savedUrl = localStorage.getItem('gas_app_url');
          if (savedUrl) {
                  setGasUrl(savedUrl);
          }
          const savedApiKey = localStorage.getItem('gemini_api_key');
          if (savedApiKey) {
                  setGeminiApiKey(savedApiKey);
          }
    }, []);

    // データ変更時に保存
    useEffect(() => {
          if (!isLocked) {
                  localStorage.setItem('expense_data', JSON.stringify(expenses));
          }
    }, [expenses, isLocked]);

    const saveSettings = () => {
          localStorage.setItem('gas_app_url', gasUrl);
          localStorage.setItem('gemini_api_key', geminiApiKey);
          setShowSettings(false);
          setStatusMessage('設定を保存しました');
          setTimeout(() => setStatusMessage(''), 3000);
    };

    // パスコード関連の処理
    const handlePasscodeSubmit = (e) => {
          e.preventDefault();
          setPasscodeError('');
          if (!hasPasscode) {
                  if (inputPasscode.length < 4) {
                            setPasscodeError('4文字以上で設定してください');
                            return;
                  }
                  localStorage.setItem('app_passcode', inputPasscode);
                  setHasPasscode(true);
                  setIsLocked(false);
                  setInputPasscode('');
          } else {
                  const savedPasscode = localStorage.getItem('app_passcode');
                  if (inputPasscode === savedPasscode) {
                            setIsLocked(false);
                            setInputPasscode('');
                  } else {
                            setPasscodeError('パスコードが間違っています');
                  }
          }
    };

    const handleFileChange = (e) => {
          const file = e.target.files[0];
          if (!file) return; // ファイルが選択されなかった場合（キャンセル時）は何もしない

          const reader = new FileReader();

          reader.onloadend = () => {
                  const base64Data = reader.result;
                  if (!base64Data) {
                            // 読み込み結果が空の場合は処理を中断
                    console.error('FileReader result is empty');
                            setStatusMessage('画像の読み込みに失敗しました。もう一度お試しください。');
                            setTimeout(() => setStatusMessage(''), 3000);
                            return;
                  }
                  setCurrentImage(base64Data);
                  if (geminiApiKey) {
                            analyzeReceiptWithGemini(base64Data);
                  } else {
                            simulateAIProcessing();
                  }
          };

          reader.onerror = () => {
                  // 読み込みエラー時のハンドリング
                  console.error('FileReader error:', reader.error);
                  setStatusMessage('画像の読み込みに失敗しました。もう一度お試しください。');
                  setTimeout(() => setStatusMessage(''), 3000);
          };

          reader.readAsDataURL(file);

          // input のvalueをリセットして、同じファイルを再選択できるようにする
          e.target.value = '';
    };

    // Gemini APIを使用した領収書解析
    const analyzeReceiptWithGemini = async (base64Data) => {
          setIsProcessing(true);
          setStatusMessage('Geminiで解析中...');
          try {
                  const content = base64Data.split(',')[1];
                  const mimeType = base64Data.split(';')[0].split(':')[1];
                  const MODEL_NAME = 'gemini-2.5-flash';
                  const prompt = `
                  この領収書（画像またはPDF）を解析し、以下の情報をJSON形式で抽出してください。
                  出力フォーマット:
                  {
                    "date": "YYYY-MM-DD", (日付不明な場合は今日の日付)
                      "amount": 数値 (円マークやカンマは除く),
                        "vendor": "店名または会社名",
                          "category": "費目 (消耗品費, 旅費交通費, 交際費, 会議費, 通信費, その他 から選択)",
                            "description": "内容の短い要約"
                            }
                            余計なマークダウン記法（\`\`\`jsonなど）は含めず、純粋なJSONテキストのみを返してください。
                            `;
                  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                        contents: [{
                                                      parts: [
                                                        { text: prompt },
                                                        { inline_data: { mime_type: mimeType, data: content } }
                                                                    ]
                                        }]
                            })
                  });
                  const data = await response.json();
                  if (data.error) throw new Error(data.error.message);
                  let text = data.candidates[0].content.parts[0].text;
                  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                  const result = JSON.parse(text);
                  setFormData({
                            date: result.date || new Date().toISOString().split('T')[0],
                            amount: result.amount || '',
                            vendor: result.vendor || '',
                            category: result.category || '消耗品費',
                            description: result.description || ''
                  });
                  setStatusMessage('解析完了！');
          } catch (error) {
                  console.error('Gemini Analysis Error:', error);
                  alert(`解析に失敗しました: ${error.message}\nシミュレーションモードで実行します。`);
                  simulateAIProcessing();
          } finally {
                  setIsProcessing(false);
                  setTimeout(() => setStatusMessage(''), 3000);
          }
    };

    const simulateAIProcessing = () => {
          setIsProcessing(true);
          setTimeout(() => {
                  const mockData = {
                            date: new Date().toISOString().split('T')[0],
                            amount: Math.floor(Math.random() * 10000) + 100,
                            vendor: ['セブンイレブン', 'Amazon.co.jp', 'スターバックス', 'タクシー利用'][Math.floor(Math.random() * 4)],
                            category: ['消耗品費', '旅費交通費', '会議費', '通信費'][Math.floor(Math.random() * 4)],
                            description: '経費精算 (デモ)'
                  };
                  setFormData(mockData);
                  setIsProcessing(false);
          }, 2000);
    };

    const handleInputChange = (e) => {
          const { name, value } = e.target;
          setFormData(prev => ({ ...prev, [name]: value }));
    };

    const sendToSpreadsheet = async (data) => {
          if (!gasUrl) return true;
          try {
                  setIsUploading(true);
                  const response = await fetch(gasUrl, {
                            method: 'POST',
                            redirect: 'follow',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify(data)
                  });
                  if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
                  const result = await response.json();
                  return result.status === 'success';
          } catch (error) {
                  console.error("Upload failed", error);
                  let message = `スプレッドシートへの送信に失敗しました。\n\nエラー: ${error.message}`;
                  if (error.message.includes('Failed to fetch')) {
                            message += "\n\n【可能性が高い原因】\nGASの公開設定が「全員」になっていない可能性があります。\nGAS画面で「デプロイ」>「デプロイを管理」を確認してください。";
                  }
                  alert(message);
                  return false;
          } finally {
                  setIsUploading(false);
          }
    };

    const handleSave = async (e) => {
          e.preventDefault();
          if (!formData.amount || !formData.date) return;
          const newExpense = { id: Date.now(), ...formData, imagePreview: currentImage };
          let success = true;
          if (gasUrl) {
                  setStatusMessage('スプレッドシートに送信中...');
                  success = await sendToSpreadsheet(newExpense);
          }
          setExpenses([newExpense, ...expenses]);
          if (gasUrl && !success) {
                  setStatusMessage('送信失敗 (ローカルにのみ保存)');
          } else {
                  setShowSuccess(true);
                  setStatusMessage(gasUrl ? '送信・保存完了！' : '保存完了！');
          }
          setCurrentImage(null);
          setFormData({ date: '', amount: '', vendor: '', category: '消耗品費', description: '' });
          setTimeout(() => {
                  setShowSuccess(false);
                  setStatusMessage('');
          }, 3000);
    };

    const handleDelete = (id) => {
          setExpenses(expenses.filter(item => item.id !== id));
    };

    const downloadCSV = () => {
          if (expenses.length === 0) return;
          const headers = ['日付', '支払先', '費目', '金額', 'メモ', 'ファイル(Base64)'];
          const csvContent = [
                  headers.join(','),
                  ...expenses.map(item => [
                            item.date,
                            `"${item.vendor}"`,
                            item.category,
                            item.amount,
                            `"${item.description}"`,
                            `"${item.imagePreview ? 'あり' : 'なし'}"`
                          ].join(','))
                ].join('\n');
          const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `経費精算_${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
    };

    const triggerCamera = () => {
          if (fileInputRef.current) {
                  fileInputRef.current.value = ''; // 同じファイルの再選択を可能にする
            fileInputRef.current.click();
          }
    };

    const isPdf = (dataUrl) => dataUrl && dataUrl.startsWith('data:application/pdf');

    // --- ロック画面 ---
    if (isLocked) {
          return (
                  <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-6 text-white">
                          <div className="w-full max-w-sm bg-white text-gray-800 rounded-2xl shadow-xl p-8 text-center">
                                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                      {hasPasscode ? <Lock className="w-8 h-8" /> : <KeyRound className="w-8 h-8" />}
                                    </div>div>
                                    <h2 className="text-2xl font-bold mb-2">
                                      {hasPasscode ? 'ロック解除' : 'パスコード設定'}
                                    </h2>h2>
                                    <p className="text-gray-500 mb-6 text-sm">
                                      {hasPasscode ? 'アプリを使用するにはパスコードを入力してください。' : 'セキュリティのため、自分用のパスコードを設定してください。'}
                                    </p>p>
                                    <form onSubmit={handlePasscodeSubmit} className="space-y-4">
                                                <input
                                                                type="password"
                                                                pattern="[0-9]*"
                                                                inputMode="numeric"
                                                                maxLength="8"
                                                                value={inputPasscode}
                                                                onChange={(e) => setInputPasscode(e.target.value)}
                                                                placeholder="パスコード"
                                                                className="w-full text-center text-2xl tracking-widest p-3 border-2 border-indigo-100 rounded-xl focus:border-indigo-500 focus:outline-none bg-gray-50"
                                                                autoFocus
                                                              />
                                      {passcodeError && (
                                  <p className="text-red-500 text-sm font-bold animate-pulse">{passcodeError}</p>p>
                                                )}
                                                <button
                                                                type="submit"
                                                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                                                              >
                                                  {hasPasscode ? <Unlock className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                                                  {hasPasscode ? '解除する' : '設定して開始'}
                                                </button>button>
                                    </form>form>
                                    <p className="mt-6 text-xs text-gray-400">Smart Expense Tracker</p>p>
                          </div>div>
                  </div>div>
                );
    }
  
    // --- メインアプリ画面 ---
    return (
          <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-24 md:pb-0 relative">
            {/* Settings Modal */}
            {showSettings && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                                          <div className="flex justify-between items-center mb-4">
                                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                                                        <Settings className="w-5 h-5" /> 設定
                                                        </h3>h3>
                                                        <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                                                                        <X className="w-6 h-6" />
                                                        </button>button>
                                          </div>div>
                                          <div className="space-y-6">
                                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                                                        <label className="block text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                                                                                          <Sparkles className="w-4 h-4 text-blue-600" /> Gemini API設定 (AI解析用)
                                                                        </label>label>
                                                                        <p className="text-xs text-gray-600 mb-2">
                                                                                          画像/PDFから文字を読み取るために必要です。<br />
                                                                                          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                                                                                              Google AI Studioでキーを取得
                                                                                            </a>a>
                                                                        </p>p>
                                                                        <input
                                                                                            type="password"
                                                                                            placeholder="AIzaSy..."
                                                                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                                                                            value={geminiApiKey}
                                                                                            onChange={(e) => setGeminiApiKey(e.target.value)}
                                                                                          />
                                                        </div>div>
                                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                                        <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                                                                                          <ExternalLink className="w-4 h-4" /> スプレッドシート連携 (GAS URL)
                                                                        </label>label>
                                                                        <p className="text-xs text-gray-500 mb-2">保存時にスプレッドシートへ送信するためのウェブアプリURL。</p>p>
                                                                        <input
                                                                                            type="url"
                                                                                            placeholder="https://script.google.com/macros/s/..."
                                                                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                                                                                            value={gasUrl}
                                                                                            onChange={(e) => setGasUrl(e.target.value)}
                                                                                          />
                                                        </div>div>
                                                        <div className="border-t pt-4">
                                                                        <p className="text-xs text-gray-500 mb-2">
                                                                                          パスコードを変更したい場合は、一度ブラウザの履歴(Local Storage)をクリアするか、以下のボタンでリセットしてください（データは消えませんが、再ログインが必要になります）。
                                                                        </p>p>
                                                                        <button
                                                                                            onClick={() => { localStorage.removeItem('app_passcode'); setHasPasscode(false); setIsLocked(true); }}
                                                                                            className="text-red-500 text-sm underline"
                                                                                          >
                                                                                          パスコードをリセットして再設定する
                                                                        </button>button>
                                                        </div>div>
                                                        <button
                                                                          onClick={saveSettings}
                                                                          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
                                                                        >
                                                                        設定を保存
                                                        </button>button>
                                          </div>div>
                              </div>div>
                    </div>div>
                )}
          
            {/* Header */}
                <header className="bg-indigo-600 text-white p-4 shadow-md sticky top-0 z-10">
                        <div className="max-w-2xl mx-auto flex justify-between items-center">
                                  <h1 className="text-xl font-bold flex items-center gap-2">
                                              <FileText className="w-6 h-6" /> スマート経費
                                  </h1>h1>
                                  <div className="flex items-center gap-2">
                                              <button
                                                              onClick={() => setShowSettings(true)}
                                                              className="p-2 hover:bg-indigo-500 rounded-full transition relative"
                                                              title="設定"
                                                            >
                                                            <Settings className="w-5 h-5" />
                                                {!geminiApiKey && activeTab === 'scan' && (
                                                                              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-400 rounded-full border border-indigo-600"></span>span>
                                                            )}
                                              </button>button>
                                    {activeTab === 'list' && (
                          <button
                                            onClick={downloadCSV}
                                            className="text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 rounded-full flex items-center gap-1 transition"
                                          >
                                          <Download className="w-4 h-4" /> CSV
                          </button>button>
                                              )}
                                  </div>div>
                        </div>div>
                </header>header>
          
                <main className="max-w-2xl mx-auto p-4">
                  {(showSuccess || statusMessage) && (
                      <div className={`mb-4 border px-4 py-3 rounded relative flex items-center gap-2 animate-bounce-short ${
                                    isUploading || isProcessing
                                      ? 'bg-blue-100 border-blue-400 text-blue-700'
                                      : 'bg-green-100 border-green-400 text-green-700'
                      }`}>
                        {(isUploading || isProcessing) ? (
                                      <div className="animate-spin h-4 w-4 border-2 border-blue-700 rounded-full border-t-transparent"></div>div>
                                    ) : (
                                      <CheckCircle className="w-5 h-5" />
                                    )}
                                  <span>{statusMessage || '処理が完了しました'}</span>span>
                      </div>div>
                        )}
                
                  {/* Scan View */}
                  {activeTab === 'scan' && (
                      <div className="space-y-6">
                        {!geminiApiKey && (
                                      <div
                                                        className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start gap-3 cursor-pointer hover:bg-yellow-100 transition"
                                                        onClick={() => setShowSettings(true)}
                                                      >
                                                      <Sparkles className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                      <div>
                                                                        <h4 className="text-sm font-bold text-yellow-800">AI解析が未設定です</h4>h4>
                                                                        <p className="text-xs text-yellow-700 mt-1">
                                                                                            Gemini APIキーを設定すると、領収書の文字を自動で読み取れます。タップして設定してください。
                                                                        </p>p>
                                                      </div>div>
                                      </div>div>
                                  )}
                      
                        {/* ファイル選択エリア（inputはここに1つだけ） */}
                                  <div className="bg-white rounded-xl shadow-sm p-6 text-center border-2 border-dashed border-gray-300 relative">
                                    {/* hidden file input - スマホカメラ対応のため capture属性を付与 */}
                                                <input
                                                                  type="file"
                                                                  accept="image/*,application/pdf"
                                                                  capture="environment"
                                                                  className="hidden"
                                                                  ref={fileInputRef}
                                                                  onChange={handleFileChange}
                                                                />
                                  
                                    {!currentImage ? (
                                        <div className="py-8 cursor-pointer" onClick={triggerCamera}>
                                                          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                                              <Camera className="w-10 h-10" />
                                                          </div>div>
                                                          <h3 className="text-lg font-semibold text-gray-700">ファイルを選択</h3>h3>
                                                          <p className="text-sm text-gray-500 mt-2">カメラ・画像・PDFに対応</p>p>
                                        </div>div>
                                      ) : (
                                        <div className="relative">
                                          {isPdf(currentImage) ? (
                                                              <div className="h-48 mx-auto rounded-lg shadow-sm bg-red-50 border border-red-100 flex flex-col items-center justify-center text-red-800">
                                                                                    <FileText className="w-16 h-16 text-red-500 mb-2" />
                                                                                    <p className="text-sm font-bold">PDFファイル</p>p>
                                                                                    <p className="text-xs opacity-70">プレビューできませんが解析可能です</p>p>
                                                              </div>div>
                                                            ) : (
                                                              <img src={currentImage} alt="Receipt Preview" className="max-h-64 mx-auto rounded-lg shadow-md" />
                                                            )}
                                                          <button
                                                                                onClick={() => setCurrentImage(null)}
                                                                                className="absolute top-2 right-2 bg-gray-900 bg-opacity-70 text-white p-1 rounded-full hover:bg-opacity-90"
                                                                              >
                                                                              <Trash2 className="w-5 h-5" />
                                                          </button>button>
                                          {isProcessing && (
                                                              <div className="absolute inset-0 bg-white bg-opacity-80 flex flex-col items-center justify-center rounded-lg">
                                                                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-2"></div>div>
                                                                                    <p className="text-indigo-600 font-bold animate-pulse">Gemini解析中...</p>p>
                                                                                    <p className="text-xs text-gray-500 mt-1">数秒お待ちください</p>p>
                                                              </div>div>
                                                          )}
                                        </div>div>
                                                )}
                                  </div>div>
                      
                                  <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                                                <div className="flex items-center gap-2 mb-2 justify-between">
                                                                <div className="flex items-center gap-2">
                                                                                  <AlertCircle className="w-5 h-5 text-indigo-500" />
                                                                                  <h3 className="font-bold text-gray-700">登録内容</h3>h3>
                                                                </div>div>
                                                  {gasUrl ? (
                                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                                                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>span> Sheet連携ON
                                          </span>span>
                                        ) : (
                                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Sheet連携OFF</span>span>
                                                                )}
                                                </div>div>
                                                <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1">
                                                                                  <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                                                                                      <Calendar className="w-3 h-3" /> 日付
                                                                                    </label>label>
                                                                                  <input
                                                                                                        type="date" name="date" required
                                                                                                        value={formData.date} onChange={handleInputChange}
                                                                                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                                                                                      />
                                                                </div>div>
                                                                <div className="space-y-1">
                                                                                  <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                                                                                      <DollarSign className="w-3 h-3" /> 金額 (円)
                                                                                    </label>label>
                                                                                  <input
                                                                                                        type="number" name="amount" required placeholder="0"
                                                                                                        value={formData.amount} onChange={handleInputChange}
                                                                                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                                                                                      />
                                                                </div>div>
                                                </div>div>
                                                <div className="space-y-1">
                                                                <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                                                                  <Store className="w-3 h-3" /> 支払先
                                                                </label>label>
                                                                <input
                                                                                    type="text" name="vendor" placeholder="例：セブンイレブン"
                                                                                    value={formData.vendor} onChange={handleInputChange}
                                                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                                                                  />
                                                </div>div>
                                                <div className="space-y-1">
                                                                <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                                                                  <Tag className="w-3 h-3" /> 費目
                                                                </label>label>
                                                                <select
                                                                                    name="category" value={formData.category} onChange={handleInputChange}
                                                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                                                                                  >
                                                                                  <option value="消耗品費">消耗品費</option>option>
                                                                                  <option value="旅費交通費">旅費交通費</option>option>
                                                                                  <option value="交際費">交際費</option>option>
                                                                                  <option value="会議費">会議費</option>option>
                                                                                  <option value="通信費">通信費</option>option>
                                                                                  <option value="その他">その他</option>option>
                                                                </select>select>
                                                </div>div>
                                                <div className="space-y-1">
                                                                <label className="text-xs font-bold text-gray-500">メモ</label>label>
                                                                <textarea
                                                                                    name="description" rows="2"
                                                                                    value={formData.description} onChange={handleInputChange}
                                                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                                                                                  ></textarea>textarea>
                                                </div>div>
                                                <button
                                                                  type="submit" disabled={isUploading}
                                                                  className={`w-full text-white py-3 rounded-lg font-bold shadow-md transition flex items-center justify-center gap-2 ${
                                                                                      isUploading ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'
                                                                  }`}
                                                                >
                                                  {isUploading ? (
                                                                                    <>
                                                                                                        <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>div>
                                                                                                        送信中...
                                                                                      </>>
                                                                                  ) : (
                                                                                    <>
                                                                                                        <Save className="w-5 h-5" /> 保存する
                                                                                      </>>
                                                                                  )}
                                                </button>button>
                                  </form>form>
                      </div>div>
                        )}
                
                  {/* List View */}
                  {activeTab === 'list' && (
                      <div className="space-y-4">
                                  <div className="flex justify-between items-center mb-2">
                                                <h2 className="text-lg font-bold text-gray-700">登録済み経費一覧</h2>h2>
                                                <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded-md">{expenses.length} 件</span>span>
                                  </div>div>
                        {expenses.length === 0 ? (
                                      <div className="text-center py-12 text-gray-400">
                                                      <p>まだ経費データがありません</p>p>
                                                      <button onClick={() => setActiveTab('scan')} className="mt-4 text-indigo-600 underline text-sm">
                                                                        領収書をスキャンする
                                                      </button>button>
                                      </div>div>
                                    ) : (
                                      <div className="grid gap-3">
                                        {expenses.map((expense) => (
                                                          <div key={expense.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
                                                            {expense.imagePreview ? (
                                                                                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                                                                    {isPdf(expense.imagePreview) ? (
                                                                                                              <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500">
                                                                                                                                          <File className="w-8 h-8" />
                                                                                                                </div>div>
                                                                                                            ) : (
                                                                                                              <img src={expense.imagePreview} alt="Receipt" className="w-full h-full object-cover" />
                                                                                                            )}
                                                                                    </div>div>
                                                                                ) : (
                                                                                  <div className="w-16 h-16 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-300">
                                                                                                          <FileText className="w-8 h-8" />
                                                                                    </div>div>
                                                                              )}
                                                                              <div className="flex-1 min-w-0">
                                                                                                    <div className="flex justify-between items-start">
                                                                                                                            <div>
                                                                                                                                                      <p className="text-xs text-gray-500 mb-0.5">{expense.date}</p>p>
                                                                                                                                                      <h4 className="font-bold text-gray-800 truncate">{expense.vendor || '支払先不明'}</h4>h4>
                                                                                                                              </div>div>
                                                                                                                            <p className="font-bold text-indigo-600">¥{Number(expense.amount).toLocaleString()}</p>p>
                                                                                                      </div>div>
                                                                                                    <div className="flex justify-between items-end mt-2">
                                                                                                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                                                                                                              {expense.category}
                                                                                                                              </span>span>
                                                                                                                            <button onClick={() => handleDelete(expense.id)} className="text-gray-400 hover:text-red-500 transition">
                                                                                                                                                      <Trash2 className="w-4 h-4" />
                                                                                                                              </button>button>
                                                                                                      </div>div>
                                                                              </div>div>
                                                          </div>div>
                                                        ))}
                                      </div>div>
                                  )}
                      </div>div>
                        )}
                </main>main>
          
            {/* Bottom Navigation */}
                <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 pb-safe md:pb-0 z-10">
                        <div className="max-w-2xl mx-auto flex justify-around">
                                  <button
                                                onClick={() => setActiveTab('scan')}
                                                className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-medium transition ${
                                                                activeTab === 'scan' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                              >
                                              <Camera className="w-6 h-6" /> スキャン
                                  </button>button>
                                  <div className="relative -top-5">
                                              <button
                                                              onClick={() => { setActiveTab('scan'); triggerCamera(); }}
                                                              className="bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-700 transition transform hover:scale-105"
                                                            >
                                                            <Plus className="w-6 h-6" />
                                              </button>button>
                                  </div>div>
                                  <button
                                                onClick={() => setActiveTab('list')}
                                                className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-medium transition ${
                                                                activeTab === 'list' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                              >
                                              <FileText className="w-6 h-6" /> 経費一覧
                                  </button>button>
                        </div>div>
                </nav>nav>
          
                <style>{`
                        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
                                @keyframes bounce-short {
                                          0%, 100% { transform: translateY(0); }
                                                    50% { transform: translateY(-5px); }
                                                            }
                                                                    .animate-bounce-short { animation: bounce-short 0.5s ease-in-out; }
                                                                          `}</style>style>
          </div>div>
        );
};

export default ExpenseTrackerApp;</></></div>
