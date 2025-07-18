import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

interface ProcessingState {
  isProcessing: boolean;
  step: string;
  error: string | null;
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    step: '',
    error: null
  });
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [notionPageUrl, setNotionPageUrl] = useState<string>('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setProcessingState({ isProcessing: false, step: '', error: null });
      setExtractedContent('');
      setNotionPageUrl('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp']
    },
    multiple: false
  });

  const processImage = async () => {
    if (!selectedFile) return;

    setProcessingState({ isProcessing: true, step: 'Converting image to text...', error: null });

    try {
      // Convert image to base64
      const base64Image = await fileToBase64(selectedFile);
      
      // Call OpenAI API to extract text from image
      const openaiResponse = await axios.post('/api/extract-text', {
        image: base64Image,
        filename: selectedFile.name
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const extractedText = openaiResponse.data.text;
      setExtractedContent(extractedText);
      setProcessingState({ isProcessing: true, step: 'Creating Notion page...', error: null });

      // Create Notion page
      const notionResponse = await axios.post('/api/create-notion-page', {
        title: `Image Analysis - ${selectedFile.name}`,
        content: extractedText,
        originalImage: base64Image
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setNotionPageUrl(notionResponse.data.pageUrl);
      setProcessingState({ isProcessing: false, step: 'Completed!', error: null });

    } catch (error: any) {
      console.error('Error processing image:', error);
      setProcessingState({
        isProcessing: false,
        step: '',
        error: error.response?.data?.error || error.message || 'An error occurred'
      });
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 string
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedContent('');
    setNotionPageUrl('');
    setProcessingState({ isProcessing: false, step: '', error: null });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Image to Text to Notion</h1>
        <p>Upload an image to extract text and create a Notion page</p>
      </header>

      <main className="App-main">
        <div className="upload-section">
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop the image here...</p>
            ) : (
              <div>
                <p>Drag & drop an image here, or click to select</p>
                <p className="file-types">Supports: JPEG, PNG, GIF, BMP, WebP</p>
              </div>
            )}
          </div>
        </div>

        {selectedFile && (
          <div className="file-preview">
            <h3>Selected File: {selectedFile.name}</h3>
            <div className="preview-container">
              <img src={previewUrl!} alt="Preview" className="image-preview" />
              <div className="file-actions">
                <button 
                  onClick={processImage} 
                  disabled={processingState.isProcessing}
                  className="process-btn"
                >
                  {processingState.isProcessing ? 'Processing...' : 'Process Image'}
                </button>
                <button onClick={removeFile} className="remove-btn">
                  Remove File
                </button>
              </div>
            </div>
          </div>
        )}

        {processingState.isProcessing && (
          <div className="processing-status">
            <div className="spinner"></div>
            <p>{processingState.step}</p>
          </div>
        )}

        {processingState.error && (
          <div className="error-message">
            <p>Error: {processingState.error}</p>
          </div>
        )}

        {extractedContent && (
          <div className="extracted-content">
            <h3>Extracted Content:</h3>
            <div className="content-box">
              <pre>{extractedContent}</pre>
            </div>
          </div>
        )}

        {notionPageUrl && (
          <div className="notion-result">
            <h3>✅ Notion Page Created!</h3>
            <a 
              href={notionPageUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="notion-link"
            >
              View in Notion
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
