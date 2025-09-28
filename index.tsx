//
// NOTE: The previous code was a simple server-side demo that was incorrectly
// running on the client, causing the "API_KEY not set" error.
// This file has been restored to the full-featured, client-side image generation
// application that correctly communicates with a Cloudflare Worker proxy.
//

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const STYLES = {
  PALAROID: `Create an image taken with a Polaroid camera. The photo should look like a regular photo, without any clear subject or props. The photo should have a slight blur effect and consistent lighting source, like a flash in a dark room, spread throughout the photo. Do not alter the faces. Replace the background behind the two people with a white curtain. The man should be squeezing the woman's cheek while wrinkling his nose, and the woman should be pouting.`,
  '3D hot trend': `Use the nano-banana model to create a 1/7 scale commercialized figure of thecharacter in the illustration, in a realistic style and environment. Place the figure on a computer desk, using a circular transparent acrylic base without any text.On the computer screen, display the ZBrush modeling process of the figure. Next to the computer screen, place a BANDAI-style toy packaging box printed with the original artwork.`,
  'TEXT BO': `Normalmente dibujo un garabato así a las 3 horas más rápidas, usando Géminis se termina en segundos 🙃 El camino: - encontrar una foto de referencia como el estilo que deseas, si es posible más de 1 (Ej: 2da foto) - pedirle a Géminis que aprenda y analize primero el estilo de ilustración - pídele que aplique estilo tsb a la foto que quiere subir`,
  NGẦU: `Create a Vertical portrait shot in 1080x1920 format, characterized by stark cinematic lighting and intense contrast. Captured with a slightly low, upward-facing angle that dramatizes the subject's jawline and neck, the composition evokes quiet dominance and sculptural elegance. The background is a deep, saturated crimson red, creating a bold visual clash with the model's luminous skin and dark wardrobe. Lighting is tigaily directional, casting warm golden highlights on one side of the face while`,
};

type StyleKey = keyof typeof STYLES;

const App = () => {
  const [image, setImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<StyleKey>(
    Object.keys(STYLES)[0] as StyleKey
  );
  const [numVariations, setNumVariations] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workerStatus, setWorkerStatus] = useState<'pending' | 'online' | 'offline'>('pending');
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [workerUrl, setWorkerUrl] = useState<string>(() => localStorage.getItem('workerUrl') || '');

  useEffect(() => {
    if (workerUrl) {
      localStorage.setItem('workerUrl', workerUrl);
    } else {
      localStorage.removeItem('workerUrl');
    }
  }, [workerUrl]);

  useEffect(() => {
    const checkWorkerStatus = async () => {
      if (!workerUrl) {
        setWorkerStatus('offline');
        setWorkerError("Vui lòng nhập URL Cloudflare Worker của bạn để bắt đầu.");
        return;
      }
      try {
        setWorkerStatus('pending');
        setWorkerError(null);
        const response = await fetch(workerUrl, { method: 'OPTIONS' });
        if (response.ok || response.type === 'opaque' || response.status === 405) {
          setWorkerStatus('online');
          setWorkerError(null);
        } else {
          setWorkerStatus('offline');
          setWorkerError(`Worker trả về mã lỗi: ${response.status}. URL có đúng không?`);
        }
      } catch (e) {
        setWorkerStatus('offline');
        setWorkerError("Lỗi mạng hoặc CORS. Hãy chắc chắn Worker của bạn đã được cấu hình CORS đúng cách và URL là chính xác.");
        console.error(e);
      }
    };
    checkWorkerStatus();
  }, [workerUrl]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Vui lòng chỉ tải lên file ảnh (jpeg, png, webp).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImage(base64String);
        setImageMimeType(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImages = async () => {
    if (!image) {
      alert('Vui lòng tải ảnh lên trước.');
      return;
    }
    if (!workerUrl || workerStatus !== 'online') {
      alert('Vui lòng cấu hình và kết nối tới Worker trước.');
      return;
    }
    setIsLoading(true);
    setProgress(0);
    setResults([]);
    setError(null);

    const generated: string[] = [];

    try {
        for (let i = 0; i < numVariations; i++) {
            const prompt = STYLES[selectedStyle];
            
            const requestBody = {
              model: 'gemini-2.5-flash-image-preview',
              contents: {
                parts: [
                  { inlineData: { data: image, mimeType: imageMimeType } },
                  { text: prompt },
                ],
              },
              config: {
                responseModalities: ['IMAGE', 'TEXT'],
              }
            };

            const response = await fetch(workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new Error(`Lỗi từ API: ${errorData.error?.message || 'Không rõ nguyên nhân'}`);
            }

            const data = await response.json();
            
            const imagePart = data.candidates?.[0]?.content?.parts?.find(
                (p: any) => p.inlineData
            );
            
            if (imagePart) {
                generated.push(imagePart.inlineData.data);
                setResults([...generated]);
            } else {
                 throw new Error('Không tìm thấy dữ liệu ảnh trong phản hồi của API.');
            }

            setProgress(Math.round(((i + 1) / numVariations) * 100));
        }
    } catch (e: any) {
        console.error(e);
        setError(`Không thể tạo ${numVariations - generated.length} ảnh. Lỗi: ${e.message}. Vui lòng thử lại.`);
    } finally {
        setIsLoading(false);
    }
  };

  const downloadImage = (base64Image: string, index: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Image}`;
    link.download = `ketqua_${selectedStyle}_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const downloadAll = () => {
     results.forEach(downloadImage);
  };


  return (
    <div className="container">
      <header>
        <div className="header-icons">
          <span>🌙</span>
          <span>⚙️</span>
        </div>
        <h1>TẠO ẢNH TREND</h1>
      </header>

      <main>
        <div className="card">
          <p className="section-title">0. Cấu hình Worker</p>
          <input
            type="url"
            className="url-input"
            placeholder="https://your-worker.your-name.workers.dev"
            value={workerUrl}
            onChange={(e) => setWorkerUrl(e.target.value.trim())}
            aria-label="Cloudflare Worker URL"
          />
          <small className="input-hint">
            Dán URL của Cloudflare Worker của bạn vào đây. URL này sẽ được lưu trên trình duyệt của bạn cho lần sau.
          </small>
        </div>
        
        <div className="card">
          <p className="section-title">1. Tải ảnh lên</p>
          <div className="upload-area">
            {image ? (
              <div className="image-preview-container">
                <img
                  src={`data:${imageMimeType};base64,${image}`}
                  alt="Preview"
                  className="image-preview"
                />
                <button
                  className="remove-image-btn"
                  onClick={() => {
                    setImage(null);
                    if(fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  aria-label="Xóa ảnh"
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                className="upload-placeholder"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: 'none' }}
                />
                <div className="upload-icon">↑</div>
                <span>Ảnh 1</span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <p className="section-title">2. Chọn style</p>
          <div className="style-selector">
            {(Object.keys(STYLES) as StyleKey[]).map((style) => (
              <button
                key={style}
                className={`style-btn ${selectedStyle === style ? 'active' : ''}`}
                onClick={() => setSelectedStyle(style)}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="section-title">3. Số lượng biến thể (tối đa 10)</p>
          <div className="variation-selector">
            <button
              onClick={() => setNumVariations(Math.max(1, numVariations - 1))}
              aria-label="Giảm số lượng"
            >
              −
            </button>
            <input
              type="text"
              value={numVariations}
              readOnly
              aria-label="Số lượng biến thể hiện tại"
            />
            <button
              onClick={() => setNumVariations(Math.min(10, numVariations + 1))}
              aria-label="Tăng số lượng"
            >
              +
            </button>
          </div>
        </div>
        
        <div className="action-section">
          <button className="generate-btn" onClick={generateImages} disabled={isLoading || !image || workerStatus !== 'online'}>
            ⚡ Bắt đầu tạo
          </button>
            <div className={`worker-status status-${workerStatus}`}>
                {workerStatus === 'pending' && 'Đang kiểm tra Worker...'}
                {workerStatus === 'online' && 'Worker sẵn sàng'}
                {workerStatus === 'offline' && <><b>{workerUrl ? 'Không thể kết nối Worker.' : 'Worker chưa được cấu hình.'}</b><br/> <small>{workerError}</small></>}
            </div>
        </div>


        {isLoading && (
            <div className="card loading-section">
                <p>Đang tạo ảnh, vui lòng chờ...</p>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="progress-text">{progress}%</p>
                <p className="loading-note">Quá trình này có thể mất một chút thời gian. Cảm ơn bạn đã kiên nhẫn!</p>
            </div>
        )}

        {error && <div className="card error-message"><p>{error}</p></div>}

        {results.length > 0 && !isLoading && (
            <div className="results-section">
                <div className="results-header">
                    <h2>Kết quả</h2>
                    <button className="download-all-btn" onClick={downloadAll}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                        </svg>
                        Tải Tất Cả
                    </button>
                </div>
                <div className="results-grid">
                    {results.map((b64, index) => (
                        <div key={index} className="result-item">
                            <img src={`data:image/png;base64,${b64}`} alt={`Kết quả ${index + 1}`}/>
                            <div className="result-overlay">
                                <span>#{index + 1}</span>
                                <button className="download-btn" onClick={() => downloadImage(b64, index)} aria-label={`Tải ảnh ${index + 1}`}>
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </main>

      <footer>
        <p>📞 LIÊN HỆ NGAY để được hướng dẫn 🟢</p>
      </footer>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
