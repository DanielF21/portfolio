'use client';

import React from 'react';
import Link from 'next/link';

const SDControlNetPage: React.FC = () => {
  const pdfUrl = '/Stable_Diffusion_Paper.pdf';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Enhancing Stable Diffusion with ControlNet</h1>
      
      <div className="mb-8 p-6 bg-gray-100 text-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-2">TL;DR</h2>
        <p className="italic text-xl">
          In this paper, I propose a novel approach to enhance Stable Diffusion models using ControlNets trained on colored edge maps. By leveraging both structural and color information, my method aims to generate images with improved fidelity to the original structure and color characteristics.
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

export default SDControlNetPage;
