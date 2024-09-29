'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

const API_URL = process.env.NEXT_PUBLIC_CHESS_API_URL || 'https://chess-bot-slni.onrender.com';

export default function ChessGame() {
    const [game, setGame] = useState<Chess | null>(null);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const chessboardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log('Chess API URL:', API_URL);
        
        const resetGameOnLoad = async () => {
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
                setLoading(false);
            } catch (error) {
                console.error('Error resetting game on load:', error);
                setLoading(false);
            }
        };

        resetGameOnLoad();

        // Keep-alive logic
        const interval = setInterval(() => {
            fetch(`${API_URL}/board`)
                .then(response => response.json())
                .catch(error => console.error('Error:', error));
        }, 5 * 60 * 1000); // 5 mins
        // Cleanup interval on component unmount
        return () => clearInterval(interval);

    }, []);

    const updateMoveHistory = (newMove: string, isPlayerMove: boolean) => {
        setMoveHistory(prev => {
            const updatedHistory = [...prev];
            if (isPlayerMove) {
                const moveNumber = Math.floor(updatedHistory.length) + 1;
                updatedHistory.push(`${moveNumber}.${newMove}`);
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
        return <div className="flex items-center justify-center h-screen">Loading... This may take up to a minute on the first load.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col xl:flex-row gap-8">
                <Card className="xl:w-1/2">
                    <CardContent className="p-6">
                        <div ref={chessboardRef} className="aspect-square w-full max-w-[120vh] mx-auto">
                            <Chessboard 
                                position={game.fen()} 
                                onPieceDrop={onDrop} 
                                arePiecesDraggable={!game.isGameOver()} 
                            />
                        </div>
                        <div className="mt-4 flex justify-center">
                            <Button onClick={resetGame} variant="outline" className="text-lg py-2 px-4">
                                Reset Game
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                
                <div className="xl:w-1/2 flex flex-col gap-8">
                    <Card className="border border-primary/30 shadow-md rounded-lg overflow-hidden xl:mt-5">
                        <CardHeader className="bg-primary/5 border-b border-primary/10 px-4">
                            <CardTitle className="text-2xl">Move History</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <ScrollArea className="h-[18vh] xl:h-[26vh]">
                                <div className="flex flex-wrap gap-2">
                                    {moveHistory.map((move, index) => (
                                        <span key={index} className="text-sm font-mono bg-secondary/20 px-2 py-1 rounded">
                                            {move}
                                        </span>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    
                    <Card className="border border-primary/30 shadow-md rounded-lg overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b border-primary/10 px-4">
                            <CardTitle className="text-2xl">About DanielBot</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pb-8">
                            <p className="text-lg text-muted-foreground mb-6">
                                DanielBot is a chess engine designed to play like me. It's trained on over 1,000,000 lichess games from players rated 1600-2000 and fine-tuned on my personal opening repertoire. Using a Convolutional Neural Network (CNN), it learns chess patterns and predicts future board states, mimicking my early game strategies.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button 
                                    asChild
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                >
                                    <a 
                                        href="https://www.chess.com/member/the-potato" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                    >
                                        My Chess.com profile
                                    </a>
                                </Button>
                                <Button 
                                    asChild
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                >
                                    <a 
                                        href="https://github.com/DanielF21/chess-bot/" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                    >
                                        See the source code on Github
                                    </a>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}