import React from 'react';
import { Card, Form } from 'react-bootstrap';

interface LevelSelectorProps {
  selectedLevel: number;
  onLevelChange: (level: number) => void;
}

const levels = [3, 4, 5, 6, 7, 8];

const LevelSelector: React.FC<LevelSelectorProps> = ({ selectedLevel, onLevelChange }) => {
  return (
    <Card className="border-0 shadow-sm h-100" style={{ background: '#f8f9fa' }}>
      <Card.Body>
        <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>
          Select Level
        </h6>
        <Form.Select
          value={selectedLevel}
          onChange={(e) => onLevelChange(parseInt(e.target.value))}
          className="border-2"
          style={{
            borderColor: '#87CEEB',
            color: '#1e3a5f',
            fontSize: '0.95rem'
          }}
        >
          {levels.map(level => (
            <option key={level} value={level}>
              Level {level}
            </option>
          ))}
        </Form.Select>
      </Card.Body>
    </Card>
  );
};

export default LevelSelector;
