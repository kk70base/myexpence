// ============================================================
// 差し替え用コード（スマート経費アプリ）
// 1) compressImage と定数はコンポーネントの外（import の下）に置く
// 2) handleFileChange / analyzeReceiptWithGemini はまるごと置き換え
// ============================================================

// ---------- コンポーネントの外に追加 ----------
// Lite優先（速い・混みにくい・レシートなら精度十分）→ 混んでたら次へ
const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];
const CATEGORIES = ['消耗品費', '旅費交通費', '交際費', '会議費', '通信費', 'その他'];
const RETRYABLE = [429, 500, 502, 503, 504];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// スマホ写真(数MB)をそのまま送ると遅い・失敗しやすいので長辺1600pxのJPEGに縮小
const compressImage = (dataUrl, maxSize = 1600, quality = 0.8) =>
  new Promise((resolve) => {
    if (!dataUrl.startsWith('data:image/')) return resolve(dataUrl); // PDFはそのまま
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl); // HEICなど描画できない形式は元データで送る
    img.src = dataUrl;
  });

// ---------- コンポーネント内：handleFileChange を置き換え ----------
const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onloadend = async () => {
    const data = await compressImage(reader.result);
    setCurrentImage(data);
    if (geminiApiKey) analyzeReceiptWithGemini(data);
    else simulateAIProcessing();
  };
  reader.readAsDataURL(file);
};

// ---------- コンポーネント内：analyzeReceiptWithGemini を置き換え ----------
const callGemini = async (model, body) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 思考モデルは15秒だと足りない
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey.trim() },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error?.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

const analyzeReceiptWithGemini = async (base64Data) => {
  setIsProcessing(true);
  setStatusMessage('Geminiで解析中...');

  const today = new Date().toISOString().split('T')[0];
  const [meta, content] = base64Data.split(',');
  const mimeType = meta.split(';')[0].split(':')[1];

  const prompt = `この領収書を読み取り、次のキーを持つJSONだけを返してください。
- date: "YYYY-MM-DD"（不明なら ${today}）
- amount: 税込合計金額の数値（円記号・カンマなし）
- vendor: 店名または会社名
- category: ${CATEGORIES.join(' / ')} のいずれか
- description: 内容の短い要約`;

  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: content } }] }],
    generationConfig: { responseMimeType: 'application/json' }, // JSON以外を返させない
  };

  try {
    let data = null;
    let lastError = null;

    outer: for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          data = await callGemini(model, body);
          break outer;
        } catch (err) {
          lastError = err;
          if (err.status === 404 || err.status === 400) break; // モデル名NG等 → 次のモデルへ
          if (err.status === 401 || err.status === 403) throw err; // APIキー問題はリトライ無意味
          if (err.name !== 'AbortError' && !RETRYABLE.includes(err.status)) throw err;
          setStatusMessage(`混雑中…再試行 (${model})`);
          await sleep(1500 * 2 ** attempt); // 1.5s → 3s → 6s
        }
      }
    }
    if (!data) throw lastError || new Error('解析できませんでした');

    // candidates が無い・ブロックされた場合も落ちないように
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts || [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('');
    if (!text) {
      throw new Error(`応答が空でした（${cand?.finishReason || data.promptFeedback?.blockReason || '理由不明'}）`);
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSONを読み取れませんでした');
    const result = JSON.parse(match[0]);

    const amount = Number(String(result.amount ?? '').replace(/[^\d.]/g, ''));
    setFormData((prev) => ({
      ...prev, // isDebit を保持
      date: /^\d{4}-\d{2}-\d{2}$/.test(result.date) ? result.date : today,
      amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : '',
      vendor: result.vendor || '',
      category: CATEGORIES.includes(result.category) ? result.category : 'その他',
      description: result.description || '',
    }));
    setStatusMessage('解析完了！');
  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    const msg =
      error.name === 'AbortError' ? '時間切れ（電波の良い場所で再試行してください）'
      : error.status === 401 || error.status === 403 ? 'APIキーが無効です。設定を確認してください'
      : error.status === 429 ? '無料枠の上限に達しました。少し時間を置いてください'
      : error.message;
    alert(`解析に失敗しました: ${msg}\n手動で入力してください。`);
  } finally {
    setIsProcessing(false);
    setTimeout(() => setStatusMessage(''), 3000);
  }
};
