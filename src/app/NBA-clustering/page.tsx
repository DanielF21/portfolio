'use client';

import React from 'react';
import Link from 'next/link';

const NBAClusteringPage: React.FC = () => {
  const pdfUrl = '/NBA_clustering.pdf';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Performance-Based NBA Clustering</h1>
      
      <div className="mb-8 p-6 bg-gray-100 text-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-2">TL;DR</h2>
        <p className="italic text-xl">
        This paper presents a novel approach to categorizing NBA players by utilizing advanced statistical methods, including multidimensional scaling and k-means clustering, to identify player types beyond the traditional five positions. By analyzing a comprehensive dataset of player statistics, the study aims to enhance team management and strategy formulation through improved player clustering, ultimately providing insights that can influence player development and game tactics.
        </p>
      </div>

      <div className="mb-4">
        <Link href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          Download PDF
        </Link>
      </div>

      <div className="w-full" style={{ height: '80vh' }}> {/* Adjust the height as needed */}
        <iframe
          src={`${pdfUrl}#view=FitH`}
          className="w-full h-full"
          title="SD-ControlNet Paper"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
};

export default NBAClusteringPage;
