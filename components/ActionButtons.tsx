import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { useRouter } from 'next/router';

interface ActionButtonsProps {
  onManageGroups: () => void;
  onGenerateAI: () => void;
  onPublishToFacultyStudents?: () => void;  // ✅ NEW
  onPublishToTeachingLoad?: () => void;     // ✅ NEW
  onPublishSchedule?: () => void;           // Keep for backward compatibility
  onIrregularStudents: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onManageGroups,
  onGenerateAI,
  onPublishToFacultyStudents,
  onPublishToTeachingLoad,
  onPublishSchedule,
  onIrregularStudents,
  onRefresh,
  isLoading
}) => {
  const router = useRouter();

  const buttonStyle = {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
    color: 'white',
    padding: '8px 20px',
    fontSize: '0.9rem',
    fontWeight: '600'
  };

  const secondaryButtonStyle = {
    background: '#b0c4d4',
    color: '#1e3a5f',
    padding: '8px 20px',
    fontSize: '0.9rem',
    fontWeight: '600'
  };

  const accentButtonStyle = {
    background: '#87CEEB',
    color: '#1e3a5f',
    padding: '8px 20px',
    fontSize: '0.9rem',
    fontWeight: '600'
  };

  return (
    <Card className="border-0 shadow-sm h-100" style={{ background: '#f8f9fa' }}>
      <Card.Body>
        <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>
          Actions
        </h6>
        <div className="d-flex gap-2 flex-wrap">
          {/* Manage Groups */}
          <Button
            className="border-0 shadow-sm"
            style={buttonStyle}
            onClick={onManageGroups}
            disabled={isLoading}
          >
            <i className="bi bi-gear me-2"></i>
            Manage Groups
          </Button>

          {/* Edit Schedule */}
          <Button
            className="border-0 shadow-sm"
            style={buttonStyle}
            onClick={() => router.push('/scheduleCommittee/EditSchedule')}
            disabled={isLoading}
          >
            <i className="bi bi-pencil-square me-2"></i>
            Edit Schedule
          </Button>

          {/* Generate AI Schedule */}
          <Button
            className="border-0 shadow-sm"
            style={buttonStyle}
            onClick={onGenerateAI}
            disabled={isLoading}
          >
            <i className="bi bi-magic me-2"></i>
            Generate AI Schedule
          </Button>

          {/* ✅ NEW: Publish to Teaching Load Committee - Sky Blue */}
          {(onPublishToTeachingLoad || onPublishSchedule) && (
            <Button
              className="border-0 shadow-sm"
              style={buttonStyle}
              onClick={onPublishToTeachingLoad || onPublishSchedule}
              disabled={isLoading}
            >
              <i className="bi bi-send me-2"></i>
              Send to Teaching Load
            </Button>
          )}

          {/* ✅ NEW: Publish to Faculty & Students - Dark Blue */}
          {(onPublishToFacultyStudents || onPublishSchedule) && (
            <Button
              className="border-0 shadow-sm"
              style={buttonStyle}
              onClick={onPublishToFacultyStudents || onPublishSchedule}
              disabled={isLoading}
            >
              <i className="bi bi-send me-2"></i>
              Publish to Faculty & Students
            </Button>
          )}

          {/* Irregular Students */}
          <Button
            className="border-0 shadow-sm"
            style={buttonStyle}
            onClick={onIrregularStudents}
            disabled={isLoading}
          >
            <i className="bi bi-person-exclamation me-2"></i>
            Irregular Students
          </Button>

          {/* Refresh */}
          <Button
            className="border-0 shadow-sm"
            style={secondaryButtonStyle}
            onClick={onRefresh}
            disabled={isLoading}
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