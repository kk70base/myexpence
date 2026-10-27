import React, { useState, useEffect, useRef } from 'react';
import { Camera, FileText, Save, Download, Trash2, Plus, Calendar, DollarSign, Tag, Store, CheckCircle, AlertCircle, Settings, X, ExternalLink, Sparkles, File, Lock, Unlock, KeyRound } from 'lucide-react';

const ExpenseTrackerApp = () => {
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
  
  const [gasUrl, setGasUrl] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  const [formData, setFormData] = useState({
    date: '',
    amount: '',
    vendor: '',
    category: '消耗品費',
    description: '',
    isDebit: false
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
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
      if (savedUrl) setGasUrl(savedUrl);
      const savedApiKey = localStorage.getItem('gemini_api_key');
      if (savedApiKey) setGeminiApiKey(savedApiKey);
    } catch (e) {
      console.warn("初期データの読み込みに失敗しました", e);
    }
  }, []);

  useEffect(() => {
    if (!isLocked) {
      try {
        const saveableExpenses = expenses.map(expense => ({
          ...expense,
          imagePreview: null 
        }));
        localStorage.setItem('expense_data', JSON.stringify(saveableExpenses));
      } catch (e) {
        console.warn("ローカル保存に失敗しました:", e);
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
           const reducedExpenses = expenses.slice(0, Math.floor(expenses.length / 2)).map(expense => ({
             ...expense, imagePreview: null
           }));
           localStorage.setItem('expense_data', JSON.stringify(reducedExpenses));
           setExpenses(reducedExpenses);
           alert("端末の保存容量が上限に達したため、古い履歴を一部削除しました。");
        }
      }
    }
  }, [expenses, isLocked]);

  const saveSettings = () => {
    localStorage.setItem('gas_app_url', gasUrl);
    localStorage.setItem('gemini_api_key', geminiApiKey);
    setShowSettings(false);
    setStatusMessage('設定を保存しました');
    setTimeout(() => setStatusMessage(''), 3000);
  };

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
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result;
        setCurrentImage(base64Data);
        
        if (geminiApiKey) {
          analyzeReceiptWithGemini(base64Data);
        } else {
          simulateAIProcessing();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeReceiptWithGemini = async (base64Data) => {
    setIsProcessing(true);
    setStatusMessage('Geminiで解析中...');

    // 15秒でタイムアウト（無限くるくる防止）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const content = base64Data.split(',')[1];
      const mimeType = base64Data.split(';')[0].split(':')[1];

      // 公式エラー画面の指示通り、最新の正しいモデル名を指定
      const MODEL_NAME = 'gemini-3.8-flash';
      
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

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: content } }
            ]
          }]
        }),
        signal: controller.signal // タイムアウト設定を反映
      });

      clearTimeout(timeoutId); // 成功したらタイムアウト解除
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
        description: result.description || '',
        isDebit: formData.isDebit
      });
      
      setStatusMessage('解析完了！');
    } catch (error) {
      console.error('Gemini Analysis Error:', error);
      if (error.name === 'AbortError') {
        alert('解析に時間がかかりすぎたため中断しました。通信環境の良いところで再度お試しください。');
      } else {
        alert(`解析に失敗しました: ${error.message}\n手動で入力してください。`);
      }
    } finally {
      clearTimeout(timeoutId);
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
        description: '経費精算 (デモ)',
        isDebit: formData.isDebit
      };
      setFormData(mockData);
      setIsProcessing(false);
    }, 2000);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
      alert(`スプレッドシートへの送信に失敗しました。\nエラー: ${error.message}`); return false; } finally { setIsUploading(false); } };  const handleSave = async (e) => { e.preventDefault(); if (!formData.amount \vert{}\vert{} !formData.date) return;  const newExpense = { id: Date.now(), ...formData, imagePreview: null };  const dataToSend = { ...newExpense, imagePreview: currentImage };  let success = true; if (gasUrl) { setStatusMessage('送信中...'); success = await sendToSpreadsheet(dataToSend); }  setExpenses([newExpense, ...expenses]);  if (gasUrl && !success) { setStatusMessage('送信失敗 (履歴のみ保存)'); } else { setShowSuccess(true); setStatusMessage(gasUrl ? '送信完了！続けて登録できます' : '保存完了！'); }  setCurrentImage(null); setFormData({ date: '', amount: '', vendor: '', category: '消耗品費', description: '', isDebit: false }); if (fileInputRef.current) fileInputRef.current.value = '';  window.scrollTo({ top: 0, behavior: 'smooth' });  setTimeout(() => { setShowSuccess(false); setStatusMessage(''); }, 3000); };  const handleDelete = (id) => { setExpenses(expenses.filter(item => item.id !== id)); };  const downloadCSV = () => { if (expenses.length === 0) return; const headers = ['日付', '支払先', '費目', '金額', 'メモ']; const csvContent = [ headers.join(','), ...expenses.map(item => [ item.date, `"${item.vendor}"`, item.category, item.amount, `"${item.description}"` ].join(',')) ].join('\n');  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.setAttribute('download', `経費精算_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 同じ画像を選んでも無反応にならないよう onClick={(e) => e.target.value = null} を追加
  const triggerCamera = () => {
    fileInputRef.current.click();
  };

  if (isLocked) {
    return (
      <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm bg-white text-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            {hasPasscode ? <Lock className="w-8 h-8" /> : <KeyRound className="w-8 h-8" />}
          </div>
          <h2 className="text-2xl font-bold mb-2">{hasPasscode ? 'ロック解除' : 'パスコード設定'}</h2>
          <p className="text-gray-500 mb-6 text-sm">
            {hasPasscode ? 'パスコードを入力してください。' : 'セキュリティのため、パスコードを設定してください。'}
          </p>
          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <input type="password" pattern="[0-9]*" inputMode="numeric" maxLength="8" value={inputPasscode} onChange={(e) => setInputPasscode(e.target.value)} placeholder="パスコード" className="w-full text-center text-2xl tracking-widest p-3 border-2 border-indigo-100 rounded-xl focus:border-indigo-500 focus:outline-none bg-gray-50" autoFocus />
            {passcodeError && <p className="text-red-500 text-sm font-bold animate-pulse">{passcodeError}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2">
              {hasPasscode ? <Unlock className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {hasPasscode ? '解除する' : '設定して開始'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-24 md:pb-0 relative">
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5" /> 設定</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <label className="block text-sm font-bold text-gray-800 mb-1 flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-600" /> Gemini API設定</label>
                <input type="password" placeholder="AIzaSy..." className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} />
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2"><ExternalLink className="w-4 h-4" /> GAS ウェブアプリURL</label>
                <input type="url" placeholder="https://script.google.com/macros/s/..." className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white" value={gasUrl} onChange={(e) => setGasUrl(e.target.value)} />
              </div>
              <button onClick={saveSettings} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition">設定を保存</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-indigo-600 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" /> スマート経費</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-indigo-500 rounded-full transition relative">
              <Settings className="w-5 h-5" />
              {!geminiApiKey && activeTab === 'scan' && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-400 rounded-full border border-indigo-600"></span>}
            </button>
            {activeTab === 'list' && (
              <button onClick={downloadCSV} className="text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 rounded-full flex items-center gap-1 transition">
                <Download className="w-4 h-4" /> CSV
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {(showSuccess || statusMessage) && (
          <div className={`mb-4 border px-4 py-3 rounded relative flex items-center gap-2 animate-bounce-short ${
            isUploading || isProcessing ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-green-100 border-green-400 text-green-700'
          }`}>
            {(isUploading || isProcessing) ? <div className="animate-spin h-4 w-4 border-2 border-blue-700 rounded-full border-t-transparent"></div> : <CheckCircle className="w-5 h-5" />}
            <span className="font-bold">{statusMessage || '完了しました'}</span>
          </div>
        )}

        {activeTab === 'scan' && (
          <div className="space-y-6">
            {!geminiApiKey && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start gap-3 cursor-pointer hover:bg-yellow-100 transition" onClick={() => setShowSettings(true)}>
                <Sparkles className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-yellow-800">AI解析が未設定です</h4>
                  <p className="text-xs text-yellow-700 mt-1">タップしてAPIキーを設定してください。</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-6 text-center border-2 border-dashed border-gray-300 relative">
              {!currentImage ? (
                <div className="py-8 cursor-pointer" onClick={triggerCamera}>
                  <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4"><Camera className="w-10 h-10" /></div>
                  <h3 className="text-lg font-semibold text-gray-700">ファイルを選択</h3>
                  <p className="text-sm text-gray-500 mt-2">カメラ・画像・PDFに対応</p>
                  <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} onClick={(e) => e.target.value = null} />
                </div>
              ) : (
                <div className="relative">
                  <img src={currentImage} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-md object-contain" />
                  <button onClick={() => setCurrentImage(null)} className="absolute top-2 right-2 bg-gray-900 bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90"><Trash2 className="w-5 h-5" /></button>
                  {isProcessing && (
                    <div className="absolute inset-0 bg-white bg-opacity-80 flex flex-col items-center justify-center rounded-lg">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-2"></div>
                      <p className="text-indigo-600 font-bold animate-pulse">Gemini解析中...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2 justify-between">
                <div className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-indigo-500" /><h3 className="font-bold text-gray-700">登録内容</h3></div>
                <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${gasUrl ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {gasUrl && <span className="w-2 h-2 bg-green-500 rounded-full"></span>} {gasUrl ? 'Sheet連携ON' : '連携OFF'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> 日付</label>
                  <input type="date" name="date" required value={formData.date} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> 金額 (円)</label>
                  <input type="number" name="amount" required placeholder="0" value={formData.amount} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Store className="w-3 h-3" /> 支払先</label>
                <input type="text" name="vendor" placeholder="例：セブンイレブン" value={formData.vendor} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Tag className="w-3 h-3" /> 費目</label>
                <select name="category" value={formData.category} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="消耗品費">消耗品費</option>
                  <option value="旅費交通費">旅費交通費</option>
                  <option value="交際費">交際費</option>
                  <option value="会議費">会議費</option>
                  <option value="通信費">通信費</option>
                  <option value="その他">その他</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">メモ</label>
                <textarea name="description" rows="2" value={formData.description} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"></textarea>
              </div>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                <input type="checkbox" name="isDebit" checked={formData.isDebit} onChange={handleInputChange} className="w-5 h-5 rounded accent-indigo-600 cursor-pointer" />
                <span className="text-sm font-bold text-gray-700">デビットカードで支払い</span>
              </label>

              <button type="submit" disabled={isUploading} className={`w-full text-white py-4 rounded-xl font-bold shadow-md
