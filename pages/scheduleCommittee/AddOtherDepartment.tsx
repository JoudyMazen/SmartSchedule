import React, { useEffect, useState } from 'react';
import { Container, Card, Form, Row, Col, Button, Alert, Table, Badge } from 'react-bootstrap';
import Layout from '../../components/Layout';

interface Level {
  level_num: number;
  groups: number[];
}

interface Course {
  course_code: string;
  course_name: string;
  level: number;
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

interface DayTimeSlot {
  day: string;
  time_slot: string;
}

interface SectionConfig {
  hasLecture: boolean;
  lectureSection: string;
  lectureSessions: DayTimeSlot[];
  
  hasPractical: boolean;
  practicalSection: string;
  practicalSessions: DayTimeSlot[];
  
  hasTutorial: boolean;
  tutorialSection: string;
  tutorialSessions: DayTimeSlot[];
}

const AddOtherDepartment: React.FC = () => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState<number | null>(null);
  const [group, setGroup] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger' | 'warning'; message: string } | null>(null);
  
  const [config, setConfig] = useState<SectionConfig>({
    hasLecture: false,
    lectureSection: '',
    lectureSessions: [],
    hasPractical: false,
    practicalSection: '',
    practicalSessions: [],
    hasTutorial: false,
    tutorialSection: '',
    tutorialSessions: []
  });

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
        if (data.success && Array.isArray(data.days)) {
          setDays(data.days);
        }
      })
      .catch(err => console.error('Error fetching days:', err));
  }, []);

  useEffect(() => {
    fetch('/api/data/timeSlots')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.timeSlots)) {
          setTimeSlots(data.timeSlots);
        }
      })
      .catch(err => console.error('Error fetching time slots:', err));
  }, []);

  useEffect(() => {
    if (!level) return;

    fetch(`/api/data/courses?level=${level}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.courses)) {
          setCourses(data.courses);
        } else {
          setCourses([]);
        }
      })
      .catch(err => {
        console.error(err);
        setCourses([]);
      });

    if (group) {
      fetchScheduleEntries();
    }
  }, [level, group]);

  useEffect(() => {
    setConfig({
      hasLecture: false,
      lectureSection: '',
      lectureSessions: [],
      hasPractical: false,
      practicalSection: '',
      practicalSessions: [],
      hasTutorial: false,
      tutorialSection: '',
      tutorialSessions: []
    });
  }, [selectedCourse]);

  const fetchScheduleEntries = async () => {
    if (!level || !group) return;

    try {
      const response = await fetch(`/api/data/schedule?level=${level}&group=${group}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.entries)) {
        setScheduleEntries(data.entries);
      }
    } catch (err) {
      console.error(err);
    }
  };
const handleDeleteCourse = async (courseCode: string, sectionNum: number) => {
  if (!confirm(`Delete all sessions for ${courseCode}?`)) return;

  try {
    const scheduleId = scheduleEntries.find(e => e.course_code === courseCode)?.schedule_id;
    
    if (!scheduleId) {
      setAlert({ type: 'danger', message: 'Schedule ID not found' });
      return;
    }

    const response = await fetch(
      `/api/scheduleCommittee/AddOtherDepartment?schedule_id=${scheduleId}&course_code=${courseCode}`,
      { method: 'DELETE' }
    );

    const data = await response.json();
    
    if (data.success) {
      setAlert({ type: 'success', message: 'All sessions deleted successfully!' });
      fetchScheduleEntries();
    } else {
      setAlert({ type: 'danger', message: data.error || 'Failed to delete.' });
    }
  } catch (err) {
    console.error(err);
    setAlert({ type: 'danger', message: 'Error deleting sessions.' });
  }
};
  const addSession = (type: 'lecture' | 'practical' | 'tutorial') => {
    setConfig(prev => ({
      ...prev,
      [`${type}Sessions`]: [...prev[`${type}Sessions` as keyof SectionConfig] as DayTimeSlot[], { day: '', time_slot: '' }]
    }));
  };

  const updateSession = (type: 'lecture' | 'practical' | 'tutorial', index: number, field: 'day' | 'time_slot', value: string) => {
    setConfig(prev => {
      const sessions = [...prev[`${type}Sessions` as keyof SectionConfig] as DayTimeSlot[]];
      sessions[index] = { ...sessions[index], [field]: value };
      return { ...prev, [`${type}Sessions`]: sessions };
    });
  };

  const removeSession = (type: 'lecture' | 'practical' | 'tutorial', index: number) => {
    setConfig(prev => ({
      ...prev,
      [`${type}Sessions`]: (prev[`${type}Sessions` as keyof SectionConfig] as DayTimeSlot[]).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCourse) {
      setAlert({ type: 'danger', message: 'Please select a course' });
      return;
    }

    const allEntries: any[] = [];

    if (config.hasLecture) {
      if (!config.lectureSection || config.lectureSection.length !== 5) {
        setAlert({ type: 'danger', message: 'Lecture section must be exactly 5 digits' });
        return;
      }
      if (config.lectureSessions.length === 0) {
        setAlert({ type: 'danger', message: 'Please add at least one lecture session' });
        return;
      }
      for (const session of config.lectureSessions) {
        if (!session.day || !session.time_slot) {
          setAlert({ type: 'danger', message: 'All lecture sessions must have day and time' });
          return;
        }
        allEntries.push({
          level,
          group,
          section_num: parseInt(config.lectureSection),
          course_code: selectedCourse,
          time_slot: session.time_slot,
          day: session.day,
          activity_type: 'Lecture'
        });
      }
    }

    if (config.hasPractical) {
      if (!config.practicalSection || config.practicalSection.length !== 5) {
        setAlert({ type: 'danger', message: 'Practical section must be exactly 5 digits' });
        return;
      }
      if (config.practicalSessions.length === 0) {
        setAlert({ type: 'danger', message: 'Please add at least one practical session' });
        return;
      }
      for (const session of config.practicalSessions) {
        if (!session.day || !session.time_slot) {
          setAlert({ type: 'danger', message: 'All practical sessions must have day and time' });
          return;
        }
        allEntries.push({
          level,
          group,
          section_num: parseInt(config.practicalSection),
          course_code: selectedCourse,
          time_slot: session.time_slot,
          day: session.day,
          activity_type: 'Practical'
        });
      }
    }

    if (config.hasTutorial) {
      if (!config.tutorialSection || config.tutorialSection.length !== 5) {
        setAlert({ type: 'danger', message: 'Tutorial section must be exactly 5 digits' });
        return;
      }
      if (config.tutorialSessions.length === 0) {
        setAlert({ type: 'danger', message: 'Please add at least one tutorial session' });
        return;
      }
      for (const session of config.tutorialSessions) {
        if (!session.day || !session.time_slot) {
          setAlert({ type: 'danger', message: 'All tutorial sessions must have day and time' });
          return;
        }
        allEntries.push({
          level,
          group,
          section_num: parseInt(config.tutorialSection),
          course_code: selectedCourse,
          time_slot: session.time_slot,
          day: session.day,
          activity_type: 'Tutorial'
        });
      }
    }

    if (allEntries.length === 0) {
      setAlert({ type: 'danger', message: 'Please select at least one section type' });
      return;
    }

    try {
      const promises = allEntries.map(entry =>
        fetch('/api/scheduleCommittee/AddOtherDepartment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        })
      );

      const responses = await Promise.all(promises);
      const results = await Promise.all(responses.map(r => r.json()));
      const failures = results.filter(r => !r.success);

      if (failures.length > 0) {
        setAlert({ type: 'danger', message: `Failed: ${failures[0].error}` });
      } else {
        setAlert({ type: 'success', message: 'All sessions added successfully!' });
        setSelectedCourse('');
        setConfig({
          hasLecture: false,
          lectureSection: '',
          lectureSessions: [],
          hasPractical: false,
          practicalSection: '',
          practicalSessions: [],
          hasTutorial: false,
          tutorialSection: '',
          tutorialSessions: []
        });
        fetchScheduleEntries();
      }
    } catch (err) {
      console.error(err);
      setAlert({ type: 'danger', message: 'Network error.' });
    }
  };

  const currentLevelData = levels.find(l => l.level_num === level);
  const availableGroups = currentLevelData?.groups || [];

  const groupedEntries = scheduleEntries.reduce((acc, entry) => {
    const key = `${entry.course_code}-${entry.section_num}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(entry);
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
            <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
              Schedule external department courses
            </p>
          </div>

          {alert && (
            <Alert variant={alert.type} onClose={() => setAlert(null)} dismissible className="border-0 shadow-sm">
              {alert.message}
            </Alert>
          )}

          <Card className="mb-4 shadow-sm border-0">
            <Card.Header style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }} className="text-white py-3">
              <h5 className="mb-0 fw-semibold">Course Configuration</h5>
            </Card.Header>
            <Card.Body className="p-4" style={{ background: 'white' }}>
              <Form onSubmit={handleSubmit}>
                <Row className="mb-4">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Level *</Form.Label>
                      <Form.Select
                        value={level || ''}
                        onChange={e => {
                          const newLevel = parseInt(e.target.value);
                          setLevel(newLevel);
                          const levelData = levels.find(l => l.level_num === newLevel);
                          if (levelData && levelData.groups.length > 0) {
                            setGroup(levelData.groups[0]);
                          }
                        }}
                        className="border-2"
                        style={{ borderColor: '#87CEEB', color: '#1e3a5f' }}
                      >
                        <option value="">Select Level</option>
                        {levels.map(l => (
                          <option key={l.level_num} value={l.level_num}>Level {l.level_num}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Group *</Form.Label>
                      <Form.Select
                        value={group || ''}
                        onChange={e => setGroup(parseInt(e.target.value))}
                        disabled={!level}
                        className="border-2"
                        style={{ borderColor: '#87CEEB', color: '#1e3a5f' }}
                      >
                        <option value="">Select Group</option>
                        {availableGroups.map(g => (
                          <option key={g} value={g}>Group {g}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Course *</Form.Label>
                  <Form.Select 
                    value={selectedCourse} 
                    onChange={e => setSelectedCourse(e.target.value)}
                    className="border-2"
                    style={{ borderColor: '#87CEEB', color: '#1e3a5f' }}
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
                  <div className="border rounded p-4 mb-4" style={{ background: '#ececec', borderColor: '#87CEEB' }}>
                    <h6 className="mb-4 fw-semibold" style={{ color: '#1e3a5f' }}>Configure Section Types</h6>

                    {/* Lecture */}
                    <Card className="mb-3 border-0 shadow-sm">
                      <Card.Body style={{ background: 'white' }}>
                        <Form.Check
                          type="checkbox"
                          label={<strong style={{ color: '#1e3a5f' }}>Lecture</strong>}
                          checked={config.hasLecture}
                          onChange={e => setConfig({...config, hasLecture: e.target.checked})}
                          className="mb-3"
                        />

                        {config.hasLecture && (
                          <>
                            <Form.Group className="mb-3">
                              <Form.Label className="small fw-semibold" style={{ color: '#1e3a5f' }}>Section Number (5 digits)</Form.Label>
                              <Form.Control
                                type="text"
                                placeholder="12344"
                                value={config.lectureSection}
                                onChange={e => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  if (value.length <= 5) {
                                    setConfig({...config, lectureSection: value});
                                  }
                                }}
                                maxLength={5}
                                style={{ maxWidth: '200px', borderColor: '#87CEEB' }}
                              />
                            </Form.Group>

                            <div className="mb-2">
                              <label className="small fw-bold d-block mb-2" style={{ color: '#1e3a5f' }}>Sessions</label>
                              {config.lectureSessions.map((session, idx) => (
                                <Row key={idx} className="mb-2 g-2">
                                  <Col md={5}>
                                    <Form.Select
                                      value={session.day}
                                      onChange={e => updateSession('lecture', idx, 'day', e.target.value)}
                                      size="sm"
                                      style={{ borderColor: '#87CEEB' }}
                                    >
                                      <option value="">Day</option>
                                      {days.map(d => (
                                        <option key={d.day} value={d.day}>{d.day}</option>
                                      ))}
                                    </Form.Select>
                                  </Col>
                                  <Col md={5}>
                                    <Form.Select
                                      value={session.time_slot}
                                      onChange={e => updateSession('lecture', idx, 'time_slot', e.target.value)}
                                      size="sm"
                                      style={{ borderColor: '#87CEEB' }}
                                    >
                                      <option value="">Time</option>
                                      {timeSlots.map(t => (
                                        <option key={t.time_slot} value={t.time_slot}>{t.time_slot}</option>
                                      ))}
                                    </Form.Select>
                                  </Col>
                                  <Col md={2}>
                                    <Button
                                      size="sm"
                                      className="border-0"
                                      style={{ background: '#b0c4d4', color: '#1e3a5f' }}
                                      onClick={() => removeSession('lecture', idx)}
                                    >
                                      ×
                                    </Button>
                                  </Col>
                                </Row>
                              ))}
                              <Button
                                size="sm"
                                className="border-0"
                                style={{ background: '#87CEEB', color: '#1e3a5f' }}
                                onClick={() => addSession('lecture')}
                              >
                                + Add Session
                              </Button>
                            </div>
                          </>
                        )}
                      </Card.Body>
                    </Card>

                    {/* Practical */}
                    <Card className="mb-3 border-0 shadow-sm">
                      <Card.Body style={{ background: 'white' }}>
                        <Form.Check
                          type="checkbox"
                          label={<strong style={{ color: '#1e3a5f' }}>Lab</strong>}
                          checked={config.hasPractical}
                          onChange={e => setConfig({...config, hasPractical: e.target.checked})}
                          className="mb-3"
                        />

                        {config.hasPractical && (
                          <>
                            <Form.Group className="mb-3">
                              <Form.Label className="small fw-semibold" style={{ color: '#1e3a5f' }}>Section Number (5 digits)</Form.Label>
                              <Form.Control
                                type="text"
                                placeholder="12345"
                                value={config.practicalSection}
                                onChange={e => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  if (value.length <= 5) {
                                    setConfig({...config, practicalSection: value});
                                  }
                                }}
                                maxLength={5}
                                style={{ maxWidth: '200px', borderColor: '#87CEEB' }}
                              />
                            </Form.Group>

                            <div className="mb-2">
                              <label className="small fw-bold d-block mb-2" style={{ color: '#1e3a5f' }}>Sessions</label>
                              {config.practicalSessions.map((session, idx) => (
                                <Row key={idx} className="mb-2 g-2">
                                  <Col md={5}>
                                    <Form.Select
                                      value={session.day}
                                      onChange={e => updateSession('practical', idx, 'day', e.target.value)}
                                      size="sm"
                                      style={{ borderColor: '#87CEEB' }}
                                    >
                                      <option value="">Day</option>
                                      {days.map(d => (
                                        <option key={d.day} value={d.day}>{d.day}</option>
                                      ))}
                                    </Form.Select>
                                  </Col>
                                  <Col md={5}>
                                    <Form.Select
                                      value={session.time_slot}
                                      onChange={e => updateSession('practical', idx, 'time_slot', e.target.value)}
                                      size="sm"
                                      style={{ borderColor: '#87CEEB' }}
                                    >
                                      <option value="">Time</option>
                                      {timeSlots.map(t => (
                                        <option key={t.time_slot} value={t.time_slot}>{t.time_slot}</option>
                                      ))}
                                    </Form.Select>
                                  </Col>
                                  <Col md={2}>
                                    <Button
                                      size="sm"
                                      className="border-0"
                                      style={{ background: '#b0c4d4', color: '#1e3a5f' }}
                                      onClick={() => removeSession('practical', idx)}
                                    >
                                      ×
                                    </Button>
                                  </Col>
                                </Row>
                              ))}
                              <Button
                                size="sm"
                                className="border-0"
                                style={{ background: '#87CEEB', color: '#1e3a5f' }}
                                onClick={() => addSession('practical')}
                              >
                                + Add Session
                              </Button>
                            </div>
                          </>
                        )}
                      </Card.Body>
                    </Card>

                    {/* Tutorial */}
                    <Card className="mb-3 border-0 shadow-sm">
                      <Card.Body style={{ background: 'white' }}>
                        <Form.Check
                          type="checkbox"
                          label={<strong style={{ color: '#1e3a5f' }}>Tutorial</strong>}
                          checked={config.hasTutorial}
                          onChange={e => setConfig({...config, hasTutorial: e.target.checked})}
                          className="mb-3"
                        />

                        {config.hasTutorial && (
                          <>
                            <Form.Group className="mb-3">
                              <Form.Label className="small fw-semibold" style={{ color: '#1e3a5f' }}>Section Number (5 digits)</Form.Label>
                              <Form.Control
                                type="text"
                                placeholder="12346"
                                value={config.tutorialSection}
                                onChange={e => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  if (value.length <= 5) {
                                    setConfig({...config, tutorialSection: value});
                                  }
                                }}
                                maxLength={5}
                                style={{ maxWidth: '200px', borderColor: '#87CEEB' }}
                              />
                            </Form.Group>

                            <div className="mb-2">
                              <label className="small fw-bold d-block mb-2" style={{ color: '#1e3a5f' }}>Sessions</label>
                              {config.tutorialSessions.map((session, idx) => (
                                <Row key={idx} className="mb-2 g-2">
                                  <Col md={5}>
                                    <Form.Select
                                      value={session.day}
                                      onChange={e => updateSession('tutorial', idx, 'day', e.target.value)}
                                      size="sm"
                                      style={{ borderColor: '#87CEEB' }}
                                    >
                                      <option value="">Day</option>
                                      {days.map(d => (
                                        <option key={d.day} value={d.day}>{d.day}</option>
                                      ))}
                                    </Form.Select>
                                  </Col>
                                  <Col md={5}>
                                    <Form.Select
                                      value={session.time_slot}
                                      onChange={e => updateSession('tutorial', idx, 'time_slot', e.target.value)}
                                      size="sm"
                                      style={{ borderColor: '#87CEEB' }}
                                    >
                                      <option value="">Time</option>
                                      {timeSlots.map(t => (
                                        <option key={t.time_slot} value={t.time_slot}>{t.time_slot}</option>
                                      ))}
                                    </Form.Select>
                                  </Col>
                                  <Col md={2}>
                                    <Button
                                      size="sm"
                                      className="border-0"
                                      style={{ background: '#b0c4d4', color: '#1e3a5f' }}
                                      onClick={() => removeSession('tutorial', idx)}
                                    >
                                      ×
                                    </Button>
                                  </Col>
                                </Row>
                              ))}
                              <Button
                                size="sm"
                                className="border-0"
                                style={{ background: '#87CEEB', color: '#1e3a5f' }}
                                onClick={() => addSession('tutorial')}
                              >
                                + Add Session
                              </Button>
                            </div>
                          </>
                        )}
                      </Card.Body>
                    </Card>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!selectedCourse}
                  size="lg"
                  className="border-0 shadow-sm"
                  style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                    color: 'white'
                  }}
                >
                  Add All Sessions to Schedule
                </Button>
              </Form>
            </Card.Body>
          </Card>

          {Object.keys(groupedEntries).length > 0 && level && group && (
            <Card className="shadow-sm border-0">
              <Card.Header style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }} className="text-white py-3">
                <h5 className="mb-0 fw-semibold">Current Schedule - Level {level}, Group {group}</h5>
              </Card.Header>
              <Card.Body className="p-0">
                {Object.entries(groupedEntries).map(([key, entries]) => {
                  const [courseCode, sectionNum] = key.split('-');
                  return (
                    <div key={key} className="border-bottom p-3">
                      <Row className="align-items-center mb-2">
                        <Col>
                          <h6 className="mb-0 fw-semibold" style={{ color: '#1e3a5f' }}>
                            {courseCode} - Section {sectionNum}
                          </h6>
                        </Col>
                        <Col xs="auto">
                          <Button
                            size="sm"
                            className="border-0"
                            style={{ background: '#b0c4d4', color: '#1e3a5f' }}
                            onClick={() => handleDeleteCourse(courseCode, parseInt(sectionNum))}
                          >
                            Delete All
                          </Button>
                        </Col>
                      </Row>
                      <Table size="sm" className="mb-0">
                        <thead style={{ background: '#87CEEB' }}>
                          <tr>
                            <th style={{ color: '#1e3a5f', border: 'none' }}>Type</th>
                            <th style={{ color: '#1e3a5f', border: 'none' }}>Day</th>
                            <th style={{ color: '#1e3a5f', border: 'none' }}>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((entry, idx) => (
                            <tr key={idx}>
                              <td style={{ border: 'none', borderTop: '1px solid #dee2e6' }}>
                                <span style={{
                                  background: '#e6f4ff',
                                  color: '#1e3a5f',
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '0.85rem',
                                  fontWeight: '500'
                                }}>
                                  {entry.activity_type || 'N/A'}
                                </span>
                              </td>
                              <td style={{ border: 'none', borderTop: '1px solid #dee2e6', color: '#5a7a99' }}>{entry.day}</td>
                              <td style={{ border: 'none', borderTop: '1px solid #dee2e6', color: '#5a7a99' }}>{entry.time_slot}</td>
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