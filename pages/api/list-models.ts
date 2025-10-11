// pages/api/list-models.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    console.log('🔍 Fetching available Gemini models...');

    // Call the ListModels endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Failed to list models: ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    
    // Filter models that support generateContent
    const contentModels = data.models?.filter((model: any) => 
      model.supportedGenerationMethods?.includes('generateContent')
    ) || [];

    console.log('✅ Found models:', contentModels.map((m: any) => m.name).join(', '));

    res.status(200).json({
      success: true,
      totalModels: contentModels.length,
      models: contentModels.map((model: any) => ({
        name: model.name,
        displayName: model.displayName,
        description: model.description,
        supportedMethods: model.supportedGenerationMethods
      })),
      recommendation: 'Use the first model in the list for your gemini.ts file'
    });
  } catch (error: any) {
    console.error('❌ Error listing models:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}