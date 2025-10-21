import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { AlertState } from '../lib/types';

interface GroupManagerModalProps {
  show: boolean;
  onHide: () => void;
  selectedLevel: number;
  availableGroups: number[];
  onGroupDelete: (groupNum: number) => Promise<void>;
  onGroupCreate: (numStudents: number) => Promise<void>;
  onAlert: (type: AlertState['type'], message: string) => void;
  isLoading: boolean;
}

const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  show,
  onHide,
  selectedLevel,
  availableGroups,
  onGroupDelete,
  onGroupCreate,
  onAlert,
  isLoading
}) => {
  const [numStudents, setNumStudents] = useState<number>(0);

  const handleDeleteGroup = async (groupNum: number) => {
    if (!confirm(`Delete Group ${groupNum}?`)) return;
    await onGroupDelete(groupNum);
  };

  const handleCreateGroups = async () => {
    if (!numStudents || numStudents <= 0) {
      onAlert('warning', 'Please enter a valid number of students');
      return;
    }

    const numberOfGroups = Math.ceil(numStudents / 25);
    const studentsPerGroup = Math.floor(numStudents / numberOfGroups);
    const maxStudentsPerGroup = Math.ceil(numStudents / numberOfGroups);

    if (!confirm(
      `Create ${numberOfGroups} group(s) for ${numStudents} students?\n` +
      `(${studentsPerGroup}-${maxStudentsPerGroup} students per group)`
    )) {
      return;
    }

    await onGroupCreate(numStudents);
    setNumStudents(0);
  };

  const calculatedGroups = Math.ceil(numStudents / 25);

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header
        closeButton
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
          border: 'none'
        }}
        className="text-white"
      >
        <Modal.Title className="fw-semibold">
          <i className="bi bi-gear me-2"></i>
          Manage Groups
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body style={{ background: 'white', padding: '2rem' }}>
        <div className="mb-4">
          <h6 className="fw-semibold mb-3" style={{ color: '#1e3a5f' }}>
            Level {selectedLevel}
          </h6>

          {availableGroups.length > 0 ? (
            <div className="d-flex flex-wrap gap-2 mb-3">
              {availableGroups.map(groupNum => (
                <div
                  key={groupNum}
                  className="badge d-flex align-items-center gap-2"
                  style={{
                    background: '#e6f4ff',
                    border: '2px solid #87CEEB',
                    color: '#1e3a5f',
                    padding: '10px 16px',
                    fontSize: '0.95rem',
                    fontWeight: '600'
                  }}
                >
                  Group {groupNum}
                  {availableGroups.length > 1 && (
                    <i
                      className="bi bi-x-circle-fill text-danger"
                      style={{ cursor: 'pointer', fontSize: '1.1rem' }}
                      onClick={() => handleDeleteGroup(groupNum)}
                      title="Delete group"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted small">No groups yet</p>
          )}
        </div>

        <hr style={{ borderColor: '#dee2e6', margin: '1.5rem 0' }} />

        <div>
          <h6 className="fw-semibold mb-3" style={{ color: '#1e3a5f' }}>
            Create New Groups
          </h6>

          <div className="mb-3">
            <Form.Label className="fw-semibold" style={{ color: '#1e3a5f', fontSize: '0.9rem' }}>
              Number of Students
            </Form.Label>
            <Form.Control
              type="number"
              min="1"
              max="500"
              placeholder="Enter number of students"
              style={{ borderColor: '#87CEEB', fontSize: '0.95rem' }}
              value={numStudents || ''}
              onChange={(e) => setNumStudents(parseInt(e.target.value) || 0)}
            />
            <Form.Text className="text-muted" style={{ fontSize: '0.8rem' }}>
              Maximum 25 students per group
            </Form.Text>
          </div>

          <div className="mb-3 p-3" style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '2px solid #87CEEB'
          }}>
            <div className="d-flex align-items-center justify-content-between">
              <span className="fw-semibold" style={{ color: '#1e3a5f', fontSize: '0.9rem' }}>
                <i className="bi bi-people-fill me-2"></i>
                Groups Needed:
              </span>
              <span
                className="badge"
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                  color: 'white',
                  fontSize: '1.2rem',
                  padding: '8px 16px'
                }}
              >
                {calculatedGroups}
              </span>
            </div>
          </div>

          <div className="d-grid">
            <Button
              className="border-0"
              style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                color: 'white',
                padding: '10px 20px',
                fontSize: '0.95rem',
                fontWeight: '600'
              }}
              onClick={handleCreateGroups}
              disabled={isLoading}
            >
              <i className="bi bi-plus-circle me-2"></i>
              {isLoading ? 'Creating...' : 'Create Groups'}
            </Button>
          </div>
        </div>
      </Modal.Body>
      
      <Modal.Footer style={{ background: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
        <Button
          className="border-0"
          style={{
            background: '#b0c4d4',
            color: '#1e3a5f',
            padding: '8px 20px'
          }}
          onClick={onHide}
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GroupManagerModal;
