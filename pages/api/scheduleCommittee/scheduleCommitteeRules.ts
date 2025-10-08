// pages/api/scheduleCommittee/scheduleCommitteeRules.ts
import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db'; // Use shared pool

interface SchedulingRule {
  rule_id: number;
  rule_name: string;
  rule_description: string;
  rule_type: string;
  is_active: boolean;
  created_at: string;
}

interface CreateRuleRequest {
  rule_name: string;
  rule_description: string;
  rule_type: string;
  is_active: boolean;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  rules?: SchedulingRule[];
  rule?: SchedulingRule;
  error?: string;
}

// GET - Fetch all rules
async function handleGet(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const { type } = req.query;
    
    let query = `
      SELECT rule_id, rule_name, rule_description, rule_type, is_active, created_at
      FROM scheduling_rule
    `;
    
    const params: any[] = [];
    
    if (type && typeof type === 'string') {
      query += ' WHERE rule_type = $1';
      params.push(type);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    
    res.status(200).json({
      success: true,
      rules: result.rows
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rules',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// POST - Create new rule
async function handlePost(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const { rule_name, rule_description, rule_type, is_active }: CreateRuleRequest = req.body;
    
    if (!rule_name || !rule_description || !rule_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rule_name, rule_description, rule_type'
      });
    }
    
    const validTypes = ['time_block', 'constraint', 'preference', 'distribution'];
    if (!validTypes.includes(rule_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rule_type. Must be one of: ' + validTypes.join(', ')
      });
    }
    
    const query = `
      INSERT INTO scheduling_rule (rule_name, rule_description, rule_type, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING rule_id, rule_name, rule_description, rule_type, is_active, created_at
    `;
    
    const result = await pool.query(query, [
      rule_name,
      rule_description,
      rule_type,
      is_active !== undefined ? is_active : true
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Rule created successfully',
      rule: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating rule',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// PUT - Update existing rule
async function handlePut(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const { id } = req.query;
    const { rule_name, rule_description, rule_type, is_active }: Partial<CreateRuleRequest> = req.body;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Rule ID is required'
      });
    }
    
    const checkQuery = 'SELECT rule_id FROM scheduling_rule WHERE rule_id = $1';
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }
    
    if (rule_type) {
      const validTypes = ['time_block', 'constraint', 'preference', 'distribution'];
      if (!validTypes.includes(rule_type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid rule_type. Must be one of: ' + validTypes.join(', ')
        });
      }
    }
    
    const query = `
      UPDATE scheduling_rule 
      SET rule_name = COALESCE($1, rule_name),
          rule_description = COALESCE($2, rule_description),
          rule_type = COALESCE($3, rule_type),
          is_active = COALESCE($4, is_active)
      WHERE rule_id = $5
      RETURNING rule_id, rule_name, rule_description, rule_type, is_active, created_at
    `;
    
    const result = await pool.query(query, [
      rule_name,
      rule_description,
      rule_type,
      is_active,
      id
    ]);
    
    res.status(200).json({
      success: true,
      message: 'Rule updated successfully',
      rule: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating rule',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// DELETE - Delete rule
async function handleDelete(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Rule ID is required'
      });
    }
    
    const query = 'DELETE FROM scheduling_rule WHERE rule_id = $1 RETURNING rule_name';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Rule "${result.rows[0].rule_name}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting rule',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    case 'PUT':
      return handlePut(req, res);
    case 'DELETE':
      return handleDelete(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      res.status(405).json({
        success: false,
        message: `Method ${method} Not Allowed`
      });
  }
}