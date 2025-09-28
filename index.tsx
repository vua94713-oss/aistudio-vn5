import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// ===================================================================
// CLOUDFLARE WORKER CODE
// ===================================================================
// Copy and paste this code into your Cloudflare Worker (e.g., worker.js).
// Make sure to set the GEMINI_API_KEY secret in your Worker's settings.
/*
  addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })

  async function handleRequest(request) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Get the API key from environment variables
    const GEMINI_API_KEY = self.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return new Response('API key not configured', { status: 500 });
    }

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`;
    
    // Read the body from the original request
    const body = await request.json();

    // Create a new request to the Gemini API
    const apiRequest = new Request(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Forward the request and get the response
    const apiResponse = await fetch(apiRequest);
    const responseBody = await apiResponse.text();

    // Create a new response to send back to the client
    const response = new Response(responseBody, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow requests from any origin
      }
    });

    return response;
  }

  function handleOptions(request) {
    // Set CORS headers for preflight requests
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
*/
// ===================================================================

const PROMPTS = {
  PALAROID: `Create an image taken with a Polaroid camera. The photo should look like a regular photo, without any clear subject or props. The photo should have a slight blur effect and consistent lighting source, like a flash in a dark room, spread throughout the photo. Do not alter the faces. Replace the background behind the person/people with a white curtain. If there are two people, the man should be squeezing the woman's cheek while wrinkling his nose, and the woman should be pouting. If there is one person, they should have a natural, candid expression.`,
  '3D hot trend': `Use the nano-banana model to create a 1/7 scale commercialized figure of the character in the illustration, in a realistic style and environment. Place the figure on a computer desk, using a circular transparent acrylic base without any text. On the computer screen, display the ZBrush modeling process of the figure. Next to the computer screen, place a BANDAI-style toy packaging box printed with the original artwork.`,
  'TEXT BO': `First, learn and analyze the illustration style from the provided image. Then, apply this learned style to the subject of the photo. Keep the original subject but transform the entire image into the new, learned art style.`,
  'NGẦU': `Create a Vertical portrait shot in 1080x1920 format, characterized by stark cinematic lighting and intense contrast. Captured with a slightly low, upward-facing angle that dramatizes the subject's jawline and neck, the composition evokes quiet dominance and sculptural elegance. The background is a deep, saturated crimson red, creating a bold visual clash with the model's luminous skin and dark wardrobe. Lighting is tightly directional, casting warm golden highlights on one side of the face while the other is in deep shadow.`
};

type StyleKey = keyof typeof PROMPTS;

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<{mimeType: string, data: string}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
        const data = result.split(',')[1];
        resolve({ mimeType, data });
    };
    reader.onerror = (error) => reject(error);
  });
};

const App = () => {
  const [uploadedImage, setUploadedImage] = useState<{file: File, base64: string, mimeType: string} | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StyleKey>('PALAROID');
  const [numVariations, setNumVariations] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const { mimeType, data } = await fileToBase64(file);
      setUploadedImage({file, base64: data, mimeType});
    }
  };
  
  const handleGenerate = async () => {
      if (!uploadedImage) {
          setError("Vui lòng tải ảnh lên trước.");
          return;
      }
      setIsLoading(true);
      setError(null);
      setGeneratedImages([]);
      setProgress(0);

      const promptText = PROMPTS[selectedStyle];
      const imagePart = {
          inlineData: {
              data: uploadedImage.base64,
              mimeType: uploadedImage.mimeType,
          },
      };

      const contents = {
          parts: [imagePart, { text: promptText }],
      };

      const successfulResults: string[] = [];

      // Generate images sequentially to provide better progress feedback
      for (let i = 0; i < numVariations; i++) {
        try {
            const res = await fetch('/api/generate', { // NOTE: This path should be proxied to your Cloudflare Worker URL
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents, // Corrected: pass the object directly
                    responseModalities: ['IMAGE', 'TEXT'], // Corrected: move to top-level
                })
            });

            if (!res.ok) {
                const errorBody = await res.text();
                console.error('API Error Response:', errorBody);
                throw new Error(`API request failed with status ${res.status}: ${errorBody}`);
            }

            const data = await res.json();
            const generatedImagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

            if (generatedImagePart) {
                successfulResults.push(`data:${generatedImagePart.inlineData.mimeType};base64,${generatedImagePart.inlineData.data}`);
            } else {
                console.error('No image data in API response:', data);
                // Attempt to find an error message from the API response
                const apiError = data.error?.message || JSON.stringify(data);
                throw new Error(`No image data in API response. Details: ${apiError}`);
            }
        } catch (err) {
            console.error(`Failed to generate image #${i + 1}:`, err);
        }
        
        // Update progress after each attempt (success or fail)
        setProgress(Math.round(((i + 1) / numVariations) * 100));
      }

      setGeneratedImages(successfulResults);

      if (successfulResults.length < numVariations) {
          setError(`Không thể tạo ${numVariations - successfulResults.length} ảnh. Vui lòng thử lại.`);
      }
      
      setIsLoading(false);
  };
  
  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  const downloadAll = () => {
    generatedImages.forEach((img, index) => {
      downloadImage(img, `generated-image-${index + 1}.png`);
    });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="loading-container card">
          <h3>Đang tạo ảnh, vui lòng chờ...</h3>
          <div className="progress-bar">
            <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="percentage">{progress}%</div>
          <p className="subtext">Quá trình này có thể mất một chút thời gian. Cảm ơn bạn đã kiên nhẫn!</p>
        </div>
      );
    }
    if (generatedImages.length > 0) {
      return (
        <div className="results-container card">
          <div className="results-header">
            <h2 className="section-title">Kết quả</h2>
            <button className="download-all-btn" onClick={downloadAll}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                Tải Tất Cả
            </button>
          </div>
          <div className="results-gallery">
            {generatedImages.map((imgSrc, index) => (
              <div className="result-image-wrapper" key={index}>
                <img src={imgSrc} alt={`Generated image ${index + 1}`} />
                <div className="result-image-overlay">
                  <span className="result-image-number">#{index + 1}</span>
                  <button className="download-btn" onClick={() => downloadImage(imgSrc, `generated-image-${index+1}.png`)}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="16" height="16"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
           <div className="generate-button-container">
                <button className="generate-button" onClick={() => { setGeneratedImages([]); setError(null); }}>
                    Tạo ảnh khác
                </button>
            </div>
        </div>
      );
    }

    return (
      <>
        <div className="card">
          <div className="segmented-control">
            <button>Tạo ảnh đơn</button>
            <button>Tạo hàng loạt</button>
            <button className="active">Tạo nhiều biến thể</button>
          </div>
        </div>

        <div className="card">
            <h2 className="section-title">1. Tải ảnh lên</h2>
            <div className="image-uploader">
                <div className="image-preview-container">
                    {uploadedImage ? (
                        <div className="image-preview">
                            <img src={`data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`} alt="Preview"/>
                            <button className="remove-image-btn" onClick={() => setUploadedImage(null)}>×</button>
                        </div>
                    ) : (
                        <label htmlFor="file-upload" className="upload-placeholder">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                           Ảnh 1
                        </label>
                    )}
                    <input id="file-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>
            </div>
        </div>

        <div className="card">
            <h2 className="section-title">2. Chọn style</h2>
            <div className="style-grid">
                {(Object.keys(PROMPTS) as StyleKey[]).map(style => (
                    <button 
                        key={style}
                        className={selectedStyle === style ? 'active' : ''}
                        onClick={() => setSelectedStyle(style)}
                    >
                        {style}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="card">
            <h2 className="section-title">3. Số lượng biến thể (tối đa 60)</h2>
            <div className="variation-counter">
                <button onClick={() => setNumVariations(v => Math.max(1, v - 1))}>-</button>
                <span className="count">{numVariations}</span>
                <button onClick={() => setNumVariations(v => Math.min(60, v + 1))}>+</button>
            </div>
        </div>

        <div className="generate-button-container">
          <button className="generate-button" onClick={handleGenerate} disabled={!uploadedImage}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>
            Bắt đầu tạo
          </button>
          <p className="generate-button-subtext">Sử dụng Key mặc định của trang web</p>
        </div>
      </>
    );
  };
  
  return (
    <div className="app-container">
        <header className="header">
            <h1>TẠO ẢNH TREND</h1>
        </header>
        {error && <div className="error-message">{error}</div>}
        {renderContent()}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);