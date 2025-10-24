import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert, Spinner, Nav, Tab } from 'react-bootstrap';
import Layout from '../../components/Layout';
import IrregularStudentsPage from './IrregularStudents';
import ScheduleTable from '../../components/ScheduleTable';
import LevelSelector from '../../components/LevelSelector';
import ActionButtons from '../../components/ActionButtons';
import GroupManagerModal from '../../components/GroupManagerModal';
import { useRouter } from 'next/router';
import { useAvailableGroups, useAlert, useLoading } from '../../lib/hooks';

const SchedulingCommitteeHomePage: React.FC = () => {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [activeTab, setActiveTab] = useState('schedule');
  const [showConfigureGroupsModal, setShowConfigureGroupsModal] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);

  // Custom hooks
  const { groups: availableGroups, refetch: refetchGroups } = useAvailableGroups(selectedLevel);
  const { alert, showAlert, clearAlert } = useAlert();
  const { isLoading, startLoading, stopLoading } = useLoading();

  useEffect(() => {
    if (router.query.refresh === 'true') {
      setRefreshCounter((c) => c + 1);
    }
    fetchFeedbacks();
  }, [router.query.refresh]);

  const generateAISchedule = async () => {
    if (!confirm(`Generate AI schedule for Level ${selectedLevel}? This will create optimized schedules for all groups.`)) {
      return;
    }

    startLoading();
    clearAlert();

    try {
      const groups = availableGroups.length > 0 ? availableGroups : [1];
      const results = [];

      if (groups.length > 1) {
        // MULTI-GROUP mode (AI generates all groups at once)
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
        // SINGLE-GROUP mode
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

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        // For multi-group mode, get the actual number of groups from the API response
        const actualGroupCount = results[0]?.groups?.length || successCount;
        showAlert('success', `AI schedule generated successfully for ${actualGroupCount} group(s)!${failureCount > 0 ? ` ${failureCount} group(s) failed.` : ''}`);
        setRefreshCounter((c) => c + 1);
      } else {
        showAlert('danger', 'Failed to generate AI schedule. Please try again or check for conflicts.');
      }
    } catch (error) {
      console.error('Error generating AI schedule:', error);
      showAlert('danger', 'Network error occurred while generating schedule.');
    } finally {
      stopLoading();
    }
  };

  const publishSchedule = async () => {
    if (!confirm(`Publish schedule for Level ${selectedLevel} to faculty and students? This will make the schedule visible to all users.`)) {
      return;
    }

    startLoading();
    clearAlert();

    try {
      const response = await fetch('/api/scheduleCommittee/publish-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: selectedLevel
        })
      });

      const data = await response.json();

      if (data.success) {
        showAlert('success', 'Schedule published successfully! Faculty and students can now view and provide feedback.');
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

  const fetchFeedbacks = async () => {
    try {
      const response = await fetch('/api/scheduleCommittee/feedback');
      const data = await response.json();
      if (data.success) {
        setFeedbacks(data.feedbacks || []);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    }
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
        showAlert('success', `Successfully created ${numberOfGroups} group(s) for ${numStudents} students`);
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


  const renderScheduleTab = () => (
    <div>
      <Row className="mb-4 g-3">
        <Col lg={3} md={4}>
          <LevelSelector
            selectedLevel={selectedLevel}
            onLevelChange={setSelectedLevel}
          />
        </Col>
        <Col lg={9} md={8}>
          <ActionButtons
            onManageGroups={() => setShowConfigureGroupsModal(true)}
            onGenerateAI={generateAISchedule}
            onPublishSchedule={publishSchedule}
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

      {availableGroups.map(groupNum => (
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
            <h2 className="fw-bold mb-2 schedule-committee-header">
              Scheduling Committee Dashboard
            </h2>
            <p className="text-muted mb-0 schedule-committee-subtitle">
              Manage schedules and irregular students
            </p>
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

          <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'schedule')}>
            <Row>
              <Col>
                <Nav variant="tabs" className="border-0 mb-4">
                  <Nav.Item>
                    <Nav.Link
                      eventKey="schedule"
                      className={`nav-tab px-4 py-3 ${activeTab === 'schedule' ? 'active' : ''}`}
                    >
                      <i className="fas fa-calendar-alt me-2"></i>
                      Schedule Management
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link
                      eventKey="irregular"
                      className={`nav-tab px-4 py-3 ${activeTab === 'irregular' ? 'active' : ''}`}
                    >
                      <i className="fas fa-user-graduate me-2"></i>
                      Irregular Students
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link
                      eventKey="feedback"
                      className={`nav-tab px-4 py-3 ${activeTab === 'feedback' ? 'active' : ''}`}
                    >
                      <i className="fas fa-comments me-2"></i>
                      Feedback
                      {feedbacks.length > 0 && (
                        <span className="badge bg-danger ms-2">{feedbacks.length}</span>
                      )}
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
                  <Tab.Pane eventKey="irregular">
                    <IrregularStudentsPage />
                  </Tab.Pane>
                  <Tab.Pane eventKey="feedback">
                    <div className="mt-4">
                      <h4 className="mb-4" style={{ color: '#1e3a5f' }}>
                        <i className="fas fa-comments me-2"></i>
                        Feedback from Faculty and Students
                      </h4>
                      
                      {feedbacks.length > 0 ? (
                        <div className="row g-3">
                          {feedbacks.map((feedback: any, index: number) => (
                            <div key={feedback.feedback_id || index} className="col-md-6 col-lg-4">
                              <div className="card h-100 border-0 shadow-sm">
                                <div className="card-header d-flex justify-content-between align-items-center" style={{ background: '#f8f9fa' }}>
                                  <div>
                                    <strong style={{ color: '#1e3a5f' }}>
                                      {feedback.first_name} {feedback.last_name}
                                    </strong>
                                    <br />
                                    <small className="text-muted">{feedback.role}</small>
                                  </div>
                                  <div className="text-end">
                                    {feedback.rating && (
                                      <div className="mb-1">
                                        {[...Array(5)].map((_, i) => (
                                          <i
                                            key={i}
                                            className={`fas fa-star${i < feedback.rating ? '' : '-o'}`}
                                            style={{ color: i < feedback.rating ? '#ffc107' : '#dee2e6' }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                    <small className="text-muted">
                                      {feedback.created_at ? new Date(feedback.created_at).toLocaleDateString() : 'N/A'}
                                    </small>
                                  </div>
                                </div>
                                <div className="card-body">
                                  <div className="mb-2">
                                    <span className="badge bg-primary me-2">{feedback.feedback_type}</span>
                                    {feedback.level_num && (
                                      <span className="badge bg-secondary">Level {feedback.level_num}</span>
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
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-5">
                          <i className="fas fa-comments text-muted" style={{ fontSize: '3rem' }}></i>
                          <h5 className="mt-3 text-muted">No feedback received yet</h5>
                          <p className="text-muted">Feedback from faculty and students will appear here once schedules are published.</p>
                        </div>
                      )}
                    </div>
                  </Tab.Pane>
                </Tab.Content>
              </Col>
            </Row>
          </Tab.Container>
        </Container>
      </div>
    </Layout>
  );
};

export default SchedulingCommitteeHomePage;