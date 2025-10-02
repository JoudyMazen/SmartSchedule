import React, { useState, useEffect } from 'react';
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
}

interface TimeSlot {
  time_slot: string;
}

interface Day {
  day: string;
}

const SchedulingCommitteeHomePage: React.FC = () => {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger', message: string} | null>(null);
  
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
  }, [selectedLevel]);

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
      const groups = getGroupsForLevel(selectedLevel);
      const allSchedules: ScheduleEntry[] = [];
      
      for (const groupNum of groups) {
        const response = await fetch(`/api/scheduleCommittee/scheduleCommitteeHomePage?level=${selectedLevel}&group=${groupNum}`);
        const data = await response.json();
        if (data.success && data.schedules) {
          allSchedules.push(...data.schedules.map((s: any) => ({ ...s, group_num: groupNum })));
        }
      }
      
      setScheduleData(allSchedules);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setAlert({type: 'danger', message: 'Error fetching schedule data'});
    } finally {
      setIsLoading(false);
    }
  };

  const generateAISchedule = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: selectedLevel })
      });
      
      const data = await response.json();
      if (data.success) {
        setAlert({type: 'success', message: 'AI schedule generated successfully!'});
        fetchSchedule();
      } else {
        setAlert({type: 'danger', message: data.message || 'Failed to generate schedule'});
      }
    } catch (error) {
      console.error('Error generating AI schedule:', error);
      setAlert({type: 'danger', message: 'Error generating AI schedule'});
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEntry = async (entry: ScheduleEntry) => {
    if (!confirm('Are you sure you want to delete this schedule entry?')) return;

    try {
      const response = await fetch(
        `/api/scheduleCommittee/scheduleCommitteeHomePage?schedule_id=${entry.schedule_id}&section_num=${entry.section_num}&time_slot=${encodeURIComponent(entry.time_slot)}&day=${entry.day}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success) {
        setAlert({ type: 'success', message: 'Schedule entry deleted successfully!' });
        fetchSchedule();
      } else {
        setAlert({ type: 'danger', message: data.error || 'Failed to delete entry.' });
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      setAlert({ type: 'danger', message: 'Network error.' });
    }
  };

  const getScheduleEntry = (groupNum: number, day: string, timeSlot: string) => {
    return scheduleData.find(
      entry => entry.group_num === groupNum && entry.day === day && entry.time_slot === timeSlot
    );
  };

  const renderScheduleTab = () => {
    const groups = getGroupsForLevel(selectedLevel);
    
    return (
      <div>
        <Row className="mb-4">
          <Col md={4}>
            <Card style={{ background: '#F5EFEB' }}>
              <Card.Body>
                <h6 style={{ color: '#2F4156' }}>Select Level</h6>
                <Form.Select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(parseInt(e.target.value))}
                  style={{ borderColor: '#2F4156' }}
                >
                  {levels.map(level => (
                    <option key={level} value={level}>Level {level}</option>
                  ))}
                </Form.Select>
              </Card.Body>
            </Card>
          </Col>
          <Col md={8}>
            <Card style={{ background: '#F5EFEB' }}>
              <Card.Body>
                <h6 style={{ color: '#2F4156' }}>Actions</h6>
                <div className="d-flex gap-2">
                  <Button 
                    variant="success" 
                    size="sm"
                    onClick={generateAISchedule}
                    disabled={isLoading}
                  >
                    <i className="bi bi-magic me-1"></i>
                    Generate AI Schedule
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={() => router.push('/scheduleCommittee/AddOtherDepartment')}
                  >
                    <i className="bi bi-plus-circle me-1"></i>
                    Add Other Department
                  </Button>
                  <Button variant="secondary" size="sm" onClick={fetchSchedule}>
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Refresh
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {groups.map(groupNum => (
          <Card key={groupNum} className="shadow-sm mb-4">
            <Card.Header style={{ background: '#2F4156', color: 'white' }}>
              <h5 className="mb-0">
                <i className="bi bi-calendar-week me-2"></i>
                Level {selectedLevel} - Group {groupNum}
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              <Table bordered responsive className="mb-0">
                <thead style={{ background: '#F5EFEB' }}>
                  <tr>
                    <th style={{ width: '120px', background: '#567C8D', color: 'white' }}>Time/Day</th>
                    {days.map(d => (
                      <th key={d.day} className="text-center" style={{ color: '#2F4156' }}>{d.day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(ts => (
                    <tr key={ts.time_slot}>
                      <td className="fw-bold text-center align-middle" style={{ background: '#C8D9E6', color: '#2F4156', fontSize: '0.85rem' }}>
                        {ts.time_slot}
                      </td>
                      {days.map(d => {
                        const entry = getScheduleEntry(groupNum, d.day, ts.time_slot);
                        return (
                          <td
                            key={`${d.day}-${ts.time_slot}`}
                            className="text-center align-middle"
                            style={{
                              minHeight: '80px',
                              background: entry ? '#e3f2fd' : 'white',
                              padding: '8px'
                            }}
                          >
                            {entry ? (
                              <div className="position-relative">
                                <div className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>{entry.course_code}</div>
                                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>{entry.course_name}</div>
                                <div className="small" style={{ fontSize: '0.75rem' }}>Sec {entry.section_num}</div>
                                {entry.room && <div className="small text-secondary" style={{ fontSize: '0.7rem' }}>{entry.room}</div>}
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="mt-1"
                                  style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                  onClick={() => handleDeleteEntry(entry)}
                                >
                                  <i className="bi bi-trash"></i>
                                </Button>
                              </div>
                            ) : (
                              <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                -
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <Container className="py-4">
        {alert && (
          <Alert variant={alert.type} onClose={() => setAlert(null)} dismissible>
            {alert.message}
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center p-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Loading schedule data...</p>
          </div>
        ) : (
          renderScheduleTab()
        )}
      </Container>
    </Layout>
  );
};

export default SchedulingCommitteeHomePage;