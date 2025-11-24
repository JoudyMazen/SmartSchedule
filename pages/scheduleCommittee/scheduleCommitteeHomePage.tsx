import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Alert, Spinner, Nav, Tab, Modal, Button } from 'react-bootstrap';
import Layout from '../../components/Layout';
import IrregularStudentsPage from './IrregularStudents';
import ScheduleTable from '../../components/ScheduleTable';
import LevelSelector from '../../components/LevelSelector';
import ActionButtons from '../../components/ActionButtons';
import GroupManagerModal from '../../components/GroupManagerModal';
import VersionHistory from '../../components/VersionHistory';
import { useRouter } from 'next/router';
import { useAvailableGroups, useAlert, useLoading } from '../../lib/hooks';
import { getUser } from '../../lib/user-state';

// Hard-coded deadline dates for schedule submission
const DEADLINE_INITIAL_SUBMISSION_TO_TEACHING_LOAD = new Date('2025-11-18');
const DEADLINE_PUBLISH_TO_FACULTY_STUDENTS = new Date('2025-11-18');
const DEADLINE_FINAL_VERSION_SUBMISSION = new Date('2025-11-18');

// ---- Types ----
interface Feedback {
  feedback_id: number;
  role?: string;
  rating?: number;
  first_name?: string;
  last_name?: string;
  created_at?: string;
  feedback_type?: string;
  level_num?: number;
  comment?: string;
  schedule_id?: number;
}

interface FeedbackFilters {
  level: string;
  role: string;
  feedback_type: string;
  search: string;
}

const SchedulingCommitteeHomePage: React.FC = () => {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [activeTab, setActiveTab] = useState<'schedule' | 'feedback' | 'versions'>('schedule');
  const [showConfigureGroupsModal, setShowConfigureGroupsModal] = useState(false);
  const [showIrregularStudentsModal, setShowIrregularStudentsModal] = useState(false);

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackFilters, setFeedbackFilters] = useState<FeedbackFilters>({
    level: '',
    role: '',
    feedback_type: '',
    search: ''
  });
  const [selectedFeedbacks, setSelectedFeedbacks] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Custom hooks
  const { groups: availableGroups, refetch: refetchGroups } = useAvailableGroups(selectedLevel);
  const { alert, showAlert, clearAlert } = useAlert();
  const { isLoading, startLoading, stopLoading } = useLoading();

  useEffect(() => {
    if (router.query.refresh === 'true') {
      setRefreshCounter((c) => c + 1);
    }
  }, [router.query.refresh]);

  // Check for deadline reminders on page load
  useEffect(() => {
    const checkDeadlineReminders = async () => {
      try {
        const response = await fetch('/api/scheduleCommittee/deadline-reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success && data.notificationsSent > 0) {
          console.log(`Deadline reminders sent: ${data.notificationsSent}`);
        }
      } catch (error) {
        console.error('Error checking deadline reminders:', error);
      }
    };

    checkDeadlineReminders();
    const interval = setInterval(checkDeadlineReminders, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const generateAISchedule = async () => {
    if (
      !confirm(
        `Generate AI schedule for Level ${selectedLevel}? This will create optimized schedules for all groups.`
      )
    ) {
      return;
    }

    startLoading();
    clearAlert();

    try {
      const groups = availableGroups.length > 0 ? availableGroups : [1];
      const results: any[] = [];

      if (groups.length > 1) {
        const response = await fetch('/api/ai/generate-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: selectedLevel,
            numberOfGroups: groups.length,
            useAI: true
          })
        });
        const data = await response.json();
        results.push(data);
      } else {
        const response = await fetch('/api/ai/generate-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: selectedLevel,
            group: groups[0],
            useAI: true
          })
        });
        const data = await response.json();
        results.push(data);
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        const actualGroupCount = results[0]?.groups?.length || successCount;
        showAlert(
          'success',
          `AI schedule generated successfully for ${actualGroupCount} group(s)!${
            failureCount > 0 ? ` ${failureCount} group(s) failed.` : ''
          }`
        );
        setRefreshCounter((c) => c + 1);
      } else {
        showAlert(
          'danger',
          'Failed to generate AI schedule. Please try again or check for conflicts.'
        );
      }
    } catch (error) {
      console.error('Error generating AI schedule:', error);
      showAlert('danger', 'Network error occurred while generating schedule.');
    } finally {
      stopLoading();
    }
  };

  // ✅ Publish ALL LEVELS to Faculty and Students
  const publishToFacultyStudents = async () => {
    if (
      !confirm(
        `Publish ALL schedules (all levels) to Faculty and Students? This will make all schedules visible to all users and create a cross-level version.`
      )
    ) {
      return;
    }

    startLoading();
    clearAlert();

    try {
      const user = getUser();
      if (!user?.user_id) {
        showAlert('danger', 'User not found. Please login again.');
        return;
      }

      // ✅ Don't send level parameter - publish ALL levels
      const response = await fetch('/api/scheduleCommittee/publish-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publish_to: 'faculty_students',
          created_by: user.user_id
        })
      });

      const data = await response.json();

      if (data.success) {
        showAlert(
          'success',
          `All schedules published successfully to Faculty and Students! (Version ${data.version_number}, ${data.levels_count} levels, ${data.groups_count} groups)`
        );
        setRefreshCounter((c) => c + 1);
      } else {
        showAlert('danger', data.message || 'Failed to publish schedule. Please try again.');
      }
    } catch (error) {
      console.error('Error publishing schedule:', error);
      showAlert('danger', 'Network error occurred while publishing schedule.');
    } finally {
      stopLoading();
    }
  };

  // ✅ Publish ALL LEVELS to Teaching Load Committee
  const publishToTeachingLoad = async () => {
    if (
      !confirm(
        `Publish ALL schedules (all levels) to Teaching Load Committee? This will send all schedules for review and create a cross-level version.`
      )
    ) {
      return;
    }

    startLoading();
    clearAlert();

    try {
      const user = getUser();
      if (!user?.user_id) {
        showAlert('danger', 'User not found. Please login again.');
        return;
      }

      // ✅ Don't send level parameter - publish ALL levels
      const response = await fetch('/api/scheduleCommittee/publish-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publish_to: 'teaching_load',
          created_by: user.user_id
        })
      });

      const data = await response.json();

      if (data.success) {
        showAlert(
          'success',
          `All schedules published successfully to Teaching Load Committee! (Version ${data.version_number}, ${data.levels_count} levels, ${data.groups_count} groups)`
        );
        setRefreshCounter((c) => c + 1);
      } else {
        showAlert('danger', data.message || 'Failed to publish schedule. Please try again.');
      }
    } catch (error) {
      console.error('Error publishing schedule:', error);
      showAlert('danger', 'Network error occurred while publishing schedule.');
    } finally {
      stopLoading();
    }
  };

  const fetchFeedbacks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (feedbackFilters.level) params.append('level', feedbackFilters.level);
      if (feedbackFilters.role) params.append('role', feedbackFilters.role);
      if (feedbackFilters.feedback_type) params.append('feedback_type', feedbackFilters.feedback_type);
      if (feedbackFilters.search.trim()) params.append('search', feedbackFilters.search.trim());

      const url = `/api/scheduleCommittee/feedback${
        params.toString() ? `?${params.toString()}` : ''
      }`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setFeedbacks((data.feedbacks || []) as Feedback[]);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    }
  }, [feedbackFilters]);

  useEffect(() => {
    if (activeTab === 'feedback') {
      fetchFeedbacks();
    }
    setSelectedFeedbacks([]);
    setIsSelectionMode(false);
  }, [feedbackFilters, activeTab, fetchFeedbacks]);

  const groupFeedbacksByRole = (feedbacks: Feedback[]) => {
    const grouped: { [key: string]: Feedback[] } = {
      scheduling_committee: [],
      teaching_load_committee: [],
      faculty: [],
      student: [],
      other: []
    };

    feedbacks.forEach((feedback) => {
      const role = (feedback.role || 'other').toLowerCase();
      if (grouped[role]) {
        grouped[role].push(feedback);
      } else {
        grouped.other.push(feedback);
      }
    });

    return grouped;
  };

  const handleSelectFeedback = (feedbackId: number) => {
    setSelectedFeedbacks((prev) => {
      if (prev.includes(feedbackId)) {
        return prev.filter((id) => id !== feedbackId);
      } else {
        return [...prev, feedbackId];
      }
    });
  };

  const handleSelectAllInRole = (roleFeedbacks: Feedback[]) => {
    const roleFeedbackIds = roleFeedbacks.map((f) => f.feedback_id);
    const allSelected = roleFeedbackIds.every((id) => selectedFeedbacks.includes(id));

    if (allSelected) {
      setSelectedFeedbacks((prev) => prev.filter((id) => !roleFeedbackIds.includes(id)));
    } else {
      setSelectedFeedbacks((prev) => {
        const newSelection = [...prev];
        roleFeedbackIds.forEach((id) => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedFeedbacks.length === feedbacks.length) {
      setSelectedFeedbacks([]);
    } else {
      setSelectedFeedbacks(feedbacks.map((f) => f.feedback_id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFeedbacks.length === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedFeedbacks.length} feedback(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch('/api/scheduleCommittee/feedback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_ids: selectedFeedbacks })
      });

      const data = await response.json();
      if (data.success) {
        showAlert('success', `Successfully deleted ${data.deletedCount} feedback(s)`);
        setSelectedFeedbacks([]);
        setIsSelectionMode(false);
        fetchFeedbacks();
      } else {
        showAlert('danger', data.message || 'Failed to delete feedback');
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
      showAlert('danger', 'Network error occurred while deleting feedback');
    }
  };

  const handleCancelSelection = () => {
    setSelectedFeedbacks([]);
    setIsSelectionMode(false);
  };

  const handleGroupDelete = async (groupNum: number) => {
    try {
      const response = await fetch(
        `/api/data/manageGroups?level=${selectedLevel}&group=${groupNum}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (data.success) {
        showAlert('success', data.message);
        await refetchGroups();
        setRefreshCounter((c) => c + 1);
      } else {
        showAlert('danger', data.error);
      }
    } catch (error) {
      showAlert('danger', 'Failed to delete group');
    }
  };

  const handleGroupCreate = async (numStudents: number) => {
    const numberOfGroups = Math.ceil(numStudents / 25);

    try {
      const response = await fetch('/api/data/manageGroups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: selectedLevel,
          numberOfGroups
        })
      });

      const data = await response.json();

      if (data.success) {
        showAlert(
          'success',
          `Successfully created ${numberOfGroups} group(s) for ${numStudents} students`
        );
        await refetchGroups();
        setRefreshCounter((c) => c + 1);
        setShowConfigureGroupsModal(false);
      } else {
        showAlert('danger', data.error);
      }
    } catch (error) {
      showAlert('danger', 'Failed to create groups');
    }
  };

  const handleVersionRestore = () => {
    showAlert('success', 'Version restored successfully!');
    setRefreshCounter((c) => c + 1);
  };

  const renderScheduleTab = () => (
    <div>
      <Row className="mb-4 g-3">
        <Col lg={3} md={4}>
          <LevelSelector selectedLevel={selectedLevel} onLevelChange={setSelectedLevel} />
        </Col>
        <Col lg={9} md={8}>
          <ActionButtons
            onManageGroups={() => setShowConfigureGroupsModal(true)}
            onGenerateAI={generateAISchedule}
            onPublishToFacultyStudents={publishToFacultyStudents}
            onPublishToTeachingLoad={publishToTeachingLoad}
            onIrregularStudents={() => setShowIrregularStudentsModal(true)}
            onRefresh={() => setRefreshCounter((c) => c + 1)}
            isLoading={isLoading}
          />
        </Col>
      </Row>

      <GroupManagerModal
        show={showConfigureGroupsModal}
        onHide={() => setShowConfigureGroupsModal(false)}
        selectedLevel={selectedLevel}
        availableGroups={availableGroups}
        onGroupDelete={handleGroupDelete}
        onGroupCreate={handleGroupCreate}
        onAlert={showAlert}
        isLoading={isLoading}
      />

      {availableGroups.map((groupNum) => (
        <ScheduleTable
          key={groupNum}
          level={selectedLevel}
          group={groupNum}
          refreshSignal={refreshCounter}
        />
      ))}
    </div>
  );

  return (
    <Layout>
      <div className="schedule-committee-container">
        <Container className="py-4">
          <div className="mb-4">
            <h2 className="fw-bold mb-2 schedule-committee-header">Scheduling Committee Dashboard</h2>
            <p className="text-muted mb-0 schedule-committee-subtitle">
              Manage schedules, view feedback, and track version history
            </p>
          </div>

          {/* Schedule Submission Deadlines */}
          <div className="mb-4">
            <h4 className="fw-bold mb-3" style={{ color: '#1e3a5f' }}>
              <i className="fas fa-calendar-times me-2"></i>
              Schedule Submission Deadlines
            </h4>
            <Row className="g-3">
              <Col md={4}>
                <div className="d-flex align-items-center">
                  <div className="me-3" style={{ fontSize: '2rem', color: '#ff9800' }}>
                    <i className="fas fa-flag"></i>
                  </div>
                  <div>
                    <h6 className="mb-1 fw-bold" style={{ color: '#1e3a5f' }}>
                      Initial Version Submission
                    </h6>
                    <p className="mb-0 text-muted small">Submit to Teaching Load Committee</p>
                    <p className="mb-0 fw-bold" style={{ color: '#ff9800', fontSize: '1.1rem' }}>
                      <i className="fas fa-clock me-1"></i>
                      {DEADLINE_INITIAL_SUBMISSION_TO_TEACHING_LOAD.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <div className="d-flex align-items-center">
                  <div className="me-3" style={{ fontSize: '2rem', color: '#ff9800' }}>
                    <i className="fas fa-bullhorn"></i>
                  </div>
                  <div>
                    <h6 className="mb-1 fw-bold" style={{ color: '#1e3a5f' }}>
                      Publish to Faculty & Students
                    </h6>
                    <p className="mb-0 text-muted small">Make schedule visible to all users</p>
                    <p className="mb-0 fw-bold" style={{ color: '#ff9800', fontSize: '1.1rem' }}>
                      <i className="fas fa-clock me-1"></i>
                      {DEADLINE_PUBLISH_TO_FACULTY_STUDENTS.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <div className="d-flex align-items-center">
                  <div className="me-3" style={{ fontSize: '2rem', color: '#ff9800' }}>
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div>
                    <h6 className="mb-1 fw-bold" style={{ color: '#1e3a5f' }}>
                      Final Version Submission
                    </h6>
                    <p className="mb-0 text-muted small">Submit final approved schedule</p>
                    <p className="mb-0 fw-bold" style={{ color: '#ff9800', fontSize: '1.1rem' }}>
                      <i className="fas fa-clock me-1"></i>
                      {DEADLINE_FINAL_VERSION_SUBMISSION.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </Col>
            </Row>
          </div>

          {alert && (
            <Alert
              variant={alert.type}
              onClose={clearAlert}
              dismissible
              className="border-0 shadow-sm"
            >
              {alert.message}
            </Alert>
          )}

          <Tab.Container
            activeKey={activeTab}
            onSelect={(k) => setActiveTab((k as any) || 'schedule')}
          >
            <Row>
              <Col>
                <Nav variant="tabs" className="border-0 mb-4">
                  <Nav.Item>
                    <Nav.Link
                      eventKey="schedule"
                      className={`nav-tab px-4 py-3 ${activeTab === 'schedule' ? 'active' : ''}`}
                      style={{
                        color: 'white',
                        backgroundColor: '#1e3a5f',
                        borderRadius: '8px',
                        marginRight: '8px',
                        fontWeight: 500,
                        transition: 'all 0.2s ease-in-out',
                        border:
                          activeTab === 'schedule'
                            ? '2px solid rgba(255,255,255,0.3)'
                            : '2px solid transparent',
                        boxShadow:
                          activeTab === 'schedule' ? '0 0 8px rgba(255, 255, 255, 0.2)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2c5282';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e3a5f';
                      }}
                    >
                      <i className="fas fa-calendar-alt me-2"></i>
                      Schedule Management
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link
                      eventKey="feedback"
                      className={`nav-tab px-4 py-3 ${activeTab === 'feedback' ? 'active' : ''}`}
                      style={{
                        color: 'white',
                        backgroundColor: '#1e3a5f',
                        borderRadius: '8px',
                        marginRight: '8px',
                        fontWeight: 500,
                        transition: 'all 0.2s ease-in-out',
                        border:
                          activeTab === 'feedback'
                            ? '2px solid rgba(255,255,255,0.3)'
                            : '2px solid transparent',
                        boxShadow:
                          activeTab === 'feedback' ? '0 0 8px rgba(255, 255, 255, 0.2)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2c5282';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e3a5f';
                      }}
                    >
                      <i className="fas fa-comments me-2"></i>
                      Feedback
                      {feedbacks.length > 0 && (
                        <span className="badge bg-danger ms-2">{feedbacks.length}</span>
                      )}
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link
                      eventKey="versions"
                      className={`nav-tab px-4 py-3 ${activeTab === 'versions' ? 'active' : ''}`}
                      style={{
                        color: 'white',
                        backgroundColor: '#1e3a5f',
                        borderRadius: '8px',
                        marginRight: '8px',
                        fontWeight: 500,
                        transition: 'all 0.2s ease-in-out',
                        border:
                          activeTab === 'versions'
                            ? '2px solid rgba(255,255,255,0.3)'
                            : '2px solid transparent',
                        boxShadow:
                          activeTab === 'versions' ? '0 0 8px rgba(255, 255, 255, 0.2)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2c5282';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e3a5f';
                      }}
                    >
                      <i className="fas fa-history me-2"></i>
                      Version History
                    </Nav.Link>
                  </Nav.Item>
                </Nav>

                <Tab.Content>
                  <Tab.Pane eventKey="schedule">
                    {isLoading ? (
                      <div className="text-center p-5">
                        <Spinner animation="border" className="loading-spinner" />
                        <p className="mt-3 schedule-committee-header">Loading schedule data...</p>
                      </div>
                    ) : (
                      renderScheduleTab()
                    )}
                  </Tab.Pane>

                  <Tab.Pane eventKey="feedback">
                    <div className="mt-4">
                      <h4 className="mb-4" style={{ color: '#1e3a5f' }}>
                        <i className="fas fa-comments me-2"></i>
                        Feedback from Faculty and Students
                      </h4>

                      {/* Feedback Filters */}
                      <div className="card mb-4 border-0 shadow-sm">
                        <div className="card-body">
                          <h6 className="mb-3" style={{ color: '#1e3a5f' }}>
                            <i className="fas fa-filter me-2"></i>
                            Filter Feedback
                          </h6>
                          <Row className="g-3">
                            <Col md={3}>
                              <label className="form-label small fw-semibold">Level</label>
                              <select
                                className="form-select form-select-sm"
                                value={feedbackFilters.level}
                                onChange={(e) =>
                                  setFeedbackFilters({ ...feedbackFilters, level: e.target.value })
                                }
                              >
                                <option value="">All Levels</option>
                                {[3, 4, 5, 6, 7, 8].map((level) => (
                                  <option key={level} value={level}>
                                    Level {level}
                                  </option>
                                ))}
                              </select>
                            </Col>
                            <Col md={3}>
                              <label className="form-label small fw-semibold">Role</label>
                              <select
                                className="form-select form-select-sm"
                                value={feedbackFilters.role}
                                onChange={(e) =>
                                  setFeedbackFilters({ ...feedbackFilters, role: e.target.value })
                                }
                              >
                                <option value="">All Roles</option>
                                <option value="faculty">Faculty</option>
                                <option value="student">Student</option>
                                <option value="teaching_load_committee">
                                  Teaching Load Committee
                                </option>
                              </select>
                            </Col>
                            <Col md={3}>
                              <label className="form-label small fw-semibold">Feedback Type</label>
                              <select
                                className="form-select form-select-sm"
                                value={feedbackFilters.feedback_type}
                                onChange={(e) =>
                                  setFeedbackFilters({
                                    ...feedbackFilters,
                                    feedback_type: e.target.value
                                  })
                                }
                              >
                                <option value="">All Types</option>
                                <option value="general">General</option>
                                <option value="schedule">Schedule</option>
                                <option value="course">Course</option>
                                <option value="instructor">Instructor</option>
                              </select>
                            </Col>
                            <Col md={3}>
                              <label className="form-label small fw-semibold">Search</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Name, comment, schedule #"
                                value={feedbackFilters.search}
                                onChange={(e) =>
                                  setFeedbackFilters({ ...feedbackFilters, search: e.target.value })
                                }
                              />
                            </Col>
                          </Row>
                          <div className="mt-3">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setFeedbackFilters({
                                  level: '',
                                  role: '',
                                  feedback_type: '',
                                  search: ''
                                })
                              }
                            >
                              <i className="fas fa-times me-1"></i>
                              Clear Filters
                            </button>
                          </div>
                        </div>
                      </div>

                      {feedbacks.length > 0 ? (
                        <>
                          {/* Action Bar */}
                          <div className="mb-3 d-flex justify-content-between align-items-center">
                            <div>
                              <small className="text-muted">
                                Showing {feedbacks.length} feedback{feedbacks.length !== 1 ? 's' : ''}
                                {selectedFeedbacks.length > 0 && (
                                  <span className="ms-2 text-primary">
                                    ({selectedFeedbacks.length} selected)
                                  </span>
                                )}
                              </small>
                            </div>
                            <div className="d-flex" style={{ gap: '0.5rem' }}>
                              {!isSelectionMode ? (
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => setIsSelectionMode(true)}
                                >
                                  <i className="fas fa-check-square me-1"></i>
                                  Select Feedback
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="outline-success"
                                    size="sm"
                                    onClick={handleSelectAll}
                                  >
                                    <i className="fas fa-check-double me-1"></i>
                                    Select All
                                  </Button>
                                  {selectedFeedbacks.length > 0 && (
                                    <Button variant="danger" size="sm" onClick={handleDeleteSelected}>
                                      <i className="fas fa-trash me-1"></i>
                                      Delete ({selectedFeedbacks.length})
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={handleCancelSelection}
                                  >
                                    <i className="fas fa-times me-1"></i>
                                    Cancel
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Grouped Feedback by Role */}
                          {(() => {
                            const grouped = groupFeedbacksByRole(feedbacks);
                            const roleLabels: { [key: string]: string } = {
                              scheduling_committee: 'Scheduling Committee Feedback',
                              faculty: 'Faculty Feedback',
                              student: 'Student Feedback',
                              teaching_load_committee: 'Teaching Load Committee Feedback',
                              other: 'Other Feedback'
                            };
                            const roleHighlights: { [key: string]: string } = {
                              scheduling_committee: '#e8f5e9',
                              faculty: '#e3f2fd',
                              student: '#f3e5f5',
                              teaching_load_committee: '#fff3e0',
                              other: '#f8f9fa'
                            };
                            const roleIcons: { [key: string]: string } = {
                              scheduling_committee: 'fa-calendar-check',
                              teaching_load_committee: 'fa-clipboard-check',
                              faculty: 'fa-chalkboard-teacher',
                              student: 'fa-user-graduate',
                              other: 'fa-users'
                            };

                            return Object.entries(grouped).map(([role, roleFeedbacks]) => {
                              if (roleFeedbacks.length === 0) return null;

                              const allInRoleSelected = roleFeedbacks.every((f) =>
                                selectedFeedbacks.includes(f.feedback_id)
                              );
                              const someInRoleSelected = roleFeedbacks.some((f) =>
                                selectedFeedbacks.includes(f.feedback_id)
                              );

                              return (
                                <div key={role} className="mb-4">
                                  <div className="card border-0 shadow-sm mb-3">
                                    <div
                                      className="card-header d-flex justify-content-between align-items-center"
                                      style={{
                                        background: roleHighlights[role] || roleHighlights.other,
                                        border: 'none'
                                      }}
                                    >
                                      <h5 className="mb-0" style={{ color: '#1e3a5f' }}>
                                        <i className={`fas ${roleIcons[role] || roleIcons.other} me-2`}></i>
                                        {roleLabels[role] || roleLabels.other}
                                        <span className="badge bg-secondary ms-2">
                                          {roleFeedbacks.length}
                                        </span>
                                      </h5>
                                      {isSelectionMode && (
                                        <Button
                                          variant="outline-primary"
                                          size="sm"
                                          onClick={() => handleSelectAllInRole(roleFeedbacks)}
                                        >
                                          <i
                                            className={`fas ${
                                              allInRoleSelected
                                                ? 'fa-check-square'
                                                : someInRoleSelected
                                                ? 'fa-minus-square'
                                                : 'fa-square'
                                            } me-1`}
                                          ></i>
                                          {allInRoleSelected ? 'Deselect All' : 'Select All'}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="row g-3">
                                    {roleFeedbacks.map((feedback: Feedback, index: number) => {
                                      const isSelected = selectedFeedbacks.includes(
                                        feedback.feedback_id
                                      );
                                      return (
                                        <div
                                          key={feedback.feedback_id || index}
                                          className="col-md-6 col-lg-4"
                                        >
                                          <div
                                            className={`card h-100 border-0 shadow-sm ${
                                              isSelected ? 'border-primary border-2' : ''
                                            }`}
                                            style={isSelected ? { backgroundColor: '#f0f8ff' } : {}}
                                          >
                                            <div
                                              className="card-header d-flex justify-content-between align-items-center"
                                              style={{ background: '#f8f9fa' }}
                                            >
                                              <div
                                                className="d-flex align-items-center"
                                                style={{ gap: '0.5rem' }}
                                              >
                                                {isSelectionMode && (
                                                  <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={isSelected}
                                                    onChange={() =>
                                                      handleSelectFeedback(feedback.feedback_id)
                                                    }
                                                    style={{
                                                      cursor: 'pointer',
                                                      width: '18px',
                                                      height: '18px',
                                                      marginTop: '0'
                                                    }}
                                                  />
                                                )}
                                                <div>
                                                  <strong style={{ color: '#1e3a5f' }}>
                                                    {feedback.first_name} {feedback.last_name}
                                                  </strong>
                                                  <br />
                                                  <small className="text-muted">
                                                    {feedback.role}
                                                  </small>
                                                </div>
                                              </div>
                                              <div className="text-end">
                                                <small className="text-muted">
                                                  {feedback.created_at
                                                    ? new Date(feedback.created_at).toLocaleDateString()
                                                    : 'N/A'}
                                                </small>
                                              </div>
                                            </div>
                                            <div className="card-body">
                                              <div className="mb-2">
                                                <span className="badge bg-primary me-2">
                                                  {feedback.feedback_type}
                                                </span>
                                                {feedback.level_num && (
                                                  <span className="badge bg-secondary">
                                                    Level {feedback.level_num}
                                                  </span>
                                                )}
                                              </div>
                                              <p className="card-text">{feedback.comment}</p>
                                              {feedback.schedule_id && (
                                                <small className="text-muted">
                                                  Schedule ID: {feedback.schedule_id}
                                                </small>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </>
                      ) : (
                        <div className="text-center py-5">
                          <i className="fas fa-comments text-muted" style={{ fontSize: '3rem' }}></i>
                          <h5 className="mt-3 text-muted">
                            {Object.values(feedbackFilters).some((f) => f)
                              ? 'No feedback found matching your filters'
                              : 'No feedback received yet'}
                          </h5>
                          <p className="text-muted">
                            {Object.values(feedbackFilters).some((f) => f)
                              ? 'Try adjusting your filters or check back later.'
                              : 'Feedback from faculty and students will appear here once schedules are published.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </Tab.Pane>

                  <Tab.Pane eventKey="versions">
                    <div className="mb-4">
                      <Alert variant="info" className="border-0 shadow-sm">
                        <i className="fas fa-info-circle me-2"></i>
                        <strong>Cross-Level Version History:</strong> This shows all versions created when publishing schedules. Each version includes all levels and groups that were published together.
                      </Alert>
                    </div>

                    {/* ✅ Show cross-level versions */}
                    <VersionHistory
                      showAllLevels={true}
                      onRestore={handleVersionRestore}
                    />
                  </Tab.Pane>
                </Tab.Content>
              </Col>
            </Row>
          </Tab.Container>
        </Container>

        <Modal
          show={showIrregularStudentsModal}
          onHide={() => setShowIrregularStudentsModal(false)}
          size="xl"
          centered
        >
          <Modal.Header
            closeButton
            className="text-white border-0"
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }}
          >
            <Modal.Title>
              <i className="fas fa-user-graduate me-2"></i>
              Irregular Students Management
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-0">
            <IrregularStudentsPage />
          </Modal.Body>
        </Modal>
      </div>
    </Layout>
  );
};

export default SchedulingCommitteeHomePage;