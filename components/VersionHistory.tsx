// components/VersionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Spinner, Alert, Modal } from 'react-bootstrap';
import { format } from 'date-fns';

interface Version {
  version_id: number;
  schedule_id: number;
  version_number: number;
  changes: any;
  change_summary: string;
  created_by: number;
  created_at: string;
  action_type: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  level_num: number;
  group_num: number;
}

interface VersionHistoryProps {
  scheduleId?: number;
  level?: number;
  group?: number;
  onRestore?: () => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({ 
  scheduleId, 
  level, 
  group,
  onRestore 
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<Version | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [scheduleId, level, group]);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = '/api/scheduleCommittee/version-control?';
      
      if (scheduleId) {
        url += `schedule_id=${scheduleId}`;
      } else if (level && group) {
        url += `level=${level}&group=${group}`;
      } else {
        setError('Either scheduleId or (level and group) is required');
        setLoading(false);
        return;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setVersions(data.versions);
      } else {
        setError(data.error || 'Failed to fetch version history');
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (version: Version) => {
    setSelectedVersion(version);
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedVersion) return;

    setRestoring(true);
    setError(null);

    try {
      const response = await fetch('/api/scheduleCommittee/version-control', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_id: selectedVersion.version_id,
          restored_by: null
        })
      });

      const data = await response.json();

      if (data.success) {
        setShowRestoreModal(false);
        await fetchVersions();
        if (onRestore) {
          onRestore();
        }
      } else {
        setError(data.error || 'Failed to restore version');
      }
    } catch (err) {
      console.error('Error restoring version:', err);
      setError('Network error occurred while restoring version');
    } finally {
      setRestoring(false);
    }
  };

  const handleViewDetails = (version: Version) => {
    setSelectedDetails(version);
    setShowDetailsModal(true);
  };

  // ✅ Convert technical action types to user-friendly labels
  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'publish': 'Published',
      'publish_to_teaching_load': 'Published to Teaching Load Committee',
      'publish_to_faculty_students': 'Published to Faculty & Students',
      'manual_edit': 'Manual Changes',
      'ai_generate': 'AI Generated',
      'restore': 'Restored Previous Version',
      'auto_save': 'Auto Saved'
    };
    return labels[actionType] || actionType.replace(/_/g, ' ');
  };

  // ✅ User-friendly badge with website colors
  const getActionBadge = (actionType: string, isLatest: boolean) => {
    if (isLatest) {
      return (
        <Badge style={{ 
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', 
          color: 'white', 
          padding: '6px 12px',
          fontWeight: '600'
        }}>
          <i className="bi bi-check-circle me-1"></i>
          Current Version
        </Badge>
      );
    }

    // All badges use website colors
    const styles: Record<string, any> = {
      'publish_to_teaching_load': { background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', color: 'white' },
      'publish_to_faculty_students': { background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', color: 'white' },
      'publish': { background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', color: 'white' },
      'manual_edit': { background: '#b0c4d4', color: '#1e3a5f' },
      'ai_generate': { background: '#87CEEB', color: '#1e3a5f' },
      'restore': { background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', color: 'white'  },
      'auto_save': { background: '#b0c4d4', color: '#1e3a5f' }
    };

    const style = styles[actionType] || { background: '#b0c4d4', color: '#1e3a5f' };

    return (
      <Badge style={{ ...style, padding: '6px 12px', fontWeight: '600' }}>
        {getActionLabel(actionType)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
    } catch {
      return dateString;
    }
  };

  // ✅ User-friendly summary of changes
  const getChangesSummary = (changes: any) => {
    if (!changes) return 'No details available';
    
    try {
      const parsed = typeof changes === 'string' ? JSON.parse(changes) : changes;
      
      if (parsed.restored_from_version) {
        return `Restored from Version ${parsed.restored_from_version}`;
      }

      if (parsed.sessions && Array.isArray(parsed.sessions)) {
        const count = parsed.sessions.length;
        return `${count} course${count !== 1 ? 's' : ''} scheduled`;
      }

      return 'Schedule updated';
    } catch {
      return 'Schedule updated';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" style={{ color: '#1e3a5f' }} />
        <p className="mt-3 text-muted">Loading version history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-3">
        <i className="bi bi-exclamation-triangle me-2"></i>
        {error}
      </Alert>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-sm">
        <Card.Header 
          className="text-white d-flex justify-content-between align-items-center"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }}
        >
          <div>
            <i className="bi bi-clock-history me-2"></i>
            <strong>Version History</strong>
            {level && group && (
              <span className="ms-2">- Level {level}, Group {group}</span>
            )}
          </div>
          <Button 
            style={{ background: '#b0c4d4', color: '#1e3a5f', border: 'none' }}
            size="sm"
            onClick={fetchVersions}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            Refresh
          </Button>
        </Card.Header>
        <Card.Body className="p-0">
          {versions.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox text-muted" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
              <h5 className="mt-3 text-muted">No Version History Yet</h5>
              <p className="text-muted">
                Version history is created automatically when you publish schedules.
              </p>
            </div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead style={{ background: '#f8f9fa' }}>
                <tr>
                  <th style={{ width: '120px', color: '#1e3a5f' }}>Version</th>
                  <th style={{ color: '#1e3a5f' }}>What Happened</th>
                  <th style={{ color: '#1e3a5f' }}>Details</th>
                  <th style={{ color: '#1e3a5f' }}>By</th>
                  <th style={{ color: '#1e3a5f' }}>When</th>
                  <th style={{ width: '180px', color: '#1e3a5f' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version, index) => (
                  <tr key={version.version_id} style={{ verticalAlign: 'middle' }}>
                    <td>
                      <div className="d-flex align-items-center">
                        <span 
                          className="fw-bold me-2" 
                          style={{ 
                            fontSize: '1.1rem',
                            color: index === 0 ? '#1e3a5f' : '#6c757d'
                          }}
                        >
                          v{version.version_number}
                        </span>
                        {index === 0 && (
                          <i 
                            className="bi bi-star-fill" 
                            style={{ color: '#1e3a5f' }}
                            title="Current version"
                          ></i>
                        )}
                      </div>
                    </td>
                    <td>
                      {getActionBadge(version.action_type, index === 0)}
                    </td>
                    <td>
                      <div>{version.change_summary}</div>
                      <small className="text-muted">
                        {getChangesSummary(version.changes)}
                      </small>
                    </td>
                    <td>
                      {version.first_name && version.last_name ? (
                        <div>
                          <div className="fw-semibold" style={{ color: '#1e3a5f' }}>
                            {version.first_name} {version.last_name}
                          </div>
                          <small className="text-muted">{version.role}</small>
                        </div>
                      ) : (
                        <span className="text-muted">System</span>
                      )}
                    </td>
                    <td>
                      <small style={{ color: '#6c757d' }}>
                        {formatDate(version.created_at)}
                      </small>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          style={{ background: '#87CEEB', color: '#1e3a5f', border: 'none' }}
                          onClick={() => handleViewDetails(version)}
                          title="View details"
                        >
                          <i className="bi bi-eye me-1"></i>
                          View
                        </Button>
                        {index !== 0 && (
                          <Button
                            size="sm"
                            style={{ background: '#b0c4d4', color: '#1e3a5f', border: 'none' }}
                            onClick={() => handleRestoreClick(version)}
                            title="Restore this version"
                          >
                            <i className="bi bi-arrow-counterclockwise me-1"></i>
                            Restore
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Restore Confirmation Modal */}
      <Modal 
        show={showRestoreModal} 
        onHide={() => !restoring && setShowRestoreModal(false)}
        centered
      >
        <Modal.Header 
          closeButton 
          className="border-0"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', color: 'white' }}
        >
          <Modal.Title>
            <i className="bi bi-arrow-counterclockwise me-2"></i>
            Restore Previous Version
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {selectedVersion && (
            <>
              <p className="mb-3">
                Are you sure you want to restore to <strong>Version {selectedVersion.version_number}</strong>?
              </p>
              <div className="p-3 rounded" style={{ background: '#f8f9fa', border: '2px solid #87CEEB' }}>
                <div className="mb-2">
                  <strong style={{ color: '#1e3a5f' }}>What will happen:</strong>
                </div>
                <ul className="mb-0" style={{ color: '#6c757d' }}>
                  <li>The schedule will return to how it was in Version {selectedVersion.version_number}</li>
                  <li>Current schedule will be saved as a new version</li>
                  <li>You can undo this restore later if needed</li>
                </ul>
              </div>
              <Alert variant="info" className="mt-3 mb-0">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Version {selectedVersion.version_number}:</strong> {selectedVersion.change_summary}
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button 
            style={{ background: '#b0c4d4', color: '#1e3a5f', border: 'none' }}
            onClick={() => setShowRestoreModal(false)}
            disabled={restoring}
          >
            Cancel
          </Button>
          <Button 
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }}
            onClick={handleRestoreConfirm}
            disabled={restoring}
          >
            {restoring ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Restoring...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-counterclockwise me-2"></i>
                Restore This Version
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Details Modal */}
      <Modal 
        show={showDetailsModal} 
        onHide={() => setShowDetailsModal(false)}
        size="lg"
        centered
      >
        <Modal.Header 
          closeButton 
          className="border-0"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', color: 'white' }}
        >
          <Modal.Title>
            <i className="bi bi-info-circle me-2"></i>
            Version Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {selectedDetails && (
            <>
              <div className="mb-4">
                <h5 style={{ color: '#1e3a5f' }}>Version {selectedDetails.version_number}</h5>
                {getActionBadge(selectedDetails.action_type, false)}
              </div>

              <div className="mb-3">
                <strong style={{ color: '#1e3a5f' }}>Summary:</strong>
                <p className="mb-0">{selectedDetails.change_summary}</p>
              </div>

              <div className="mb-3">
                <strong style={{ color: '#1e3a5f' }}>Created:</strong>
                <p className="mb-0">{formatDate(selectedDetails.created_at)}</p>
              </div>

              {selectedDetails.first_name && selectedDetails.last_name && (
                <div className="mb-3">
                  <strong style={{ color: '#1e3a5f' }}>Created By:</strong>
                  <p className="mb-0">
                    {selectedDetails.first_name} {selectedDetails.last_name} ({selectedDetails.role})
                  </p>
                </div>
              )}

              <div className="mb-3">
                <strong style={{ color: '#1e3a5f' }}>Schedule:</strong>
                <p className="mb-0">Level {selectedDetails.level_num}, Group {selectedDetails.group_num}</p>
              </div>

              <div>
                <strong style={{ color: '#1e3a5f' }}>Details:</strong>
                <p className="mb-0 text-muted">
                  {getChangesSummary(selectedDetails.changes)}
                </p>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button 
            style={{ background: '#b0c4d4', color: '#1e3a5f', border: 'none' }}
            onClick={() => setShowDetailsModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default VersionHistory;