import React, { useEffect, useState } from 'react';
import { Container, Card, Form, Row, Col, Button, Alert, Table } from 'react-bootstrap';
import Layout from '../../components/Layout';

interface Level {
  level_num: number;
  groups: number[];
}

interface Course {
  course_code: string;
  course_name: string;
  level: number;
  lecture_hours: number;
  tutorial_hours: number;
  lab_hours: number;
}

interface TimeSlot {
  time_slot: string;
}

interface Day {
  day: string;
}

interface ScheduleEntry {
  course_code: string;
  course_name: string;
  section_num: number;
  activity_type: string;
  time_slot: string;
  day: string;
  schedule_id: number;
}

interface SessionInput {
  day: string;
  time_slot: string;
}

const AddOtherDepartment: React.FC = () => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState<number | null>(null);
  const [group, setGroup] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

  const [lectureSection, setLectureSection] = useState('');
  const [lectureSessions, setLectureSessions] = useState<SessionInput[]>([]);
  
  const [tutorialSection, setTutorialSection] = useState('');
  const [tutorialSession, setTutorialSession] = useState<SessionInput>({ day: '', time_slot: '' });
  
  const [labSection, setLabSection] = useState('');
  const [labSession, setLabSession] = useState<SessionInput>({ day: '', time_slot: '' });

  const [errors, setErrors] = useState<{
    lectureSection?: string;
    lectureSessions?: string;
    tutorialSection?: string;
    tutorialSession?: string;
    labSection?: string;
    labSession?: string;
    general?: string;
  }>({});

  useEffect(() => {
    fetch('/api/data/levels')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.levels)) {
          setLevels(data.levels);
          if (data.levels.length > 0) {
            setLevel(data.levels[0].level_num);
            setGroup(data.levels[0].groups[0]);
          }
        }
      })
      .catch(err => console.error('Error fetching levels:', err));
  }, []);

  useEffect(() => {
    fetch('/api/data/days')
      .then(res => res.json())
      .then(data => {
        if (data.success) setDays(data.days);
      })
      .catch(err => console.error(err));

    fetch('/api/data/timeSlots')
      .then(res => res.json())
      .then(data => {
        if (data.success) setTimeSlots(data.timeSlots);
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!level) return;
    
    fetch(`/api/data/courses?level=${level}&excludeSWE=true`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setCourses(data.courses);
        else setCourses([]);
      })
      .catch(err => {
        console.error(err);
        setCourses([]);
      });

    if (group) fetchScheduleEntries();
  }, [level, group]);

  const fetchScheduleEntries = async () => {
    if (!level || !group) return;
    
    try {
      const response = await fetch(`/api/data/schedule?level=${level}&group=${group}`);
      const data = await response.json();
      if (data.success) {
        setScheduleEntries(data.entries);
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
    }
  };

  const handleCourseSelect = (courseCode: string) => {
    const course = courses.find(c => c.course_code === courseCode);
    setSelectedCourse(course || null);
    
    setLectureSection('');
    setLectureSessions([]);
    setTutorialSection('');
    setTutorialSession({ day: '', time_slot: '' });
    setLabSection('');
    setLabSession({ day: '', time_slot: '' });
    setErrors({});
    setAlert(null);
  };

  const addLectureSession = () => {
    if (lectureSessions.length < (selectedCourse?.lecture_hours || 0)) {
      setLectureSessions([...lectureSessions, { day: '', time_slot: '' }]);
    }
  };

  const updateLectureSession = (index: number, field: 'day' | 'time_slot', value: string) => {
    const updated = [...lectureSessions];
    updated[index] = { ...updated[index], [field]: value };
    setLectureSessions(updated);
    if (errors.lectureSessions) setErrors({ ...errors, lectureSessions: undefined });
  };

  const removeLectureSession = (index: number) => {
    setLectureSessions(lectureSessions.filter((_, i) => i !== index));
    if (errors.lectureSessions) setErrors({ ...errors, lectureSessions: undefined });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    setErrors({});
  
    if (!selectedCourse) {
      setErrors({ general: 'Please select a course' });
      return;
    }

    const courseExists = scheduleEntries.some(entry => entry.course_code === selectedCourse.course_code);
    if (courseExists) {
      setErrors({ 
        general: `Course ${selectedCourse.course_code} is already scheduled for Level ${level}, Group ${group}. Please select a different course or remove the existing schedule first.` 
      });
      return;
    }
  
    const allEntries: any[] = [];
  
    if (selectedCourse.lecture_hours > 0) {
      if (!lectureSection || lectureSection.length !== 5) {
        setErrors({ lectureSection: 'Enter lecture section number (5 digits)' });
        return;
      }

      let totalLectureHours = 0;
      for (const session of lectureSessions) {
        if (!session.day || !session.time_slot) {
          setErrors({ lectureSessions: 'All lecture sessions must have day and time selected' });
          return;
        }
        const [start, end] = session.time_slot.split('-');
        const startHour = parseInt(start.split(':')[0]);
        const endHour = parseInt(end.split(':')[0]);
        totalLectureHours += (endHour - startHour >= 1 ? 2 : 1);
      }

      if (totalLectureHours !== selectedCourse.lecture_hours) {
        setErrors({ 
          lectureSessions: `Lecture hours must total exactly ${selectedCourse.lecture_hours} hour(s). Currently added: ${totalLectureHours} hour(s)` 
        });
        return;
      }

      for (const session of lectureSessions) {
        allEntries.push({
          level,
          group,
          section_num: parseInt(lectureSection),
          course_code: selectedCourse.course_code,
          time_slot: session.time_slot,
          day: session.day,
          activity_type: 'Lecture'
        });
      }
    }
  
    if (selectedCourse.tutorial_hours > 0) {
      if (!tutorialSection || tutorialSection.length !== 5) {
        setErrors({ tutorialSection: 'Enter tutorial section number (5 digits)' });
        return;
      }
      if (!tutorialSession.day || !tutorialSession.time_slot) {
        setErrors({ tutorialSession: 'Tutorial session must have both day and time selected' });
        return;
      }
      allEntries.push({
        level,
        group,
        section_num: parseInt(tutorialSection),
        course_code: selectedCourse.course_code,
        time_slot: tutorialSession.time_slot,
        day: tutorialSession.day,
        activity_type: 'Tutorial'
      });
    }
  
    if (selectedCourse.lab_hours > 0) {
      if (!labSection || labSection.length !== 5) {
        setErrors({ labSection: 'Lab section number must be exactly 5 digits' });
        return;
      }
      if (!labSession.day || !labSession.time_slot) {
        setErrors({ labSession: 'Lab session must have both day and time selected' });
        return;
      }

      const [start, end] = labSession.time_slot.split('-');
      const startHour = parseInt(start.split(':')[0]);
      const endHour = parseInt(end.split(':')[0]);
      
      if ((endHour - startHour) < 1) {
        setErrors({ labSession: 'Please select a 2-hour time block for lab' });
        return;
      }

      allEntries.push({
        level,
        group,
        section_num: parseInt(labSection),
        course_code: selectedCourse.course_code,
        time_slot: labSession.time_slot,
        day: labSession.day,
        activity_type: 'Lab'
      });
    }

    if (allEntries.length === 0) {
      setErrors({ general: 'Please add at least one activity session' });
      return;
    }
  
    try {
      // Send all entries in a SINGLE batch request for atomic transaction
      const response = await fetch('/api/scheduleCommittee/AddOtherDepartment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allEntries), // Send as array
      });

      const result = await response.json();
      
      if (!result.success) {
        // If ANY session fails validation, NONE are added
        if (result.error.includes('Time slot conflict')) {
          setErrors({ general: result.error });
        } else if (result.error.includes('Section number') && result.error.includes('already exists')) {
          const errorMsg = result.error;
          if (errorMsg.includes('Lecture')) {
            setErrors({ lectureSection: result.error });
          } else if (errorMsg.includes('Tutorial')) {
            setErrors({ tutorialSection: result.error });
          } else if (errorMsg.includes('Lab')) {
            setErrors({ labSection: result.error });
          } else {
            setErrors({ general: result.error });
          }
        } else {
          setErrors({ general: result.error });
        }
      } else {
        // ALL sessions added successfully
        setAlert({ type: 'success', message: `Course ${selectedCourse.course_code} schedule added successfully!` });
        
        // Reset form
        setSelectedCourse(null);
        setLectureSection('');
        setLectureSessions([]);
        setTutorialSection('');
        setTutorialSession({ day: '', time_slot: '' });
        setLabSection('');
        setLabSession({ day: '', time_slot: '' });
        
        // Refresh schedule entries
        await fetchScheduleEntries();
        
        // Auto-dismiss alert after 5 seconds
        setTimeout(() => {
          setAlert(null);
        }, 5000);
      }
    } catch (err) {
      console.error(err);
      setErrors({ general: 'Network error occurred. Please try again.' });
    }
  };

  const handleDeleteCourse = async (courseCode: string) => {
    if (!confirm(`Delete all sessions for ${courseCode}?`)) return;

    const scheduleId = scheduleEntries.find(e => e.course_code === courseCode)?.schedule_id;
    if (!scheduleId) return;

    try {
      const response = await fetch(
        `/api/scheduleCommittee/AddOtherDepartment?schedule_id=${scheduleId}&course_code=${courseCode}`,
        { method: 'DELETE' }
      );
      
      const data = await response.json();
      if (data.success) {
        setAlert({ type: 'success', message: data.message });
        await fetchScheduleEntries();
        
        setTimeout(() => {
          setAlert(null);
        }, 5000);
      } else {
        setAlert({ type: 'danger', message: data.error });
      }
    } catch (err) {
      setAlert({ type: 'danger', message: 'Error deleting course' });
    }
  };

  const currentLevelData = levels.find(l => l.level_num === level);
  const availableGroups = currentLevelData?.groups || [];
  
  const groupedEntries = scheduleEntries.reduce((acc, entry) => {
    if (!acc[entry.course_code]) acc[entry.course_code] = [];
    acc[entry.course_code].push(entry);
    return acc;
  }, {} as Record<string, ScheduleEntry[]>);

  return (
    <Layout>
      <div style={{ background: '#ececec', minHeight: '100vh' }}>
        <Container className="py-4">
          <div className="mb-4">
            <h2 className="fw-bold mb-2" style={{ color: '#1e3a5f' }}>
              Add Other Department Courses
            </h2>
            <p className="text-muted mb-0">Schedule external department courses</p>
          </div>

          {alert && (
            <Alert variant={alert.type} onClose={() => setAlert(null)} dismissible>
              {alert.message}
            </Alert>
          )}

          <Card className="mb-4 shadow-sm border-0">
            <Card.Header style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }} className="text-white py-3">
              <h5 className="mb-0 fw-semibold">Course Configuration</h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handleSubmit}>
                <Row className="mb-4">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Level</Form.Label>
                      <Form.Select
                        value={level || ''}
                        onChange={e => {
                          const newLevel = parseInt(e.target.value);
                          setLevel(newLevel);
                          const levelData = levels.find(l => l.level_num === newLevel);
                          if (levelData?.groups.length) setGroup(levelData.groups[0]);
                          setErrors({});
                          setAlert(null);
                        }}
                        style={{ borderColor: '#87CEEB' }}
                      >
                        {levels.map(l => (
                          <option key={l.level_num} value={l.level_num}>Level {l.level_num}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Group</Form.Label>
                      <Form.Select
                        value={group || ''}
                        onChange={e => {
                          setGroup(parseInt(e.target.value));
                          setErrors({});
                          setAlert(null);
                        }}
                        disabled={!level}
                        style={{ borderColor: '#87CEEB' }}
                      >
                        {availableGroups.map(g => (
                          <option key={g} value={g}>Group {g}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Course</Form.Label>
                  <Form.Select
                    value={selectedCourse?.course_code || ''}
                    onChange={e => handleCourseSelect(e.target.value)}
                    style={{ borderColor: '#87CEEB' }}
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => (
                      <option key={c.course_code} value={c.course_code}>
                        {c.course_code} - {c.course_name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {selectedCourse && (
                  <div className="border rounded p-4 mb-4" style={{ background: '#f8f9fa' }}>
                    <h6 className="mb-4 fw-semibold" style={{ color: '#1e3a5f' }}>
                      Configure Activities for {selectedCourse.course_code}
                    </h6>

                    {selectedCourse.lecture_hours > 0 && (
                      <Card className="mb-3 border-0 shadow-sm">
                        <Card.Body>
                          <h6 className="fw-semibold mb-3" style={{ color: '#1e3a5f' }}>
                            Lecture ({selectedCourse.lecture_hours} hours total)
                          </h6>
                          
                          <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Section Number (5 digits)</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="50084"
                              value={lectureSection}
                              onChange={e => {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 5) setLectureSection(value);
                                if (errors.lectureSection) setErrors({ ...errors, lectureSection: undefined });
                              }}
                              maxLength={5}
                              style={{ maxWidth: '200px', borderColor: errors.lectureSection ? '#dc3545' : '#87CEEB' }}
                              isInvalid={!!errors.lectureSection}
                            />
                            {errors.lectureSection && (
                              <Form.Control.Feedback type="invalid" style={{ display: 'block' }}>
                                {errors.lectureSection}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>

                          <div className="mb-3">
                            <label className="small fw-bold d-block mb-2">
                              Sessions (Add up to {selectedCourse.lecture_hours} hours - can use 1-hour or 2-hour blocks)
                            </label>
                            {lectureSessions.map((session, idx) => (
                              <Row key={idx} className="mb-2 g-2">
                                <Col md={5}>
                                  <Form.Select
                                    value={session.day}
                                    onChange={e => updateLectureSession(idx, 'day', e.target.value)}
                                    size="sm"
                                  >
                                    <option value="">Select Day</option>
                                    {days.map(d => (
                                      <option key={d.day} value={d.day}>{d.day}</option>
                                    ))}
                                  </Form.Select>
                                </Col>
                                <Col md={5}>
                                  <Form.Select
                                    value={session.time_slot}
                                    onChange={e => updateLectureSession(idx, 'time_slot', e.target.value)}
                                    size="sm"
                                  >
                                    <option value="">Select Time</option>
                                    {timeSlots
                                      .filter(t => t.time_slot !== '12:00-12:50')
                                      .map(t => (
                                        <option key={t.time_slot} value={t.time_slot}>{t.time_slot}</option>
                                      ))
                                    }
                                  </Form.Select>
                                </Col>
                                <Col md={2}>
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => removeLectureSession(idx)}
                                  >
                                    Remove
                                  </Button>
                                </Col>
                              </Row>
                            ))}
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={addLectureSession}
                              disabled={lectureSessions.length >= selectedCourse.lecture_hours}
                            >
                              + Add Session
                            </Button>
                            {errors.lectureSessions && (
                              <Alert variant="danger" className="mt-2 mb-0 py-2">
                                {errors.lectureSessions}
                              </Alert>
                            )}
                            <small className="text-muted d-block mt-2">
                              Added: {lectureSessions.reduce((total, s) => {
                                if (!s.time_slot) return total;
                                const [start, end] = s.time_slot.split('-');
                                const startHour = parseInt(start.split(':')[0]);
                                const endHour = parseInt(end.split(':')[0]);
                                return total + (endHour - startHour >= 1 ? 2 : 1);
                              }, 0)} / {selectedCourse.lecture_hours} hours
                            </small>
                          </div>
                        </Card.Body>
                      </Card>
                    )}

                    {selectedCourse.tutorial_hours > 0 && (
                      <Card className="mb-3 border-0 shadow-sm">
                        <Card.Body>
                          <h6 className="fw-semibold mb-3" style={{ color: '#1e3a5f' }}>
                            Tutorial ({selectedCourse.tutorial_hours} hour{selectedCourse.tutorial_hours > 1 ? 's' : ''})
                          </h6>
                          
                          <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Section Number (5 digits)</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="50085"
                              value={tutorialSection}
                              onChange={e => {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 5) setTutorialSection(value);
                                if (errors.tutorialSection) setErrors({ ...errors, tutorialSection: undefined });
                              }}
                              maxLength={5}
                              style={{ maxWidth: '200px', borderColor: errors.tutorialSection ? '#dc3545' : '#87CEEB' }}
                              isInvalid={!!errors.tutorialSection}
                            />
                            {errors.tutorialSection && (
                              <Form.Control.Feedback type="invalid" style={{ display: 'block' }}>
                                {errors.tutorialSection}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>

                          <Row className="g-2">
                            <Col md={6}>
                              <Form.Select
                                value={tutorialSession.day}
                                onChange={e => {
                                  setTutorialSession({ ...tutorialSession, day: e.target.value });
                                  if (errors.tutorialSession) setErrors({ ...errors, tutorialSession: undefined });
                                }}
                              >
                                <option value="">Select Day</option>
                                {days.map(d => (
                                  <option key={d.day} value={d.day}>{d.day}</option>
                                ))}
                              </Form.Select>
                            </Col>
                            <Col md={6}>
                              <Form.Select
                                value={tutorialSession.time_slot}
                                onChange={e => {
                                  setTutorialSession({ ...tutorialSession, time_slot: e.target.value });
                                  if (errors.tutorialSession) setErrors({ ...errors, tutorialSession: undefined });
                                }}
                              >
                                <option value="">Select Time Slot</option>
                                {timeSlots
                                  .filter(t => {
                                    // Filter out lunch break
                                    if (t.time_slot === '12:00-12:50') return false;
                                    
                                    const [start, end] = t.time_slot.split('-');
                                    const startHour = parseInt(start.split(':')[0]);
                                    const endHour = parseInt(end.split(':')[0]);
                                    const hours = endHour - startHour >= 1 ? 2 : 1;
                                    return hours === selectedCourse.tutorial_hours;
                                  })
                                  .map(t => (
                                    <option key={t.time_slot} value={t.time_slot}>{t.time_slot}</option>
                                  ))
                                }
                              </Form.Select>
                            </Col>
                          </Row>
                          {errors.tutorialSession && (
                            <Alert variant="danger" className="mt-2 mb-0 py-2">
                              {errors.tutorialSession}
                            </Alert>
                          )}
                        </Card.Body>
                      </Card>
                    )}

                    {selectedCourse.lab_hours > 0 && (
                      <Card className="mb-3 border-0 shadow-sm">
                        <Card.Body>
                          <h6 className="fw-semibold mb-3" style={{ color: '#1e3a5f' }}>
                            Lab (2 continuous hours)
                          </h6>
                          
                          <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Section Number (5 digits)</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="50159"
                              value={labSection}
                              onChange={e => {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 5) setLabSection(value);
                                if (errors.labSection) setErrors({ ...errors, labSection: undefined });
                              }}
                              maxLength={5}
                              style={{ maxWidth: '200px', borderColor: errors.labSection ? '#dc3545' : '#87CEEB' }}
                              isInvalid={!!errors.labSection}
                            />
                            {errors.labSection && (
                              <Form.Control.Feedback type="invalid" style={{ display: 'block' }}>
                                {errors.labSection}
                              </Form.Control.Feedback>
                            )}
                          </Form.Group>

                          <Row className="g-2">
                            <Col md={6}>
                              <Form.Select
                                value={labSession.day}
                                onChange={e => {
                                  setLabSession({ ...labSession, day: e.target.value });
                                  if (errors.labSession) setErrors({ ...errors, labSession: undefined });
                                }}
                              >
                                <option value="">Select Day</option>
                                {days.map(d => (
                                  <option key={d.day} value={d.day}>{d.day}</option>
                                ))}
                              </Form.Select>
                            </Col>
                            <Col md={6}>
                              <Form.Select
                                value={labSession.time_slot}
                                onChange={e => {
                                  setLabSession({ ...labSession, time_slot: e.target.value });
                                  if (errors.labSession) setErrors({ ...errors, labSession: undefined });
                                }}
                              >
                                <option value="">Select 2-Hour Block</option>
                                {timeSlots
                                  .filter(t => {
                                    // Filter out lunch break and blocks containing lunch
                                    if (t.time_slot === '12:00-12:50') return false;
                                    if (t.time_slot.includes('12:00') || t.time_slot.includes('12:50')) return false;
                                    
                                    const [start, end] = t.time_slot.split('-');
                                    const startHour = parseInt(start.split(':')[0]);
                                    const endHour = parseInt(end.split(':')[0]);
                                    return (endHour - startHour) >= 1;
                                  })
                                  .map(t => (
                                    <option key={t.time_slot} value={t.time_slot}>{t.time_slot}</option>
                                  ))
                                }
                              </Form.Select>
                            </Col>
                          </Row>
                          {errors.labSession && (
                            <Alert variant="danger" className="mt-2 mb-0 py-2">
                              {errors.labSession}
                            </Alert>
                          )}
                        </Card.Body>
                      </Card>
                    )}
                  </div>
                )}

                {errors.general && (
                  <Alert variant="danger" className="mb-3">
                    {errors.general}
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={!selectedCourse}
                  size="lg"
                  className="border-0 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', color: 'white' }}
                >
                  Add to Schedule
                </Button>
              </Form>
            </Card.Body>
          </Card>

          {Object.keys(groupedEntries).length > 0 && (
            <Card className="shadow-sm border-0">
              <Card.Header style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }} className="text-white py-3">
                <h5 className="mb-0 fw-semibold">Current Schedule - Level {level}, Group {group}</h5>
              </Card.Header>
              <Card.Body className="p-0">
                {Object.entries(groupedEntries).map(([courseCode, entries]) => {
                  const groupedBySection = entries.reduce((acc, entry) => {
                    const key = `${entry.section_num}-${entry.activity_type}`;
                    if (!acc[key]) {
                      acc[key] = {
                        section_num: entry.section_num,
                        activity_type: entry.activity_type,
                        sessions: []
                      };
                    }
                    acc[key].sessions.push({
                      day: entry.day,
                      time_slot: entry.time_slot
                    });
                    return acc;
                  }, {} as Record<string, { section_num: number; activity_type: string; sessions: { day: string; time_slot: string }[] }>);

                  return (
                    <div key={courseCode} className="border-bottom p-3">
                      <Row className="align-items-center mb-2">
                        <Col>
                          <h6 className="mb-0 fw-semibold" style={{ color: '#1e3a5f' }}>
                            {courseCode} - {entries[0].course_name}
                          </h6>
                        </Col>
                        <Col xs="auto">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteCourse(courseCode)}
                          >
                            Delete All
                          </Button>
                        </Col>
                      </Row>
                      <Table size="sm" className="mb-0">
                        <thead style={{ background: '#87CEEB' }}>
                          <tr>
                            <th style={{ color: '#1e3a5f' }}>Section</th>
                            <th style={{ color: '#1e3a5f' }}>Type</th>
                            <th style={{ color: '#1e3a5f' }}>Day</th>
                            <th style={{ color: '#1e3a5f' }}>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(groupedBySection).map((group, idx) => (
                            <tr key={idx}>
                              <td>{group.section_num}</td>
                              <td>
                                <span style={{
                                  background: group.activity_type === 'Lecture' ? '#e3f2fd' : 
                                             group.activity_type === 'Lab' ? '#f3e5f5' : '#e8f5e9',
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '0.85rem',
                                  fontWeight: '500'
                                }}>
                                  {group.activity_type}
                                </span>
                              </td>
                              <td>
                                {group.sessions.map(s => s.day).join(', ')}
                              </td>
                              <td>
                                {Array.from(new Set(group.sessions.map(s => s.time_slot))).join(', ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  );
                })}
              </Card.Body>
            </Card>
          )}
        </Container>
      </div>
    </Layout>
  );
};

export default AddOtherDepartment;