import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner } from 'react-bootstrap';
import Layout from '../../components/Layout';
import { useRouter } from 'next/router';

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
}

interface Course {
  course_code: string;
  course_name: string;
  level: number;
  lecture_hours: number;
  tutorial_hours: number;
  lab_hours: number;
  course_type?: string;
  is_elective?: boolean;
}

interface TimeSlot {
  time_slot: string;
}

interface Day {
  day: string;
}

interface SessionInput {
  day: string;
  time_slot: string;
}

const EditSchedule: React.FC = () => {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [selectedGroup, setSelectedGroup] = useState(1);
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [allTimeSlots, setAllTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger' | 'warning', message: string} | null>(null);
  
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  
  const [lectureSection, setLectureSection] = useState('');
  const [lectureSessions, setLectureSessions] = useState<SessionInput[]>([]);
  const [tutorialSection, setTutorialSection] = useState('');
  const [tutorialSession, setTutorialSession] = useState<SessionInput>({ day: '', time_slot: '' });
  const [labSection, setLabSection] = useState('');
  const [labSession, setLabSession] = useState<SessionInput>({ day: '', time_slot: '' });
  const [errors, setErrors] = useState<any>({});

  const lectureSectionRef = useRef<HTMLInputElement>(null);
  const tutorialSectionRef = useRef<HTMLInputElement>(null);
  const labSectionRef = useRef<HTMLInputElement>(null);
  const generalErrorRef = useRef<HTMLDivElement>(null);

  const levels = [3, 4, 5, 6, 7, 8];

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      if (errors.lectureSection && lectureSectionRef.current) {
        lectureSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lectureSectionRef.current.focus();
      } else if (errors.tutorialSection && tutorialSectionRef.current) {
        tutorialSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tutorialSectionRef.current.focus();
      } else if (errors.labSection && labSectionRef.current) {
        labSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        labSectionRef.current.focus();
      } else if (errors.general && generalErrorRef.current) {
        generalErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [errors]);

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
    fetchCourses();
  }, [selectedLevel, selectedGroup]);

  const fetchTimeSlots = async () => {
    try {
      const response = await fetch('/api/data/timeSlots');
      const data = await response.json();
      if (data.success) {
        setAllTimeSlots(data.timeSlots);
        const filtered = data.timeSlots.filter((slot: TimeSlot) => slot.time_slot !== '12:00-12:50');
        setTimeSlots(filtered);
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

  const fetchCourses = async () => {
    try {
      const scheduleId = scheduleData.find(e => e.group_num === selectedGroup)?.schedule_id;
      const scheduleParam = scheduleId ? `&schedule_id=${scheduleId}` : '';
      
      const response = await fetch(`/api/data/courses?level=${selectedLevel}${scheduleParam}`);
      const data = await response.json();
      if (data.success) {
        setCourses(data.courses);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchSchedule = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/data/schedule?level=${selectedLevel}&group=${selectedGroup}`);
      const data = await response.json();
      if (data.success && data.entries) {
        setScheduleData(data.entries.map((s: any) => ({ ...s, group_num: selectedGroup })));
      } else {
        setScheduleData([]);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setScheduleData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCourseSelect = async (courseCode: string) => {
    const course = courses.find(c => c.course_code === courseCode);
    setSelectedCourse(course || null);
    setLectureSection('');
    setLectureSessions([]);
    setTutorialSection('');
    setTutorialSession({ day: '', time_slot: '' });
    setLabSection('');
    setLabSession({ day: '', time_slot: '' });
    setErrors({});
    setEditingCourse(null);
  };

  const handleEditCourse = (courseCode: string) => {
    const courseEntries = scheduleData.filter(e => e.course_code === courseCode && e.group_num === selectedGroup);
    if (courseEntries.length === 0) return;

    const course = courses.find(c => c.course_code === courseCode);
    if (!course) return;

    setSelectedCourse(course);
    setEditingCourse(courseCode);

    const lectureEntries = courseEntries.filter(e => e.activity_type === 'Lecture');
    if (lectureEntries.length > 0) {
      setLectureSection(lectureEntries[0].section_num.toString());
      setLectureSessions(lectureEntries.map(e => ({
        day: e.day,
        time_slot: e.time_slot
      })));
    } else {
      setLectureSection('');
      setLectureSessions([]);
    }

    const tutorialEntry = courseEntries.find(e => e.activity_type === 'Tutorial');
    if (tutorialEntry) {
      setTutorialSection(tutorialEntry.section_num.toString());
      setTutorialSession({
        day: tutorialEntry.day,
        time_slot: tutorialEntry.time_slot
      });
    } else {
      setTutorialSection('');
      setTutorialSession({ day: '', time_slot: '' });
    }

    const labEntry = courseEntries.find(e => e.activity_type === 'Lab');
    if (labEntry) {
      setLabSection(labEntry.section_num.toString());
      setLabSession({
        day: labEntry.day,
        time_slot: labEntry.time_slot
      });
    } else {
      setLabSection('');
      setLabSession({ day: '', time_slot: '' });
    }

    setErrors({});
    
    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('.border.rounded.p-4.mb-4');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);

    if (!selectedCourse) {
      setErrors({ general: 'Please select a course' });
      return;
    }

    if (!editingCourse) {
      const courseExists = scheduleData.some(
        entry => entry.course_code === selectedCourse.course_code && entry.group_num === selectedGroup
      );
      if (courseExists) {
        setErrors({ 
          general: `Course ${selectedCourse.course_code} is already scheduled for Level ${selectedLevel}, Group ${selectedGroup}. Please select a different course or remove the existing schedule first.` 
        });
        return;
      }
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
          level: selectedLevel,
          group: selectedGroup,
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
        level: selectedLevel,
        group: selectedGroup,
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
        level: selectedLevel,
        group: selectedGroup,
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

    setIsLoading(true);
    try {
      if (editingCourse) {
        const scheduleId = scheduleData.find(e => e.course_code === editingCourse && e.group_num === selectedGroup)?.schedule_id;
        if (scheduleId) {
          await fetch(
            `/api/scheduleCommittee/scheduleCommitteeHomePage?schedule_id=${scheduleId}&course_code=${editingCourse}`,
            { method: 'DELETE' }
          );
        }
      }

      const response = await fetch('/api/scheduleCommittee/scheduleCommitteeHomePage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allEntries),
      });

      const result = await response.json();
      
      if (!result.success) {
        // Skip prerequisite errors
        if (result.error && result.error.includes('prerequisite')) {
          // Ignore prerequisite errors - just show success
          setAlert({ 
            type: 'success', 
            message: editingCourse 
              ? `Course ${selectedCourse.course_code} updated successfully!`
              : `Course ${selectedCourse.course_code} added successfully!`
          });
          
          handleCourseSelect('');
          setEditingCourse(null);
          await fetchSchedule();
          await fetchCourses();
          
          setTimeout(() => {
            setAlert(null);
          }, 5000);
        } else {
          const errorField = result.failedField || 'general';
          setErrors({ [errorField]: result.error });
        }
      } else {
        setAlert({ 
          type: 'success', 
          message: editingCourse 
            ? `Course ${selectedCourse.course_code} updated successfully!`
            : `Course ${selectedCourse.course_code} added successfully!`
        });
        
        handleCourseSelect('');
        setEditingCourse(null);
        await fetchSchedule();
        await fetchCourses();
        
        setTimeout(() => {
          setAlert(null);
        }, 5000);
      }
    } catch (err) {
      console.error(err);
      setErrors({ general: 'Network error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (entry: ScheduleEntry) => {
    if (!confirm(`Delete this ${entry.activity_type || 'session'} for ${entry.course_code}?\n\nDay: ${entry.day}\nTime: ${entry.time_slot}`)) {
      return;
    }

    setIsLoading(true);
    setAlert(null);
    
    try {
      const params = new URLSearchParams({
        schedule_id: entry.schedule_id.toString(),
        section_num: entry.section_num.toString(),
        time_slot: entry.time_slot,
        day: entry.day
      });

      const response = await fetch(
        `/api/scheduleCommittee/scheduleCommitteeHomePage?${params.toString()}`,
        { 
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setAlert({ 
          type: 'success', 
          message: `Session deleted: ${entry.course_code} - ${entry.day} at ${entry.time_slot}` 
        });
        await fetchSchedule();
        
        setTimeout(() => {
          setAlert(null);
        }, 5000);
      } else {
        setAlert({ 
          type: 'danger', 
          message: data.error || 'Failed to delete session' 
        });
      }
    } catch (err) {
      console.error('Delete session error:', err);
      setAlert({ 
        type: 'danger', 
        message: 'Network error occurred while deleting session' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCourse = async (courseCode: string, scheduleId: number) => {
    const courseSessions = scheduleData.filter(
      e => e.course_code === courseCode && e.group_num === selectedGroup
    );
    
    const sessionCount = courseSessions.length;
    const sessionText = sessionCount === 1 ? 'session' : 'sessions';
    
    if (!confirm(
      `Delete ALL ${sessionCount} ${sessionText} for ${courseCode}?\n\n` +
      `This will remove:\n${courseSessions.map(s => `• ${s.activity_type || 'Session'}: ${s.day} at ${s.time_slot}`).join('\n')}`
    )) {
      return;
    }

    setIsLoading(true);
    setAlert(null);
    
    try {
      const params = new URLSearchParams({
        schedule_id: scheduleId.toString(),
        course_code: courseCode
      });

      const response = await fetch(
        `/api/scheduleCommittee/scheduleCommitteeHomePage?${params.toString()}`,
        { 
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setAlert({ 
          type: 'success', 
          message: `All sessions for ${courseCode} deleted successfully (${sessionCount} ${sessionText} removed)` 
        });
        await fetchSchedule();
        await fetchCourses();
        
        setTimeout(() => {
          setAlert(null);
        }, 5000);
      } else {
        setAlert({ 
          type: 'danger', 
          message: data.error || 'Failed to delete course' 
        });
      }
    } catch (err) {
      console.error('Delete course error:', err);
      setAlert({ 
        type: 'danger', 
        message: 'Network error occurred while deleting course' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getGroupedEntries = () => {
    return scheduleData.reduce((acc, entry) => {
      if (!acc[entry.course_code]) {
        acc[entry.course_code] = {
          course_name: entry.course_name,
          schedule_id: entry.schedule_id,
          entries: []
        };
      }
      acc[entry.course_code].entries.push(entry);
      return acc;
    }, {} as Record<string, { course_name: string; schedule_id: number; entries: ScheduleEntry[] }>);
  };

  const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
    <div className="invalid-feedback" style={{ display: 'block', fontSize: '0.875rem', marginTop: '0.25rem' }}>
      {message}
    </div>
  );

  return (
    <Layout>
      <div style={{ background: '#ececec', minHeight: '100vh' }}>
        <Container className="py-4">
          <div className="mb-4 d-flex justify-content-between align-items-center">
            <div>
              <h2 className="fw-bold mb-2" style={{ color: '#1e3a5f' }}>
                Edit Schedule
              </h2>
              <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                Add, edit, or remove courses from the schedule
              </p>
            </div>
            <Button
              className="border-0"
              style={{ background: '#b0c4d4', color: '#1e3a5f' }}
              onClick={() => router.push('/scheduleCommittee/scheduleCommitteeHomePage')}
            >
              <i className="bi bi-arrow-left me-2"></i>
              Back to Schedule
            </Button>
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

          <Row className="mb-4 g-3">
            <Col md={6}>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Level</Form.Label>
                  <Form.Select
                    value={selectedLevel}
                    onChange={(e) => {
                      const newLevel = parseInt(e.target.value);
                      setSelectedLevel(newLevel);
                      const groups = getGroupsForLevel(newLevel);
                      setSelectedGroup(groups[0]);
                      handleCourseSelect('');
                    }}
                    style={{ borderColor: '#87CEEB' }}
                  >
                    {levels.map(level => (
                      <option key={level} value={level}>Level {level}</option>
                    ))}
                  </Form.Select>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Group</Form.Label>
                  <Form.Select
                    value={selectedGroup}
                    onChange={(e) => {
                      setSelectedGroup(parseInt(e.target.value));
                      handleCourseSelect('');
                    }}
                    style={{ borderColor: '#87CEEB' }}
                  >
                    {getGroupsForLevel(selectedLevel).map(g => (
                      <option key={g} value={g}>Group {g}</option>
                    ))}
                  </Form.Select>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="mb-4 border-0 shadow-sm">
            <Card.Header style={{ background: '#b0c4d4', color: '#1e3a5f', border: 'none' }} className="py-3">
              <h6 className="mb-0 fw-semibold">
                <i className="bi bi-list-ul me-2"></i>
                Current Schedule - Level {selectedLevel}, Group {selectedGroup}
              </h6>
            </Card.Header>
            <Card.Body className="p-0">
              {isLoading ? (
                <div className="text-center p-5">
                  <Spinner animation="border" style={{ color: '#1e3a5f' }} />
                </div>
              ) : Object.keys(getGroupedEntries()).length === 0 ? (
                <div className="text-center p-5 text-muted">
                  <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <p className="mt-3">No courses scheduled yet</p>
                </div>
              ) : (
                Object.entries(getGroupedEntries()).map(([courseCode, data]) => {
                  const groupedBySection = data.entries.reduce((acc, entry) => {
                    const key = `${entry.section_num}-${entry.activity_type || 'General'}`;
                    if (!acc[key]) {
                      acc[key] = {
                        section_num: entry.section_num,
                        activity_type: entry.activity_type || 'General',
                        entries: []
                      };
                    }
                    acc[key].entries.push(entry);
                    return acc;
                  }, {} as Record<string, { section_num: number; activity_type: string; entries: ScheduleEntry[] }>);

                  return (
                    <div key={courseCode} className="border-bottom p-3">
                      <Row className="align-items-center mb-2">
                        <Col>
                          <h6 className="mb-0 fw-semibold" style={{ color: '#1e3a5f' }}>
                            {courseCode} - {data.course_name}
                          </h6>
                        </Col>
                        <Col xs="auto">
                          <Button
                            size="sm"
                            className="me-2"
                            style={{ background: '#87CEEB', border: 'none', color: '#1e3a5f' }}
                            onClick={() => handleEditCourse(courseCode)}
                          >
                            <i className="bi bi-pencil me-1"></i>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteCourse(courseCode, data.schedule_id)}
                          >
                            <i className="bi bi-trash me-1"></i>
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
                            <th style={{ color: '#1e3a5f' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(groupedBySection).map((group, idx) => (
                            <React.Fragment key={idx}>
                              {group.entries.map((entry, entryIdx) => (
                                <tr key={`${idx}-${entryIdx}`}>
                                  {entryIdx === 0 && (
                                    <>
                                      <td rowSpan={group.entries.length}>{group.section_num}</td>
                                      <td rowSpan={group.entries.length}>
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
                                    </>
                                  )}
                                  <td>{entry.day}</td>
                                  <td>{entry.time_slot}</td>
                                  <td>
                                    <Button
                                      size="sm"
                                      variant="outline-danger"
                                      onClick={() => handleDeleteSession(entry)}
                                      title="Delete session"
                                    >
                                      <i className="bi bi-trash"></i>
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  );
                })
              )}
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Header style={{ background: '#87CEEB', color: '#1e3a5f', border: 'none' }} className="py-3">
              <h6 className="mb-0 fw-semibold">
                <i className="bi bi-plus-circle me-2"></i>
                {editingCourse ? `Edit ${editingCourse}` : 'Add New Course'}
              </h6>
            </Card.Header>
            <Card.Body className="p-4">
              {errors.general && (
                <Alert ref={generalErrorRef} variant="danger" className="mb-3">
                  <div className="d-flex align-items-start">
                    <div className="flex-grow-1">
                      <strong>Error</strong>
                      <div className="mt-1">{errors.general}</div>
                    </div>
                  </div>
                </Alert>
              )}
              
              <Form onSubmit={handleSaveCourse}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                    Required Course
                  </Form.Label>
                  <Form.Select
                    value={selectedCourse?.course_type === 'required' || (selectedCourse && !selectedCourse.is_elective) ? selectedCourse.course_code : ''}
                    onChange={e => handleCourseSelect(e.target.value)}
                    style={{ borderColor: '#87CEEB' }}
                    disabled={!!editingCourse}
                  >
                    <option value="">Select Required Course</option>
                    {courses
                      .filter(c => c.level === selectedLevel && (c.course_type === 'required' || !c.is_elective))
                      .map(c => (
                        <option key={c.course_code} value={c.course_code}>
                          {c.course_code} - {c.course_name}
                        </option>
                      ))
                    }
                  </Form.Select>
                  <small className="text-muted d-block mt-1">
                    Required courses for Level {selectedLevel}
                  </small>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                    <span className="me-2">Elective Course</span>
                    <span 
                      className="badge" 
                      style={{ 
                        background: 'linear-gradient(135deg, #87CEEB 0%, #87CEEB 100%)',
                        color: 'white',
                        padding: '4px 10px',
                        fontSize: '0.7rem'
                      }}
                    >
                      Optional
                    </span>
                  </Form.Label>
                  <Form.Select
                    value={selectedCourse?.course_type === 'elective' || (selectedCourse?.is_elective) ? selectedCourse.course_code : ''}
                    onChange={e => handleCourseSelect(e.target.value)}
                    style={{ borderColor: '#87CEEB' }}
                    disabled={!!editingCourse}
                  >
                    <option value="">Select Elective Course</option>
                    {courses
                      .filter(c => c.level === selectedLevel && (c.course_type === 'elective' || c.is_elective))
                      .map(c => (
                        <option key={c.course_code} value={c.course_code}>
                          {c.course_code} - {c.course_name}
                        </option>
                      ))
                    }
                  </Form.Select>
                  <small className="text-muted d-block mt-1">
                    {courses.filter(c => c.level === selectedLevel && (c.course_type === 'elective' || c.is_elective)).length > 0 ? (
                      <>
                        {courses.filter(c => c.level === selectedLevel && (c.course_type === 'elective' || c.is_elective)).length} elective(s) available.
                      </>
                    ) : (
                      'No electives available.'
                    )}
                  </small>
                </Form.Group>

                {selectedCourse && (
                  <div className="border rounded p-4 mb-4" style={{ background: '#f8f9fa' }}>
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h6 className="mb-0 fw-semibold" style={{ color: '#1e3a5f' }}>
                        Configure Activities for {selectedCourse.course_code}
                      </h6>
                      {(selectedCourse.course_type === 'elective' || selectedCourse.is_elective) && (
                        <span 
                          className="badge" 
                          style={{ 
                            background: 'linear-gradient(135deg, #87CEEB 0%, #87CEEB 100%)',
                            color: 'white',
                            padding: '6px 12px',
                            fontSize: '0.75rem'
                          }}
                        >
                          Elective Course
                        </span>
                      )}
                    </div>

                    {selectedCourse.lecture_hours > 0 && (
                      <Card className="mb-3 border-0 shadow-sm">
                        <Card.Body>
                          <h6 className="fw-semibold mb-3" style={{ color: '#1e3a5f' }}>
                            Lecture ({selectedCourse.lecture_hours} hours total)
                          </h6>
                          
                          <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Section Number (5 digits)</Form.Label>
                            <Form.Control
                              ref={lectureSectionRef}
                              type="text"
                              placeholder="50084"
                              value={lectureSection}
                              onChange={e => {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 5) setLectureSection(value);
                                if (errors.lectureSection) setErrors({ ...errors, lectureSection: undefined });
                                if (errors.general) setErrors({ ...errors, general: undefined });
                              }}
                              maxLength={5}
                              style={{ maxWidth: '200px', borderColor: errors.lectureSection ? '#dc3545' : '#87CEEB' }}
                              isInvalid={!!errors.lectureSection}
                            />
                            {errors.lectureSection && <ErrorMessage message={errors.lectureSection} />}
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
                                    style={{ borderColor: '#87CEEB' }}
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
                                    style={{ borderColor: '#87CEEB' }}
                                  >
                                    <option value="">Select Time</option>
                                    {allTimeSlots
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
                              ref={tutorialSectionRef}
                              type="text"
                              placeholder="50085"
                              value={tutorialSection}
                              onChange={e => {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 5) setTutorialSection(value);
                                if (errors.tutorialSection) setErrors({ ...errors, tutorialSection: undefined });
                                if (errors.general) setErrors({ ...errors, general: undefined });
                              }}
                              maxLength={5}
                              style={{ maxWidth: '200px', borderColor: errors.tutorialSection ? '#dc3545' : '#87CEEB' }}
                              isInvalid={!!errors.tutorialSection}
                            />
                            {errors.tutorialSection && <ErrorMessage message={errors.tutorialSection} />}
                          </Form.Group>

                          <Row className="g-2">
                            <Col md={6}>
                              <Form.Select
                                value={tutorialSession.day}
                                onChange={e => {
                                  setTutorialSession({ ...tutorialSession, day: e.target.value });
                                  if (errors.tutorialSession) setErrors({ ...errors, tutorialSession: undefined });
                                }}
                                style={{ borderColor: '#87CEEB' }}
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
                                style={{ borderColor: '#87CEEB' }}
                              >
                                <option value="">Select Time Slot</option>
                                {allTimeSlots
                                  .filter(t => {
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
                              ref={labSectionRef}
                              type="text"
                              placeholder="50159"
                              value={labSection}
                              onChange={e => {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 5) setLabSection(value);
                                if (errors.labSection) setErrors({ ...errors, labSection: undefined });
                                if (errors.general) setErrors({ ...errors, general: undefined });
                              }}
                              maxLength={5}
                              style={{ maxWidth: '200px', borderColor: errors.labSection ? '#dc3545' : '#87CEEB' }}
                              isInvalid={!!errors.labSection}
                            />
                            {errors.labSection && <ErrorMessage message={errors.labSection} />}
                          </Form.Group>

                          <Row className="g-2">
                            <Col md={6}>
                              <Form.Select
                                value={labSession.day}
                                onChange={e => {
                                  setLabSession({ ...labSession, day: e.target.value });
                                  if (errors.labSession) setErrors({ ...errors, labSession: undefined });
                                }}
                                style={{ borderColor: '#87CEEB' }}
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
                                style={{ borderColor: '#87CEEB' }}
                              >
                                <option value="">Select 2-Hour Block</option>
                                {allTimeSlots
                                  .filter(t => {
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

                    <div className="d-flex gap-2">
                      <Button
                        type="submit"
                        className="border-0 shadow-sm"
                        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', color: 'white' }}
                        disabled={isLoading}
                      >
                        {isLoading ? (editingCourse ? 'Updating...' : 'Adding...') : (editingCourse ? 'Update Course' : 'Add Course to Schedule')}
                      </Button>
                      {editingCourse && (
                        <Button
                          type="button"
                          className="border-0"
                          style={{ background: '#b0c4d4', color: '#1e3a5f' }}
                          onClick={() => {
                            handleCourseSelect('');
                            setEditingCourse(null);
                          }}
                        >
                          Cancel Edit
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Form>
            </Card.Body>
          </Card>
        </Container>
      </div>
    </Layout>
  );
};

export default EditSchedule;