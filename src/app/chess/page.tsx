'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

const API_URL = process.env.NEXT_PUBLIC_CHESS_API_URL || 'https://chess-bot-slni.onrender.com';

export default function ChessGame() {
    const [game, setGame] = useState<Chess | null>(null);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const chessboardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log('Chess API URL:', API_URL);
        
        // Retrieve move history from localStorage
        const savedMoveHistory = localStorage.getItem('moveHistory');
        if (savedMoveHistory) {
            setMoveHistory(JSON.parse(savedMoveHistory));
        }

        // API status check and initial board state fetch
        fetch(`${API_URL}/board`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Initial board state:', data);
                if (data.fen) {
                    setGame(new Chess(data.fen));
                } else {
                    setGame(new Chess());
                }
                setLoading(false);
            })
            .catch(error => {
                console.error('Error checking API status:', error);
                setLoading(false);
            });
    }, []);

    const updateMoveHistory = (newMove: string, isPlayerMove: boolean) => {
        setMoveHistory(prev => {
            const updatedHistory = [...prev];
            if (isPlayerMove) {
                const moveNumber = updatedHistory.length + 1;
                updatedHistory.push(`${moveNumber}. ${newMove}`);
            } else {
                updatedHistory[updatedHistory.length - 1] += ` ${newMove}`;
            }
            localStorage.setItem('moveHistory', JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    };

    const handleGameOver = () => {
        if (!game) return;
        if (game.isCheckmate()) {
            updateMoveHistory('Checkmate', false);
        } else if (game.isStalemate()) {
            updateMoveHistory('Stalemate', false);
        } else if (game.isDraw()) {
            updateMoveHistory('Draw', false);
        } else if (game.isThreefoldRepetition()) {
            updateMoveHistory('Threefold repetition', false);
        } else if (game.isInsufficientMaterial()) {
            updateMoveHistory('Insufficient material', false);
        }
    };

    const makeMove = useCallback(async (uciMove: string, sanMove: string) => {
        if (!game || game.isGameOver()) return;
        const fullUrl = `${API_URL}/move`;
        console.log('Full API URL:', fullUrl);
        console.log('Move being sent:', uciMove);
        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ move: uciMove }),
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
    
            const data = await response.json();
            console.log('API response:', data);
    
            if (data.error) {
                console.error('API Error:', data.error);
                updateMoveHistory(`Error: ${data.error}`, false);
            } else {
                const aiMove = game.move(data.ai_move);
                if (aiMove) {
                    updateMoveHistory(aiMove.san, false);
                    setGame(new Chess(game.fen()));
                    handleGameOver();
                } else {
                    updateMoveHistory('Error: Invalid move', false);
                }
            }
        } catch (error) {
            console.error('Detailed error:', error);
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            updateMoveHistory(`Error: ${errorMessage}`, false);
        }
    }, [game]);

    const onDrop = (sourceSquare: string, targetSquare: string) => {
        if (!game || game.isGameOver()) return false;
        const move = game.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: 'q', // always promote to a queen for simplicity
        });
    
        if (move === null) return false;
        console.log('Move object:', move);
        const uciMove = move.from + move.to + (move.promotion || '');
        console.log('UCI move:', uciMove);
        
        // Update the game state immediately after the player's move
        setGame(new Chess(game.fen()));
        updateMoveHistory(move.san, true);
        
        makeMove(uciMove, move.san);
        handleGameOver();
        return true;
    };

    const resetGame = async () => {
        try {
            const response = await fetch(`${API_URL}/reset`, { method: 'POST' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Reset response:', data);
            setGame(new Chess());
            setMoveHistory([]);
            localStorage.removeItem('moveHistory');
        } catch (error) {
            console.error('Error resetting game:', error);
            updateMoveHistory(`Error resetting game: ${error instanceof Error ? error.message : 'Unknown error'}`, false);
        }
    };

    if (loading || !game) {
        return <div>Loading...</div>;
    }

    return (
        <div className="flex w-full h-full">
            <div className="flex flex-col mr-10" ref={chessboardRef} style={{ height: '75vh', width: '75vh' }}>
                <div className="flex-1">
                    <Chessboard position={game.fen()} onPieceDrop={onDrop} arePiecesDraggable={!game.isGameOver()} />
                </div>
                <button 
                    onClick={resetGame}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Reset Game
                </button>
            </div>
            <div className="w-1/4 flex flex-col gap-4 mr-10" style={{ height: '75vh', width: '25vh' }}>
                <h2 className="text-xl font-semibold mb-2 items-center" style={{ fontSize: '30px' }}>Move History</h2>
                <div 
                    className="bg-gray-100 p-4 rounded-lg overflow-y-auto h-full"
                >
                    {moveHistory.map((move, index) => (
                        <div key={index} className="mb-1 text-2xl">{move}</div>
                    ))}
                </div>
            </div>
            <div className="w-1/4 flex flex-col gap-4 items-center " style={{ height: '75vh', width: '50vh', fontSize: '20x' }}> {/* Centered About Section */}
                <h2 className="text-xl font-semibold mb-2" style={{ fontSize: '30px' }}>About DanielBot</h2>
                <p className="text-center" style={{ fontSize: '20px' }}>
                DanielBot is a chess engine with the goal of playing like me (<a href="https://www.chess.com/member/the-potato" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">My Chess.com profile</a>). It is trained on a dataset of 1,000,000+ lichess games of players rated between 1600 and 2000, and fine-tuned on my personal opening repertoire. It utilizes a Convolutional Neural Network (CNN) architecture to learn chess patterns from numerous games and predict likely future board states, with a bias to mimick my early game strategies.</p>
                <div className="flex flex-col space-y-2"> 
                    <a href="https://github.com/DanielF21/chess-bot/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">See the source code on Github</a>
                </div>
            </div>
        </div>
    );
}