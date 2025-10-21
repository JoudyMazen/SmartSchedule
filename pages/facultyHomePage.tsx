import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner, Modal, Badge, InputGroup } from 'react-bootstrap';
import Layout from '../components/Layout';

interface ScheduleEntry {
  schedule_id: number;
  section_num: number;
  course_code: string;
  course_name: string;
  time_slot: string;
  day: string;
  room: string;
  instructor: string;
  group_num: number;
  activity_type?: string;
  status?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

interface Feedback {
  feedback_id?: number;
  schedule_id: number;
  user_id: number;
  comment: string;
  feedback_type: string;
  rating?: number;
  created_at?: string;
  user_name?: string;
}

interface TimeSlot {
  time_slot: string;
}

interface Day {
  day: string;
}

interface Faculty {
  user_id: number;
  first_name: string;
  last_name: string;
  instructor_name: string;
}

const FacultyHomePage: React.FC = () => {
  // User state
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  
  // Schedule state
  const [selectedLevel, setSelectedLevel] = useState<number>(3);
  const [groups, setGroups] = useState<number[]>([]);
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [filteredScheduleData, setFilteredScheduleData] = useState<ScheduleEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger' | 'warning' | 'info', message: string} | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterCourse, setFilterCourse] = useState('');

  // Feedback states
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackType, setFeedbackType] = useState<string>('general');
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [existingFeedback, setExistingFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData && userData.role === 'faculty') {
      setFaculty({
        user_id: userData.user_id,
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        instructor_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
      });
    }
    fetchTimeSlots();
    fetchDays();
  }, []);

  useEffect(() => {
    if (faculty) {
      fetchSchedule();
      fetchFeedbacks();
    }
  }, [faculty, selectedLevel]);

  useEffect(() => {
    filterScheduleData();
  }, [scheduleData, searchTerm, filterDay, filterCourse]);

  const fetchTimeSlots = async () => {
    try {
      const response = await fetch('/api/data/timeSlots');
      const data = await response.json();
      if (data.success) {
        setTimeSlots(data.timeSlots);
      }
    } catch (error) {
      console.error('Error fetching time slots:', error);
    }
  };

  const fetchDays = async () => {
    try {
      const response = await fetch('/api/data/days');
      const data = await response.json();
      if (data.success) {
        setDays(data.days);
      }
    } catch (error) {
      console.error('Error fetching days:', error);
    }
  };

  const fetchSchedule = async () => {
    if (!faculty) return;
    
    setIsLoading(true);
    setAlert(null);
    try {
      // 1) Fetch groups for the selected level
      const groupsRes = await fetch(`/api/data/groups?level=${selectedLevel}`);
      const groupsJson = await groupsRes.json();
      const levelGroups: number[] = groupsJson?.groups || [];
      setGroups(levelGroups);

      // 2) Fetch schedules for all groups in parallel
      const schedulePromises = levelGroups.map(async (g) => {
        const res = await fetch(`/api/data/schedule?level=${selectedLevel}&group=${g}`);
        const json = await res.json();
        return json?.success && Array.isArray(json.entries) ? json.entries : [];
      });
      const allEntriesArrays = await Promise.all(schedulePromises);
      const combined = allEntriesArrays.flat();

      if (combined.length > 0) {
        setScheduleData(combined);
      } else {
        setScheduleData([]);
        setAlert({ type: 'warning', message: 'No schedule entries found' });
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setAlert({type: 'danger', message: 'Error fetching schedule data'});
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    if (!faculty) return;
    
    try {
      const response = await fetch(`/api/teachingLoadCommittee/feedback?user_id=${faculty.user_id}`);
      const data = await response.json();
      if (data.success) {
        setFeedbacks(data.feedbacks || []);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    }
  };

  const fetchExistingFeedback = async (scheduleId: number) => {
    if (!faculty?.user_id) return;
    try {
      const response = await fetch(`/api/teachingLoadCommittee/feedback?user_id=${faculty.user_id}&schedule_id=${scheduleId}`);
      const data = await response.json();
      if (data.success && data.feedbacks && data.feedbacks.length > 0) {
        const feedback = data.feedbacks[0];
        setExistingFeedback(feedback);
        setFeedbackText(feedback.comment);
        setFeedbackRating(feedback.rating || 5);
        setFeedbackType(feedback.feedback_type || 'general');
      } else {
        setExistingFeedback(null);
        setFeedbackText('');
        setFeedbackRating(5);
        setFeedbackType('general');
      }
    } catch (error) {
      console.error('Error fetching existing feedback:', error);
      setExistingFeedback(null);
      setFeedbackText('');
      setFeedbackRating(5);
      setFeedbackType('general');
    }
  };

  const filterScheduleData = () => {
    let filtered = [...scheduleData];

    if (searchTerm) {
      filtered = filtered.filter(entry => 
        entry.course_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.instructor && entry.instructor.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (filterDay) {
      filtered = filtered.filter(entry => entry.day === filterDay);
    }

    if (filterCourse) {
      filtered = filtered.filter(entry => entry.course_code === filterCourse);
    }

    setFilteredScheduleData(filtered);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      setAlert({type: 'warning', message: 'Please enter feedback text'});
      return;
    }

    if (!faculty) {
      setAlert({type: 'danger', message: 'Faculty information not available'});
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/teachingLoadCommittee/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: selectedScheduleId,
          user_id: faculty.user_id,
          comment: feedbackText,
          feedback_type: feedbackType,
          level: null,
          rating: feedbackRating
        })
      });

      const data = await response.json();
      if (data.success) {
        setAlert({type: 'success', message: 'Feedback submitted successfully!'});
        setFeedbackText('');
        setFeedbackRating(5);
        setFeedbackType('general');
        setShowFeedbackModal(false);
        fetchFeedbacks();
      } else {
        setAlert({type: 'danger', message: data.error || 'Failed to submit feedback'});
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setAlert({type: 'danger', message: 'Error submitting feedback'});
    } finally {
      setIsLoading(false);
    }
  };

  const openFeedbackModal = async (entry: ScheduleEntry) => {
    setSelectedScheduleId(entry.schedule_id);
    setShowFeedbackModal(true);
    await fetchExistingFeedback(entry.schedule_id);
  };

  const shouldRenderCell = (
    entries: ScheduleEntry[],
    day: string,
    currentTimeSlot: string
  ): { render: boolean; rowSpan: number; entry: ScheduleEntry | null } => {
    const [currentStart, currentEnd] = currentTimeSlot.split('-').map(t => t.trim());
    const currentStartHour = parseInt(currentStart.split(':')[0]);
    const currentStartMin = parseInt(currentStart.split(':')[1]);

    for (const entry of entries) {
      if (entry.day !== day) continue;

      const [entryStart, entryEnd] = entry.time_slot.split('-').map(t => t.trim());
      const entryStartHour = parseInt(entryStart.split(':')[0]);
      const entryStartMin = parseInt(entryStart.split(':')[1]);
      const entryEndHour = parseInt(entryEnd.split(':')[0]);
      const entryEndMin = parseInt(entryEnd.split(':')[1]);

      const entryStartTotalMin = entryStartHour * 60 + entryStartMin;
      const entryEndTotalMin = entryEndHour * 60 + entryEndMin;
      const durationMin = entryEndTotalMin - entryStartTotalMin;

      if (currentStartHour === entryStartHour && currentStartMin === entryStartMin) {
        const rowSpan = durationMin >= 100 ? 2 : 1;
        return { render: true, rowSpan, entry };
      }

      const currentStartTotalMin = currentStartHour * 60 + currentStartMin;
      if (currentStartTotalMin > entryStartTotalMin && currentStartTotalMin < entryEndTotalMin) {
        return { render: false, rowSpan: 0, entry: null };
      }
    }

    return { render: true, rowSpan: 1, entry: null };
  };

  const renderScheduleView = (groupNum: number) => {
    const filteredTimeSlots = timeSlots.filter(slot => {
      const [startTime, endTime] = slot.time_slot.split('-').map(t => t.trim());
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const startTotalMin = startHour * 60 + startMin;
      const endTotalMin = endHour * 60 + endMin;
      const duration = endTotalMin - startTotalMin;
      
      return duration === 50 && startTotalMin >= 480 && endTotalMin <= 890;
    });

    return (
      <Card className="shadow-sm border-0 overflow-hidden">
        <Card.Header
          className="py-3"
          style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
            color: 'white',
            border: 'none'
          }}
        >
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-semibold">
              <i className="bi bi-calendar-week me-2"></i>
              Level {selectedLevel} - Group {groupNum}
            </h5>
            {scheduleData.length > 0 && (
              <Badge bg="light" text="dark" className="px-3 py-2">
                Latest v{scheduleData[0]?.version || 1}
              </Badge>
            )}
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <div style={{ overflowX: 'auto' }}>
            <Table className="mb-0" style={{ minWidth: '1000px' }}>
              <thead>
                <tr style={{ background: '#87CEEB' }}>
                  <th
                    style={{
                      width: '130px',
                      background: '#1e3a5f',
                      color: 'white',
                      fontWeight: '600',
                      padding: '12px',
                      fontSize: '0.9rem',
                      border: 'none'
                    }}
                  >
                    Time/Day
                  </th>
                  {days.map(d => (
                    <th
                      key={d.day}
                      className="text-center"
                      style={{
                        color: '#1e3a5f',
                        fontWeight: '600',
                        padding: '12px',
                        fontSize: '0.9rem',
                        border: 'none',
                        borderLeft: '1px solid #dee2e6'
                      }}
                    >
                      {d.day}
                    </th>
                  ))}
                  <th
                    className="text-center"
                    style={{
                      color: '#1e3a5f',
                      fontWeight: '600',
                      padding: '12px',
                      fontSize: '0.9rem',
                      border: 'none',
                      borderLeft: '1px solid #dee2e6',
                      background: '#87CEEB'
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTimeSlots.map((ts, idx) => (
                  <tr key={ts.time_slot}>
                    <td
                      className="fw-semibold text-center align-middle"
                      style={{
                        background: '#b0c4d4',
                        color: '#1e3a5f',
                        fontSize: '0.85rem',
                        padding: '12px',
                        border: 'none',
                        borderTop: idx > 0 ? '1px solid #dee2e6' : 'none'
                      }}
                    >
                      {ts.time_slot}
                    </td>
                    {days.map(d => {
                      const filteredForGroup = filteredScheduleData.filter(e => e.group_num === groupNum);
                      const cellInfo = shouldRenderCell(filteredForGroup, d.day, ts.time_slot);
                      if (!cellInfo.render) {
                        return null;
                      }
                      const entry = cellInfo.entry;

                      return (
                        <td
                          key={`${d.day}-${ts.time_slot}`}
                          className="text-center align-middle position-relative"
                          rowSpan={cellInfo.rowSpan}
                          style={{
                            minHeight: cellInfo.rowSpan === 2 ? '180px' : '90px',
                            background: entry ? '#e6f4ff' : 'white',
                            padding: '12px',
                            border: 'none',
                            borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                            borderLeft: '1px solid #dee2e6',
                            transition: 'all 0.2s ease',
                            verticalAlign: 'middle'
                          }}
                        >
                          {entry ? (
                            <div className="position-relative">
                              <div
                                className="fw-bold mb-1"
                                style={{
                                  fontSize: '1rem',
                                  color: '#1e3a5f'
                                }}
                              >
                                {entry.course_code}
                              </div>
                              <div
                                className="small"
                                style={{
                                  fontSize: '0.8rem',
                                  color: '#1e3a5f'
                                }}
                              >
                                {entry.course_name}
                              </div>
                              {entry.activity_type && (
                                <div
                                  className="small mt-1"
                                  style={{
                                    fontSize: '0.75rem',
                                    color: '#1e3a5f'
                                  }}
                                >
                                  <span style={{
                                    background: entry.activity_type === 'Lecture' ? '#e3f2fd' : 
                                               entry.activity_type === 'Lab' ? '#f3e5f5' : '#e8f5e9',
                                    padding: '2px 8px',
                                    borderRadius: '8px',
                                    fontSize: '0.7rem'
                                  }}>
                                    {entry.activity_type}
                                  </span>
                                </div>
                              )}
                              {entry.room && (
                                <div
                                  className="small mt-1"
                                  style={{
                                    fontSize: '0.75rem',
                                    color: '#1e3a5f',
                                    fontWeight: '500'
                                  }}
                                >
                                  <i className="bi bi-geo-alt-fill me-1"></i>
                                  {entry.room}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="text-muted"
                              style={{
                                fontSize: '0.85rem',
                                opacity: 0.4
                              }}
                            >
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* Actions column */}
                    <td
                      className="text-center align-middle"
                      style={{
                        minHeight: '90px',
                        background: 'white',
                        padding: '12px',
                        border: 'none',
                        borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                        borderLeft: '1px solid #dee2e6',
                        verticalAlign: 'middle'
                      }}
                    >
                      {(() => {
                        const entriesForTimeSlot = filteredScheduleData.filter(entry => 
                          entry.time_slot === ts.time_slot
                        );
                        
                        if (entriesForTimeSlot.length > 0) {
                          const entry = entriesForTimeSlot[0];
                          return (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => openFeedbackModal(entry)}
                              style={{
                                fontSize: '0.7rem',
                                padding: '4px 12px'
                              }}
                            >
                              <i className="bi bi-chat-dots me-1"></i>
                              Feedback
                            </Button>
                          );
                        }
                        return null;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    );
  };

  return (
    <Layout>
      <div style={{ background: '#ececec', minHeight: '100vh' }}>
        <Container className="py-4">
          <div className="mb-4">
            <h2 className="fw-bold mb-2" style={{ color: '#1e3a5f' }}>
              Faculty Dashboard
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
              View your teaching schedule and provide feedback
            </p>
          </div>

          {alert && (
            <Alert
              variant={alert.type}
              onClose={() => setAlert(null)}
              dismissible
              className="border-0 shadow-sm"
            >
              {alert.message}
            </Alert>
          )}

          {/* Action Buttons */}
          <Row className="mb-4 g-3">
            <Col md={12}>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <div className="d-flex gap-2 flex-wrap">
                    <Button
                      className="border-0 shadow-sm"
                      style={{
                        background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                        color: 'white',
                        padding: '8px 20px'
                      }}
                      onClick={() => {
                        setSelectedScheduleId(null);
                        setShowFeedbackModal(true);
                      }}
                    >
                      <i className="bi bi-chat-dots me-2"></i>
                      Submit Feedback
                    </Button>
                    {/* Removed View Teaching Loads button per requirement */}
                    {/* Removed View Conflicts button as AI generator ensures no conflicts */}
                    <Button
                      className="border-0 shadow-sm"
                      style={{
                        background: '#b0c4d4',
                        color: '#1e3a5f',
                        padding: '8px 20px'
                      }}
                      onClick={fetchSchedule}
                    >
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Refresh
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Level first, then Search & Filter */}
          <Row className="mb-4 g-3">
            <Col lg={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>Level</h6>
                  <Form.Select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(parseInt(e.target.value))}
                    className="border-2"
                    style={{ borderColor: '#87CEEB', color: '#1e3a5f' }}
                  >
                    {[3,4,5,6,7,8].map(level => (
                      <option key={level} value={level}>Level {level}</option>
                    ))}
                  </Form.Select>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={9}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>Search & Filter</h6>
                  <Row className="g-2">
                    <Col md={4}>
                      <InputGroup>
                        <InputGroup.Text style={{ background: '#87CEEB', border: 'none' }}>
                          <i className="bi bi-search"></i>
                        </InputGroup.Text>
                        <Form.Control
                          placeholder="Search courses, instructors..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          style={{ borderColor: '#87CEEB' }}
                        />
                      </InputGroup>
                    </Col>
                    <Col md={3}>
                      <Form.Select
                        value={filterDay}
                        onChange={(e) => setFilterDay(e.target.value)}
                        style={{ borderColor: '#87CEEB' }}
                      >
                        <option value="">All Days</option>
                        {days.map(day => (
                          <option key={day.day} value={day.day}>{day.day}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={3}>
                      <Form.Select
                        value={filterCourse}
                        onChange={(e) => setFilterCourse(e.target.value)}
                        style={{ borderColor: '#87CEEB' }}
                      >
                        <option value="">All Courses</option>
                        {Array.from(new Set(scheduleData.map(e => e.course_code))).map(course => (
                          <option key={course} value={course}>{course}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={2}>
                      <Button
                        className="w-100"
                        style={{ background: '#b0c4d4', color: '#1e3a5f', border: 'none' }}
                        onClick={() => {
                          setSearchTerm('');
                          setFilterDay('');
                          setFilterCourse('');
                        }}
                      >
                        Clear
                      </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
            
          </Row>

          {/* Schedule Views per group */}
          {isLoading ? (
            <div className="text-center p-5">
              <Spinner animation="border" style={{ color: '#1e3a5f' }} />
              <p className="mt-3" style={{ color: '#1e3a5f' }}>Loading schedule data...</p>
            </div>
          ) : (
            <>
              {groups.length > 0 ? (
                groups.map(g => (
                  <div key={g} className="mb-4">
                    {renderScheduleView(g)}
                  </div>
                ))
              ) : (
                renderScheduleView(1)
              )}
            </>
          )}

          {/* Previous Feedbacks */}
          {feedbacks.length > 0 && (
            <Card className="shadow-sm mt-4 border-0">
              <Card.Header
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                  color: 'white',
                  border: 'none'
                }}
              >
                <h5 className="mb-0 fw-semibold">
                  <i className="bi bi-chat-left-text me-2"></i>
                  My Previous Feedback
                </h5>
              </Card.Header>
              <Card.Body>
                {feedbacks.map((feedback, idx) => (
                  <div key={idx} className="border-bottom pb-3 mb-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        {feedback.rating && (
                          <div className="mb-2">
                            {[...Array(5)].map((_, i) => (
                              <i
                                key={i}
                                className={`bi bi-star${i < feedback.rating! ? '-fill' : ''}`}
                                style={{ color: i < feedback.rating! ? '#ffc107' : '#dee2e6' }}
                              />
                            ))}
                          </div>
                        )}
                        <small className="text-muted">
                          {feedback.created_at ? new Date(feedback.created_at).toLocaleString() : 'N/A'}
                        </small>
                      </div>
                      <small className="text-muted">Schedule ID: {feedback.schedule_id}</small>
                    </div>
                    <p className="mt-2 mb-0">{feedback.comment}</p>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}
        </Container>
      </div>

      {/* Feedback Modal - Same as Teaching Load Committee */}
      <Modal show={showFeedbackModal} onHide={() => setShowFeedbackModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }} className="text-white">
          <Modal.Title className="fw-semibold">
            <i className="bi bi-chat-dots me-2"></i>
            Submit Schedule Feedback
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Feedback Type</Form.Label>
              <Form.Select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                style={{ borderColor: '#87CEEB' }}
              >
                <option value="general">General Feedback</option>
                {/* Removed conflict option as conflicts are not shown to faculty */}
                <option value="teaching_load">Teaching Load Concern</option>
                <option value="room_assignment">Room Assignment</option>
                <option value="time_slot">Time Slot Issue</option>
                <option value="other">Other</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Rating (1-5 stars)</Form.Label>
              <div className="d-flex align-items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <i
                    key={star}
                    className={`bi bi-star${star <= feedbackRating ? '-fill' : ''} me-1`}
                    style={{ 
                      color: star <= feedbackRating ? '#ffc107' : '#dee2e6',
                      fontSize: '1.5rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => setFeedbackRating(star)}
                  />
                ))}
                <span className="ms-2 text-muted">({feedbackRating}/5)</span>
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Your Feedback</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Provide detailed feedback or suggestions for the schedule..."
                style={{ borderColor: '#87CEEB' }}
              />
              <Form.Text className="text-muted">
                Be specific about the issues you've identified and provide constructive suggestions.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowFeedbackModal(false)}
          >
            Cancel
          </Button>
          <Button
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }}
            onClick={handleSubmitFeedback}
            disabled={isLoading}
          >
            {isLoading ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
};

export default FacultyHomePage;