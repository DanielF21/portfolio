'use client';

import React, { useState, useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

const SchemeInterpreter: React.FC = () => {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      const view = new EditorView({
        doc: code,
        extensions: [
          basicSetup,
          javascript(), // We'll use JavaScript highlighting as a fallback
          oneDark,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setCode(update.state.doc.toString());
            }
          }),
        ],
        parent: editorRef.current,
      });

      return () => {
        view.destroy();
      };
    }
  }, [code]); // Add 'code' to the dependency array

  const handleRunCode = async () => {
    try {
      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (data.error) {
        setOutput(`Error: ${data.error}`);
      } else {
        setOutput(data.result);
      }
    } catch (error) {
      setOutput('Error: Failed to interpret code');
    }
  };

  return (
    <div className="scheme-interpreter">
      <div ref={editorRef} className="mb-4" style={{ height: '200px' }} />
      <button 
        onClick={handleRunCode}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Run
      </button>
      <pre className="mt-4 p-4 bg-gray-100 rounded">{output}</pre>
    </div>
  );
};

export default SchemeInterpreter;