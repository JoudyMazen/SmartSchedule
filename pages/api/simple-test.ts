// pages/api/simple-test.ts
// Ultra-simple test to see exact error

import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  try {
    console.log('Testing with minimal request...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Hello"
            }]
          }]
        })
      }
    );

    const text = await response.text();
    
    console.log('Status:', response.status);
    console.log('Response:', text);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        status: response.status,
        statusText: response.statusText,
        body: text,
        note: 'Check the server console for full details'
      });
    }

    const data = JSON.parse(text);
    
    res.status(200).json({
      success: true,
      message: 'Working!',
      response: data.candidates[0].content.parts[0].text
    });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}