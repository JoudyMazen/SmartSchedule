import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner, Modal, Badge, InputGroup } from 'react-bootstrap';
import Layout from '../../components/Layout';

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

interface InstructorLoad {
  instructor: string;
  course_count: number;
  total_hours: number;
  courses: string[];
}

interface Feedback {
  feedback_id?: number;
  schedule_id: number;
  user_id: number;
  comment: string;
  feedback_type: string;
  created_at?: string;
  user_name?: string;
}

interface TimeSlot {
  time_slot: string;
}

interface Day {
  day: string;
}

const TeachingLoadCommitteeHomePage: React.FC = () => {
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [selectedVersion, setSelectedVersion] = useState<string>('latest');
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [filteredScheduleData, setFilteredScheduleData] = useState<ScheduleEntry[]>([]);
  const [instructorLoads, setInstructorLoads] = useState<InstructorLoad[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger' | 'warning' | 'info', message: string} | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInstructor, setFilterInstructor] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterCourse, setFilterCourse] = useState('');

  // Modal states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showInstructorLoadModal, setShowInstructorLoadModal] = useState(false);
  const [showConflictsModal, setShowConflictsModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<string>('general');
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number>(1);

  const levels = [3, 4, 5, 6, 7, 8];

  const getGroupsForLevel = (level: number): number[] => {
    switch (level) {
      case 3: return [1, 2];
      case 4: return [1];
      case 5: return [1, 2];
      case 6: return [1];
      case 7: return [1, 2];
      case 8: return [1];
      default: return [1];
    }
  };

  useEffect(() => {
    fetchTimeSlots();
    fetchDays();
  }, []);

  useEffect(() => {
    fetchSchedule();
    fetchFeedbacks();
  }, [selectedLevel, selectedVersion]);

  useEffect(() => {
    filterScheduleData();
  }, [scheduleData, searchTerm, filterInstructor, filterDay, filterCourse]);

  useEffect(() => {
    if (scheduleData.length > 0) {
      calculateInstructorLoads();
      detectConflicts();
    }
  }, [scheduleData]);

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
    setIsLoading(true);
    setAlert(null);
    try {
      const groups = getGroupsForLevel(selectedLevel);
      const allSchedules: ScheduleEntry[] = [];
      
      for (const groupNum of groups) {
        const response = await fetch(`/api/data/schedule?level=${selectedLevel}&group=${groupNum}`);
        const data = await response.json();
        if (data.success && data.entries) {
          allSchedules.push(...data.entries.map((s: any) => ({ ...s, group_num: groupNum })));
        }
      }
      
      setScheduleData(allSchedules);
      if (allSchedules.length === 0) {
        setAlert({
          type: 'warning',
          message: `No schedule entries found for Level ${selectedLevel}`
        });
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setAlert({type: 'danger', message: 'Error fetching schedule data'});
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const response = await fetch(`/api/teachingLoadCommittee/feedback?level=${selectedLevel}`);
      const data = await response.json();
      if (data.success) {
        setFeedbacks(data.feedbacks || []);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
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

    if (filterInstructor) {
      filtered = filtered.filter(entry => entry.instructor === filterInstructor);
    }

    if (filterDay) {
      filtered = filtered.filter(entry => entry.day === filterDay);
    }

    if (filterCourse) {
      filtered = filtered.filter(entry => entry.course_code === filterCourse);
    }

    setFilteredScheduleData(filtered);
  };

  const calculateInstructorLoads = () => {
    const loadMap = new Map<string, InstructorLoad>();

    scheduleData.forEach(entry => {
      if (!entry.instructor) return;

      const [start, end] = entry.time_slot.split('-').map(t => t.trim());
      const startHour = parseInt(start.split(':')[0]);
      const endHour = parseInt(end.split(':')[0]);
      const hours = endHour - startHour >= 1 ? 2 : 1;

      if (!loadMap.has(entry.instructor)) {
        loadMap.set(entry.instructor, {
          instructor: entry.instructor,
          course_count: 0,
          total_hours: 0,
          courses: []
        });
      }

      const load = loadMap.get(entry.instructor)!;
      if (!load.courses.includes(entry.course_code)) {
        load.courses.push(entry.course_code);
        load.course_count++;
      }
      load.total_hours += hours;
    });

    setInstructorLoads(Array.from(loadMap.values()).sort((a, b) => b.total_hours - a.total_hours));
  };

  const detectConflicts = () => {
    const conflictList: any[] = [];
    const instructorSchedule = new Map<string, Set<string>>();

    scheduleData.forEach(entry => {
      if (!entry.instructor) return;

      const key = `${entry.day}-${entry.time_slot}`;
      if (!instructorSchedule.has(entry.instructor)) {
        instructorSchedule.set(entry.instructor, new Set());
      }

      const schedule = instructorSchedule.get(entry.instructor)!;
      if (schedule.has(key)) {
        conflictList.push({
          instructor: entry.instructor,
          day: entry.day,
          time_slot: entry.time_slot,
          conflict_type: 'Double Booking',
          description: `${entry.instructor} is scheduled for multiple courses at the same time`
        });
      } else {
        schedule.add(key);
      }
    });

    setConflicts(conflictList);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      setAlert({type: 'warning', message: 'Please enter feedback text'});
      return;
    }

    setIsLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch('/api/teachingLoadCommittee/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: selectedScheduleId,
          user_id: user.user_id,
          comment: feedbackText,
          feedback_type: feedbackType,
          level: selectedLevel
        })
      });

      const data = await response.json();
      if (data.success) {
        setAlert({type: 'success', message: 'Feedback submitted successfully!'});
        setFeedbackText('');
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

  const getUniqueInstructors = () => {
    return Array.from(new Set(scheduleData.map(e => e.instructor).filter(i => i)));
  };

  const getUniqueCourses = () => {
    return Array.from(new Set(scheduleData.map(e => e.course_code)));
  };

  const shouldRenderCell = (groupNum: number, day: string, currentTimeSlot: string): { render: boolean; rowSpan: number; entry: ScheduleEntry | null } => {
    const [currentStart, currentEnd] = currentTimeSlot.split('-').map(t => t.trim());
    const currentStartHour = parseInt(currentStart.split(':')[0]);
    const currentStartMin = parseInt(currentStart.split(':')[1]);

    for (const entry of filteredScheduleData) {
      if (entry.group_num !== groupNum || entry.day !== day) continue;

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

  const renderScheduleView = () => {
    const groups = getGroupsForLevel(selectedLevel);
    const filteredTimeSlots = timeSlots.filter(slot => {
      const [startTime, endTime] = slot.time_slot.split('-').map(t => t.trim());
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const startTotalMin = startHour * 60 + startMin;
      const endTotalMin = endHour * 60 + endMin;
      const duration = endTotalMin - startTotalMin;
      
      // Only show standard 50-minute time slots from 8:00 to 14:50
      return duration === 50 && startTotalMin >= 480 && endTotalMin <= 890;
    });

    return (
      <div>
        {groups.map(groupNum => (
          <Card key={groupNum} className="shadow-sm mb-4 border-0 overflow-hidden">
            <Card.Header
              className="py-3"
              style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              <h5 className="mb-0 fw-semibold">
                <i className="bi bi-calendar-week me-2"></i>
                Level {selectedLevel} - Group {groupNum}
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              <div style={{ overflowX: 'auto' }}>
                <Table className="mb-0" style={{ minWidth: '800px' }}>
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
                          const cellInfo = shouldRenderCell(groupNum, d.day, ts.time_slot);
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
                                  {entry.instructor && (
                                    <div
                                      className="small mt-1 fw-semibold"
                                      style={{
                                        fontSize: '0.75rem',
                                        color: '#1e3a5f'
                                      }}
                                    >
                                      <i className="bi bi-person-fill me-1"></i>
                                      {entry.instructor}
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
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div style={{ background: '#ececec', minHeight: '100vh' }}>
        <Container className="py-4">
          <div className="mb-4">
            <h2 className="fw-bold mb-2" style={{ color: '#1e3a5f' }}>
              Teaching Load Committee Dashboard
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
              Review schedules, teaching assignments, and provide feedback
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
                    <Button
                      className="border-0 shadow-sm"
                      style={{
                        background: '#87CEEB',
                        color: '#1e3a5f',
                        padding: '8px 20px'
                      }}
                      onClick={() => setShowInstructorLoadModal(true)}
                    >
                      <i className="bi bi-person-workspace me-2"></i>
                      View Teaching Loads
                    </Button>
                    <Button
                      className="border-0 shadow-sm"
                      style={{
                        background: conflicts.length > 0 ? '#dc3545' : '#28a745',
                        color: 'white',
                        padding: '8px 20px'
                      }}
                      onClick={() => setShowConflictsModal(true)}
                    >
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      View Conflicts
                      {conflicts.length > 0 && (
                        <Badge bg="light" text="dark" className="ms-2">
                          {conflicts.length}
                        </Badge>
                      )}
                    </Button>
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

          {/* Filters and Search */}
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
                    {levels.map(level => (
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
                    <Col md={6}>
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
                    <Col md={2}>
                      <Form.Select
                        value={filterInstructor}
                        onChange={(e) => setFilterInstructor(e.target.value)}
                        style={{ borderColor: '#87CEEB' }}
                      >
                        <option value="">All Instructors</option>
                        {getUniqueInstructors().map(instructor => (
                          <option key={instructor} value={instructor}>{instructor}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={2}>
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
                    <Col md={2}>
                      <Button
                        className="w-100"
                        style={{ background: '#b0c4d4', color: '#1e3a5f', border: 'none' }}
                        onClick={() => {
                          setSearchTerm('');
                          setFilterInstructor('');
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

          {/* Schedule View */}
          {isLoading ? (
            <div className="text-center p-5">
              <Spinner animation="border" style={{ color: '#1e3a5f' }} />
              <p className="mt-3" style={{ color: '#1e3a5f' }}>Loading schedule data...</p>
            </div>
          ) : (
            renderScheduleView()
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
                  Previous Feedback & Comments
                </h5>
              </Card.Header>
              <Card.Body>
                {feedbacks.map((feedback, idx) => (
                  <div key={idx} className="border-bottom pb-3 mb-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <Badge bg="primary" className="me-2">{feedback.feedback_type}</Badge>
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

      {/* Feedback Modal */}
      <Modal show={showFeedbackModal} onHide={() => setShowFeedbackModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }} className="text-white">
          <Modal.Title className="fw-semibold">
            <i className="bi bi-chat-dots me-2"></i>
            Submit Feedback to Scheduling Committee
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
                <option value="conflict">Schedule Conflict</option>
                <option value="teaching_load">Teaching Load Concern</option>
                <option value="room_assignment">Room Assignment</option>
                <option value="time_slot">Time Slot Issue</option>
                <option value="other">Other</option>
              </Form.Select>
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

      {/* Instructor Load Modal */}
      <Modal show={showInstructorLoadModal} onHide={() => setShowInstructorLoadModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }} className="text-white">
          <Modal.Title className="fw-semibold">
            <i className="bi bi-person-workspace me-2"></i>
            Teaching Load Distribution
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {instructorLoads.length === 0 ? (
            <div className="text-center p-4">
              <p className="text-muted">No instructor assignments found</p>
            </div>
          ) : (
            <Table striped bordered hover>
              <thead style={{ background: '#87CEEB' }}>
                <tr>
                  <th>Instructor</th>
                  <th className="text-center">Courses</th>
                  <th className="text-center">Total Hours/Week</th>
                  <th>Course Codes</th>
                </tr>
              </thead>
              <tbody>
                {instructorLoads.map((load, idx) => (
                  <tr key={idx}>
                    <td className="fw-semibold">{load.instructor}</td>
                    <td className="text-center">{load.course_count}</td>
                    <td className="text-center">
                      <Badge bg={load.total_hours > 15 ? 'danger' : load.total_hours > 10 ? 'warning' : 'success'}>
                        {load.total_hours} hrs
                      </Badge>
                    </td>
                    <td>
                      {load.courses.map((course, i) => (
                        <Badge key={i} bg="secondary" className="me-1">
                          {course}
                        </Badge>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="mt-3 p-3" style={{ background: '#f8f9fa', borderRadius: '8px' }}>
            <h6 className="fw-semibold mb-2">Load Guidelines:</h6>
            <ul className="mb-0 small">
              <li><Badge bg="success">Green</Badge> = Acceptable load (≤10 hours/week)</li>
              <li><Badge bg="warning">Yellow</Badge> = Moderate load (11-15 hours/week)</li>
              <li><Badge bg="danger">Red</Badge> = High load (&gt;15 hours/week)</li>
            </ul>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowInstructorLoadModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Conflicts Modal */}
      <Modal show={showConflictsModal} onHide={() => setShowConflictsModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)', border: 'none' }} className="text-white">
          <Modal.Title className="fw-semibold">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Schedule Conflicts
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {conflicts.length === 0 ? (
            <div className="text-center p-4">
              <i className="bi bi-check-circle text-success" style={{ fontSize: '3rem' }}></i>
              <h5 className="mt-3 text-success">No Conflicts Detected</h5>
              <p className="text-muted">The current schedule appears to be conflict-free.</p>
            </div>
          ) : (
            <div>
              <Alert variant="warning" className="mb-3">
                <i className="bi bi-info-circle me-2"></i>
                Found {conflicts.length} potential conflict(s) that need attention.
              </Alert>
              {conflicts.map((conflict, idx) => (
                <Card key={idx} className="mb-3 border-danger">
                  <Card.Body>
                    <div className="d-flex align-items-start">
                      <div className="me-3">
                        <Badge bg="danger">{conflict.conflict_type}</Badge>
                      </div>
                      <div className="flex-grow-1">
                        <h6 className="fw-semibold mb-2">{conflict.instructor}</h6>
                        <p className="mb-1">
                          <strong>Time:</strong> {conflict.day} at {conflict.time_slot}
                        </p>
                        <p className="mb-0 text-muted small">{conflict.description}</p>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowConflictsModal(false)}
          >
            Close
          </Button>
          {conflicts.length > 0 && (
            <Button
              variant="danger"
              onClick={() => {
                setShowConflictsModal(false);
                setShowFeedbackModal(true);
                setFeedbackType('conflict');
              }}
            >
              Report Conflict
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Layout>
  );
};

export default TeachingLoadCommitteeHomePage;

