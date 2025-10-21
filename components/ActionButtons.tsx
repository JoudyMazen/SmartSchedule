import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { useRouter } from 'next/router';

interface ActionButtonsProps {
  onManageGroups: () => void;
  onGenerateAI: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onManageGroups,
  onGenerateAI,
  onRefresh,
  isLoading
}) => {
  const router = useRouter();

  const buttonStyle = {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
    color: 'white',
    padding: '8px 20px',
    fontSize: '0.9rem'
  };

  const secondaryButtonStyle = {
    background: '#b0c4d4',
    color: '#1e3a5f',
    padding: '8px 20px',
    fontSize: '0.9rem'
  };

  return (
    <Card className="border-0 shadow-sm h-100" style={{ background: '#f8f9fa' }}>
      <Card.Body>
        <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>
          Actions
        </h6>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            className="border-0 shadow-sm"
            style={buttonStyle}
            onClick={onManageGroups}
          >
            <i className="bi bi-gear me-2"></i>
            Manage Groups
          </Button>
          <Button
            className="border-0 shadow-sm"
            style={buttonStyle}
            onClick={() => router.push('/scheduleCommittee/EditSchedule')}
          >
            <i className="bi bi-pencil-square me-2"></i>
            Edit Schedule
          </Button>
          <Button
            className="border-0 shadow-sm"
            style={buttonStyle}
            onClick={onGenerateAI}
            disabled={isLoading}
          >
            <i className="bi bi-magic me-2"></i>
            Generate AI Schedule
          </Button>
          <Button
            className="border-0 shadow-sm"
            style={secondaryButtonStyle}
            onClick={onRefresh}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default ActionButtons;
