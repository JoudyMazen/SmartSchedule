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
}

interface Section {
  section_id: number;
  section_number: number;
  activity_type: string;
  course_code: string;
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

const AddOtherDepartment: React.FC = () => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState<number | null>(null);
  const [group, setGroup] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

  // Fetch available levels and groups from database
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

  // Fetch available days from database
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

  // Fetch available time slots from database
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

  // Fetch courses for selected level
  useEffect(() => {
    if (!level) return;

    fetch(`/api/data/courses?level=${level}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.courses)) {
          // Filter out courses starting with SWE followed by 3 digits
          const filteredCourses = data.courses.filter((course: Course) => {
            return !/^SWE\d{3}/.test(course.course_code);
          });
          setCourses(filteredCourses);
        } else {
          setCourses([]);
        }
      })
      .catch(err => {
        console.error(err);
        setCourses([]);
      });

    // Fetch existing schedule entries
    if (group) {
      fetchScheduleEntries();
    }
  }, [level, group]);

  // Fetch sections when a course is selected
  useEffect(() => {
    if (!selectedCourse) {
      setSections([]);
      setSelectedSection(0);
      return;
    }

    fetch(`/api/data/sections?course_code=${selectedCourse}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.sections)) {
          setSections(data.sections);
        } else {
          setSections([]);
        }
      })
      .catch(err => {
        console.error(err);
        setSections([]);
      });
  }, [selectedCourse]);

  // Fetch existing schedule entries
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

  // Delete schedule entry
  const handleDelete = async (scheduleId: number, sectionNum: number, timeSlot: string, day: string) => {
    if (!confirm('Are you sure you want to delete this schedule entry?')) return;

    try {
      const response = await fetch(
        `/api/scheduleCommittee/AddOtherDepartment?schedule_id=${scheduleId}&section_num=${sectionNum}&time_slot=${encodeURIComponent(timeSlot)}&day=${day}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success) {
        setAlert({ type: 'success', message: 'Schedule entry deleted successfully!' });
        fetchScheduleEntries();
      } else {
        setAlert({ type: 'danger', message: data.error || 'Failed to delete entry.' });
      }
    } catch (err) {
      console.error(err);
      setAlert({ type: 'danger', message: 'Network error.' });
    }
  };

  // Submit manual schedule entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate section is exactly 5 digits
    if (selectedSection.toString().length !== 5) {
      setAlert({ type: 'danger', message: 'Section number must be exactly 5 digits.' });
      return;
    }

    if (!selectedCourse || !selectedSection || !selectedTimeSlot || !selectedDay) {
      setAlert({ type: 'danger', message: 'Please fill in all required fields.' });
      return;
    }

    try {
      const response = await fetch('/api/scheduleCommittee/AddOtherDepartment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          group,
          section_num: selectedSection,
          course_code: selectedCourse,
          time_slot: selectedTimeSlot,
          day: selectedDay,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAlert({ type: 'success', message: 'Schedule entry added successfully!' });
        // Reset fields
        setSelectedCourse('');
        setSelectedSection(0);
        setSelectedDay('');
        setSelectedTimeSlot('');
        // Refresh schedule entries
        fetchScheduleEntries();
      } else {
        setAlert({ type: 'danger', message: data.error || 'Failed to add schedule entry.' });
      }
    } catch (err) {
      console.error(err);
      setAlert({ type: 'danger', message: 'Network error.' });
    }
  };

  const currentLevelData = levels.find(l => l.level_num === level);
  const availableGroups = currentLevelData?.groups || [];

  return (
    <Layout>
      <Container className="py-4">
        {alert && <Alert variant={alert.type} onClose={() => setAlert(null)} dismissible>{alert.message}</Alert>}

        <Card className="mb-4">
          <Card.Header>Add Other Department Schedule</Card.Header>
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              {/* Level & Group Selection */}
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Level <span className="text-danger">*</span></Form.Label>
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
                    <Form.Label>Group <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      value={group || ''}
                      onChange={e => setGroup(parseInt(e.target.value))}
                      disabled={!level}
                    >
                      <option value="">Select Group</option>
                      {availableGroups.map(g => (
                        <option key={g} value={g}>Group {g}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {/* Course Selection */}
              <Row className="mb-3">
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Course <span className="text-danger">*</span></Form.Label>
                    <Form.Select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
                      <option value="">Select Course</option>
                      {courses.map(c => (
                        <option key={c.course_code} value={c.course_code}>
                          {c.course_code} - {c.course_name}
                        </option>
                      ))}
                    </Form.Select>
                    {courses.length === 0 && level && (
                      <Form.Text className="text-muted">
                        No courses available for Level {level}
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              {/* Section Input - 5 digits only */}
              <Row className="mb-3">
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Section Number <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter 5-digit section number (e.g., 10001)"
                      value={selectedSection || ''}
                      onChange={e => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 5) {
                          setSelectedSection(parseInt(value) || 0);
                        }
                      }}
                      maxLength={5}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Day & Time Slot */}
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Day <span className="text-danger">*</span></Form.Label>
                    <Form.Select value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
                      <option value="">Select Day</option>
                      {days.map(d => (
                        <option key={d.day} value={d.day}>{d.day}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Time Slot <span className="text-danger">*</span></Form.Label>
                    <Form.Select value={selectedTimeSlot} onChange={e => setSelectedTimeSlot(e.target.value)}>
                      <option value="">Select Time Slot</option>
                      {timeSlots.map(t => (
                        <option key={t.time_slot} value={t.time_slot}>{t.time_slot}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Button type="submit" variant="primary">Add to Schedule</Button>
            </Form>
          </Card.Body>
        </Card>

        {/* Display Existing Schedule Entries */}
        {scheduleEntries.length > 0 && level && group && (
          <Card>
            <Card.Header>Current Schedule - Level {level}, Group {group}</Card.Header>
            <Card.Body>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Section</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleEntries.map((entry, idx) => (
                    <tr key={idx}>
                      <td>{entry.course_code} - {entry.course_name}</td>
                      <td>Section {entry.section_num} ({entry.activity_type})</td>
                      <td>{entry.day}</td>
                      <td>{entry.time_slot}</td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(entry.schedule_id, entry.section_num, entry.time_slot, entry.day)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}
      </Container>
    </Layout>
  );
};

export default AddOtherDepartment;