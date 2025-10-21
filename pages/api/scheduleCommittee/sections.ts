import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

interface SectionData {
  section_id: number;
  section_number: number;
  course_code: string;
  activity_type: string;
  capacity: number;
}

interface ApiResponse {
  success: boolean;
  sections?: SectionData[];
  message?: string;
  error?: string;
}

// GET - Fetch sections
async function handleGet(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const { level, course_codes } = req.query;

    if (!level) {
      return res.status(400).json({
        success: false,
        error: 'Level parameter is required'
      });
    }

    let query = `
  SELECT 
    s.section_id,
    s.section_number,
    s.course_code,
    s.activity_type,
    s.capacity
  FROM section s
  JOIN course c ON s.course_code = c.course_code
  WHERE c.level = $1
`;

    const params: any[] = [level];

    if (course_codes && typeof course_codes === 'string') {
      const codes = course_codes.split(',');
      query += ` AND s.course_code = ANY($2)`;
      params.push(codes);
    }

    query += ` ORDER BY s.course_code, s.section_number`;

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      sections: result.rows
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
  }
}

// PUT - Update section capacity
async function handlePut(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const { section_id, capacity } = req.body;

    if (!section_id || capacity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'section_id and capacity are required'
      });
    }

    if (capacity < 1 || capacity > 100) {
      return res.status(400).json({
        success: false,
        error: 'Capacity must be between 1 and 100'
      });
    }

    const query = `
      UPDATE section
      SET capacity = $1
      WHERE section_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [capacity, section_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Capacity updated successfully'
    });
  } catch (error) {
    console.error('Error updating section:', error);
    res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGet(req, res);
    case 'PUT':
      return handlePut(req, res);
    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`
      });
  }
}