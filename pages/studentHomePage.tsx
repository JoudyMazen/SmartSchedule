import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner, Modal, Badge, InputGroup, ListGroup } from 'react-bootstrap';
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
}

interface ExamEntry {
  exam_id: number;
  course_code: string;
  course_name: string;
  exam_date: string;
  exam_time: string;
  room: string;
  level: number;
  group_num?: number;
}

interface ElectiveCourse {
  course_id: number;
  course_code: string;
  course_name: string;
  department: string;
  available_sections: number;
  level: number;
}

interface StudentPreference {
  preference_id?: number;
  student_id: number;
  course_id: number;
  priority: number;
  created_at?: string;
}

interface Feedback {
  feedback_id?: number;
  schedule_id?: number;
  exam_id?: number;
  student_id: number;
  comment: string;
  feedback_type: string;
  level: number;
  group_num: number;
  created_at?: string;
}

interface TimeSlot {
  time_slot: string;
}

interface Day {
  day: string;
}

const StudentHomePage: React.FC = () => {
  const [student, setStudent] = useState<any>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(3);
  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [filteredScheduleData, setFilteredScheduleData] = useState<ScheduleEntry[]>([]);
  const [examData, setExamData] = useState<ExamEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger' | 'warning' | 'info', message: string} | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDay, setFilterDay] = useState('');

  // Elective survey state
  const [electiveCourses, setElectiveCourses] = useState<ElectiveCourse[]>([]);
  const [selectedElectives, setSelectedElectives] = useState<{[key: number]: number}>({});
  const [myPreferences, setMyPreferences] = useState<StudentPreference[]>([]);
  const [showSurveyModal, setShowSurveyModal] = useState(false);

  // Feedback state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<string>('schedule');
  const [feedbackTarget, setFeedbackTarget] = useState<'schedule' | 'exam'>('schedule');
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [myFeedbacks, setMyFeedbacks] = useState<Feedback[]>([]);

  // Active view
  const [activeView, setActiveView] = useState<'schedule' | 'exam'>('schedule');

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
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setStudent(user);
      setSelectedLevel(user.level || 3);
      setSelectedGroup(user.group_num || 1);
    }
    
    fetchTimeSlots();
    fetchDays();
  }, []);

  useEffect(() => {
    if (student) {
      fetchSchedule();
      fetchExams();
      fetchMyFeedbacks();
      fetchElectiveCourses();
      fetchMyPreferences();
    }
  }, [selectedLevel, selectedGroup, student]);

  useEffect(() => {
    filterScheduleData();
  }, [scheduleData, searchTerm, filterDay]);

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
    try {
      const response = await fetch(`/api/data/schedule?level=${selectedLevel}&group=${selectedGroup}`);
      const data = await response.json();
      if (data.success && data.entries) {
        setScheduleData(data.entries);
      } else {
        setScheduleData([]);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setAlert({type: 'danger', message: 'Error fetching schedule data'});
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/data/exams?level=${selectedLevel}&group=${selectedGroup}`);
      const data = await response.json();
      if (data.success && data.exams) {
        setExamData(data.exams);
      } else {
        setExamData([]);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
      setAlert({type: 'danger', message: 'Error fetching exam data'});
    } finally {
      setIsLoading(false);
    }
  };

  const fetchElectiveCourses = async () => {
    try {
      const response = await fetch(`/api/student/electiveCourses?level=${selectedLevel}`);
      const data = await response.json();
      if (data.success) {
        setElectiveCourses(data.courses || []);
      }
    } catch (error) {
      console.error('Error fetching elective courses:', error);
    }
  };

  const fetchMyPreferences = async () => {
    if (!student) return;
    try {
      const response = await fetch(`/api/student/preferences?student_id=${student.user_id}`);
      const data = await response.json();
      if (data.success) {
        setMyPreferences(data.preferences || []);
        const preSelected: {[key: number]: number} = {};
        data.preferences.forEach((pref: StudentPreference) => {
          preSelected[pref.course_id] = pref.priority;
        });
        setSelectedElectives(preSelected);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const fetchMyFeedbacks = async () => {
    if (!student) return;
    try {
      const response = await fetch(`/api/student/feedback?student_id=${student.user_id}&level=${selectedLevel}&group=${selectedGroup}`);
      const data = await response.json();
      if (data.success) {
        setMyFeedbacks(data.feedbacks || []);
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

    if (filterDay) {
      filtered = filtered.filter(entry => entry.day === filterDay);
    }

    setFilteredScheduleData(filtered);
  };

  const handleElectiveSelection = (courseId: number, priority: number) => {
    setSelectedElectives(prev => ({
      ...prev,
      [courseId]: priority
    }));
  };

  const handleSubmitPreferences = async () => {
    if (Object.keys(selectedElectives).length === 0) {
      setAlert({type: 'warning', message: 'Please select at least one elective course'});
      return;
    }

    setIsLoading(true);
    try {
      const preferences = Object.entries(selectedElectives).map(([courseId, priority]) => ({
        student_id: student.user_id,
        course_id: parseInt(courseId),
        priority: priority
      }));

      const response = await fetch('/api/student/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences })
      });

      const data = await response.json();
      if (data.success) {
        setAlert({type: 'success', message: 'Elective preferences submitted successfully!'});
        setShowSurveyModal(false);
        fetchMyPreferences();
      } else {
        setAlert({type: 'danger', message: data.error || 'Failed to submit preferences'});
      }
    } catch (error) {
      console.error('Error submitting preferences:', error);
      setAlert({type: 'danger', message: 'Error submitting preferences'});
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      setAlert({type: 'warning', message: 'Please enter your feedback'});
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/student/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student.user_id,
          schedule_id: feedbackTarget === 'schedule' ? selectedScheduleId : null,
          exam_id: feedbackTarget === 'exam' ? selectedExamId : null,
          comment: feedbackText,
          feedback_type: feedbackType,
          feedback_target: feedbackTarget,
          level: selectedLevel,
          group_num: selectedGroup
        })
      });

      const data = await response.json();
      if (data.success) {
        setAlert({type: 'success', message: 'Feedback submitted successfully!'});
        setFeedbackText('');
        setShowFeedbackModal(false);
        setSelectedScheduleId(null);
        setSelectedExamId(null);
        fetchMyFeedbacks();
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

  const openScheduleFeedbackModal = (scheduleId?: number) => {
    setFeedbackTarget('schedule');
    setSelectedScheduleId(scheduleId || null);
    setSelectedExamId(null);
    setFeedbackType('schedule');
    setFeedbackText('');
    setShowFeedbackModal(true);
  };

  const openExamFeedbackModal = (examId?: number) => {
    setFeedbackTarget('exam');
    setSelectedExamId(examId || null);
    setSelectedScheduleId(null);
    setFeedbackType('exam');
    setFeedbackText('');
    setShowFeedbackModal(true);
  };

  const shouldRenderCell = (day: string, currentTimeSlot: string): { render: boolean; rowSpan: number; entry: ScheduleEntry | null } => {
    const [currentStart] = currentTimeSlot.split('-').map(t => t.trim());
    const currentStartHour = parseInt(currentStart.split(':')[0]);
    const currentStartMin = parseInt(currentStart.split(':')[1]);

    for (const entry of filteredScheduleData) {
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

  const renderScheduleView = () => {
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
          className="py-3 d-flex justify-content-between align-items-center"
          style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
            color: 'white',
            border: 'none'
          }}
        >
          <h5 className="mb-0 fw-semibold">
            <i className="bi bi-calendar-week me-2"></i>
            My Schedule - Level {selectedLevel}, Group {selectedGroup}
          </h5>
          <Button
            size="sm"
            style={{
              background: '#87CEEB',
              color: '#1e3a5f',
              border: 'none',
              fontWeight: '600'
            }}
            onClick={() => openScheduleFeedbackModal()}
          >
            <i className="bi bi-chat-dots me-1"></i>
            Give Feedback
          </Button>
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
                      const cellInfo = shouldRenderCell(d.day, ts.time_slot);
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
                                <div className="small mt-1">
                                  <span style={{
                                    background: entry.activity_type === 'Lecture' ? '#e3f2fd' : 
                                               entry.activity_type === 'Lab' ? '#f3e5f5' : '#e8f5e9',
                                    padding: '2px 8px',
                                    borderRadius: '8px',
                                    fontSize: '0.7rem',
                                    color: '#1e3a5f'
                                  }}>
                                    {entry.activity_type}
                                  </span>
                                </div>
                              )}
                              {entry.instructor && (
                                <div className="small mt-1 fw-semibold" style={{ fontSize: '0.75rem', color: '#1e3a5f' }}>
                                  <i className="bi bi-person-fill me-1"></i>
                                  {entry.instructor}
                                </div>
                              )}
                              {entry.room && (
                                <div className="small mt-1" style={{ fontSize: '0.75rem', color: '#1e3a5f', fontWeight: '500' }}>
                                  <i className="bi bi-geo-alt-fill me-1"></i>
                                  {entry.room}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted" style={{ fontSize: '0.85rem', opacity: 0.4 }}>
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
    );
  };

  const renderExamView = () => {
    return (
      <Card className="shadow-sm border-0 overflow-hidden">
        <Card.Header
          className="py-3 d-flex justify-content-between align-items-center"
          style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
            color: 'white',
            border: 'none'
          }}
        >
          <h5 className="mb-0 fw-semibold">
            <i className="bi bi-file-text me-2"></i>
            Exam Timetable - Level {selectedLevel}, Group {selectedGroup}
          </h5>
          <Button
            size="sm"
            style={{
              background: '#87CEEB',
              color: '#1e3a5f',
              border: 'none',
              fontWeight: '600'
            }}
            onClick={() => openExamFeedbackModal()}
          >
            <i className="bi bi-chat-dots me-1"></i>
            Give Feedback
          </Button>
        </Card.Header>
        <Card.Body>
          {examData.length === 0 ? (
            <div className="text-center p-5">
              <i className="bi bi-calendar-x text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">No exam schedule available yet</p>
            </div>
          ) : (
            <Table striped hover responsive>
              <thead style={{ background: '#87CEEB' }}>
                <tr>
                  <th style={{ color: '#1e3a5f' }}>Course Code</th>
                  <th style={{ color: '#1e3a5f' }}>Course Name</th>
                  <th style={{ color: '#1e3a5f' }}>Date</th>
                  <th style={{ color: '#1e3a5f' }}>Time</th>
                  <th style={{ color: '#1e3a5f' }}>Room</th>
                  <th style={{ color: '#1e3a5f' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {examData.map((exam, idx) => (
                  <tr key={idx}>
                    <td className="fw-semibold">{exam.course_code}</td>
                    <td>{exam.course_name}</td>
                    <td>
                      <i className="bi bi-calendar-event me-2"></i>
                      {new Date(exam.exam_date).toLocaleDateString()}
                    </td>
                    <td>
                      <i className="bi bi-clock me-2"></i>
                      {exam.exam_time}
                    </td>
                    <td>
                      <i className="bi bi-geo-alt me-2"></i>
                      {exam.room}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => openExamFeedbackModal(exam.exam_id)}
                      >
                        <i className="bi bi-chat-square-text me-1"></i>
                        Feedback
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
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
              Student Dashboard
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
              View your schedule, exam timetable, submit elective preferences, and provide feedback
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

          {/* Action Buttons - Same as Teaching Load Committee */}
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
                      onClick={() => setShowSurveyModal(true)}
                    >
                      <i className="bi bi-card-checklist me-2"></i>
                      Elective Survey
                    </Button>
                    <Button
                      className="border-0 shadow-sm"
                      style={{
                        background: '#b0c4d4',
                        color: '#1e3a5f',
                        padding: '8px 20px'
                      }}
                      onClick={() => {
                        fetchSchedule();
                        fetchExams();
                      }}
                    >
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Refresh
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Filters and Search - Same as Teaching Load Committee */}
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
                    <Col md={2}>
                      <Form.Select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(parseInt(e.target.value))}
                        style={{ borderColor: '#87CEEB' }}
                      >
                        {getGroupsForLevel(selectedLevel).map(group => (
                          <option key={group} value={group}>Group {group}</option>
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
                      <Form.Select
                        value={activeView}
                        onChange={(e) => setActiveView(e.target.value as 'schedule' | 'exam')}
                        style={{ borderColor: '#87CEEB' }}
                      >
                        <option value="schedule">Schedule</option>
                        <option value="exam">Exams</option>
                      </Form.Select>
                    </Col>
                    <Col md={2}>
                      <Button
                        className="w-100"
                        style={{ background: '#b0c4d4', color: '#1e3a5f', border: 'none' }}
                        onClick={() => {
                          setSearchTerm('');
                          setFilterDay('');
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

          {/* Main Content View */}
          {isLoading ? (
            <div className="text-center p-5">
              <Spinner animation="border" style={{ color: '#1e3a5f' }} />
              <p className="mt-3" style={{ color: '#1e3a5f' }}>Loading...</p>
            </div>
          ) : (
            <>
              {activeView === 'schedule' && renderScheduleView()}
              {activeView === 'exam' && renderExamView()}
            </>
          )}

          {/* My Preferences */}
          {myPreferences.length > 0 && (
            <Card className="shadow-sm mt-4 border-0">
              <Card.Header
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                  color: 'white',
                  border: 'none'
                }}
              >
                <h5 className="mb-0 fw-semibold">
                  <i className="bi bi-star-fill me-2"></i>
                  My Elective Preferences
                </h5>
              </Card.Header>
              <Card.Body>
                <ListGroup>
                  {myPreferences.map((pref, idx) => {
                    const course = electiveCourses.find(c => c.course_id === pref.course_id);
                    return (
                      <ListGroup.Item key={idx} className="d-flex justify-content-between align-items-center">
                        <div>
                          <Badge bg="primary" className="me-2">Priority {pref.priority}</Badge>
                          <strong>{course?.course_code}</strong> - {course?.course_name}
                        </div>
                        <small className="text-muted">{course?.department}</small>
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              </Card.Body>
            </Card>
          )}

          {/* My Feedback */}
          {myFeedbacks.length > 0 && (
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
                {myFeedbacks.map((feedback, idx) => (
                  <div key={idx} className="border-bottom pb-3 mb-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <Badge bg={feedback.feedback_target === 'schedule' ? 'primary' : 'info'} className="me-2">
                          {feedback.feedback_type}
                        </Badge>
                        <Badge bg="secondary">
                          Level {feedback.level} - Group {feedback.group_num}
                        </Badge>
                      </div>
                      <small className="text-muted">
                        {feedback.created_at ? new Date(feedback.created_at).toLocaleString() : 'N/A'}
                      </small>
                    </div>
                    <p className="mt-2 mb-0">{feedback.comment}</p>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}
        </Container>
      </div>

      {/* Elective Survey Modal */}
      <Modal show={showSurveyModal} onHide={() => setShowSurveyModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }} className="text-white">
          <Modal.Title className="fw-semibold">
            <i className="bi bi-card-checklist me-2"></i>
            Elective Course Preferences Survey
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-3">
            <i className="bi bi-info-circle me-2"></i>
            Select your preferred elective courses and assign priority (1 = highest priority)
          </Alert>
          {electiveCourses.length === 0 ? (
            <div className="text-center p-4">
              <p className="text-muted">No elective courses available at this time</p>
            </div>
          ) : (
            <div>
              {electiveCourses.map(course => (
                <Card key={course.course_id} className="mb-3">
                  <Card.Body>
                    <Row className="align-items-center">
                      <Col md={8}>
                        <h6 className="mb-1 fw-semibold">{course.course_code}</h6>
                        <p className="mb-1 small">{course.course_name}</p>
                        <small className="text-muted">
                          <Badge bg="secondary">{course.department}</Badge>
                          <span className="ms-2">{course.available_sections} section(s) available</span>
                        </small>
                      </Col>
                      <Col md={4}>
                        <Form.Label className="small fw-semibold">Priority</Form.Label>
                        <Form.Select
                          size="sm"
                          value={selectedElectives[course.course_id] || ''}
                          onChange={(e) => handleElectiveSelection(course.course_id, parseInt(e.target.value))}
                          style={{ borderColor: '#87CEEB' }}
                        >
                          <option value="">Not Selected</option>
                          <option value="1">1 (Highest)</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5 (Lowest)</option>
                        </Form.Select>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSurveyModal(false)}>
            Cancel
          </Button>
          <Button
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }}
            onClick={handleSubmitPreferences}
            disabled={isLoading || Object.keys(selectedElectives).length === 0}
          >
            {isLoading ? 'Submitting...' : 'Submit Preferences'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Feedback Modal */}
      <Modal show={showFeedbackModal} onHide={() => setShowFeedbackModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }} className="text-white">
          <Modal.Title className="fw-semibold">
            <i className="bi bi-chat-dots me-2"></i>
            Submit Feedback on {feedbackTarget === 'schedule' ? 'Schedule' : 'Exam Timetable'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-3">
            <i className="bi bi-info-circle me-2"></i>
            You are submitting feedback for Level {selectedLevel}, Group {selectedGroup}
          </Alert>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Feedback Type</Form.Label>
              <Form.Select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                style={{ borderColor: '#87CEEB' }}
              >
                {feedbackTarget === 'schedule' ? (
                  <>
                    <option value="schedule">General Schedule Feedback</option>
                    <option value="conflict">Time Conflict</option>
                    <option value="room">Room Location</option>
                    <option value="instructor">Instructor</option>
                    <option value="time_slot">Time Slot Issue</option>
                  </>
                ) : (
                  <>
                    <option value="exam">General Exam Feedback</option>
                    <option value="exam_conflict">Exam Conflict</option>
                    <option value="exam_date">Exam Date Issue</option>
                    <option value="exam_time">Exam Time Issue</option>
                    <option value="exam_room">Exam Room Issue</option>
                  </>
                )}
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
                placeholder={`Share your thoughts about the ${feedbackTarget === 'schedule' ? 'schedule' : 'exam timetable'}, any conflicts you've noticed, or suggestions for improvement...`}
                style={{ borderColor: '#87CEEB' }}
              />
              <Form.Text className="text-muted">
                Your feedback helps us improve the {feedbackTarget === 'schedule' ? 'scheduling' : 'exam scheduling'} process for everyone.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFeedbackModal(false)}>
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

export default StudentHomePage;