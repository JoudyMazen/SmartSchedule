import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner, Modal } from 'react-bootstrap';
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
}

interface TimeSlot {
  time_slot: string;
}

interface Day {
  day: string;
}

interface Course {
  course_code: string;
  course_name: string;
  level: number;
  lecture_hours: number;
  tutorial_hours: number;
  lab_hours: number;
}

interface SessionInput {
  day: string;
  time_slot: string;
  originalDay?: string;
  originalTimeSlot?: string;
}

const SchedulingCommitteeHomePage: React.FC = () => {
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [allTimeSlots, setAllTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger' | 'warning', message: string} | null>(null);
  const addCourseFormRef = React.useRef<HTMLDivElement>(null);
  
  // Modal states
  const [showEditScheduleModal, setShowEditScheduleModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  
  // Add course form state
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lectureSection, setLectureSection] = useState('');
  const [lectureSessions, setLectureSessions] = useState<SessionInput[]>([]);
  const [tutorialSection, setTutorialSection] = useState('');
  const [tutorialSession, setTutorialSession] = useState<SessionInput>({ day: '', time_slot: '' });
  const [labSection, setLabSection] = useState('');
  const [labSession, setLabSession] = useState<SessionInput>({ day: '', time_slot: '' });
  const [errors, setErrors] = useState<any>({});

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

  const filterTimeSlots = (slots: TimeSlot[]): TimeSlot[] => {
    return slots.filter(slot => {
      const [startTime, endTime] = slot.time_slot.split('-').map(t => t.trim());
      const [startHourStr, startMinStr] = startTime.split(':');
      const [endHourStr, endMinStr] = endTime.split(':');
      const startHour = parseInt(startHourStr);
      const startMin = parseInt(startMinStr);
      const endHour = parseInt(endHourStr);
      const endMin = parseInt(endMinStr);
      const startTotalMin = startHour * 60 + startMin;
      const endTotalMin = endHour * 60 + endMin;
      const durationMin = endTotalMin - startTotalMin;
      if (durationMin !== 50) return false;
      if (startHour < 8 || startHour > 14) return false;
      return true;
    });
  };

  useEffect(() => {
    fetchTimeSlots();
    fetchDays();
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [selectedLevel]);

  const fetchTimeSlots = async () => {
    try {
      const response = await fetch('/api/data/timeSlots');
      const data = await response.json();
      if (data.success) {
        setAllTimeSlots(data.timeSlots);
        const filtered = filterTimeSlots(data.timeSlots);
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
      const response = await fetch('/api/data/courses');
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
    setEditingCourse(null);
  };

  const handleEditCourse = (courseCode: string) => {
    const courseEntries = scheduleData.filter(e => e.course_code === courseCode && e.group_num === selectedGroup);
    if (courseEntries.length === 0) return;

    const course = courses.find(c => c.course_code === courseCode);
    if (!course) return;

    setSelectedCourse(course);
    setEditingCourse(courseCode);

    // Populate lecture sessions
    const lectureEntries = courseEntries.filter(e => e.activity_type === 'Lecture');
    if (lectureEntries.length > 0) {
      setLectureSection(lectureEntries[0].section_num.toString());
      setLectureSessions(lectureEntries.map(e => ({
        day: e.day,
        time_slot: e.time_slot,
        originalDay: e.day,
        originalTimeSlot: e.time_slot
      })));
    }

    // Populate tutorial session
    const tutorialEntry = courseEntries.find(e => e.activity_type === 'Tutorial');
    if (tutorialEntry) {
      setTutorialSection(tutorialEntry.section_num.toString());
      setTutorialSession({
        day: tutorialEntry.day,
        time_slot: tutorialEntry.time_slot,
        originalDay: tutorialEntry.day,
        originalTimeSlot: tutorialEntry.time_slot
      });
    }

    // Populate lab session
    const labEntry = courseEntries.find(e => e.activity_type === 'Lab');
    if (labEntry) {
      setLabSection(labEntry.section_num.toString());
      setLabSession({
        day: labEntry.day,
        time_slot: labEntry.time_slot,
        originalDay: labEntry.day,
        originalTimeSlot: labEntry.time_slot
      });
    }

    setErrors({});
    
    // Scroll to the form
    setTimeout(() => {
      addCourseFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    if (!selectedCourse) {
      setErrors({ general: 'Please select a course' });
      return;
    }

    const allEntries: any[] = [];

    // Validate and collect Lecture entries
    if (selectedCourse.lecture_hours > 0) {
      if (!lectureSection || lectureSection.length !== 5) {
        setErrors({ lectureSection: 'Enter lecture section' });
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

    // Validate and collect Tutorial entry
    if (selectedCourse.tutorial_hours > 0) {
      if (!tutorialSection || tutorialSection.length !== 5) {
        setErrors({ tutorialSection: 'Tutorial section must be exactly 5 digits' });
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

    // Validate and collect Lab entry
    if (selectedCourse.lab_hours > 0) {
      if (!labSection || labSection.length !== 5) {
        setErrors({ labSection: 'Lab section must be exactly 5 digits' });
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
      // If editing, first try to add new entries to check for conflicts
      // Only delete old entries if new ones succeed
      if (editingCourse) {
        // Try adding new entries first
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
          // If there's a conflict, don't delete the old entries
          setErrors({ general: failures[0].error || 'Failed to update. There may be a scheduling conflict.' });
          setIsLoading(false);
          return;
        }

        // If all new entries succeeded, now delete the old entries
        const scheduleId = scheduleData.find(e => e.course_code === editingCourse && e.group_num === selectedGroup)?.schedule_id;
        if (scheduleId) {
          await fetch(
            `/api/scheduleCommittee/AddOtherDepartment?schedule_id=${scheduleId}&course_code=${editingCourse}`,
            { method: 'DELETE' }
          );
        }

        setAlert({ type: 'success', message: 'Course updated successfully!' });
      } else {
        // Adding new course - normal flow
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
          setErrors({ general: failures[0].error });
          setIsLoading(false);
          return;
        }

        setAlert({ type: 'success', message: 'Course added successfully!' });
      }

      handleCourseSelect('');
      setEditingCourse(null);
      fetchSchedule();
    } catch (err) {
      console.error(err);
      setErrors({ general: 'Network error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (entry: ScheduleEntry) => {
    if (!confirm(`Delete this ${entry.activity_type} session?`)) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/scheduleCommittee/scheduleCommitteeHomePage?schedule_id=${entry.schedule_id}&section_num=${entry.section_num}&time_slot=${encodeURIComponent(entry.time_slot)}&day=${entry.day}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success) {
        setAlert({ type: 'success', message: 'Session deleted successfully' });
        fetchSchedule();
      } else {
        setAlert({ type: 'danger', message: data.error || 'Failed to delete session' });
      }
    } catch (err) {
      setAlert({ type: 'danger', message: 'Error deleting session' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCourse = async (courseCode: string, scheduleId: number) => {
    if (!confirm(`Delete all sessions for ${courseCode}?`)) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/scheduleCommittee/AddOtherDepartment?schedule_id=${scheduleId}&course_code=${courseCode}`,
        { method: 'DELETE' }
      );
      
      const data = await response.json();
      if (data.success) {
        setAlert({ type: 'success', message: data.message });
        fetchSchedule();
      } else {
        setAlert({ type: 'danger', message: data.error });
      }
    } catch (err) {
      setAlert({ type: 'danger', message: 'Error deleting course' });
    } finally {
      setIsLoading(false);
    }
  };
// Add this to your SchedulingCommitteeHomePage component

const generateAISchedule = async () => {
  if (!confirm(`Generate AI schedule for Level ${selectedLevel}? This will create optimized schedules for all groups.`)) {
    return;
  }

  setIsLoading(true);
  setAlert(null);

  try {
    const groups = getGroupsForLevel(selectedLevel);
    const results = [];

    for (const groupNum of groups) {
      const response = await fetch('/api/ai/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          level: selectedLevel,
          group: groupNum
        })
      });

      const data = await response.json();
      results.push(data);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    if (successCount > 0) {
      setAlert({
        type: 'success',
        message: `AI schedule generated successfully for ${successCount} group(s)!${failureCount > 0 ? ` ${failureCount} group(s) failed.` : ''}`
      });
      await fetchSchedule();
    } else {
      setAlert({
        type: 'danger',
        message: 'Failed to generate AI schedule. Please try again or check for conflicts.'
      });
    }
  } catch (error) {
    console.error('Error generating AI schedule:', error);
    setAlert({
      type: 'danger',
      message: 'Network error occurred while generating schedule.'
    });
  } finally {
    setIsLoading(false);
  }
};

  const shouldRenderCell = (groupNum: number, day: string, currentTimeSlot: string, currentIndex: number): { render: boolean; rowSpan: number; entry: ScheduleEntry | null } => {
    const [currentStart, currentEnd] = currentTimeSlot.split('-').map(t => t.trim());
    const currentStartHour = parseInt(currentStart.split(':')[0]);
    const currentStartMin = parseInt(currentStart.split(':')[1]);

    for (const entry of scheduleData) {
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

  const getGroupedEntriesForModal = () => {
    const filteredEntries = scheduleData.filter(e => e.group_num === selectedGroup);
    return filteredEntries.reduce((acc, entry) => {
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

  const renderScheduleTab = () => {
    const groups = getGroupsForLevel(selectedLevel);

    return (
      <div>
        <Row className="mb-4 g-3">
          <Col lg={3} md={4}>
            <Card className="border-0 shadow-sm h-100" style={{ background: '#f8f9fa' }}>
              <Card.Body>
                <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>Select Level</h6>
                <Form.Select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(parseInt(e.target.value))}
                  className="border-2"
                  style={{
                    borderColor: '#87CEEB',
                    color: '#1e3a5f',
                    fontSize: '0.95rem'
                  }}
                >
                  {levels.map(level => (
                    <option key={level} value={level}>Level {level}</option>
                  ))}
                </Form.Select>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={9} md={8}>
            <Card className="border-0 shadow-sm h-100" style={{ background: '#f8f9fa' }}>
              <Card.Body>
                <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>Actions</h6>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    className="border-0 shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                      color: 'white',
                      padding: '8px 20px',
                      fontSize: '0.9rem'
                    }}
                    onClick={() => {
                      setSelectedGroup(groups[0]);
                      handleCourseSelect('');
                      setShowEditScheduleModal(true);
                    }}
                  >
                    <i className="bi bi-pencil-square me-2"></i>
                    Edit Schedule
                  </Button>
                  <Button
                    className="border-0 shadow-sm"
                    style={{
                      background: '#87CEEB',
                      color: '#1e3a5f',
                      padding: '8px 20px',
                      fontSize: '0.9rem'
                    }}
                    onClick={generateAISchedule}
                    disabled={isLoading}
                  >
                    <i className="bi bi-magic me-2"></i>
                    Generate AI Schedule
                  </Button>
                  <Button
                    className="border-0 shadow-sm"
                    style={{
                      background: '#b0c4d4',
                      color: '#1e3a5f',
                      padding: '8px 20px',
                      fontSize: '0.9rem'
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
                    {timeSlots.map((ts, idx) => (
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
                          const cellInfo = shouldRenderCell(groupNum, d.day, ts.time_slot, idx);
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
                                      fontSize: '0.95rem',
                                      color: '#1e3a5f'
                                    }}
                                  >
                                    {entry.time_slot}
                                  </div>
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
                                  <div
                                    className="small mt-1"
                                    style={{
                                      fontSize: '0.75rem',
                                      color: '#1e3a5f'
                                    }}
                                  >
                                    Section {entry.section_num}
                                  </div>
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
              Schedule Management
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
              View and manage course schedules by level and group (08:00 - 14:50)
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

          {isLoading ? (
            <div className="text-center p-5">
              <Spinner animation="border" style={{ color: '#1e3a5f' }} />
              <p className="mt-3" style={{ color: '#1e3a5f' }}>Loading schedule data...</p>
            </div>
          ) : (
            renderScheduleTab()
          )}
        </Container>
      </div>

      {/* Edit Schedule Modal */}
      <Modal show={showEditScheduleModal} onHide={() => setShowEditScheduleModal(false)} size="xl" style={{ maxWidth: '95%' }}>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }} className="text-white">
          <Modal.Title className="fw-semibold">
            <i className="bi bi-pencil-square me-2"></i>
            Edit Schedule - Level {selectedLevel}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: 'white', maxHeight: '80vh', overflowY: 'auto' }}>
          {/* Group Selection */}
          <Card className="mb-4 border-0 shadow-sm">
            <Card.Body>
              <Row className="align-items-center">
                <Col md={3}>
                  <Form.Label className="fw-semibold mb-0" style={{ color: '#1e3a5f' }}>Select Group</Form.Label>
                </Col>
                <Col md={9}>
                  <Form.Select
                    value={selectedGroup}
                    onChange={(e) => {
                      setSelectedGroup(parseInt(e.target.value));
                      handleCourseSelect('');
                    }}
                    style={{ borderColor: '#87CEEB', color: '#1e3a5f' }}
                  >
                    {getGroupsForLevel(selectedLevel).map(g => (
                      <option key={g} value={g}>Group {g}</option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Current Schedule Entries - Moved to top */}
          <Card className="mb-4 border-0 shadow-sm">
            <Card.Header style={{ background: '#b0c4d4', color: '#1e3a5f', border: 'none' }} className="py-3">
              <h6 className="mb-0 fw-semibold">
                <i className="bi bi-list-ul me-2"></i>
                Current Schedule - Level {selectedLevel}, Group {selectedGroup}
              </h6>
            </Card.Header>
            <Card.Body className="p-0">
              {Object.keys(getGroupedEntriesForModal()).length === 0 ? (
                <div className="text-center p-5 text-muted">
                  <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <p className="mt-3">No courses scheduled yet</p>
                </div>
              ) : (
                Object.entries(getGroupedEntriesForModal()).map(([courseCode, data]) => {
                  const groupedBySection = data.entries.reduce((acc, entry) => {
                    const key = `${entry.section_num}-${entry.activity_type || 'General'}`;
                    if (!acc[key]) {
                      acc[key] = {
                        section_num: entry.section_num,
                        activity_type: entry.activity_type || 'General',
                        sessions: [],
                        entries: []
                      };
                    }
                    acc[key].sessions.push({
                      day: entry.day,
                      time_slot: entry.time_slot
                    });
                    acc[key].entries.push(entry);
                    return acc;
                  }, {} as Record<string, { section_num: number; activity_type: string; sessions: { day: string; time_slot: string }[]; entries: ScheduleEntry[] }>);

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

          {/* Add/Edit Course Section */}
          <Card className="border-0 shadow-sm" ref={addCourseFormRef}>
            <Card.Header style={{ background: '#87CEEB', color: '#1e3a5f', border: 'none' }} className="py-3">
              <h6 className="mb-0 fw-semibold">
                <i className="bi bi-plus-circle me-2"></i>
                {editingCourse ? `Edit ${editingCourse}` : 'Add New Course'}
              </h6>
            </Card.Header>
            <Card.Body className="p-4">
              {errors.general && (
                <Alert variant="danger" className="mb-3">
                  {errors.general}
                </Alert>
              )}
              
              <Form onSubmit={handleSaveCourse}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Select Course</Form.Label>
                  <Form.Select
                    value={selectedCourse?.course_code || ''}
                    onChange={e => handleCourseSelect(e.target.value)}
                    style={{ borderColor: '#87CEEB' }}
                    disabled={!!editingCourse}
                  >
                    <option value="">Choose a course to add...</option>
                    {courses.filter(c => c.level === selectedLevel).map(c => (
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

                    {/* Lecture Section */}
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
                              Sessions (Add up to {selectedCourse.lecture_hours} hours)
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
                                    {allTimeSlots.map(t => (
                                      <option key={t.time_slot} value={t.time_slot}>{t.time_slot}</option>
                                    ))}
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

                    {/* Tutorial Section */}
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
                                {allTimeSlots
                                  .filter(t => {
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

                    {/* Lab Section */}
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
                                {allTimeSlots
                                  .filter(t => {
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
        </Modal.Body>
        <Modal.Footer style={{ background: 'white', borderTop: '1px solid #dee2e6' }}>
          <Button
            className="border-0"
            style={{ background: '#b0c4d4', color: '#1e3a5f', padding: '8px 20px' }}
            onClick={() => {
              setShowEditScheduleModal(false);
              handleCourseSelect('');
              setEditingCourse(null);
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
};

export default SchedulingCommitteeHomePage;