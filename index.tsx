// The original file content was invalid. Replaced with a functional React component
// that demonstrates the correct usage of the @google/genai SDK.
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
// Fix: Use correct import for GoogleGenAI as per guidelines.
import { GoogleGenAI } from "@google/genai";

const App = () => {
  const [generatedText, setGeneratedText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        // The API key must be obtained from process.env.API_KEY.
        if (!process.env.API_KEY) {
          setError("API_KEY environment variable not set.");
          return;
        }
        // Fix: Correctly initialize GoogleGenAI with a named apiKey parameter.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // Fix: Use ai.models.generateContent to generate text.
        const response = await ai.models.generateContent({
          // Fix: Use 'gemini-2.5-flash' model for general text tasks.
          model: 'gemini-2.5-flash',
          contents: 'why is the sky blue?',
        });

        // Fix: Extract text directly from the `text` property of the response.
        const text = response.text;
        setGeneratedText(text);
      } catch (e) {
        const err = e as Error;
        setError(err.message);
        console.error(e);
      }
    };
    run();
  }, []);

  return (
    <div>
      <h1>Gemini API Demo</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {generatedText ? (
        <pre>{generatedText}</pre>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
