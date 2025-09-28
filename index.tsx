import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
  const [workerUrl, setWorkerUrl] = useState<string>(() => localStorage.getItem('workerUrl') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);

  useEffect(() => {
    if (workerUrl) {
      localStorage.setItem('workerUrl', workerUrl);
    } else {
      localStorage.removeItem('workerUrl');
    }
  }, [workerUrl]);

  const handleTestConnection = async () => {
    if (!workerUrl) {
      setError("Vui lòng nhập URL của Cloudflare Worker.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Một câu hỏi đơn giản để kiểm tra
      const requestBody = {
        contents: [{
          parts: [{ text: "Explain why the sky is blue in one Vietnamese sentence." }]
        }],
        model: 'gemini-2.5-flash' // Sử dụng model text-only để kiểm tra đơn giản
      };

      const res = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        // Nếu API trả về lỗi, hiển thị thông tin lỗi đó
        throw new Error(data.error?.message || `Worker trả về lỗi HTTP ${res.status}`);
      }

      // Định dạng lại JSON để hiển thị đẹp hơn
      const formattedJson = JSON.stringify(data, null, 2);
      setResponse(formattedJson);

    } catch (e: any) {
      console.error("Lỗi khi kiểm tra kết nối:", e);
      setError(`Không thể kết nối hoặc xử lý yêu cầu. Lỗi: ${e.message}. Hãy kiểm tra lại URL, cấu hình CORS trên Worker, và Worker logs.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getStatus = () => {
      if (isLoading) return <div className="status is-loading">Đang gửi yêu cầu...</div>;
      if (error) return <div className="status is-error">{error}</div>;
      if (response) return <div className="status is-success">Kết nối thành công! Gemini đã trả về kết quả.</div>;
      return null;
  }

  return (
    <div className="container">
      <h1>Kiểm tra kết nối Gemini qua Worker</h1>
      <div className="form-group">
        <label htmlFor="worker-url">URL Cloudflare Worker</label>
        <input
          id="worker-url"
          type="url"
          placeholder="https://your-worker.your-name.workers.dev"
          value={workerUrl}
          onChange={(e) => setWorkerUrl(e.target.value.trim())}
        />
      </div>
      <button 
        className="test-button"
        onClick={handleTestConnection} 
        disabled={isLoading}
      >
        {isLoading ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
      </button>

      <div className="results-area">
        <h2>Trạng thái & Kết quả</h2>
        {getStatus()}
        {response && (
            <pre className="response-box">
                <code>{response}</code>
            </pre>
        )}
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
