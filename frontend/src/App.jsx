// File: frontend/src/App.jsx
import React, { useState, useRef } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

function App() {
  const [figmaFile, setFigmaFile] = useState(null);
  const [actualFile, setActualFile] = useState(null);
  const [figmaPreview, setFigmaPreview] = useState('');
  const [actualPreview, setActualPreview] = useState('');
  const [diffReport, setDiffReport] = useState('');
  const [diffImage, setDiffImage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const reportRef = useRef(null);
  const [expectedStyles, setExpectedStyles] = useState(null);
  const [computedStyles, setComputedStyles] = useState(null); 
  const [styleDiffReport, setStyleDiffReport] = useState('');

const [liveSelector, setLiveSelector] = useState('header');

const handleLiveExtract = async () => {
  if (!liveSelector) {
    alert('Please enter a selector.');
    return;
  }

  setIsLoading(true);

  try {
    const res = await axios.post('http://localhost:3001/extract-live-element', {
      selector: liveSelector,
      url: 'https://qa-auction.47billion.com/product/bespoke-silver-velvet-continental-settee?id=289713'
    });

    const { screenshotBase64, computedStyles } = res.data;

    const blob = await fetch(screenshotBase64).then(res => res.blob());
    const file = new File([blob], `${liveSelector}.png`, { type: 'image/png' });

    setActualFile(file);
    setActualPreview(URL.createObjectURL(file));

      
       setComputedStyles(computedStyles); 

    console.log('🎯 Extracted styles:', computedStyles);
  } catch (err) {
    console.error('❌ Error extracting element:', err);
    alert('Error extracting element from live site.');
  }

  setIsLoading(false);
};

const handleUpload = async () => {
  if (!figmaFile || !actualFile) {
    alert('Please upload both screenshots.');
    return;
  }

  const formData = new FormData();
  formData.append('figma', figmaFile);
  formData.append('actual', actualFile);

  setIsLoading(true);
  setDiffReport('');
  setDiffImage('');

  try {
    const res = await axios.post('http://localhost:3001/upload', formData);
    if (res.data) {
      setDiffReport(res.data.report);
      setDiffImage(res.data.diffImage);
    }
  } catch (err) {
    console.error('❌ Frontend Axios error:', err);
    alert('Error comparing images');
  }

  setIsLoading(false);
};




  const exportToPDF = async () => {
    if (!reportRef.current) return;

    const pdf = new jsPDF();
    const date = new Date().toLocaleString();
    const tempContainer = document.createElement('div');
    tempContainer.style.padding = '1rem';
    tempContainer.style.backgroundColor = '#fff';
    tempContainer.innerHTML = `<h2>AI Visual Diff Report</h2><p style="white-space:pre-wrap">${diffReport}</p><p>📅 Generated on: ${date}</p>`;
    document.body.appendChild(tempContainer);

    const canvas = await html2canvas(tempContainer);
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 10, 10, 190, 0);
    pdf.save(`ui-diff-report-${Date.now()}.pdf`);

    document.body.removeChild(tempContainer);
  };

  const dragDropStyle = {
    border: '2px dashed #339af0',
    padding: '1.25rem',
    borderRadius: '10px',
    textAlign: 'center',
    marginBottom: '1rem',
    backgroundColor: '#eef7ff',
    cursor: 'pointer',
    color: '#333'
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (type === 'figma') {
      setFigmaFile(file);
      setFigmaPreview(URL.createObjectURL(file));
    } else {
      setActualFile(file);
      setActualPreview(URL.createObjectURL(file));
    }
  };


const handleExpectedJsonUpload = (e) => {
  const file = e.target.files[0];
  if (!file || !file.name.endsWith('.json')) {
    alert('Please upload a valid .json file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      setExpectedStyles(parsed);
    } catch (err) {
      alert('Invalid JSON format.');
    }
  };
  reader.readAsText(file);
};

  const compareStyles = () => {
  if (!expectedStyles || !computedStyles) {
    alert('Both expected and actual styles are required.');
    return;
  }

  const diffs = [];

  for (const key in expectedStyles) {
    if (typeof expectedStyles[key] === 'object') continue; // Skip nested fields
    if (expectedStyles[key] !== computedStyles[key]) {
      diffs.push(`🟡 ${key} mismatch:\n   ➤ Expected: ${expectedStyles[key]}\n   ➤ Actual: ${computedStyles[key]}`);
    }
  }

  if (diffs.length === 0) {
    setStyleDiffReport('✅ No differences found. UI matches expected styles.');
  } else {
    setStyleDiffReport(diffs.join('\n\n'));
  }
};




  return (
    <div style={{ fontFamily: 'Segoe UI', background: 'linear-gradient(180deg, #f0f4ff 0%, #ffffff 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: '#fff', padding: '1rem 2rem', display: 'flex', alignItems: 'center', borderBottom: '2px solid #eee' }}>
        <img src="/logo.png" alt="Logo" style={{ height: 50, marginRight: 14 }} />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#007bff' }}>PixelProbe</h1>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#555' }}>Powered by 47 Billion</p>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 850 }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
  <input
    type="text"
    placeholder="Enter CSS selector (e.g., header, .nav, #logo)"
    value={liveSelector}
    onChange={(e) => setLiveSelector(e.target.value)}
    style={{
      flex: 1,
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '6px',
      fontSize: '1rem'
    }}
  />
  <button
    onClick={handleLiveExtract}
    style={{
      padding: '10px 20px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }}
  >
    🔍 Extract Element
  </button>
</div>
          <div style={dragDropStyle} onDrop={(e) => handleDrop(e, 'figma')} onDragOver={(e) => e.preventDefault()}>
            {figmaFile ? `✅ Figma Screenshot: ${figmaFile.name}` : '📥 Drag & Drop Figma Screenshot Here'}
          </div>
          <input type="file" accept="image/*" onChange={(e) => {
            const file = e.target.files[0];
            setFigmaFile(file);
            setFigmaPreview(URL.createObjectURL(file));
          }} style={{ marginBottom: '1rem' }} />

          {/* Expected JSON Upload */}
<div style={{ marginBottom: '1.5rem' }}>
  <label style={{ fontWeight: 'bold' }}>📂 Upload Expected Style JSON (Figma):</label>
  <input
    type="file"
    accept=".json"
    onChange={handleExpectedJsonUpload}
    style={{ marginTop: '0.5rem' }}
  />
</div>




          <div style={dragDropStyle} onDrop={(e) => handleDrop(e, 'actual')} onDragOver={(e) => e.preventDefault()}>
            {actualFile ? `✅ Actual Screenshot: ${actualFile.name}` : '📥 Drag & Drop Actual Screenshot Here'}
          </div>
          <input type="file" accept="image/*" onChange={(e) => {
            const file = e.target.files[0];
            setActualFile(file);
            setActualPreview(URL.createObjectURL(file));
          }} style={{ marginBottom: '1rem' }} />

          {/* Upload Expected Figma Styles JSON */}



          {figmaPreview && actualPreview && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ flex: 1 }}>
                <p style={{ textAlign: 'center' }}>Figma</p>
                <img src={figmaPreview} alt="Figma" style={{ width: '100%', borderRadius: 8, border: '1px solid #ccc' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ textAlign: 'center' }}>Actual</p>
                <img src={actualPreview} alt="Actual" style={{ width: '100%', borderRadius: 8, border: '1px solid #ccc' }} />
              </div>
            </div>
          )}

          {figmaPreview && actualPreview && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ textAlign: 'center', color: '#007bff' }}>🟰 Slide-by-Slide UI Comparison</h3>
              
               <ReactCompareSlider
      itemOne={
        <ReactCompareSliderImage
          src={figmaPreview}
          alt="Figma"
          style={{ height: 400, width: '100%', objectFit: 'contain', backgroundColor: '#fff' }}
        />
      }
      itemTwo={
        <ReactCompareSliderImage
          src={actualPreview}
          alt="Actual"
          style={{ height: 400, width: '100%', objectFit: 'contain', backgroundColor: '#fff' }}
        />
      }
    />
  </div>
)}
          <button onClick={handleUpload} style={{
            padding: '12px 24px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem', width: '100%', cursor: 'pointer'
          }}>
            Compare UI
          </button>

         <button
  onClick={compareStyles}
  style={{
    marginTop: '1rem',
    padding: '10px 24px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer'
  }}
>
  🧠 Compare Styles (JSON)
</button>

{styleDiffReport && (
  <div style={{
    marginTop: '1.5rem',
    backgroundColor: '#e8f5e9',
    padding: '1rem',
    borderRadius: '6px',
    whiteSpace: 'pre-wrap',
    color: '#2e7d32'
  }}>
    <strong>Style Comparison Report:</strong>
    <br />
    {styleDiffReport}
  </div>
)}

          {isLoading && <p style={{ marginTop: '1rem', textAlign: 'center' }}>⏳ Comparing images with AI...</p>}

          {diffReport && (
            <div ref={reportRef} style={{ marginTop: '2rem', backgroundColor: '#ffffff', borderLeft: '6px solid #007bff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 0 12px rgba(0,0,0,0.05)' }}>
              <h2 style={{ color: '#007bff' }}>🎯 AI Visual Diff Report</h2>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{diffReport}</pre>
            </div>
          )}

          {diffReport && (
            <button onClick={exportToPDF} style={{ marginTop: '1rem', padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1rem', cursor: 'pointer' }}>📤 Export Report to PDF</button>
          )}

          {diffImage && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ textAlign: 'center', color: '#007bff' }}>🖼 Pixel-Level Visual Diff</h3>
              <img src={diffImage} alt="Diff Image" style={{ width: '100%', maxWidth: '100%', borderRadius: 10, border: '2px solid #ccc' }} />
            </div>
          )}
        </div>
      </main>

      {expectedStyles && computedStyles && (
  <div style={{
    display: 'flex',
    gap: '2rem',
    marginTop: '2rem',
    backgroundColor: '#fff',
    padding: '1.5rem',
    borderRadius: '10px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
  }}>
    <div style={{ flex: 1 }}>
      <h3 style={{ color: '#007bff' }}>📄 Expected Styles (Figma)</h3>
     <pre style={{
  background: '#f0f0f0',
  padding: '1rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  maxHeight: '300px',
  overflowX: 'auto',
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
}}>
        {JSON.stringify(expectedStyles, null, 2)}
      </pre>
    </div>
    <div style={{ flex: 1 }}>
      <h3 style={{ color: '#28a745' }}>🧪 Actual Styles (Live DOM)</h3>
      <pre style={{
  background: '#f0f0f0',
  padding: '1rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  maxHeight: '300px',
  overflowX: 'auto',
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
}}>
        {JSON.stringify(computedStyles, null, 2)}
      </pre>
    </div>
  </div>
)}

      <footer style={{ backgroundColor: '#fff', padding: '1rem', textAlign: 'center', borderTop: '1px solid #ccc', fontSize: '0.85rem', color: '#777' }}>
        © 2025 PixelProbe QA Tools. Built by Piyush Soni
      </footer>
    </div>
  );
}

export default App;
