import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Spinner, Alert } from 'react-bootstrap';
import { ElectiveSurveyResult } from '../lib/types';

interface ElectiveSurveyResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ElectiveSurveyResultsModal: React.FC<ElectiveSurveyResultsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [results, setResults] = useState<ElectiveSurveyResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSurveyResults();
    } else {
      // Reset state when modal closes
      setResults([]);
      setError(null);
    }
  }, [isOpen]);

  const fetchSurveyResults = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get user from localStorage to pass user_id for auth
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?.user_id || user?.user_id;

      const url = userId 
        ? `/api/scheduleCommittee/elective-survey-results?user_id=${userId}`
        : '/api/scheduleCommittee/elective-survey-results';

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);
      } else {
        setError(data.error || 'Failed to fetch survey results');
      }
    } catch (err) {
      console.error('Error fetching survey results:', err);
      setError('Network error occurred while fetching survey results');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onHide={onClose} size="lg" centered>
      <Modal.Header
        closeButton
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
          border: 'none'
        }}
        className="text-white"
      >
        <Modal.Title className="fw-semibold">
          <i className="bi bi-clipboard-data me-2"></i>
          Elective Survey Results
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body style={{ background: 'white', padding: '2rem' }}>
        {isLoading ? (
          <div className="text-center py-5">
            <Spinner animation="border" style={{ color: '#1e3a5f' }} />
            <p className="mt-3" style={{ color: '#1e3a5f' }}>
              Loading survey results...
            </p>
          </div>
        ) : error ? (
          <Alert variant="danger" className="border-0">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </Alert>
        ) : results.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-clipboard text-muted" style={{ fontSize: '3rem' }}></i>
            <p className="mt-3 text-muted">No survey results available yet.</p>
            <p className="text-muted small">
              Students need to submit their elective preferences first.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table striped bordered hover className="mb-0">
              <thead style={{ background: '#1e3a5f', color: 'white' }}>
                <tr>
                  <th style={{ fontWeight: '600', padding: '12px' }}>Elective Code</th>
                  <th style={{ fontWeight: '600', padding: '12px' }}>Elective Name</th>
                  <th style={{ fontWeight: '600', padding: '12px' }}>Level</th>
                  <th style={{ fontWeight: '600', padding: '12px', textAlign: 'center' }}>
                    Number of Students
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={`${result.electiveCode}-${result.level}-${index}`}>
                    <td style={{ padding: '12px', fontWeight: '600', color: '#1e3a5f' }}>
                      {result.electiveCode}
                    </td>
                    <td style={{ padding: '12px' }}>{result.electiveName}</td>
                    <td style={{ padding: '12px' }}>Level {result.level}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span
                        className="badge"
                        style={{
                          background: '#87CEEB',
                          color: '#1e3a5f',
                          padding: '6px 12px',
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}
                      >
                        {result.studentsCount} {result.studentsCount === 1 ? 'student' : 'students'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-3 text-muted small">
              <i className="bi bi-info-circle me-1"></i>
              Total: {results.length} elective course{results.length !== 1 ? 's' : ''} with student preferences
            </div>
          </div>
        )}
      </Modal.Body>
      
      <Modal.Footer style={{ border: 'none', background: '#f8f9fa' }}>
        <Button
          variant="secondary"
          onClick={onClose}
          style={{
            background: '#b0c4d4',
            color: '#1e3a5f',
            border: 'none',
            padding: '8px 20px'
          }}
        >
          Close
        </Button>
        {!isLoading && !error && results.length > 0 && (
          <Button
            onClick={fetchSurveyResults}
            style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
              border: 'none',
              color: 'white',
              padding: '8px 20px'
            }}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ElectiveSurveyResultsModal;

