'use client';

import React, { useState, useRef, useEffect } from 'react';

// API URL - your Render API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://scheme-interpreter.onrender.com';

export default function SchemeInterpreter() {
    const [history, setHistory] = useState<string[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const inputRef = useRef<HTMLSpanElement>(null);
    const consoleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
        if (inputRef.current) {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(inputRef.current);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    }, [history, currentInput]);

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentInput.trim()) {
                try {
                    const response = await fetch(`${API_URL}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ input: currentInput.trim() }),
                    });
                    
                    const data = await response.json();
                    const cleanedOutput = data.output.replace(/^out>\s*/, '').trim();
                    setHistory(prev => [...prev, `in> ${currentInput}`, `out> ${cleanedOutput}`]);
                    setCurrentInput('');
                } catch (error) {
                    console.error('Error:', error);
                    setHistory(prev => [...prev, `in> ${currentInput}`, 'out> Error: Could not evaluate expression']);
                    setCurrentInput('');
                }
            }
        }
    };

    const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
        const text = (e.target as HTMLSpanElement).textContent || '';
        setCurrentInput(text);
    };

    return (
        <div className="p-4 w-full">
            <div className="mb-8 p-6 bg-gray-100 text-gray-800 rounded-lg shadow-md w-full">
                <section id="about" className="mb-4">
                    <h2 className="text-2xl font-semibold mb-2">What is Scheme?</h2>
                    <p>Scheme is a dialect of the Lisp programming language known for its simplicity and elegance. It's a functional language with a strong emphasis on recursion and higher-order functions. Scheme is often used for teaching programming concepts and as a foundation for other languages.</p>
                </section>
                
                <section id="interpreter" className="mb-4">
                    <h2 className="text-2xl font-semibold mb-2">About This Interpreter</h2>
                    <p>This Python-based interpreter provides a basic implementation of the Scheme language. It supports a subset of Scheme features, allowing you to explore the language's core concepts and syntax.</p>
                </section>
                
                <section id="features" className="mb-4">
                    <h2 className="text-2xl font-semibold mb-2">Supported Features</h2>
                    <ul className="list-disc pl-5">
                        <li>Basic Arithmetic: +, -, *, /</li>
                        <li>Comparison Operators: =, &lt;, &gt;, &lt;=, &gt;=</li>
                        <li>Boolean Values: #t, #f</li>
                        <li>Conditional Expressions: if, cond</li>
                        <li>Definitions: define</li>
                        <li>Lambda Expressions: lambda</li>
                        <li>Procedure Application: Function calls</li>
                        <li>Lists: Creation, manipulation, and access</li>
                        <li>Special Forms: quote, car, cdr, cons</li>
                    </ul>
                </section>
            </div>
            
            <div 
                className="bg-black text-green-400 p-6 h-[60vh] w-full overflow-auto mb-4 rounded-lg shadow-lg font-mono text-lg"
            >
                <div ref={consoleRef}>
                    {history.map((line, index) => (
                        <div key={index}>{line}</div>
                    ))}
                    <div className="flex">
                        <span className="mr-1">in{'>'}</span>
                        <span
                            ref={inputRef}
                            contentEditable
                            suppressContentEditableWarning
                            onKeyDown={handleKeyDown}
                            onInput={handleInput}
                            className="outline-none flex-1"
                        >
                            {currentInput}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}